import json
from decimal import Decimal
from django.test import TestCase
from apps.orders.models import Order
from apps.payments.adapters.base import (
    PaymentIntentResult,
    PaymentVerificationResult,
    RefundResult,
    NormalizedWebhookEvent,
)
from apps.payments.adapters.simulated import SimulatedPaymentAdapter
from apps.payments.adapters.stripe_adapter import StripePaymentAdapter
from apps.payments.adapters.factory import get_payment_adapter, list_available_adapters
from apps.payments.exceptions import PaymentConfigurationError


class PaymentAdaptersTests(TestCase):
    def setUp(self):
        self.simulated = SimulatedPaymentAdapter(webhook_secret='test-webhook-secret-123')
        self.order = Order.objects.create(
            order_number='ORD-TEST-0001',
            currency='USD',
            total_amount=Decimal('150.00')
        )

    def test_simulated_adapter_create_intent(self):
        result = self.simulated.create_payment_intent(self.order)
        self.assertTrue(result.success)
        self.assertTrue(result.intent_id.startswith('sim_pi_'))
        self.assertTrue(result.client_secret.startswith(result.intent_id))
        self.assertEqual(result.amount, Decimal('150.00'))
        self.assertEqual(result.currency, 'USD')

    def test_simulated_adapter_confirm_success(self):
        intent = self.simulated.create_payment_intent(self.order)
        result = self.simulated.confirm_payment(
            transaction_id=intent.intent_id,
            payment_token='tok_test_success',
            options={'amount': self.order.total_amount, 'currency': 'USD'}
        )
        self.assertTrue(result.success)
        self.assertEqual(result.status, 'SUCCESSFUL')
        self.assertEqual(result.card_brand, 'Simulated')
        self.assertEqual(result.card_last4, '4242')

        # Server-side verification query
        verification = self.simulated.verify_payment(intent.intent_id)
        self.assertTrue(verification.success)
        self.assertEqual(verification.status, 'SUCCESSFUL')

    def test_simulated_adapter_confirm_declined(self):
        result = self.simulated.confirm_payment(
            transaction_id='TXN-DECLINE-01',
            payment_token='tok_test_declined',
            options={'amount': self.order.total_amount, 'currency': 'USD'}
        )
        self.assertFalse(result.success)
        self.assertEqual(result.status, 'FAILED')
        self.assertEqual(result.error_code, 'CARD_DECLINED')

    def test_simulated_adapter_confirm_insufficient_funds(self):
        result = self.simulated.confirm_payment(
            transaction_id='TXN-INSUF-01',
            payment_token='tok_test_insufficient_funds',
            options={'amount': self.order.total_amount, 'currency': 'USD'}
        )
        self.assertFalse(result.success)
        self.assertEqual(result.status, 'FAILED')
        self.assertEqual(result.error_code, 'INSUFFICIENT_FUNDS')

    def test_simulated_adapter_confirm_cancelled(self):
        result = self.simulated.confirm_payment(
            transaction_id='TXN-CANCEL-01',
            payment_token='tok_test_cancelled',
            options={'amount': self.order.total_amount, 'currency': 'USD'}
        )
        self.assertFalse(result.success)
        self.assertEqual(result.status, 'CANCELLED')

    def test_simulated_adapter_confirm_pending(self):
        result = self.simulated.confirm_payment(
            transaction_id='TXN-PENDING-01',
            payment_token='tok_test_pending',
            options={'amount': self.order.total_amount, 'currency': 'USD'}
        )
        self.assertTrue(result.success)
        self.assertEqual(result.status, 'PENDING')

    def test_simulated_adapter_webhook_signature_and_parsing(self):
        payload_dict = {
            'id': 'evt_sim_test_1001',
            'type': 'payment.succeeded',
            'data': {
                'object': {
                    'transaction_id': 'TXN-HOOK-SUCCESS-01',
                    'order_number': 'ORD-TEST-0001',
                    'amount': '150.00',
                    'currency': 'USD',
                }
            }
        }
        payload_bytes = json.dumps(payload_dict).encode('utf-8')
        valid_signature = self.simulated.generate_webhook_signature(payload_bytes)

        headers = {'X-Webhook-Signature': valid_signature}
        self.assertTrue(self.simulated.verify_webhook_signature(payload_bytes, headers))

        # Test forged signature rejection
        forged_headers = {'X-Webhook-Signature': 't=12345,v1=bad_hash_value_here'}
        self.assertFalse(self.simulated.verify_webhook_signature(payload_bytes, forged_headers))

        # Test missing header rejection
        self.assertFalse(self.simulated.verify_webhook_signature(payload_bytes, {}))

        # Test event parsing
        event = self.simulated.parse_webhook_event(payload_bytes, headers)
        self.assertEqual(event.event_id, 'evt_sim_test_1001')
        self.assertEqual(event.event_type, 'payment.succeeded')
        self.assertEqual(event.status, 'SUCCESSFUL')
        self.assertEqual(event.transaction_id, 'TXN-HOOK-SUCCESS-01')
        self.assertEqual(event.order_number, 'ORD-TEST-0001')
        self.assertEqual(event.amount, Decimal('150.00'))

    def test_stripe_adapter_configuration_status(self):
        unconfigured_stripe = StripePaymentAdapter(secret_key='', publishable_key='', webhook_secret='')
        self.assertFalse(unconfigured_stripe.is_configured)
        status_info = unconfigured_stripe.get_configuration_status()
        self.assertIn('STRIPE_SECRET_KEY', status_info['unconfigured_items'])
        self.assertIn('STRIPE_PUBLISHABLE_KEY', status_info['unconfigured_items'])
        self.assertIn('STRIPE_WEBHOOK_SECRET', status_info['unconfigured_items'])
        self.assertIn('US', status_info['supported_countries'])
        self.assertIn('USD', status_info['supported_currencies'])

        # Attempting operation without keys must raise PaymentConfigurationError
        with self.assertRaises(PaymentConfigurationError):
            unconfigured_stripe.create_payment_intent(self.order)

    def test_factory_gateway_resolution(self):
        sim = get_payment_adapter('simulated')
        self.assertEqual(sim.gateway_name, 'simulated')

        stripe_ad = get_payment_adapter('stripe')
        self.assertEqual(stripe_ad.gateway_name, 'stripe')

        unknown = get_payment_adapter('non_existent_gateway')
        self.assertEqual(unknown.gateway_name, 'simulated')

        all_adapters = list_available_adapters()
        self.assertTrue(any(a['gateway_name'] == 'simulated' for a in all_adapters))
        self.assertTrue(any(a['gateway_name'] == 'stripe' for a in all_adapters))
