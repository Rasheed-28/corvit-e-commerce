from django.urls import path
from .views import (
    AdminOverviewView,
    AdminSalesReportView,
    AdminProductListCreateView,
    AdminProductDetailView,
    AdminCategoryListCreateView,
    AdminCategoryDetailView,
    AdminProductImageListCreateView,
    AdminProductImageDetailView,
    AdminInventoryListView,
    AdminInventoryDetailView,
    AdminOrderListView,
    AdminOrderDetailView,
    AdminOrderStatusUpdateView,
    AdminCustomerListView,
    AdminCustomerDetailView,
    AdminCustomerStatusToggleView,
    AdminCouponListCreateView,
    AdminCouponDetailView,
    AdminReviewListView,
    AdminReviewModerationView,
    AdminReviewDeleteView,
)

app_name = 'administration'

urlpatterns = [
    # Dashboard & Reports
    path('overview/', AdminOverviewView.as_view(), name='admin-overview'),
    path('reports/sales/', AdminSalesReportView.as_view(), name='admin-sales-report'),

    # Product Catalog Management
    path('products/', AdminProductListCreateView.as_view(), name='admin-product-list-create'),
    path('products/<str:id>/', AdminProductDetailView.as_view(), name='admin-product-detail'),
    path('products/<str:product_id>/images/', AdminProductImageListCreateView.as_view(), name='admin-product-image-list-create'),
    path('products/<str:product_id>/images/<str:id>/', AdminProductImageDetailView.as_view(), name='admin-product-image-detail'),

    # Category Management
    path('categories/', AdminCategoryListCreateView.as_view(), name='admin-category-list-create'),
    path('categories/<str:id>/', AdminCategoryDetailView.as_view(), name='admin-category-detail'),

    # Inventory Management
    path('inventory/', AdminInventoryListView.as_view(), name='admin-inventory-list'),
    path('inventory/<str:id>/', AdminInventoryDetailView.as_view(), name='admin-inventory-detail'),

    # Orders Management
    path('orders/', AdminOrderListView.as_view(), name='admin-order-list'),
    path('orders/<str:order_number>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('orders/<str:order_number>/status/', AdminOrderStatusUpdateView.as_view(), name='admin-order-status-update'),

    # Customer Management (User PK is integer)
    path('customers/', AdminCustomerListView.as_view(), name='admin-customer-list'),
    path('customers/<int:id>/', AdminCustomerDetailView.as_view(), name='admin-customer-detail'),
    path('customers/<int:id>/status/', AdminCustomerStatusToggleView.as_view(), name='admin-customer-status-toggle'),

    # Coupon & Discount Management
    path('coupons/', AdminCouponListCreateView.as_view(), name='admin-coupon-list-create'),
    path('coupons/<str:id>/', AdminCouponDetailView.as_view(), name='admin-coupon-detail'),

    # Review Moderation
    path('reviews/', AdminReviewListView.as_view(), name='admin-review-list'),
    path('reviews/<str:id>/moderate/', AdminReviewModerationView.as_view(), name='admin-review-moderate'),
    path('reviews/<str:id>/', AdminReviewDeleteView.as_view(), name='admin-review-delete'),
]
