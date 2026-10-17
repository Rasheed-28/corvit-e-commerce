import uuid
from decimal import Decimal
from rest_framework import serializers
from apps.accounts.models import Address
from apps.accounts.serializers import AddressSerializer
from .models import Coupon, Order, OrderItem, Payment

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            'id', 'product', 'variant',
            'product_title', 'variant_name', 'sku',
            'unit_price', 'quantity', 'line_total'
        )
        read_only_fields = ('id', 'line_total')


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            'id', 'transaction_id', 'payment_method',
            'status', 'amount', 'currency', 'created_at'
        )
        read_only_fields = ('id', 'created_at')


class OrderListSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'order_number', 'status',
            'total_amount', 'currency',
            'items_count', 'created_at'
        )
        read_only_fields = ('id', 'order_number', 'created_at')


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'order_number', 'status',
            'subtotal', 'shipping_fee', 'tax_amount', 'discount_amount', 'total_amount',
            'currency', 'items', 'payments',
            'shipping_address_snapshot', 'billing_address_snapshot',
            'customer_notes', 'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'order_number', 'subtotal', 'total_amount',
            'shipping_address_snapshot', 'billing_address_snapshot',
            'created_at', 'updated_at'
        )


class ValidateCouponSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50, required=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)

    def validate(self, attrs):
        code = attrs['code'].strip().upper()
        subtotal = attrs['subtotal']
        try:
            coupon = Coupon.objects.get(code__iexact=code, is_active=True)
        except Coupon.DoesNotExist:
            raise serializers.ValidationError({"code": "Invalid or expired coupon code."})

        if not coupon.is_valid_for_amount(subtotal):
            raise serializers.ValidationError({"code": "Coupon conditions are not met or coupon has expired."})

        discount = coupon.calculate_discount(subtotal)
        attrs['coupon_obj'] = coupon
        attrs['discount_amount'] = discount
        return attrs


class CheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.UUIDField(required=True)
    billing_address_id = serializers.UUIDField(required=False, allow_null=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')
    customer_notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_shipping_address_id(self, value):
        user = self.context['request'].user
        if not Address.objects.filter(id=value, user=user).exists():
            raise serializers.ValidationError("Shipping address not found in your saved addresses.")
        return value

    def validate_billing_address_id(self, value):
        if value:
            user = self.context['request'].user
            if not Address.objects.filter(id=value, user=user).exists():
                raise serializers.ValidationError("Billing address not found in your saved addresses.")
        return value


class CreatePaymentSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)
    transaction_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def create(self, validated_data):
        order = self.context['order']
        amount = validated_data.get('amount') or order.total_amount
        transaction_id = validated_data.get('transaction_id') or f"TXN-{uuid.uuid4().hex[:12].upper()}"

        payment = Payment.objects.create(
            order=order,
            transaction_id=transaction_id,
            payment_method=validated_data['payment_method'],
            status=Payment.PaymentStatus.COMPLETED,
            amount=amount,
            currency=order.currency
        )

        # Update order status to PAID
        order.status = Order.OrderStatus.PAID
        order.save(update_fields=['status', 'updated_at'])

        return payment
