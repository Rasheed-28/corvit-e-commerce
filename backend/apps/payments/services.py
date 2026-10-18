import uuid
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from apps.orders.models import Order, Payment
from .models import PaymentWebhookEvent
from .adapters.base import (
    BasePaymentAdapter,
    PaymentIntentResult,
    PaymentVerificationResult,
    RefundResult,
)
from .adapters.factory import get_payment_adapter
from .exceptions import (
    DuplicatePaymentError,
    InvalidOrderStateError,
    ExcessiveRefundError,
    WebhookSignatureVerificationError,
)
from .utils.sanitizer import sanitize_payment_data, extract_card_summary
from .utils.logger import payment_logger


class PaymentService:
    """
    Centralized Payment Business Logic & Orchestration Service.
    Enforces atomic transactions, row-level locks, duplicate charge prevention,
    state machine validation, server-side gateway verification, and idempotent webhook handling.
    """

    @classmethod
    def create_payment_intent(
        cls,
        order: Order,
        payment_method: str = Payment.PaymentMethod.CREDIT_CARD,
        gateway_name: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[PaymentIntentResult, Payment]:
        """
        Initializes a server-side payment intent linked to the order.
        Guarantees that an already paid or cancelled order cannot have new payment intents created.
        """
        # Status & duplicate prevention
        if order.status in (
            Order.OrderStatus.PAID,
            Order.OrderStatus.PROCESSING,
            Order.OrderStatus.SHIPPED,
            Order.OrderStatus.DELIVERED,
        ):
            raise DuplicatePaymentError(
                f"Order {order.order_number} is already paid (status: {order.status}). New charges are prevented.",
                order_number=order.order_number
            )

        if order.status in (Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED):
            raise InvalidOrderStateError(
                f"Cannot create payment intent for order in '{order.status}' status.",
                current_status=order.status,
                order_number=order.order_number
            )

        # Check existing successful payments
        if order.payments.filter(status__in=[Payment.PaymentStatus.COMPLETED, Payment.PaymentStatus.SUCCESSFUL]).exists():
            raise DuplicatePaymentError(
                f"Order {order.order_number} already has a confirmed payment record. Duplicate charge prevented.",
                order_number=order.order_number
            )

        adapter = get_payment_adapter(gateway_name)
        intent_res = adapter.create_payment_intent(order, payment_method=payment_method, metadata=metadata)

        if not intent_res.success:
            payment_logger.error(
                f"[PaymentService] Failed to create payment intent for order {order.order_number}: {intent_res.error_message}"
            )
            # Record failed attempt for auditability
            payment = Payment.objects.create(
                order=order,
                transaction_id=f"INTENT-FAILED-{uuid.uuid4().hex[:10].upper()}",
                gateway=adapter.gateway_name,
                payment_method=payment_method,
                status=Payment.PaymentStatus.FAILED,
                amount=order.total_amount,
                currency=order.currency,
                error_code=intent_res.error_code or 'INTENT_CREATION_FAILED',
                error_message=intent_res.error_message or 'Payment intent creation failed.',
                gateway_response=sanitize_payment_data(intent_res.metadata),
            )
            return intent_res, payment

        # Record or update pending payment record with client_secret and intent_id
        payment = Payment.objects.create(
            order=order,
            transaction_id=intent_res.intent_id,
            payment_intent_id=intent_res.intent_id,
            client_secret=intent_res.client_secret,
            idempotency_key=idempotency_key,
            gateway=adapter.gateway_name,
            payment_method=payment_method,
            status=Payment.PaymentStatus.PENDING,
            amount=order.total_amount,
            currency=order.currency,
            gateway_response=sanitize_payment_data(intent_res.metadata),
        )

        payment_logger.info(
            f"[PaymentService] Initialized payment intent {intent_res.intent_id} for order {order.order_number}"
        )
        return intent_res, payment

    @classmethod
    def confirm_and_verify_payment(
        cls,
        order: Order,
        transaction_id: Optional[str] = None,
        payment_token: Optional[str] = None,
        payment_method: str = Payment.PaymentMethod.CREDIT_CARD,
        gateway_name: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[PaymentVerificationResult, Payment]:
        """
        Executes confirmation with payment adapter AND verifies results server-side.
        Applies row-level locks on Order and Payment to strictly prevent duplicate charges.
        Never marks order PAID unless gateway server confirms completion.
        """
        opts = options or {}
        card_summary = extract_card_summary(payment_token or '')

        with transaction.atomic():
            # Apply row-level lock on Order
            locked_order = Order.objects.select_for_update().get(id=order.id)

            # Prevent duplicate charge on already paid order
            if locked_order.status in (
                Order.OrderStatus.PAID,
                Order.OrderStatus.PROCESSING,
                Order.OrderStatus.SHIPPED,
                Order.OrderStatus.DELIVERED,
            ):
                raise DuplicatePaymentError(
                    f"Order {locked_order.order_number} is already '{locked_order.status}'. Duplicate charge rejected.",
                    order_number=locked_order.order_number
                )

            if locked_order.status in (Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED):
                raise InvalidOrderStateError(
                    f"Cannot process payment for order in '{locked_order.status}' status.",
                    current_status=locked_order.status,
                    order_number=locked_order.order_number
                )

            # Resolve or create payment record
            payment = None
            if transaction_id:
                payment = Payment.objects.select_for_update().filter(
                    transaction_id=transaction_id,
                    order=locked_order
                ).first()

            if not payment:
                generated_tx_id = transaction_id or f"TXN-{uuid.uuid4().hex[:12].upper()}"
                payment = Payment.objects.create(
                    order=locked_order,
                    transaction_id=generated_tx_id,
                    payment_intent_id=transaction_id or '',
                    idempotency_key=idempotency_key,
                    payment_method=payment_method,
                    gateway=gateway_name or 'simulated',
                    status=Payment.PaymentStatus.PENDING,
                    amount=locked_order.total_amount,
                    currency=locked_order.currency,
                    card_brand=card_summary['card_brand'],
                    card_last4=card_summary['card_last4'],
                )

            # Check if this specific payment record was already captured
            if payment.is_successful:
                raise DuplicatePaymentError(
                    f"Payment transaction {payment.transaction_id} is already completed.",
                    order_number=locked_order.order_number
                )

            # Call provider adapter to confirm and capture
            adapter = get_payment_adapter(payment.gateway or gateway_name)
            opts.update({
                'amount': locked_order.total_amount,
                'currency': locked_order.currency,
            })
            verification = adapter.confirm_payment(
                transaction_id=payment.transaction_id,
                payment_token=payment_token,
                options=opts
            )

            # Server-Side Verification: double-check state directly with gateway
            server_check = adapter.verify_payment(payment.transaction_id)
            final_status = server_check.status if server_check.success else verification.status

            # Update Payment Record
            payment.card_brand = verification.card_brand or payment.card_brand or 'Card'
            payment.card_last4 = verification.card_last4 or payment.card_last4 or '4242'
            payment.gateway_response = sanitize_payment_data(verification.raw_response)

            if final_status in ('SUCCESSFUL', 'COMPLETED'):
                payment.status = Payment.PaymentStatus.COMPLETED
                payment.error_code = ''
                payment.error_message = ''
                payment.save()

                # Transition Order to PAID
                locked_order.status = Order.OrderStatus.PAID
                locked_order.save(update_fields=['status', 'updated_at'])
                payment_logger.info(
                    f"[PaymentService] Payment verified for Order {locked_order.order_number}, "
                    f"tx={payment.transaction_id}, order moved to PAID."
                )
            elif final_status == 'FAILED':
                payment.status = Payment.PaymentStatus.FAILED
                payment.error_code = verification.error_code or 'PAYMENT_DECLINED'
                payment.error_message = verification.error_message or 'The payment card was declined.'
                payment.save()
                payment_logger.warning(
                    f"[PaymentService] Payment failed for Order {locked_order.order_number}: {payment.error_message}"
                )
                # Note: Order remains PENDING so the customer can retry without creating a duplicate order
            elif final_status == 'CANCELLED':
                payment.status = Payment.PaymentStatus.CANCELLED
                payment.error_code = 'PAYMENT_CANCELLED'
                payment.error_message = 'Payment was cancelled by the customer.'
                payment.save()
            else:
                # PENDING / requires action
                payment.status = Payment.PaymentStatus.PENDING
                payment.save()

            return verification, payment

    @classmethod
    def process_webhook_event(
        cls,
        provider_name: str,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Processes an incoming gateway webhook:
        1. Validates cryptographic signature.
        2. Normalizes event payload.
        3. Enforces idempotency via PaymentWebhookEvent table.
        4. Safely synchronizes payment and order states.
        5. Strictly prevents incorrect order regressions.
        """
        adapter = get_payment_adapter(provider_name)

        # 1. Cryptographic Signature Verification
        if not adapter.verify_webhook_signature(payload_bytes, headers):
            payment_logger.warning(f"[PaymentService] Webhook signature verification rejected for provider '{provider_name}'.")
            raise WebhookSignatureVerificationError("Invalid or missing webhook signature.")

        # 2. Parse Normalized Event
        event = adapter.parse_webhook_event(payload_bytes, headers)
        sanitized_payload = sanitize_payment_data(event.raw_data)

        # 3. Idempotency Check & Atomic Processing
        with transaction.atomic():
            # Check or create webhook event record with DB-level lock
            webhook_event, created = PaymentWebhookEvent.objects.select_for_update().get_or_create(
                provider=provider_name,
                event_id=event.event_id,
                defaults={
                    'event_type': event.event_type,
                    'order_number': event.order_number or '',
                    'transaction_id': event.transaction_id or '',
                    'payload': sanitized_payload,
                    'status': PaymentWebhookEvent.EventStatus.PENDING,
                }
            )

            # Idempotent skip if already processed
            if not created and webhook_event.status == PaymentWebhookEvent.EventStatus.PROCESSED:
                payment_logger.info(
                    f"[PaymentService] Webhook event '{event.event_id}' ({provider_name}) was already processed. "
                    "Skipping duplicate execution idempotently."
                )
                return {
                    'status': 'already_processed',
                    'event_id': event.event_id,
                    'event_type': event.event_type,
                }

            # 4. State Synchronization
            order = None
            if event.order_number:
                order = Order.objects.select_for_update().filter(order_number=event.order_number).first()

            payment = None
            if event.transaction_id:
                payment = Payment.objects.select_for_update().filter(transaction_id=event.transaction_id).first()

            if not order and payment:
                order = Order.objects.select_for_update().filter(id=payment.order_id).first()

            # Handle states
            if event.status == 'SUCCESSFUL':
                if payment:
                    payment.status = Payment.PaymentStatus.COMPLETED
                    payment.save(update_fields=['status', 'updated_at'])
                if order and order.status != Order.OrderStatus.PAID:
                    order.status = Order.OrderStatus.PAID
                    order.save(update_fields=['status', 'updated_at'])
                    payment_logger.info(f"[PaymentService] Webhook updated order {order.order_number} to PAID.")

            elif event.status == 'FAILED':
                if payment and not payment.is_successful:
                    payment.status = Payment.PaymentStatus.FAILED
                    payment.error_code = 'GATEWAY_WEBHOOK_FAILED'
                    payment.error_message = 'Payment failed according to gateway webhook event.'
                    payment.save(update_fields=['status', 'error_code', 'error_message', 'updated_at'])

                # SAFEGUARD: Never regress an already PAID or SHIPPED order to failed
                if order and order.status in (
                    Order.OrderStatus.PAID,
                    Order.OrderStatus.PROCESSING,
                    Order.OrderStatus.SHIPPED,
                    Order.OrderStatus.DELIVERED,
                ):
                    payment_logger.warning(
                        f"[PaymentService] Received FAILED webhook for order {order.order_number}, "
                        f"but order is already {order.status}. Ignoring order status regression."
                    )

            elif event.status == 'CANCELLED':
                if payment and not payment.is_successful:
                    payment.status = Payment.PaymentStatus.CANCELLED
                    payment.save(update_fields=['status', 'updated_at'])

            elif event.status == 'REFUNDED':
                refund_amt = event.amount
                if payment:
                    payment.status = Payment.PaymentStatus.REFUNDED
                    if refund_amt is not None:
                        payment.refund_amount = refund_amt
                    else:
                        payment.refund_amount = payment.amount
                    payment.save(update_fields=['status', 'refund_amount', 'updated_at'])

                if order and order.status != Order.OrderStatus.REFUNDED:
                    order.status = Order.OrderStatus.REFUNDED
                    order.save(update_fields=['status', 'updated_at'])
                    payment_logger.info(f"[PaymentService] Webhook updated order {order.order_number} to REFUNDED.")

            # Mark webhook event PROCESSED
            webhook_event.status = PaymentWebhookEvent.EventStatus.PROCESSED
            webhook_event.processed_at = timezone.now()
            webhook_event.order_number = order.order_number if order else (event.order_number or '')
            webhook_event.transaction_id = payment.transaction_id if payment else (event.transaction_id or '')
            webhook_event.payload = sanitized_payload
            webhook_event.save(update_fields=['status', 'processed_at', 'order_number', 'transaction_id', 'payload', 'updated_at'])

            return {
                'status': 'processed',
                'event_id': event.event_id,
                'event_type': event.event_type,
                'order_number': webhook_event.order_number,
            }

    @classmethod
    def process_refund(
        cls,
        payment: Payment,
        amount: Optional[Decimal] = None,
        reason: str = ''
    ) -> RefundResult:
        """
        Executes a full or partial refund with the underlying gateway adapter.
        Prevents excessive refunding and synchronizes order status to REFUNDED upon full refund.
        """
        with transaction.atomic():
            locked_payment = Payment.objects.select_for_update().get(id=payment.id)
            locked_order = Order.objects.select_for_update().get(id=payment.order.id)

            if not locked_payment.is_successful:
                raise InvalidOrderStateError(
                    f"Cannot refund payment {locked_payment.transaction_id} because it is in '{locked_payment.status}' status (must be COMPLETED).",
                    current_status=locked_payment.status
                )

            target_amount = amount or locked_payment.amount
            remaining_refundable = locked_payment.amount - locked_payment.refund_amount

            if target_amount > remaining_refundable:
                raise ExcessiveRefundError(
                    f"Requested refund amount ${target_amount} exceeds remaining refundable amount ${remaining_refundable}.",
                    max_allowed=str(remaining_refundable)
                )

            adapter = get_payment_adapter(locked_payment.gateway)
            refund_res = adapter.process_refund(locked_payment, amount=target_amount, reason=reason)

            if not refund_res.success:
                payment_logger.error(f"[PaymentService] Refund failed for payment {locked_payment.transaction_id}: {refund_res.error_message}")
                return refund_res

            # Update Payment
            locked_payment.refund_amount += target_amount
            locked_payment.refund_reason = reason
            if locked_payment.refund_amount >= locked_payment.amount:
                locked_payment.status = Payment.PaymentStatus.REFUNDED
                locked_order.status = Order.OrderStatus.REFUNDED
                locked_order.save(update_fields=['status', 'updated_at'])

            locked_payment.save(update_fields=['status', 'refund_amount', 'refund_reason', 'updated_at'])

            payment_logger.info(
                f"[PaymentService] Successfully processed refund {refund_res.refund_id} for order {locked_order.order_number}, "
                f"amount=${target_amount}."
            )
            return refund_res
