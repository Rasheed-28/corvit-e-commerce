from django.urls import path
from .views import (
    OrderListCreateView,
    OrderPreviewView,
    OrderDetailView,
    OrderCancelView,
    ValidateCouponView,
    OrderPaymentView,
)

app_name = 'orders'

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='order-list-create'),
    path('preview/', OrderPreviewView.as_view(), name='order-preview'),
    path('coupons/validate/', ValidateCouponView.as_view(), name='coupon-validate'),
    path('<str:order_number>/', OrderDetailView.as_view(), name='order-detail'),
    path('<str:order_number>/cancel/', OrderCancelView.as_view(), name='order-cancel'),
    path('<str:order_number>/payments/', OrderPaymentView.as_view(), name='order-payments'),
]
