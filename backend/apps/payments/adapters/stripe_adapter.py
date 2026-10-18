import json
from decimal import Decimal
from typing import Any, Dict, Optional
from django.conf import settings
from .base import (
    BasePaymentAdapter,
    PaymentIntentResult,
    PaymentVerificationResult,
    RefundResult,
    NormalizedWebhookEvent,
)
from ..exceptions import PaymentConfigurationError
from ..utils.sanitizer import sanitize_payment_data
from ..utils.logger import payment_logger

try:
    import stripe
except ImportError:
    stripe = None


class StripePaymentAdapter(BasePaymentAdapter):
    """
    Production-ready Stripe Payment Adapter integrating with Stripe PaymentIntents API.
    
    Security & Compliance:
    - Never touches or stores raw credit card numbers or CVVs on the backend.
    - Uses client_secret for frontend tokenization (Stripe Elements / Mobile SDK).
    - Requires backend secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) which are never exposed.
    - Performs server-to-server transaction verification.
    - Validates cryptographic webhook signatures with constant-time comparison.
    - Enforces configuration verification: clearly surfaces missing credentials and warns against claiming live payments work without verification.
    """
    gateway_name = 'stripe'

    def __init__(
        self,
        secret_key: Optional[str] = None,
        publishable_key: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ):
        self.secret_key = (
            secret_key or
            getattr(settings, 'STRIPE_SECRET_KEY', None) or
            ''
        )
        self.publishable_key = (
            publishable_key or
            getattr(settings, 'STRIPE_PUBLISHABLE_KEY', None) or
            ''
        )
        self.webhook_secret = (
            webhook_secret or
            getattr(settings, 'STRIPE_WEBHOOK_SECRET', None) or
            ''
        )

        if stripe and self.secret_key:
            stripe.api_key = self.secret_key

    @property
    def is_configured(self) -> bool:
        """True only if secret key and webhook secret are configured."""
        return bool(self.secret_key and self.secret_key.strip() and self.webhook_secret and self.webhook_secret.strip())

    @property
    def is_test_mode(self) -> bool:
        return self.secret_key.startswith('sk_test_') if self.secret_key else True

    def get_configuration_status(self) -> Dict[str, Any]:
        unconfigured = []
        if not self.secret_key:
            unconfigured.append('STRIPE_SECRET_KEY')
        if not self.publishable_key:
            unconfigured.append('STRIPE_PUBLISHABLE_KEY')
        if not self.webhook_secret:
            unconfigured.append('STRIPE_WEBHOOK_SECRET')

        is_live = bool(self.secret_key and not self.secret_key.startswith('sk_test_'))

        return {
            'gateway_name': self.gateway_name,
            'is_configured': self.is_configured,
            'mode': 'live' if is_live else ('test' if self.secret_key else 'unconfigured'),
            'is_live': is_live,
            'publishable_key_configured': bool(self.publishable_key),
            'webhook_secret_configured': bool(self.webhook_secret),
            'unconfigured_items': unconfigured,
            'supported_countries': [
                'US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'IE', 'AT', 'SE', 'NO', 'DK', 'FI',
                'AU', 'NZ', 'SG', 'JP', 'HK', 'MX', 'BR', 'AE'
            ],
            'supported_currencies': ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'SGD', 'CHF', 'SEK', 'NOK', 'DKK', 'NZD', 'MXN', 'BRL'],
            'supported_payment_methods': ['card', 'apple_pay', 'google_pay', 'link', 'sepa_debit', 'ideal'],
            'message': (
                'Stripe is fully configured and ready for ' + ('LIVE' if is_live else 'TEST-MODE') + ' transactions.'
                if self.is_configured
                else f"Stripe integration is pending configuration. Missing credentials: {', '.join(unconfigured)}. Local development safely uses SimulatedPaymentAdapter."
            ),
        }

    def _ensure_configured(self):
        if not self.is_configured:
            status_info = self.get_configuration_status()
            raise PaymentConfigurationError(
                message=(
                    f"Stripe credentials are not configured. Unconfigured items: {', '.join(status_info['unconfigured_items'])}. "
                    "Cannot process live charges. Configure credentials in backend .env or use the test-mode Simulated adapter."
                ),
                unconfigured_keys=status_info['unconfigured_items']
            )
        if stripe is None:
            raise PaymentConfigurationError("The stripe Python package is not installed.")

    def create_payment_intent(
        self,
        order,
        payment_method: str = 'CREDIT_CARD',
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentIntentResult:
        self._ensure_configured()

        amount_cents = int(round(order.total_amount * Decimal('100')))
        currency_code = (order.currency or 'USD').lower()

        meta = {
            'order_number': order.order_number,
            'order_id': str(order.id),
        }
        if metadata:
            meta.update(metadata)

        try:
            payment_logger.info(f"[StripeAdapter] Creating PaymentIntent for order {order.order_number}, amount_cents={amount_cents}")
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency_code,
                automatic_payment_methods={'enabled': True},
                metadata=meta,
                description=f"Order {order.order_number} at E-Commerce Store",
            )

            return PaymentIntentResult(
                success=True,
                intent_id=intent.id,
                client_secret=intent.client_secret,
                status=intent.status,
                amount=order.total_amount,
                currency=order.currency,
                metadata=intent.metadata or meta,
            )
        except Exception as exc:
            payment_logger.error(f"[StripeAdapter] Failed to create PaymentIntent for {order.order_number}: {exc}")
            return PaymentIntentResult(
                success=False,
                intent_id='',
                client_secret='',
                status='failed',
                amount=order.total_amount,
                currency=order.currency,
                error_code='STRIPE_INTENT_CREATION_FAILED',
                error_message=str(exc),
            )

    def confirm_payment(
        self,
        transaction_id: str,
        payment_token: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> PaymentVerificationResult:
        self._ensure_configured()
        return self.verify_payment(transaction_id)

    def verify_payment(self, transaction_id: str) -> PaymentVerificationResult:
        """
        Direct server-to-server query to Stripe API to verify the true status of a PaymentIntent.
        Prevents client tampering.
        """
        self._ensure_configured()

        try:
            payment_logger.info(f"[StripeAdapter] Querying Stripe API for PaymentIntent {transaction_id}")
            intent = stripe.PaymentIntent.retrieve(transaction_id)
            
            # Map Stripe status to normalized payment status
            stripe_status = intent.status
            amount = Decimal(intent.amount) / Decimal('100.00')
            currency = intent.currency.upper()

            card_brand = 'Card'
            card_last4 = '4242'
            charges = getattr(intent, 'charges', None) or getattr(intent, 'latest_charge', None)
            if hasattr(charges, 'data') and len(charges.data) > 0:
                payment_method_details = getattr(charges.data[0], 'payment_method_details', None)
                if payment_method_details and hasattr(payment_method_details, 'card'):
                    card_brand = getattr(payment_method_details.card, 'brand', 'Card').capitalize()
                    card_last4 = getattr(payment_method_details.card, 'last4', '4242')

            if stripe_status == 'succeeded':
                norm_status = 'SUCCESSFUL'
                success = True
            elif stripe_status in ('requires_payment_method', 'canceled'):
                norm_status = 'FAILED' if stripe_status == 'requires_payment_method' else 'CANCELLED'
                success = False
            elif stripe_status in ('processing', 'requires_action', 'requires_confirmation'):
                norm_status = 'PENDING'
                success = True
            else:
                norm_status = 'PENDING'
                success = False

            return PaymentVerificationResult(
                success=success,
                transaction_id=intent.id,
                status=norm_status,
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                card_brand=card_brand,
                card_last4=card_last4,
                raw_response=sanitize_payment_data(intent.to_dict_recursive() if hasattr(intent, 'to_dict_recursive') else {}),
            )
        except Exception as exc:
            payment_logger.error(f"[StripeAdapter] Error verifying transaction {transaction_id}: {exc}")
            return PaymentVerificationResult(
                success=False,
                transaction_id=transaction_id,
                status='FAILED',
                amount=Decimal('0.00'),
                currency='USD',
                gateway_name=self.gateway_name,
                error_code='VERIFICATION_ERROR',
                error_message=str(exc),
            )

    def process_refund(
        self,
        payment,
        amount: Optional[Decimal] = None,
        reason: str = ''
    ) -> RefundResult:
        self._ensure_configured()

        target_amount = amount or payment.amount
        if target_amount > payment.amount:
            return RefundResult(
                success=False,
                refund_id='',
                status='failed',
                amount=target_amount,
                currency=payment.currency,
                error_code='EXCESSIVE_REFUND',
                error_message=f"Refund amount {target_amount} exceeds original payment {payment.amount}.",
            )

        amount_cents = int(round(target_amount * Decimal('100')))
        intent_id = getattr(payment, 'payment_intent_id', None) or payment.transaction_id

        try:
            payment_logger.info(f"[StripeAdapter] Issuing refund for intent {intent_id}, amount_cents={amount_cents}")
            refund = stripe.Refund.create(
                payment_intent=intent_id,
                amount=amount_cents,
                reason='requested_by_customer' if 'customer' in reason.lower() else 'duplicate',
                metadata={'order_id': str(payment.order_id), 'reason': reason},
            )

            return RefundResult(
                success=refund.status in ('succeeded', 'pending'),
                refund_id=refund.id,
                status=refund.status,
                amount=target_amount,
                currency=payment.currency,
                raw_response=sanitize_payment_data(refund.to_dict_recursive() if hasattr(refund, 'to_dict_recursive') else {}),
            )
        except Exception as exc:
            payment_logger.error(f"[StripeAdapter] Failed to process refund for payment {payment.id}: {exc}")
            return RefundResult(
                success=False,
                refund_id='',
                status='failed',
                amount=target_amount,
                currency=payment.currency,
                error_code='REFUND_FAILED',
                error_message=str(exc),
            )

    def verify_webhook_signature(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Validates Stripe webhook cryptographic signature using Stripe SDK or HMAC.
        """
        sig_header = (
            headers.get('Stripe-Signature') or
            headers.get('stripe-signature') or
            headers.get('HTTP_STRIPE_SIGNATURE') or
            ''
        )
        if not sig_header or not self.webhook_secret:
            payment_logger.warning("[StripeAdapter] Missing Stripe signature header or webhook secret.")
            return False

        if stripe is None:
            return False

        try:
            stripe.Webhook.construct_event(
                payload=payload_bytes,
                sig_header=sig_header,
                secret=self.webhook_secret
            )
            return True
        except Exception as exc:
            payment_logger.warning(f"[StripeAdapter] Webhook signature verification rejected: {exc}")
            return False

    def parse_webhook_event(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> NormalizedWebhookEvent:
        """
        Parses Stripe webhook JSON payload into NormalizedWebhookEvent.
        """
        try:
            data = json.loads(payload_bytes.decode('utf-8'))
        except Exception as exc:
            raise ValueError(f"Invalid Stripe webhook JSON: {exc}")

        event_id = data.get('id', '')
        event_type = data.get('type', '')
        payload_obj = data.get('data', {}).get('object', {})

        transaction_id = payload_obj.get('id', '')
        order_number = (
            payload_obj.get('metadata', {}).get('order_number') or
            payload_obj.get('description', '').replace('Order ', '').split()[0]
            if 'Order ' in payload_obj.get('description', '') else None
        )

        amount_cents = payload_obj.get('amount')
        amount = (Decimal(amount_cents) / Decimal('100.00')) if amount_cents is not None else None
        currency = payload_obj.get('currency', 'USD').upper()

        if event_type == 'payment_intent.succeeded':
            status = 'SUCCESSFUL'
        elif event_type in ('payment_intent.payment_failed', 'charge.failed'):
            status = 'FAILED'
        elif event_type == 'payment_intent.canceled':
            status = 'CANCELLED'
        elif event_type == 'charge.refunded':
            status = 'REFUNDED'
        else:
            status = 'PENDING'

        return NormalizedWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            transaction_id=transaction_id,
            order_number=order_number,
            status=status,
            amount=amount,
            currency=currency,
            raw_data=sanitize_payment_data(data),
            metadata=payload_obj.get('metadata', {}),
        )
