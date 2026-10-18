import json
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.orders.models import Order, Payment
from apps.payments.models import PaymentWebhookEvent
from apps.payments.services import PaymentService
from apps.payments.adapters.simulated import SimulatedPaymentAdapter
from apps.payments.exceptions import WebhookSignatureVerificationError

User = get_user_model()


class WebhookProcessingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='hookuser@example.com',
            email='hookuser@example.com',
            password='TestPassword123!'
        )
        self.order = Order.objects.create(
            user=self.user,
            order_number='ORD-HOOK-001',
            status=Order.OrderStatus.PENDING,
            currency='USD',
            total_amount=Decimal('120.00')
        )
        from apps.payments.adapters.factory import get_payment_adapter
        self.simulated_adapter = get_payment_adapter('simulated')


    def _build_signed_payload(self, event_type: str, event_id: str, order_number: str, tx_id: str, amount: str = '120.00'):
        data = {
            'id': event_id,
            'type': event_type,
            'data': {
                'object': {
                    'transaction_id': tx_id,
                    'order_number': order_number,
                    'amount': amount,
                    'currency': 'USD',
                }
            }
        }
        payload_bytes = json.dumps(data).encode('utf-8')
        sig = self.simulated_adapter.generate_webhook_signature(payload_bytes)
        headers = {'X-Webhook-Signature': sig}
        return payload_bytes, headers

    def test_webhook_successful_payment_event(self):
        payload_bytes, headers = self._build_signed_payload(
            event_type='payment.succeeded',
            event_id='evt_succ_001',
            order_number=self.order.order_number,
            tx_id='TXN-HOOK-SUCC-001'
        )

        res = PaymentService.process_webhook_event(
            provider_name='simulated',
            payload_bytes=payload_bytes,
            headers=headers
        )

        self.assertEqual(res['status'], 'processed')
        self.assertEqual(res['event_id'], 'evt_succ_001')

        # Check order transition
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

        # Check webhook event logged
        webhook_event = PaymentWebhookEvent.objects.get(provider='simulated', event_id='evt_succ_001')
        self.assertEqual(webhook_event.status, PaymentWebhookEvent.EventStatus.PROCESSED)
        self.assertEqual(webhook_event.order_number, self.order.order_number)

    def test_webhook_idempotency_duplicate_deliveries(self):
        payload_bytes, headers = self._build_signed_payload(
            event_type='payment.succeeded',
            event_id='evt_idempotent_001',
            order_number=self.order.order_number,
            tx_id='TXN-HOOK-IDEM-001'
        )

        # 1. First delivery
        first_res = PaymentService.process_webhook_event(
            provider_name='simulated',
            payload_bytes=payload_bytes,
            headers=headers
        )
        self.assertEqual(first_res['status'], 'processed')

        # 2. Second delivery with identical event_id
        second_res = PaymentService.process_webhook_event(
            provider_name='simulated',
            payload_bytes=payload_bytes,
            headers=headers
        )
        self.assertEqual(second_res['status'], 'already_processed')
        self.assertEqual(second_res['event_id'], 'evt_idempotent_001')

        # Ensure only 1 record exists in DB
        self.assertEqual(
            PaymentWebhookEvent.objects.filter(provider='simulated', event_id='evt_idempotent_001').count(),
            1
        )

    def test_webhook_signature_verification_failure(self):
        payload_bytes = json.dumps({'id': 'evt_bad', 'type': 'payment.succeeded'}).encode('utf-8')
        bad_headers = {'X-Webhook-Signature': 't=999,v1=bad_signature_hash'}

        with self.assertRaises(WebhookSignatureVerificationError):
            PaymentService.process_webhook_event(
                provider_name='simulated',
                payload_bytes=payload_bytes,
                headers=bad_headers
            )

        # Webhook event must NOT be processed
        self.assertFalse(PaymentWebhookEvent.objects.filter(event_id='evt_bad').exists())

    def test_webhook_never_regresses_already_paid_order(self):
        # Order is already PAID
        self.order.status = Order.OrderStatus.PAID
        self.order.save()

        # Late failed payment webhook arrives
        payload_bytes, headers = self._build_signed_payload(
            event_type='payment.failed',
            event_id='evt_late_fail_001',
            order_number=self.order.order_number,
            tx_id='TXN-LATE-FAIL-001'
        )

        res = PaymentService.process_webhook_event(
            provider_name='simulated',
            payload_bytes=payload_bytes,
            headers=headers
        )
        self.assertEqual(res['status'], 'processed')

        # Order MUST remain PAID (must not be regressed to failed or pending)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

    def test_webhook_refund_event(self):
        # Order is PAID with a payment record
        self.order.status = Order.OrderStatus.PAID
        self.order.save()

        payment = Payment.objects.create(
            order=self.order,
            transaction_id='TXN-REF-TEST-001',
            payment_method=Payment.PaymentMethod.CREDIT_CARD,
            status=Payment.PaymentStatus.COMPLETED,
            amount=Decimal('120.00'),
            currency='USD'
        )

        payload_bytes, headers = self._build_signed_payload(
            event_type='charge.refunded',
            event_id='evt_refund_001',
            order_number=self.order.order_number,
            tx_id='TXN-REF-TEST-001',
            amount='120.00'
        )

        PaymentService.process_webhook_event(
            provider_name='simulated',
            payload_bytes=payload_bytes,
            headers=headers
        )

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.PaymentStatus.REFUNDED)
        self.assertEqual(payment.refund_amount, Decimal('120.00'))

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.REFUNDED)
