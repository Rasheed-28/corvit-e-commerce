from django.urls import path
from .views import (
    PaymentConfigView,
    PaymentIntentCreateView,
    PaymentConfirmView,
    PaymentRefundView,
    PaymentWebhookView,
)

app_name = 'payments'

urlpatterns = [
    path('config/', PaymentConfigView.as_view(), name='payment-config'),
    path('intent/', PaymentIntentCreateView.as_view(), name='payment-intent-create'),
    path('confirm/', PaymentConfirmView.as_view(), name='payment-confirm'),
    path('refund/<str:transaction_id>/', PaymentRefundView.as_view(), name='payment-refund'),
    path('webhook/<str:provider>/', PaymentWebhookView.as_view(), name='payment-webhook'),
]
