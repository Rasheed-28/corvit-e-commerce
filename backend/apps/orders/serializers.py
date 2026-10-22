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
            'id', 'transaction_id', 'gateway', 'payment_method',
            'status', 'amount', 'currency', 'card_brand', 'card_last4',
            'refund_amount', 'refund_reason', 'gateway_response', 'created_at'
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
            coupon = Coupon.objects.get(code__iexact=code)
        except Coupon.DoesNotExist:
            raise serializers.ValidationError({"code": "Invalid or expired coupon code."})

        err = coupon.get_validation_error(subtotal)
        if err:
            raise serializers.ValidationError({"code": err})

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

        coupon_code = attrs.get('coupon_code', '').strip()
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code)
                attrs['coupon_obj'] = coupon
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({
                    "coupon_code": f"Coupon code '{coupon_code}' is invalid or expired."
                })

        return attrs



class OrderPreviewSerializer(serializers.Serializer):
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_address_id = serializers.UUIDField(required=False, allow_null=True)


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='Cancelled by customer')


class CreatePaymentSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
        default=Payment.PaymentMethod.CREDIT_CARD
    )
    transaction_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    payment_token = serializers.CharField(max_length=255, required=False, allow_blank=True)
    card_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    simulate_failure = serializers.BooleanField(default=False)
    idempotency_key = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate(self, attrs):
        order = self.context['order']
        if order.status != Order.OrderStatus.PENDING:
            raise serializers.ValidationError({
                "payment": f"Order {order.order_number} is already in '{order.status}' status and does not require payment."
            })
        return attrs

    def create(self, validated_data):
        from apps.payments.services import PaymentService
        from apps.payments.exceptions import DuplicatePaymentError, PaymentError

        order = self.context['order']
        payment_method = validated_data.get('payment_method', Payment.PaymentMethod.CREDIT_CARD)
        transaction_id = validated_data.get('transaction_id')
        simulate_failure = validated_data.get('simulate_failure', False)
        payment_token = validated_data.get('payment_token', '')
        idempotency_key = validated_data.get('idempotency_key')
        card_number = str(validated_data.get('card_number') or '').replace(' ', '').replace('-', '')

        if not payment_token:
            if simulate_failure or card_number.endswith('0002') or 'fail' in card_number.lower():
                payment_token = 'tok_test_declined'
            else:
                payment_token = 'tok_test_success'

        try:
            verification, payment = PaymentService.confirm_and_verify_payment(
                order=order,
                transaction_id=transaction_id,
                payment_token=payment_token,
                payment_method=payment_method,
                idempotency_key=idempotency_key,
                options={'simulate_failure': simulate_failure}
            )

            if not verification.success or payment.status == Payment.PaymentStatus.FAILED:
                raise serializers.ValidationError({
                    "payment": payment.error_message or "Your payment method was declined. Please try another card or payment method."
                })

            return payment
        except DuplicatePaymentError as exc:
            raise serializers.ValidationError({"payment": exc.message})
        except serializers.ValidationError:
            raise
        except Exception as exc:
            raise serializers.ValidationError({"payment": str(exc)})

