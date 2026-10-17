from django.urls import path
from .views import (
    OrderListCreateView,
    OrderDetailView,
    ValidateCouponView,
    OrderPaymentView,
)

app_name = 'orders'

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='order-list-create'),
    path('coupons/validate/', ValidateCouponView.as_view(), name='coupon-validate'),
    path('<str:order_number>/', OrderDetailView.as_view(), name='order-detail'),
    path('<str:order_number>/payments/', OrderPaymentView.as_view(), name='order-payments'),
]
