import json
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.orders.models import Order, Payment
from apps.payments.adapters.simulated import SimulatedPaymentAdapter

User = get_user_model()


class PaymentAPIEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='apiuser@example.com',
            email='apiuser@example.com',
            password='TestPassword123!'
        )
        self.staff_user = User.objects.create_user(
            username='staff@example.com',
            email='staff@example.com',
            password='TestPassword123!',
            is_staff=True
        )
        self.order = Order.objects.create(
            user=self.user,
            order_number='ORD-API-TEST-001',
            status=Order.OrderStatus.PENDING,
            currency='USD',
            total_amount=Decimal('75.00')
        )

    def test_payment_config_endpoint_public(self):
        response = self.client.get('/api/v1/payments/config/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        data = response.data['data']
        self.assertEqual(data['active_gateway'], 'simulated')
        self.assertTrue(data['is_active_gateway_configured'])
        self.assertIn('available_gateways', data)
        # Ensure secret keys are never present
        self.assertNotIn('secret_key', str(response.data))
        self.assertNotIn('stripe_secret_key', str(response.data))

    def test_create_payment_intent_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/payments/intent/', {
            'order_number': self.order.order_number,
            'payment_method': 'CREDIT_CARD',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        data = response.data['data']
        self.assertTrue(data['intent_id'].startswith('sim_pi_'))
        self.assertTrue(data['client_secret'].startswith(data['intent_id']))
        self.assertEqual(Decimal(str(data['amount'])), Decimal('75.00'))

    def test_confirm_payment_endpoint_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/payments/confirm/', {
            'order_number': self.order.order_number,
            'payment_token': 'tok_test_success',
            'payment_method': 'CREDIT_CARD',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['order_status'], 'PAID')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

    def test_confirm_payment_declined(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/payments/confirm/', {
            'order_number': self.order.order_number,
            'payment_token': 'tok_test_declined',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'CARD_DECLINED')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PENDING)

    def test_duplicate_confirm_payment_rejected(self):
        self.client.force_authenticate(user=self.user)
        # First confirmation
        self.client.post('/api/v1/payments/confirm/', {
            'order_number': self.order.order_number,
            'payment_token': 'tok_test_success',
        })

        # Second confirmation attempt
        response = self.client.post('/api/v1/payments/confirm/', {
            'order_number': self.order.order_number,
            'payment_token': 'tok_test_success',
        })
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'DUPLICATE_PAYMENT_ERROR')

    def test_staff_refund_endpoint(self):
        # 1. Pay order
        self.client.force_authenticate(user=self.user)
        pay_res = self.client.post('/api/v1/payments/confirm/', {
            'order_number': self.order.order_number,
            'payment_token': 'tok_test_success',
        })
        tx_id = pay_res.data['data']['payment']['transaction_id']

        # 2. Non-staff cannot refund
        refund_res_forbidden = self.client.post(f'/api/v1/payments/refund/{tx_id}/', {
            'amount': '75.00',
            'reason': 'Customer requested refund'
        })
        self.assertEqual(refund_res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Staff can refund
        self.client.force_authenticate(user=self.staff_user)
        refund_res = self.client.post(f'/api/v1/payments/refund/{tx_id}/', {
            'amount': '75.00',
            'reason': 'Approved by store manager'
        })
        self.assertEqual(refund_res.status_code, status.HTTP_200_OK)
        self.assertTrue(refund_res.data['success'])
        self.assertEqual(refund_res.data['data']['order_status'], 'REFUNDED')

    def test_webhook_api_endpoint(self):
        from apps.payments.adapters.factory import get_payment_adapter
        adapter = get_payment_adapter('simulated')
        payload = json.dumps({
            'id': 'evt_api_hook_01',
            'type': 'payment.succeeded',
            'data': {
                'object': {
                    'order_number': self.order.order_number,
                    'transaction_id': 'TXN-API-HOOK-01',
                    'amount': '75.00',
                    'currency': 'USD',
                }
            }
        }).encode('utf-8')

        sig = adapter.generate_webhook_signature(payload)
        response = self.client.post(
            '/api/v1/payments/webhook/simulated/',
            data=payload,
            content_type='application/json',
            HTTP_X_WEBHOOK_SIGNATURE=sig
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['status'], 'processed')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PAID)

    @patch('apps.payments.services.PaymentService.process_webhook_event')
    def test_webhook_unexpected_exception_sanitizes_error_message(self, mock_process):
        mock_process.side_effect = RuntimeError("Sensitive DB internal error: user=admin password=secret_token")
        from apps.payments.adapters.factory import get_payment_adapter
        adapter = get_payment_adapter('simulated')
        payload = b'{"dummy": true}'
        sig = adapter.generate_webhook_signature(payload)

        response = self.client.post(
            '/api/v1/payments/webhook/simulated/',
            data=payload,
            content_type='application/json',
            HTTP_X_WEBHOOK_SIGNATURE=sig
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'WEBHOOK_PROCESSING_ERROR')
        self.assertEqual(
            response.data['error']['message'],
            'An unexpected error occurred while processing the webhook event.'
        )
        self.assertNotIn("secret_token", response.data['error']['message'])
        self.assertNotIn("Sensitive DB", response.data['error']['message'])
