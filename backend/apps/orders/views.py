from decimal import Decimal
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.common.permissions import IsOwnerOrAdmin
from apps.accounts.models import Address
from apps.cart.models import Cart
from .models import Coupon, Order, OrderItem, Payment
from .serializers import (
    OrderListSerializer,
    OrderDetailSerializer,
    ValidateCouponSerializer,
    CheckoutSerializer,
    CreatePaymentSerializer,
    PaymentSerializer,
)

class OrderListCreateView(generics.ListCreateAPIView):
    """
    List user orders or place a new order from active cart.
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Order.objects.all()

    def get_serializer_class(self):
        if self.request and self.request.method == 'POST':
            return CheckoutSerializer
        return OrderListSerializer

    def get_queryset(self):
        if not self.request or not self.request.user.is_authenticated:
            return Order.objects.none()
        if self.request.user.is_staff:
            return Order.objects.all().prefetch_related('items')
        return Order.objects.filter(user=self.request.user).prefetch_related('items')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        """
        Executes atomic checkout: validates cart, locks inventory, creates order items with snapshots, and computes server totals.
        """
        serializer = CheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        cart = Cart.objects.filter(user=user, is_active=True).first()

        if not cart or not cart.items.exists():
            return Response({
                'success': False,
                'error': {
                    'code': 'EMPTY_CART',
                    'message': 'Cannot create order: your shopping cart is empty.',
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        shipping_addr = Address.objects.get(id=serializer.validated_data['shipping_address_id'], user=user)
        billing_addr_id = serializer.validated_data.get('billing_address_id')
        billing_addr = Address.objects.get(id=billing_addr_id, user=user) if billing_addr_id else shipping_addr

        coupon_code = serializer.validated_data.get('coupon_code', '').strip().upper()
        coupon = None
        discount_amount = Decimal('0.00')

        with transaction.atomic():
            # Validate cart subtotal
            cart_subtotal = Decimal('0.00')
            items_to_create = []

            for cart_item in cart.items.select_related('product', 'variant__inventory'):
                product = cart_item.product
                variant = cart_item.variant
                quantity = cart_item.quantity
                unit_price = variant.effective_price if variant else product.base_price

                # Check and decrement inventory if variant inventory is present
                if variant and hasattr(variant, 'inventory'):
                    inv = variant.inventory
                    if inv.available_quantity < quantity:
                        return Response({
                            'success': False,
                            'error': {
                                'code': 'INSUFFICIENT_STOCK',
                                'message': f"Insufficient stock for {variant.name} ({inv.available_quantity} available).",
                                'details': None
                            }
                        }, status=status.HTTP_400_BAD_REQUEST)
                    inv.quantity -= quantity
                    inv.save(update_fields=['quantity', 'updated_at'])

                line_total = unit_price * quantity
                cart_subtotal += line_total

                items_to_create.append({
                    'product': product,
                    'variant': variant,
                    'product_title': product.title,
                    'variant_name': variant.name if variant else '',
                    'sku': variant.sku if variant else product.sku,
                    'unit_price': unit_price,
                    'quantity': quantity,
                    'line_total': line_total,
                })

            # Validate coupon if supplied
            if coupon_code:
                try:
                    c = Coupon.objects.get(code__iexact=coupon_code, is_active=True)
                    if c.is_valid_for_amount(cart_subtotal):
                        coupon = c
                        discount_amount = c.calculate_discount(cart_subtotal)
                        c.times_used += 1
                        c.save(update_fields=['times_used', 'updated_at'])
                except Coupon.DoesNotExist:
                    pass

            # Calculate server totals
            shipping_fee = Decimal('10.00') if cart_subtotal < Decimal('100.00') else Decimal('0.00')
            tax_amount = (cart_subtotal * Decimal('0.05')).quantize(Decimal('0.01')) # 5% baseline tax
            total_amount = max(Decimal('0.00'), cart_subtotal + shipping_fee + tax_amount - discount_amount)

            order = Order.objects.create(
                user=user,
                shipping_address=shipping_addr,
                billing_address=billing_addr,
                subtotal=cart_subtotal,
                shipping_fee=shipping_fee,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                total_amount=total_amount,
                coupon=coupon,
                customer_notes=serializer.validated_data.get('customer_notes', '')
            )

            # Preserve static address snapshot
            order.snapshot_addresses()
            order.save(update_fields=['shipping_address_snapshot', 'billing_address_snapshot'])

            # Create immutable OrderItems
            for item_data in items_to_create:
                OrderItem.objects.create(order=order, **item_data)

            # Deactivate cart
            cart.is_active = False
            cart.save(update_fields=['is_active', 'updated_at'])

        return Response({
            'success': True,
            'message': 'Order placed successfully.',
            'data': OrderDetailSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    """
    Retrieves full details for a specific order. Protected by ownership permission.
    """
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    serializer_class = OrderDetailSerializer
    lookup_field = 'order_number'
    queryset = Order.objects.all()

    def get_queryset(self):
        if not self.request or not self.request.user.is_authenticated:
            return Order.objects.none()
        if self.request.user.is_staff:
            return Order.objects.all().prefetch_related('items', 'payments')
        return Order.objects.filter(user=self.request.user).prefetch_related('items', 'payments')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })


class ValidateCouponView(APIView):
    """
    Validates a promotional coupon code against an order subtotal.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ValidateCouponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coupon = serializer.validated_data['coupon_obj']
        discount = serializer.validated_data['discount_amount']

        return Response({
            'success': True,
            'message': 'Coupon code is valid.',
            'data': {
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_value': coupon.discount_value,
                'discount_amount': discount,
            }
        })


class OrderPaymentView(APIView):
    """
    Records a payment transaction for an existing order.
    """
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_order(self, order_number):
        if self.request.user.is_staff:
            order = get_object_or_404(Order, order_number=order_number)
        else:
            order = get_object_or_404(Order, order_number=order_number, user=self.request.user)
        self.check_object_permissions(self.request, order)
        return order

    def get(self, request, order_number):
        order = self.get_order(order_number)
        serializer = PaymentSerializer(order.payments.all(), many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def post(self, request, order_number):
        order = self.get_order(order_number)
        serializer = CreatePaymentSerializer(data=request.data, context={'order': order})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        return Response({
            'success': True,
            'message': 'Payment recorded successfully.',
            'data': PaymentSerializer(payment).data
        }, status=status.HTTP_201_CREATED)
