import hmac
import hashlib
import json
import time
import uuid
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
from ..utils.sanitizer import sanitize_payment_data, extract_card_summary
from ..utils.logger import payment_logger


class SimulatedPaymentAdapter(BasePaymentAdapter):
    """
    Safe Test-Mode Payment Provider / Simulated Adapter for local development and CI testing.
    
    Guarantees:
    - Never requires real bank credentials or external network connectivity.
    - Strictly forbids raw card numbers or CVV storage.
    - Supports simulated payment tokens (e.g. tok_test_success, tok_test_declined, tok_test_pending).
    - Cryptographically validates simulated webhook signatures via HMAC-SHA256.
    - Handles all payment states: pending, successful, failed, cancelled, and refunded.
    """
    gateway_name = 'simulated'

    def __init__(self, webhook_secret: Optional[str] = None):
        self.webhook_secret = (
            webhook_secret or
            getattr(settings, 'SIMULATED_WEBHOOK_SECRET', None) or
            getattr(settings, 'SECRET_KEY', 'simulated-secret-key-fallback')
        )
        # In-memory deterministic registry for simulating server-to-server gateway queries
        self._simulated_records: Dict[str, Dict[str, Any]] = {}

    @property
    def is_configured(self) -> bool:
        """Simulated provider is always safely configured for test-mode and local dev."""
        return True

    def get_configuration_status(self) -> Dict[str, Any]:
        return {
            'gateway_name': self.gateway_name,
            'is_configured': True,
            'mode': 'test_simulated',
            'is_live': False,
            'supported_countries': ['US', 'CA', 'GB', 'EU', 'AU', 'NZ', 'Global (Simulated)'],
            'supported_currencies': ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
            'supported_payment_methods': ['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'STRIPE'],
            'unconfigured_items': [],
            'message': 'Simulated test-mode payment provider is active. Safe for local development and testing.',
        }

    def create_payment_intent(
        self,
        order,
        payment_method: str = 'CREDIT_CARD',
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentIntentResult:
        intent_id = f"sim_pi_{uuid.uuid4().hex[:16]}"
        client_secret = f"{intent_id}_secret_{uuid.uuid4().hex[:12]}"
        meta = metadata or {}
        meta.update({
            'order_number': order.order_number,
            'order_id': str(order.id),
        })

        # Store simulated intent state
        self._simulated_records[intent_id] = {
            'intent_id': intent_id,
            'order_number': order.order_number,
            'amount': order.total_amount,
            'currency': order.currency,
            'status': 'requires_confirmation',
            'payment_method': payment_method,
            'metadata': meta,
        }

        payment_logger.info(
            f"[SimulatedGateway] Created payment intent {intent_id} for order {order.order_number} "
            f"amount={order.total_amount} {order.currency}"
        )

        return PaymentIntentResult(
            success=True,
            intent_id=intent_id,
            client_secret=client_secret,
            status='requires_confirmation',
            amount=order.total_amount,
            currency=order.currency,
            metadata=meta,
        )

    def confirm_payment(
        self,
        transaction_id: str,
        payment_token: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> PaymentVerificationResult:
        opts = options or {}
        token = str(payment_token or opts.get('token') or 'tok_test_success').strip().lower()
        amount = opts.get('amount', Decimal('0.00'))
        currency = opts.get('currency', 'USD')

        # Check simulation triggers based on safe tokens
        is_declined = (
            'decline' in token or
            'fail' in token or
            token.endswith('0002') or
            opts.get('simulate_failure') is True
        )
        is_insufficient_funds = 'insufficient' in token
        is_pending = 'pending' in token
        is_cancelled = 'cancel' in token

        card_info = extract_card_summary(token)

        if is_declined:
            result = PaymentVerificationResult(
                success=False,
                transaction_id=transaction_id,
                status='FAILED',
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                card_brand=card_info['card_brand'],
                card_last4=card_info['card_last4'],
                raw_response={
                    'decline_code': 'card_declined',
                    'message': 'The test card was declined by simulated issuer bank.',
                },
                error_code='CARD_DECLINED',
                error_message='The simulated payment card was declined by the bank.',
            )
        elif is_insufficient_funds:
            result = PaymentVerificationResult(
                success=False,
                transaction_id=transaction_id,
                status='FAILED',
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                card_brand=card_info['card_brand'],
                card_last4=card_info['card_last4'],
                raw_response={
                    'decline_code': 'insufficient_funds',
                    'message': 'The test card has insufficient funds.',
                },
                error_code='INSUFFICIENT_FUNDS',
                error_message='Insufficient funds on the simulated payment card.',
            )
        elif is_cancelled:
            result = PaymentVerificationResult(
                success=False,
                transaction_id=transaction_id,
                status='CANCELLED',
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                raw_response={'message': 'Payment was cancelled by the user.'},
                error_code='PAYMENT_CANCELLED',
                error_message='Simulated payment session was cancelled.',
            )
        elif is_pending:
            result = PaymentVerificationResult(
                success=True,
                transaction_id=transaction_id,
                status='PENDING',
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                card_brand=card_info['card_brand'],
                card_last4=card_info['card_last4'],
                raw_response={
                    'status': 'requires_action',
                    'message': 'Payment is pending asynchronous customer verification.',
                },
            )
        else:
            # Default: SUCCESSFUL
            result = PaymentVerificationResult(
                success=True,
                transaction_id=transaction_id,
                status='SUCCESSFUL',
                amount=amount,
                currency=currency,
                gateway_name=self.gateway_name,
                card_brand=card_info['card_brand'],
                card_last4=card_info['card_last4'],
                raw_response={
                    'status': 'succeeded',
                    'charge_id': f"ch_{uuid.uuid4().hex[:12]}",
                    'risk_level': 'normal',
                },
            )

        # Cache simulated record for verify_payment lookups
        self._simulated_records[transaction_id] = {
            'transaction_id': transaction_id,
            'status': result.status,
            'amount': result.amount,
            'currency': result.currency,
            'gateway_name': self.gateway_name,
            'card_brand': result.card_brand,
            'card_last4': result.card_last4,
            'raw_response': result.raw_response,
            'error_code': result.error_code,
            'error_message': result.error_message,
        }

        payment_logger.info(
            f"[SimulatedGateway] Confirmed transaction {transaction_id}: status={result.status}, "
            f"success={result.success}"
        )
        return result

    def verify_payment(self, transaction_id: str) -> PaymentVerificationResult:
        """
        Direct server-side verification of transaction state.
        Never relies on client claim.
        """
        record = self._simulated_records.get(transaction_id)
        if record:
            return PaymentVerificationResult(
                success=(record['status'] in ('SUCCESSFUL', 'COMPLETED')),
                transaction_id=transaction_id,
                status=record['status'],
                amount=record['amount'],
                currency=record['currency'],
                gateway_name=self.gateway_name,
                card_brand=record.get('card_brand', 'Visa'),
                card_last4=record.get('card_last4', '4242'),
                raw_response=record.get('raw_response', {}),
                error_code=record.get('error_code'),
                error_message=record.get('error_message'),
            )

        # If not in cache, fallback to deterministic evaluation from transaction_id suffix
        if 'fail' in transaction_id.lower() or transaction_id.endswith('0002'):
            return PaymentVerificationResult(
                success=False,
                transaction_id=transaction_id,
                status='FAILED',
                amount=Decimal('0.00'),
                currency='USD',
                gateway_name=self.gateway_name,
                error_code='TRANSACTION_FAILED',
                error_message='Simulated transaction verification resolved to FAILED.',
            )

        return PaymentVerificationResult(
            success=True,
            transaction_id=transaction_id,
            status='SUCCESSFUL',
            amount=Decimal('0.00'),
            currency='USD',
            gateway_name=self.gateway_name,
            raw_response={'status': 'verified_succeeded'},
        )

    def process_refund(
        self,
        payment,
        amount: Optional[Decimal] = None,
        reason: str = ''
    ) -> RefundResult:
        refund_amount = amount or payment.amount
        refund_id = f"sim_ref_{uuid.uuid4().hex[:14]}"

        if refund_amount > payment.amount:
            return RefundResult(
                success=False,
                refund_id='',
                status='failed',
                amount=refund_amount,
                currency=payment.currency,
                error_code='EXCESSIVE_REFUND',
                error_message=f"Refund amount {refund_amount} exceeds original payment amount {payment.amount}.",
            )

        # Update simulated record
        if payment.transaction_id in self._simulated_records:
            self._simulated_records[payment.transaction_id]['status'] = 'REFUNDED'

        payment_logger.info(
            f"[SimulatedGateway] Processed refund {refund_id} for payment {payment.transaction_id}, "
            f"amount={refund_amount} {payment.currency}"
        )

        return RefundResult(
            success=True,
            refund_id=refund_id,
            status='succeeded',
            amount=refund_amount,
            currency=payment.currency,
            raw_response={
                'refund_id': refund_id,
                'status': 'succeeded',
                'reason': reason or 'Customer request',
            },
        )

    def generate_webhook_signature(self, payload_bytes: bytes, timestamp: Optional[int] = None) -> str:
        """
        Utility for generating valid test webhook signatures.
        Format: t=<timestamp>,v1=<hmac_sha256_hex>
        """
        ts = int(time.time()) if timestamp is None else timestamp
        signed_payload = f"t={ts}.".encode('utf-8') + payload_bytes
        signature = hmac.new(
            self.webhook_secret.encode('utf-8'),
            signed_payload,
            hashlib.sha256
        ).hexdigest()
        return f"t={ts},v1={signature}"

    def verify_webhook_signature(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Verifies HMAC-SHA256 webhook signature.
        Header checked: X-Webhook-Signature or Stripe-Signature
        """
        sig_header = (
            headers.get('X-Webhook-Signature') or
            headers.get('x-webhook-signature') or
            headers.get('Stripe-Signature') or
            headers.get('stripe-signature') or
            ''
        )
        if not sig_header:
            payment_logger.warning("[SimulatedGateway] Missing webhook signature header.")
            return False

        try:
            # Parse t=...,v1=...
            parts = dict(item.strip().split('=', 1) for item in sig_header.split(',') if '=' in item)
            ts = parts.get('t')
            v1_sig = parts.get('v1')
            if not ts or not v1_sig:
                payment_logger.warning("[SimulatedGateway] Malformed webhook signature header.")
                return False

            signed_payload = f"t={ts}.".encode('utf-8') + payload_bytes
            expected_sig = hmac.new(
                self.webhook_secret.encode('utf-8'),
                signed_payload,
                hashlib.sha256
            ).hexdigest()

            is_valid = hmac.compare_digest(expected_sig, v1_sig)
            if not is_valid:
                payment_logger.warning("[SimulatedGateway] Invalid webhook signature detected.")
            return is_valid
        except Exception as exc:
            payment_logger.error(f"[SimulatedGateway] Exception during webhook signature validation: {exc}")
            return False

    def parse_webhook_event(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> NormalizedWebhookEvent:
        """
        Parses simulated webhook payload into NormalizedWebhookEvent.
        """
        try:
            data = json.loads(payload_bytes.decode('utf-8'))
        except Exception as exc:
            raise ValueError(f"Invalid JSON webhook payload: {exc}")

        event_id = data.get('id') or f"evt_{uuid.uuid4().hex[:12]}"
        event_type = data.get('type') or 'payment.succeeded'
        payload_obj = data.get('data', {}).get('object', data)

        transaction_id = (
            payload_obj.get('transaction_id') or
            payload_obj.get('id') or
            f"TXN-{uuid.uuid4().hex[:10].upper()}"
        )
        order_number = (
            payload_obj.get('order_number') or
            payload_obj.get('metadata', {}).get('order_number')
        )
        amount_raw = payload_obj.get('amount')
        amount = Decimal(str(amount_raw)) if amount_raw is not None else None
        currency = payload_obj.get('currency', 'USD').upper()

        # Map event type to normalized payment status
        if event_type in ('payment.succeeded', 'payment_intent.succeeded', 'charge.succeeded'):
            status = 'SUCCESSFUL'
        elif event_type in ('payment.failed', 'payment_intent.payment_failed', 'charge.failed'):
            status = 'FAILED'
        elif event_type in ('payment.cancelled', 'payment_intent.canceled'):
            status = 'CANCELLED'
        elif event_type in ('payment.refunded', 'charge.refunded'):
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
