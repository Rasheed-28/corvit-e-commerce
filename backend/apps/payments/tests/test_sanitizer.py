from django.test import TestCase
from apps.payments.utils.sanitizer import (
    sanitize_payment_data,
    mask_card_number,
    extract_card_summary,
    detect_card_brand,
)


class PaymentSanitizerTests(TestCase):
    def test_mask_card_number(self):
        raw_card = "4242 4242 4242 4242"
        masked = mask_card_number(raw_card)
        self.assertEqual(masked, "****-****-****-4242")
        self.assertNotIn("4242 4242 4242", masked)

    def test_detect_card_brand(self):
        self.assertEqual(detect_card_brand("4111111111111111"), "Visa")
        self.assertEqual(detect_card_brand("5555555555554444"), "Mastercard")
        self.assertEqual(detect_card_brand("378282246310005"), "American Express")
        self.assertEqual(detect_card_brand("6011000990139424"), "Discover")

    def test_extract_card_summary(self):
        summary = extract_card_summary("4242424242421234")
        self.assertEqual(summary['card_brand'], "Visa")
        self.assertEqual(summary['card_last4'], "1234")

    def test_sanitize_nested_payment_payload(self):
        payload = {
            'order_id': '12345',
            'card_number': '4242424242424242',
            'cvv': '999',
            'security_code': '123',
            'stripe_secret_key': 'sk_live_secretkey123456789',
            'webhook_secret': 'whsec_987654321',
            'customer': {
                'email': 'buyer@example.com',
                'pan': '4111222233334444',
                'password': 'SuperSecretPassword!',
            },
            'logs': [
                'Payment attempt with card 4242-4242-4242-4242 was processed.',
                'CVV verified.'
            ]
        }

        sanitized = sanitize_payment_data(payload)

        # Ensure sensitive secrets are completely redacted
        self.assertEqual(sanitized['cvv'], '[REDACTED]')
        self.assertEqual(sanitized['security_code'], '[REDACTED]')
        self.assertEqual(sanitized['stripe_secret_key'], '[REDACTED]')
        self.assertEqual(sanitized['webhook_secret'], '[REDACTED]')
        self.assertEqual(sanitized['customer']['password'], '[REDACTED]')

        # Ensure card numbers are masked and never preserved in raw form
        self.assertEqual(sanitized['card_number'], '****-****-****-4242')
        self.assertEqual(sanitized['customer']['pan'], '****-****-****-4444')
        self.assertNotIn('4242424242424242', str(sanitized))
        self.assertNotIn('4111222233334444', str(sanitized))
        self.assertNotIn('SuperSecretPassword!', str(sanitized))
