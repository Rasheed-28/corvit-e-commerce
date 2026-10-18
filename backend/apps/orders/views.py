import uuid
from decimal import Decimal
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.common.permissions import IsOwnerOrAdmin
from apps.accounts.models import Address
from apps.catalog.models import Inventory
from apps.cart.models import Cart
from .models import Coupon, Order, OrderItem, Payment
from .serializers import (
    OrderListSerializer,
    OrderDetailSerializer,
    ValidateCouponSerializer,
    CheckoutSerializer,
    OrderPreviewSerializer,
    CancelOrderSerializer,
    CreatePaymentSerializer,
    PaymentSerializer,
)

FREE_SHIPPING_THRESHOLD = Decimal('50.00')
STANDARD_SHIPPING_FEE = Decimal('9.99')
TAX_RATE = Decimal('0.08')  # 8% standard tax baseline


def calculate_order_financials(cart_subtotal: Decimal, coupon_code: str = '') -> dict:
    """
    Centralized server-side financial calculator for subtotal, coupon discounts,
    shipping rates, taxes, and final totals. Never trusts frontend amounts.
    """
    discount_amount = Decimal('0.00')
    coupon_obj = None

    if coupon_code:
        try:
            c = Coupon.objects.get(code__iexact=coupon_code.strip(), is_active=True)
            if c.is_valid_for_amount(cart_subtotal):
                coupon_obj = c
                discount_amount = c.calculate_discount(cart_subtotal)
        except Coupon.DoesNotExist:
            pass

    is_free_shipping = cart_subtotal >= FREE_SHIPPING_THRESHOLD
    shipping_fee = Decimal('0.00') if is_free_shipping or cart_subtotal == Decimal('0.00') else STANDARD_SHIPPING_FEE
    tax_amount = (cart_subtotal * TAX_RATE).quantize(Decimal('0.01'))
    total_amount = max(
        Decimal('0.00'),
        cart_subtotal + shipping_fee + tax_amount - discount_amount
    ).quantize(Decimal('0.01'))

    return {
        'subtotal': cart_subtotal,
        'discount_amount': discount_amount,
        'shipping_fee': shipping_fee,
        'tax_amount': tax_amount,
        'total_amount': total_amount,
        'coupon': coupon_obj,
        'is_free_shipping': is_free_shipping,
        'free_shipping_threshold': FREE_SHIPPING_THRESHOLD,
    }


class OrderPreviewView(APIView):
    """
    Calculates exact server totals, taxes, shipping, and discounts for checkout preview.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = OrderPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        cart = Cart.objects.filter(user=user, is_active=True).first()

        if not cart or not cart.items.exists():
            return Response({
                'success': True,
                'data': {
                    'subtotal': Decimal('0.00'),
                    'discount_amount': Decimal('0.00'),
                    'shipping_fee': Decimal('0.00'),
                    'tax_amount': Decimal('0.00'),
                    'total_amount': Decimal('0.00'),
                    'is_free_shipping': True,
                    'items_count': 0,
                }
            })

        coupon_code = serializer.validated_data.get('coupon_code', '')
        cart_subtotal = Decimal('0.00')
        preview_items = []

        for item in cart.items.select_related('product', 'variant__inventory'):
            product = item.product
            variant = item.variant
            unit_price = variant.effective_price if variant else product.base_price
            line_total = unit_price * item.quantity
            cart_subtotal += line_total
            preview_items.append({
                'id': str(item.id),
                'product_title': product.title,
                'variant_name': variant.name if variant else '',
                'quantity': item.quantity,
                'unit_price': unit_price,
                'line_total': line_total,
            })

        financials = calculate_order_financials(cart_subtotal, coupon_code)

        return Response({
            'success': True,
            'data': {
                'subtotal': financials['subtotal'],
                'discount_amount': financials['discount_amount'],
                'shipping_fee': financials['shipping_fee'],
                'tax_amount': financials['tax_amount'],
                'total_amount': financials['total_amount'],
                'is_free_shipping': financials['is_free_shipping'],
                'free_shipping_threshold': financials['free_shipping_threshold'],
                'coupon_code': financials['coupon'].code if financials['coupon'] else None,
                'items_count': len(preview_items),
                'items': preview_items,
            }
        })


class OrderListCreateView(generics.ListCreateAPIView):
    """
    List user orders or place a new order from active cart.
    Enforces transactional creation, row-level inventory locks, address snapshots,
    re-validation of prices and stock, and request idempotency.
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
        serializer = CheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        idempotency_key = serializer.validated_data.get('idempotency_key', '').strip()

        # Idempotency check: prevent duplicate orders on repeated submissions
        if idempotency_key:
            existing_order = Order.objects.filter(idempotency_key=idempotency_key, user=user).first()
            if existing_order:
                return Response({
                    'success': True,
                    'message': 'Order already processed.',
                    'data': OrderDetailSerializer(existing_order, context={'request': request}).data
                }, status=status.HTTP_200_OK)

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

        # Shipping Address resolution
        shipping_addr_id = serializer.validated_data.get('shipping_address_id')
        shipping_addr_data = serializer.validated_data.get('shipping_address')
        shipping_addr_obj = None
        shipping_snapshot = {}

        if shipping_addr_id:
            shipping_addr_obj = Address.objects.filter(id=shipping_addr_id, user=user).first()
            if shipping_addr_obj:
                shipping_snapshot = {
                    'full_name': shipping_addr_obj.full_name,
                    'phone_number': shipping_addr_obj.phone_number,
                    'street_address_1': shipping_addr_obj.street_address_1,
                    'street_address_2': shipping_addr_obj.street_address_2,
                    'city': shipping_addr_obj.city,
                    'state_or_province': shipping_addr_obj.state_or_province,
                    'postal_code': shipping_addr_obj.postal_code,
                    'country': shipping_addr_obj.country,
                }
        elif shipping_addr_data:
            shipping_snapshot = {
                'full_name': shipping_addr_data['full_name'],
                'phone_number': shipping_addr_data['phone_number'],
                'street_address_1': shipping_addr_data['street_address_1'],
                'street_address_2': shipping_addr_data.get('street_address_2', ''),
                'city': shipping_addr_data['city'],
                'state_or_province': shipping_addr_data['state_or_province'],
                'postal_code': shipping_addr_data['postal_code'],
                'country': shipping_addr_data.get('country', 'United States'),
            }
            if shipping_addr_data.get('save_to_address_book'):
                shipping_addr_obj = Address.objects.create(
                    user=user,
                    full_name=shipping_snapshot['full_name'],
                    phone_number=shipping_snapshot['phone_number'],
                    street_address_1=shipping_snapshot['street_address_1'],
                    street_address_2=shipping_snapshot['street_address_2'],
                    city=shipping_snapshot['city'],
                    state_or_province=shipping_snapshot['state_or_province'],
                    postal_code=shipping_snapshot['postal_code'],
                    country=shipping_snapshot['country'],
                    address_type='shipping'
                )

        # Billing Address resolution
        billing_addr_id = serializer.validated_data.get('billing_address_id')
        billing_addr_data = serializer.validated_data.get('billing_address')
        billing_addr_obj = shipping_addr_obj
        billing_snapshot = shipping_snapshot

        if billing_addr_id:
            billing_addr_obj = Address.objects.filter(id=billing_addr_id, user=user).first() or shipping_addr_obj
            if billing_addr_obj:
                billing_snapshot = {
                    'full_name': billing_addr_obj.full_name,
                    'phone_number': billing_addr_obj.phone_number,
                    'street_address_1': billing_addr_obj.street_address_1,
                    'street_address_2': billing_addr_obj.street_address_2,
                    'city': billing_addr_obj.city,
                    'state_or_province': billing_addr_obj.state_or_province,
                    'postal_code': billing_addr_obj.postal_code,
                    'country': billing_addr_obj.country,
                }
        elif billing_addr_data:
            billing_snapshot = {
                'full_name': billing_addr_data['full_name'],
                'phone_number': billing_addr_data['phone_number'],
                'street_address_1': billing_addr_data['street_address_1'],
                'street_address_2': billing_addr_data.get('street_address_2', ''),
                'city': billing_addr_data['city'],
                'state_or_province': billing_addr_data['state_or_province'],
                'postal_code': billing_addr_data['postal_code'],
                'country': billing_addr_data.get('country', 'United States'),
            }

        coupon_code = serializer.validated_data.get('coupon_code', '')
        payment_method = serializer.validated_data.get('payment_method', Payment.PaymentMethod.CREDIT_CARD)

        with transaction.atomic():
            cart_subtotal = Decimal('0.00')
            items_to_create = []

            for cart_item in cart.items.select_related('product', 'variant__inventory'):
                product = cart_item.product
                variant = cart_item.variant
                quantity = cart_item.quantity

                if not product.is_active or (variant and not variant.is_active):
                    return Response({
                        'success': False,
                        'error': {
                            'code': 'ITEM_UNAVAILABLE',
                            'message': f"'{product.title}' is no longer available for purchase.",
                            'details': None
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Row-level lock on inventory to guarantee stock consistency
                if variant and hasattr(variant, 'inventory'):
                    inv = Inventory.objects.select_for_update().filter(id=variant.inventory.id).first()
                    if not inv or inv.available_quantity < quantity:
                        avail = inv.available_quantity if inv else 0
                        return Response({
                            'success': False,
                            'error': {
                                'code': 'INSUFFICIENT_STOCK',
                                'message': f"Insufficient stock for '{variant.name}' ({avail} available).",
                                'details': None
                            }
                        }, status=status.HTTP_400_BAD_REQUEST)

                    # Deduct stock upon order creation
                    inv.quantity -= quantity
                    inv.save(update_fields=['quantity', 'updated_at'])

                # Re-validate price from live catalog model
                unit_price = variant.effective_price if variant else product.base_price
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

            financials = calculate_order_financials(cart_subtotal, coupon_code)
            coupon = financials['coupon']

            # Increment coupon usage count
            if coupon:
                coupon.times_used += 1
                coupon.save(update_fields=['times_used', 'updated_at'])

            initial_status = Order.OrderStatus.PENDING
            if payment_method == Payment.PaymentMethod.CASH_ON_DELIVERY:
                initial_status = Order.OrderStatus.PROCESSING

            order = Order.objects.create(
                user=user,
                status=initial_status,
                shipping_address=shipping_addr_obj,
                billing_address=billing_addr_obj,
                shipping_address_snapshot=shipping_snapshot,
                billing_address_snapshot=billing_snapshot,
                subtotal=financials['subtotal'],
                shipping_fee=financials['shipping_fee'],
                tax_amount=financials['tax_amount'],
                discount_amount=financials['discount_amount'],
                total_amount=financials['total_amount'],
                coupon=coupon,
                idempotency_key=idempotency_key or None,
                customer_notes=serializer.validated_data.get('customer_notes', '')
            )

            # Create immutable OrderItems
            for itm in items_to_create:
                OrderItem.objects.create(order=order, **itm)

            # Record initial payment record for Cash on Delivery
            if payment_method == Payment.PaymentMethod.CASH_ON_DELIVERY:
                Payment.objects.create(
                    order=order,
                    transaction_id=f"COD-{uuid.uuid4().hex[:10].upper()}",
                    payment_method=Payment.PaymentMethod.CASH_ON_DELIVERY,
                    status=Payment.PaymentStatus.PENDING,
                    amount=financials['total_amount'],
                    currency=order.currency,
                    gateway_response={'type': 'cash_on_delivery', 'message': 'Payment will be collected upon courier delivery.'}
                )

            # Deactivate shopping cart
            cart.items.all().delete()
            cart.is_active = False
            cart.save(update_fields=['is_active', 'updated_at'])

        return Response({
            'success': True,
            'message': 'Order placed successfully.',
            'data': OrderDetailSerializer(order, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieves full details for a specific order.
    Customers are strictly restricted to their own orders (404/403 for unauthorized access).
    Status modification is strictly restricted to administrative staff.
    """
    serializer_class = OrderDetailSerializer
    lookup_field = 'order_number'
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
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

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'Only store staff may alter order statuses directly.',
                    'details': None
                }
            }, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status:
            if new_status not in Order.OrderStatus.values:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'VALIDATION_ERROR',
                        'message': f"Invalid status '{new_status}'. Allowed: {Order.OrderStatus.values}",
                        'details': None
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
            instance.status = new_status
            instance.save(update_fields=['status', 'updated_at'])

        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'message': 'Order updated successfully.',
            'data': serializer.data
        })


class OrderCancelView(APIView):
    """
    Allows a customer to cancel their own order before shipment.
    Transactionally restores inventory quantities and processes cancellation.
    """
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def post(self, request, order_number):
        user = request.user
        if user.is_staff:
            order = get_object_or_404(Order, order_number=order_number)
        else:
            order = get_object_or_404(Order, order_number=order_number, user=user)

        self.check_object_permissions(request, order)

        serializer = CancelOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason')

        if order.status == Order.OrderStatus.CANCELLED:
            return Response({
                'success': False,
                'error': {
                    'code': 'ALREADY_CANCELLED',
                    'message': 'This order has already been cancelled.',
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        if not order.can_cancel:
            return Response({
                'success': False,
                'error': {
                    'code': 'CANNOT_CANCEL',
                    'message': f"Cannot cancel order in '{order.status}' status (only Pending, Paid, or Processing orders can be cancelled).",
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Apply row-level lock on order
            locked_order = Order.objects.select_for_update().get(id=order.id)

            # Restore inventory quantities
            for item in locked_order.items.select_related('variant__inventory').all():
                if item.variant and hasattr(item.variant, 'inventory'):
                    inv = Inventory.objects.select_for_update().filter(id=item.variant.inventory.id).first()
                    if inv:
                        inv.quantity += item.quantity
                        inv.save(update_fields=['quantity', 'updated_at'])

            # If order was paid, record refund record
            if locked_order.status == Order.OrderStatus.PAID:
                Payment.objects.create(
                    order=locked_order,
                    transaction_id=f"REF-{uuid.uuid4().hex[:10].upper()}",
                    payment_method=Payment.PaymentMethod.CREDIT_CARD,
                    status=Payment.PaymentStatus.REFUNDED,
                    amount=locked_order.total_amount,
                    currency=locked_order.currency,
                    gateway_response={'reason': reason, 'message': 'Full refund triggered upon customer order cancellation.'}
                )

            locked_order.status = Order.OrderStatus.CANCELLED
            locked_order.cancellation_reason = reason
            locked_order.save(update_fields=['status', 'cancellation_reason', 'updated_at'])

        locked_order.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Order successfully cancelled and inventory restored.',
            'data': OrderDetailSerializer(locked_order, context={'request': request}).data
        }, status=status.HTTP_200_OK)


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
    Records and verifies payment transactions for an order.
    Never marks an order paid unless server-side gateway processing succeeds.
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
            'message': 'Payment successfully recorded.',
            'data': PaymentSerializer(payment).data
        }, status=status.HTTP_201_CREATED)
