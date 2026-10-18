import uuid
from decimal import Decimal
from rest_framework import serializers
from apps.accounts.models import Address
from apps.accounts.serializers import AddressSerializer
from .models import Coupon, Order, OrderItem, Payment

class AddressInputSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=True)
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    street_address_1 = serializers.CharField(max_length=255, required=True)
    street_address_2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100, required=True)
    state_or_province = serializers.CharField(max_length=100, required=True)
    postal_code = serializers.CharField(max_length=20, required=True)
    country = serializers.CharField(max_length=100, default='United States')
    save_to_address_book = serializers.BooleanField(default=False)


class OrderItemSerializer(serializers.ModelSerializer):
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id', 'product', 'variant',
            'product_title', 'variant_name', 'sku', 'product_image',
            'unit_price', 'quantity', 'line_total'
        )
        read_only_fields = ('id', 'line_total', 'product_image')

    def get_product_image(self, obj) -> str | None:
        if obj.product:
            images = obj.product.images.all()
            primary = next((img for img in images if img.is_primary), None) or (images[0] if images else None)
            if primary and primary.image:
                request = self.context.get('request')
                return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return None


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            'id', 'transaction_id', 'payment_method',
            'status', 'amount', 'currency', 'gateway_response', 'created_at'
        )
        read_only_fields = ('id', 'created_at')


class OrderListSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'order_number', 'status',
            'subtotal', 'shipping_fee', 'tax_amount', 'discount_amount',
            'total_amount', 'currency', 'can_cancel',
            'items_count', 'created_at'
        )
        read_only_fields = ('id', 'order_number', 'created_at')


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'order_number', 'status',
            'subtotal', 'shipping_fee', 'tax_amount', 'discount_amount', 'total_amount',
            'currency', 'items', 'payments', 'can_cancel', 'cancellation_reason',
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
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    cart_subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def validate(self, attrs):
        code = attrs['code'].strip().upper()
        subtotal = attrs.get('subtotal') or attrs.get('cart_subtotal')
        if subtotal is None:
            raise serializers.ValidationError({"subtotal": "Subtotal amount is required to validate coupon."})

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
    shipping_address_id = serializers.UUIDField(required=False, allow_null=True)
    shipping_address = AddressInputSerializer(required=False, allow_null=True)
    billing_address_id = serializers.UUIDField(required=False, allow_null=True)
    billing_address = AddressInputSerializer(required=False, allow_null=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')
    customer_notes = serializers.CharField(required=False, allow_blank=True, default='')
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=128, default='')
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
        required=False,
        default=Payment.PaymentMethod.CREDIT_CARD
    )

    def validate(self, attrs):
        user = self.context['request'].user
        shipping_addr_id = attrs.get('shipping_address_id')
        shipping_addr_data = attrs.get('shipping_address')

        if not shipping_addr_id and not shipping_addr_data:
            raise serializers.ValidationError({
                "shipping_address": "Please select a saved shipping address or provide a new shipping address."
            })

        if shipping_addr_id:
            if not Address.objects.filter(id=shipping_addr_id, user=user).exists():
                raise serializers.ValidationError({
                    "shipping_address_id": "Selected shipping address was not found in your account."
                })

        billing_addr_id = attrs.get('billing_address_id')
        if billing_addr_id:
            if not Address.objects.filter(id=billing_addr_id, user=user).exists():
                raise serializers.ValidationError({
                    "billing_address_id": "Selected billing address was not found in your account."
                })

        return attrs


class OrderPreviewSerializer(serializers.Serializer):
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_address_id = serializers.UUIDField(required=False, allow_null=True)


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='Cancelled by customer')


class CreatePaymentSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)
    transaction_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    card_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    simulate_failure = serializers.BooleanField(default=False)

    def validate(self, attrs):
        order = self.context['order']
        if order.status != Order.OrderStatus.PENDING:
            raise serializers.ValidationError({
                "payment": f"Order {order.order_number} is already in '{order.status}' status and does not require payment."
            })
        return attrs

    def create(self, validated_data):
        order = self.context['order']
        amount = validated_data.get('amount') or order.total_amount
        transaction_id = validated_data.get('transaction_id') or f"TXN-{uuid.uuid4().hex[:12].upper()}"
        payment_method = validated_data['payment_method']
        card_number = validated_data.get('card_number', '').replace(' ', '')
        simulate_failure = validated_data.get('simulate_failure', False)

        # Server-side payment gateway simulation & verification
        # Never mark an order paid if payment processing fails
        is_failure = (
            simulate_failure or
            card_number.endswith('0002') or
            'fail' in card_number.lower()
        )

        if is_failure:
            payment = Payment.objects.create(
                order=order,
                transaction_id=transaction_id,
                payment_method=payment_method,
                status=Payment.PaymentStatus.FAILED,
                amount=amount,
                currency=order.currency,
                gateway_response={
                    'decline_code': 'card_declined',
                    'message': 'The payment transaction was declined by the issuer bank.'
                }
            )
            raise serializers.ValidationError({
                "payment": "Your payment method was declined. Please try another card or payment method."
            })

        payment = Payment.objects.create(
            order=order,
            transaction_id=transaction_id,
            payment_method=payment_method,
            status=Payment.PaymentStatus.COMPLETED,
            amount=amount,
            currency=order.currency,
            gateway_response={'status': 'succeeded', 'charge_id': transaction_id}
        )

        # Update order status to PAID
        order.status = Order.OrderStatus.PAID
        order.save(update_fields=['status', 'updated_at'])

        return payment
