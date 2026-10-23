import datetime
from decimal import Decimal
from django.db import models, transaction
from django.db.models import Sum, Count, Q, F, Avg
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.catalog.models import (
    ProductCategory,
    Product,
    ProductImage,
    ProductVariant,
    Inventory,
    Review,
)
from apps.orders.models import Order, OrderItem, Coupon, Payment
from .serializers import (
    AdminCategorySerializer,
    AdminProductListSerializer,
    AdminProductDetailSerializer,
    AdminProductCreateUpdateSerializer,
    AdminProductImageSerializer,
    AdminProductVariantSerializer,
    AdminInventorySerializer,
    AdminInventoryUpdateSerializer,
    AdminOrderListSerializer,
    AdminOrderDetailSerializer,
    AdminOrderStatusUpdateSerializer,
    AdminCustomerListSerializer,
    AdminCustomerDetailSerializer,
    AdminCouponSerializer,
    AdminReviewSerializer,
)

User = get_user_model()


def parse_date_range(request):
    """
    Parses 'period' query parameter ('today', '7d', '30d', '90d', 'all')
    or explicit 'start_date' and 'end_date' (YYYY-MM-DD).
    Returns (start_datetime, end_datetime).
    """
    now = timezone.now()
    period = request.query_params.get('period', '30d').lower()

    start_param = request.query_params.get('start_date')
    end_param = request.query_params.get('end_date')

    if start_param and end_param:
        try:
            s_date = datetime.date.fromisoformat(start_param)
            e_date = datetime.date.fromisoformat(end_param)
            start_dt = timezone.make_aware(datetime.datetime.combine(s_date, datetime.time.min))
            end_dt = timezone.make_aware(datetime.datetime.combine(e_date, datetime.time.max))
            return start_dt, end_dt
        except (ValueError, TypeError):
            pass

    if period == 'today':
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif period == '7d':
        start_dt = now - datetime.timedelta(days=7)
        end_dt = now
    elif period == '90d':
        start_dt = now - datetime.timedelta(days=90)
        end_dt = now
    elif period == 'all':
        start_dt = timezone.make_aware(datetime.datetime(2020, 1, 1))
        end_dt = now
    else:  # default '30d'
        start_dt = now - datetime.timedelta(days=30)
        end_dt = now

    return start_dt, end_dt


# ==============================================================================
# 1. Dashboard Overview & Sales Reports
# ==============================================================================

class AdminOverviewView(APIView):
    """
    High-level dashboard KPIs, sales trends, recent orders, and stock alerts.
    Strictly restricted to administrative staff users.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        start_dt, end_dt = parse_date_range(request)

        # Revenue & Order Metrics (only counting confirmed/paid statuses for revenue)
        paid_statuses = [
            Order.OrderStatus.PAID,
            Order.OrderStatus.PROCESSING,
            Order.OrderStatus.SHIPPED,
            Order.OrderStatus.DELIVERED,
        ]

        period_orders = Order.objects.filter(created_at__range=(start_dt, end_dt))
        paid_period_orders = period_orders.filter(status__in=paid_statuses)

        revenue_agg = paid_period_orders.aggregate(total=Sum('total_amount'))
        total_revenue = revenue_agg['total'] or Decimal('0.00')

        total_orders_count = period_orders.count()
        paid_orders_count = paid_period_orders.count()
        pending_orders_count = period_orders.filter(status=Order.OrderStatus.PENDING).count()
        cancelled_orders_count = period_orders.filter(status=Order.OrderStatus.CANCELLED).count()
        refunded_orders_count = period_orders.filter(status=Order.OrderStatus.REFUNDED).count()

        avg_order_value = (
            (total_revenue / paid_orders_count).quantize(Decimal('0.01'))
            if paid_orders_count > 0 else Decimal('0.00')
        )

        # Customer Metrics
        total_customers = User.objects.filter(is_staff=False).count()
        new_customers = User.objects.filter(is_staff=False, date_joined__range=(start_dt, end_dt)).count()

        # Inventory Alerts
        low_stock_qs = Inventory.objects.filter(
            quantity__lte=F('low_stock_threshold') + F('reserved_quantity')
        )
        low_stock_count = low_stock_qs.count()

        # Sales Trend (Daily Aggregation)
        sales_trend = (
            paid_period_orders
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(
                revenue=Sum('total_amount'),
                orders_count=Count('id')
            )
            .order_by('date')
        )

        trend_data = [
            {
                'date': entry['date'].strftime('%Y-%m-%d') if entry['date'] else '',
                'revenue': float(entry['revenue'] or 0),
                'orders_count': entry['orders_count'],
            }
            for entry in sales_trend
        ]

        # Recent 5 Orders
        recent_orders = Order.objects.all().order_by('-created_at')[:5]
        recent_orders_data = AdminOrderListSerializer(recent_orders, many=True).data

        # Top 5 Low Stock Items
        low_stock_items = low_stock_qs.select_related('variant__product').order_by('quantity')[:5]
        low_stock_data = AdminInventorySerializer(low_stock_items, many=True).data

        return Response({
            'success': True,
            'data': {
                'metrics': {
                    'total_revenue': float(total_revenue),
                    'total_orders': total_orders_count,
                    'paid_orders_count': paid_orders_count,
                    'pending_orders_count': pending_orders_count,
                    'cancelled_orders_count': cancelled_orders_count,
                    'refunded_orders_count': refunded_orders_count,
                    'average_order_value': float(avg_order_value),
                    'total_customers': total_customers,
                    'new_customers_count': new_customers,
                    'low_stock_count': low_stock_count,
                },
                'sales_trend': trend_data,
                'recent_orders': recent_orders_data,
                'low_stock_items': low_stock_data,
                'period': {
                    'start': start_dt.isoformat(),
                    'end': end_dt.isoformat(),
                }
            }
        })


class AdminSalesReportView(APIView):
    """
    Comprehensive sales analytics report with line-item volume,
    discounts, tax, shipping, and top-performing products.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        start_dt, end_dt = parse_date_range(request)

        paid_statuses = [
            Order.OrderStatus.PAID,
            Order.OrderStatus.PROCESSING,
            Order.OrderStatus.SHIPPED,
            Order.OrderStatus.DELIVERED,
        ]

        orders_qs = Order.objects.filter(created_at__range=(start_dt, end_dt))
        paid_orders_qs = orders_qs.filter(status__in=paid_statuses)

        financials = paid_orders_qs.aggregate(
            gross_subtotal=Sum('subtotal'),
            total_shipping=Sum('shipping_fee'),
            total_tax=Sum('tax_amount'),
            total_discounts=Sum('discount_amount'),
            net_revenue=Sum('total_amount'),
        )

        gross_subtotal = financials['gross_subtotal'] or Decimal('0.00')
        total_shipping = financials['total_shipping'] or Decimal('0.00')
        total_tax = financials['total_tax'] or Decimal('0.00')
        total_discounts = financials['total_discounts'] or Decimal('0.00')
        net_revenue = financials['net_revenue'] or Decimal('0.00')

        # Total Line Items Sold
        items_sold_agg = OrderItem.objects.filter(
            order__in=paid_orders_qs
        ).aggregate(total_units=Sum('quantity'))
        total_units_sold = items_sold_agg['total_units'] or 0

        # Orders Status Breakdown
        status_breakdown = (
            orders_qs
            .values('status')
            .annotate(count=Count('id'), total_val=Sum('total_amount'))
            .order_by('-count')
        )

        # Top 10 Selling Products
        top_products = (
            OrderItem.objects.filter(order__in=paid_orders_qs)
            .values('product_title', 'sku')
            .annotate(
                units_sold=Sum('quantity'),
                revenue_generated=Sum('line_total')
            )
            .order_by('-units_sold')[:10]
        )

        # Payment Methods Breakdown
        payment_breakdown = (
            Payment.objects.filter(order__in=paid_orders_qs)
            .values('payment_method')
            .annotate(
                count=Count('id'),
                total_amount=Sum('amount')
            )
            .order_by('-total_amount')
        )

        return Response({
            'success': True,
            'data': {
                'financial_summary': {
                    'gross_subtotal': float(gross_subtotal),
                    'total_shipping': float(total_shipping),
                    'total_tax': float(total_tax),
                    'total_discounts': float(total_discounts),
                    'net_revenue': float(net_revenue),
                    'total_orders': paid_orders_qs.count(),
                    'total_units_sold': total_units_sold,
                },
                'status_breakdown': list(status_breakdown),
                'top_products': list(top_products),
                'payment_methods': list(payment_breakdown),
                'date_range': {
                    'start': start_dt.isoformat(),
                    'end': end_dt.isoformat(),
                }
            }
        })


# ==============================================================================
# 2. Product & Category Management
# ==============================================================================

class AdminProductListCreateView(generics.ListCreateAPIView):
    """
    Admin listing and creation for products. Supports full catalog search,
    category filters, active status, stock status, and pagination.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request and self.request.method == 'POST':
            return AdminProductCreateUpdateSerializer
        return AdminProductListSerializer

    def get_queryset(self):
        qs = Product.objects.all().select_related('category').prefetch_related('images', 'variants__inventory')

        # Keyword Search
        q = self.request.query_params.get('search', '').strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(sku__icontains=q) | Q(description__icontains=q))

        # Category Filter
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)

        # Active Filter
        is_active = self.request.query_params.get('is_active')
        if is_active in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', '0'):
            qs = qs.filter(is_active=False)

        # Featured Filter
        is_featured = self.request.query_params.get('is_featured')
        if is_featured in ('true', '1'):
            qs = qs.filter(is_featured=True)

        # Ordering
        ordering = self.request.query_params.get('ordering', '-created_at')
        allowed_orderings = ['created_at', '-created_at', 'title', '-title', 'base_price', '-base_price']
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)

        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response({
            'success': True,
            'message': f"Product '{product.title}' created successfully.",
            'data': AdminProductDetailSerializer(product, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin detail, update, and deletion of a product.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = 'id'
    queryset = Product.objects.all().select_related('category').prefetch_related('images', 'variants__inventory')

    def get_serializer_class(self):
        if self.request and self.request.method in ('PUT', 'PATCH'):
            return AdminProductCreateUpdateSerializer
        return AdminProductDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response({
            'success': True,
            'message': f"Product '{product.title}' updated successfully.",
            'data': AdminProductDetailSerializer(product, context={'request': request}).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        title = instance.title
        # If order items reference it, protect catalog integrity by deactivating rather than hard deleting
        if OrderItem.objects.filter(product=instance).exists():
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
            return Response({
                'success': True,
                'message': f"Product '{title}' is referenced in past customer orders. Deactivated product instead of hard deleting.",
            }, status=status.HTTP_200_OK)

        instance.delete()
        return Response({
            'success': True,
            'message': f"Product '{title}' was permanently deleted.",
        }, status=status.HTTP_200_OK)


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    """Admin category list and creation endpoint."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminCategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = ProductCategory.objects.all().select_related('parent').prefetch_related('children', 'products')

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get('search', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(slug__icontains=q) | Q(description__icontains=q))
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response({
            'success': True,
            'message': f"Category '{category.name}' created successfully.",
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin category inspection, update, and deletion."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminCategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = 'id'
    queryset = ProductCategory.objects.all().select_related('parent').prefetch_related('children', 'products')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response({
            'success': True,
            'message': f"Category '{category.name}' updated successfully.",
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        if instance.products.exists():
            return Response({
                'success': False,
                'error': {
                    'code': 'CATEGORY_IN_USE',
                    'message': f"Cannot delete category '{name}' because it contains {instance.products.count()} products. Reassign products first."
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        instance.delete()
        return Response({
            'success': True,
            'message': f"Category '{name}' was deleted successfully."
        }, status=status.HTTP_200_OK)


# ==============================================================================
# 3. Product Media Gallery Management
# ==============================================================================

class AdminProductImageListCreateView(generics.ListCreateAPIView):
    """View and upload images for a specific product."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminProductImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        product_id = self.kwargs['product_id']
        return ProductImage.objects.filter(product_id=product_id)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        product = get_object_or_404(Product, id=self.kwargs['product_id'])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.save(product=product)
        return Response({
            'success': True,
            'message': 'Image uploaded successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class AdminProductImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Modify or delete a specific product image."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminProductImageSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = 'id'
    queryset = ProductImage.objects.all()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        image = serializer.save()
        return Response({
            'success': True,
            'message': 'Image updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'Image deleted successfully.'
        }, status=status.HTTP_200_OK)


# ==============================================================================
# 4. Inventory & Low-Stock Management
# ==============================================================================

class AdminInventoryListView(APIView):
    """
    List and filter inventory stock levels across all variants.
    Includes quick low-stock indicators and summary stats.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = Inventory.objects.all().select_related('variant__product')

        # Filters
        low_stock_only = request.query_params.get('low_stock_only', 'false').lower() in ('true', '1')
        out_of_stock_only = request.query_params.get('out_of_stock', 'false').lower() in ('true', '1')
        search_q = request.query_params.get('search', '').strip()

        if low_stock_only:
            qs = qs.filter(quantity__lte=F('low_stock_threshold') + F('reserved_quantity'))
        if out_of_stock_only:
            qs = qs.filter(quantity__lte=F('reserved_quantity'))
        if search_q:
            qs = qs.filter(
                Q(variant__sku__icontains=search_q) |
                Q(variant__name__icontains=search_q) |
                Q(variant__product__title__icontains=search_q)
            )

        # Summary stats across full inventory
        total_tracked = Inventory.objects.count()
        low_stock_count = Inventory.objects.filter(
            quantity__lte=F('low_stock_threshold') + F('reserved_quantity'),
            quantity__gt=F('reserved_quantity')
        ).count()
        out_of_stock_count = Inventory.objects.filter(quantity__lte=F('reserved_quantity')).count()
        healthy_count = total_tracked - low_stock_count - out_of_stock_count

        serializer = AdminInventorySerializer(qs.order_by('quantity'), many=True)
        return Response({
            'success': True,
            'summary': {
                'total_tracked': total_tracked,
                'healthy_count': healthy_count,
                'low_stock_count': low_stock_count,
                'out_of_stock_count': out_of_stock_count,
            },
            'data': serializer.data
        })


class AdminInventoryDetailView(APIView):
    """
    Directly adjust stock quantities or threshold for a variant.
    """
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, id):
        inventory = get_object_or_404(Inventory, id=id)
        serializer = AdminInventoryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            inv = Inventory.objects.select_for_update().get(id=inventory.id)
            if 'quantity' in serializer.validated_data:
                inv.quantity = serializer.validated_data['quantity']
            elif 'adjustment' in serializer.validated_data:
                inv.quantity = max(0, inv.quantity + serializer.validated_data['adjustment'])

            if 'low_stock_threshold' in serializer.validated_data:
                inv.low_stock_threshold = serializer.validated_data['low_stock_threshold']

            inv.save()

        inv.refresh_from_db()
        return Response({
            'success': True,
            'message': f"Inventory stock for '{inv.variant.sku}' updated to {inv.quantity}.",
            'data': AdminInventorySerializer(inv).data
        })


# ==============================================================================
# 5. Order Administration & Lifecycle Management
# ==============================================================================

class AdminOrderListView(APIView):
    """
    List all store orders with customer search, status filters, date filters, and pagination.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = Order.objects.all().select_related('user').prefetch_related('items', 'payments')

        # Status filter
        status_param = request.query_params.get('status')
        if status_param and status_param in Order.OrderStatus.values:
            qs = qs.filter(status=status_param)

        # Search filter (order number, customer email, customer name)
        search_q = request.query_params.get('search', '').strip()
        if search_q:
            qs = qs.filter(
                Q(order_number__icontains=search_q) |
                Q(user__email__icontains=search_q) |
                Q(user__first_name__icontains=search_q) |
                Q(user__last_name__icontains=search_q)
            )

        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date and end_date:
            try:
                s_dt = timezone.make_aware(datetime.datetime.combine(datetime.date.fromisoformat(start_date), datetime.time.min))
                e_dt = timezone.make_aware(datetime.datetime.combine(datetime.date.fromisoformat(end_date), datetime.time.max))
                qs = qs.filter(created_at__range=(s_dt, e_dt))
            except (ValueError, TypeError):
                pass

        # Pagination
        from apps.common.pagination import StandardResultsSetPagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs.order_by('-created_at'), request)
        if page is not None:
            serializer = AdminOrderListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AdminOrderListSerializer(qs.order_by('-created_at'), many=True)
        return Response({'success': True, 'data': serializer.data})


class AdminOrderDetailView(APIView):
    """Full detail view for a specific order."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, order_number):
        order = get_object_or_404(
            Order.objects.select_related('user').prefetch_related('items', 'payments'),
            order_number=order_number
        )
        serializer = AdminOrderDetailSerializer(order)
        return Response({'success': True, 'data': serializer.data})


class AdminOrderStatusUpdateView(APIView):
    """
    Updates order lifecycle status with state machine enforcement and inventory handling.
    """
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, order_number):
        order = get_object_or_404(Order, order_number=order_number)
        serializer = AdminOrderStatusUpdateSerializer(data=request.data, context={'order': order})
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        reason = serializer.validated_data.get('reason', '')
        prev_status = order.status

        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(id=order.id)

            # If cancelling, restore inventory atomically
            if new_status == Order.OrderStatus.CANCELLED and locked_order.status != Order.OrderStatus.CANCELLED:
                for item in locked_order.items.select_related('variant__inventory').all():
                    if item.variant and hasattr(item.variant, 'inventory'):
                        inv = Inventory.objects.select_for_update().filter(id=item.variant.inventory.id).first()
                        if inv:
                            inv.quantity += item.quantity
                            inv.save(update_fields=['quantity', 'updated_at'])

                locked_order.cancellation_reason = reason or 'Cancelled by Administrator'

            locked_order.status = new_status
            locked_order.save(update_fields=['status', 'cancellation_reason', 'updated_at'])

        locked_order.refresh_from_db()

        # Send customer notification email for status transition
        if prev_status != new_status:
            try:
                from apps.orders.services import send_order_status_update_email
                send_order_status_update_email(locked_order, prev_status, new_status, reason=reason)
            except Exception as mail_exc:
                pass

        return Response({
            'success': True,
            'message': f"Order {order_number} status updated to '{new_status}'.",
            'data': AdminOrderDetailSerializer(locked_order).data
        })



# ==============================================================================
# 6. Customer Account Administration
# ==============================================================================

class AdminCustomerListView(APIView):
    """
    List all registered customers with lifetime spend and order metrics.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = User.objects.filter(is_staff=False).select_related('customer_profile').prefetch_related('orders')

        search_q = request.query_params.get('search', '').strip()
        if search_q:
            qs = qs.filter(
                Q(email__icontains=search_q) |
                Q(username__icontains=search_q) |
                Q(first_name__icontains=search_q) |
                Q(last_name__icontains=search_q)
            )

        is_active = request.query_params.get('is_active')
        if is_active in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', '0'):
            qs = qs.filter(is_active=False)

        from apps.common.pagination import StandardResultsSetPagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs.order_by('-date_joined'), request)
        if page is not None:
            serializer = AdminCustomerListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AdminCustomerListSerializer(qs.order_by('-date_joined'), many=True)
        return Response({'success': True, 'data': serializer.data})


class AdminCustomerDetailView(APIView):
    """Customer profile details and complete order history."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, id):
        customer = get_object_or_404(User.objects.select_related('customer_profile').prefetch_related('orders'), id=id)
        serializer = AdminCustomerDetailSerializer(customer)
        return Response({'success': True, 'data': serializer.data})


class AdminCustomerStatusToggleView(APIView):
    """Activate or deactivate a customer account."""
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, id):
        customer = get_object_or_404(User, id=id)
        if customer.is_superuser or customer.pk == request.user.pk:
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN_MODIFICATION',
                    'message': 'Cannot deactivate superuser or own administrative account.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        customer.is_active = not customer.is_active
        customer.save(update_fields=['is_active'])

        state_str = 'activated' if customer.is_active else 'deactivated'
        return Response({
            'success': True,
            'message': f"Customer account '{customer.get_username()}' was {state_str}.",
            'data': {'id': customer.id, 'is_active': customer.is_active}
        })


# ==============================================================================
# 7. Coupon & Discount Management
# ==============================================================================

class AdminCouponListCreateView(generics.ListCreateAPIView):
    """List and create promotional discount coupons."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminCouponSerializer
    queryset = Coupon.objects.all().order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        search_q = self.request.query_params.get('search', '').strip()
        if search_q:
            qs = qs.filter(code__icontains=search_q)

        is_active = self.request.query_params.get('is_active')
        if is_active in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', '0'):
            qs = qs.filter(is_active=False)

        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coupon = serializer.save()
        return Response({
            'success': True,
            'message': f"Coupon '{coupon.code}' created successfully.",
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class AdminCouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Inspect, edit, or delete a discount coupon."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminCouponSerializer
    lookup_field = 'id'
    queryset = Coupon.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        coupon = serializer.save()
        return Response({
            'success': True,
            'message': f"Coupon '{coupon.code}' updated successfully.",
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        code = instance.code
        instance.delete()
        return Response({
            'success': True,
            'message': f"Coupon '{code}' was deleted successfully."
        }, status=status.HTTP_200_OK)


# ==============================================================================
# 8. Review Moderation
# ==============================================================================

class AdminReviewListView(APIView):
    """
    List product reviews across all products with approval status and rating filters.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = Review.objects.all().select_related('product', 'user').order_by('-created_at')

        # Filters
        is_approved = request.query_params.get('is_approved')
        if is_approved in ('true', '1'):
            qs = qs.filter(is_approved=True)
        elif is_approved in ('false', '0'):
            qs = qs.filter(is_approved=False)

        rating = request.query_params.get('rating')
        if rating and rating.isdigit():
            qs = qs.filter(rating=int(rating))

        search_q = request.query_params.get('search', '').strip()
        if search_q:
            qs = qs.filter(
                Q(product__title__icontains=search_q) |
                Q(title__icontains=search_q) |
                Q(comment__icontains=search_q) |
                Q(user__email__icontains=search_q)
            )

        from apps.common.pagination import StandardResultsSetPagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AdminReviewSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AdminReviewSerializer(qs, many=True)
        return Response({'success': True, 'data': serializer.data})


class AdminReviewModerationView(APIView):
    """Approve or unapprove customer product review."""
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, id):
        review = get_object_or_404(Review, id=id)
        approve_param = request.data.get('is_approved')

        if approve_param is None:
            # Toggle
            review.is_approved = not review.is_approved
        else:
            review.is_approved = bool(approve_param)

        review.save(update_fields=['is_approved', 'updated_at'])

        status_text = 'approved' if review.is_approved else 'unapproved'
        return Response({
            'success': True,
            'message': f"Review has been marked as {status_text}.",
            'data': AdminReviewSerializer(review).data
        })


class AdminReviewDeleteView(APIView):
    """Delete a spam or offensive review."""
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, id):
        review = get_object_or_404(Review, id=id)
        review.delete()
        return Response({
            'success': True,
            'message': 'Review was deleted successfully.'
        }, status=status.HTTP_200_OK)
