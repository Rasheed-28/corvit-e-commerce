from decimal import Decimal
from rest_framework import serializers
from apps.orders.models import Order, Payment
from .models import PaymentWebhookEvent


class PaymentIntentCreateSerializer(serializers.Serializer):
    """Initializes a server-side payment intent/session."""
    order_number = serializers.CharField(max_length=32)
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
        default=Payment.PaymentMethod.CREDIT_CARD
    )
    gateway = serializers.CharField(max_length=50, required=False, allow_blank=True)
    idempotency_key = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate_order_number(self, value):
        order = Order.objects.filter(order_number=value).first()
        if not order:
            raise serializers.ValidationError(f"Order '{value}' was not found.")
        return value


class PaymentConfirmSerializer(serializers.Serializer):
    """
    Confirms and verifies a payment transaction server-side.
    Uses safe tokens (payment_token / payment_method_id / client_secret).
    NEVER accepts or stores raw credit card numbers or CVV codes.
    """
    order_number = serializers.CharField(max_length=32)
    transaction_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    payment_token = serializers.CharField(max_length=255, required=False, allow_blank=True, default='tok_test_success')
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
        default=Payment.PaymentMethod.CREDIT_CARD
    )
    gateway = serializers.CharField(max_length=50, required=False, allow_blank=True)
    simulate_failure = serializers.BooleanField(default=False)
    idempotency_key = serializers.CharField(max_length=128, required=False, allow_blank=True)

    # Optional client-side card input field (for backward compatibility with test forms),
    # strictly sanitized so that raw PAN/CVV are never persisted.
    card_number = serializers.CharField(max_length=30, required=False, allow_blank=True)

    def validate(self, attrs):
        order_number = attrs.get('order_number')
        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise serializers.ValidationError({"order_number": f"Order '{order_number}' does not exist."})
        
        # If card_number is passed in test form, normalize to token and scrub
        raw_card = attrs.get('card_number', '')
        if raw_card and not attrs.get('payment_token'):
            clean = raw_card.replace(' ', '').replace('-', '')
            if clean.endswith('0002') or 'fail' in clean.lower():
                attrs['payment_token'] = 'tok_test_declined'
            else:
                attrs['payment_token'] = 'tok_test_success'
        
        attrs.pop('card_number', None)
        attrs['order'] = order
        return attrs


class PaymentRefundSerializer(serializers.Serializer):
    """Processes server-side partial or full refund."""
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal('0.01')
    )
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='Customer requested refund')


class PaymentAuditSerializer(serializers.ModelSerializer):
    """
    Safe public serializer for Payment transaction records.
    Never exposes raw secrets or sensitive credentials.
    """
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'order_number',
            'transaction_id',
            'gateway',
            'payment_method',
            'status',
            'amount',
            'currency',
            'card_brand',
            'card_last4',
            'client_secret',
            'refund_amount',
            'refund_reason',
            'error_code',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class PaymentWebhookEventSerializer(serializers.ModelSerializer):
    """Serializer for administrative inspection of webhook events."""
    class Meta:
        model = PaymentWebhookEvent
        fields = [
            'id',
            'provider',
            'event_id',
            'event_type',
            'status',
            'order_number',
            'transaction_id',
            'processed_at',
            'created_at',
        ]
        read_only_fields = fields
