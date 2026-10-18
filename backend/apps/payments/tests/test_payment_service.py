from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.orders.models import Order, Payment
from apps.payments.services import PaymentService
from apps.payments.exceptions import (
    DuplicatePaymentError,
    InvalidOrderStateError,
    ExcessiveRefundError,
)

User = get_user_model()


class PaymentServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='payer@example.com',
            email='payer@example.com',
            password='TestPassword123!'
        )
        self.order = Order.objects.create(
            user=self.user,
            order_number='ORD-PAY-SERVICE-01',
            status=Order.OrderStatus.PENDING,
            currency='USD',
            total_amount=Decimal('89.99')
        )

    def test_create_payment_intent_success(self):
        intent, payment = PaymentService.create_payment_intent(
            order=self.order,
            payment_method=Payment.PaymentMethod.CREDIT_CARD
        )
        self.assertTrue(intent.success)
        self.assertEqual(payment.order, self.order)
        self.assertEqual(payment.status, Payment.PaymentStatus.PENDING)
        self.assertEqual(payment.amount, Decimal('89.99'))
        self.assertEqual(payment.currency, 'USD')
        self.assertTrue(payment.client_secret.startswith(payment.transaction_id))

    def test_prevent_intent_creation_on_already_paid_order(self):
        self.order.status = Order.OrderStatus.PAID
        self.order.save()

        with self.assertRaises(DuplicatePaymentError):
            PaymentService.create_payment_intent(order=self.order)

    def test_prevent_intent_creation_on_cancelled_order(self):
        self.order.status = Order.OrderStatus.CANCELLED
        self.order.save()

        with self.assertRaises(InvalidOrderStateError):
            PaymentService.create_payment_intent(order=self.order)

    def test_confirm_and_verify_payment_success(self):
        verification, payment = PaymentService.confirm_and_verify_payment(
            order=self.order,
            payment_token='tok_test_success',
            payment_method=Payment.PaymentMethod.CREDIT_CARD
        )

        self.assertTrue(verification.success)
        self.assertEqual(payment.status, Payment.PaymentStatus.COMPLETED)
        self.assertEqual(payment.card_brand, 'Simulated')
        self.assertEqual(payment.card_last4, '4242')

        # Order must be updated to PAID
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

    def test_prevent_duplicate_charge_on_paid_order(self):
        # First payment succeeds
        PaymentService.confirm_and_verify_payment(
            order=self.order,
            payment_token='tok_test_success'
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

        # Second payment attempt must be rejected with DuplicatePaymentError
        with self.assertRaises(DuplicatePaymentError):
            PaymentService.confirm_and_verify_payment(
                order=self.order,
                payment_token='tok_test_success'
            )

    def test_failed_payment_keeps_order_pending_and_allows_retry(self):
        # 1. First attempt fails (card declined)
        verification, payment1 = PaymentService.confirm_and_verify_payment(
            order=self.order,
            payment_token='tok_test_declined'
        )
        self.assertFalse(verification.success)
        self.assertEqual(payment1.status, Payment.PaymentStatus.FAILED)
        self.assertEqual(payment1.error_code, 'CARD_DECLINED')

        # Order remains PENDING so customer can retry
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PENDING)

        # 2. Customer retries with successful payment token
        verification2, payment2 = PaymentService.confirm_and_verify_payment(
            order=self.order,
            payment_token='tok_test_success'
        )
        self.assertTrue(verification2.success)
        self.assertEqual(payment2.status, Payment.PaymentStatus.COMPLETED)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)
        self.assertEqual(self.order.payments.count(), 2)

    def test_refund_lifecycle(self):
        # Capture payment
        _, payment = PaymentService.confirm_and_verify_payment(
            order=self.order,
            payment_token='tok_test_success'
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

        # 1. Partial refund of $30.00
        refund_res = PaymentService.process_refund(
            payment=payment,
            amount=Decimal('30.00'),
            reason='Partial return of 1 item'
        )
        self.assertTrue(refund_res.success)
        payment.refresh_from_db()
        self.assertEqual(payment.refund_amount, Decimal('30.00'))
        self.order.refresh_from_db()
        # Order should remain PAID on partial refund
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

        # 2. Excessive refund must fail
        with self.assertRaises(ExcessiveRefundError):
            PaymentService.process_refund(
                payment=payment,
                amount=Decimal('100.00')  # Remaining refundable is only 59.99
            )

        # 3. Complete remaining refund of $59.99
        refund_res2 = PaymentService.process_refund(
            payment=payment,
            amount=Decimal('59.99'),
            reason='Return of rest of items'
        )
        self.assertTrue(refund_res2.success)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.PaymentStatus.REFUNDED)
        self.assertEqual(payment.refund_amount, Decimal('89.99'))

        # Full refund moves Order to REFUNDED
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.REFUNDED)
