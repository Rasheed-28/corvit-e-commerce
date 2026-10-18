from django.contrib import admin
from .models import PaymentWebhookEvent


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = ('event_id', 'provider', 'event_type', 'status', 'order_number', 'created_at', 'processed_at')
    list_filter = ('provider', 'status', 'event_type')
    search_fields = ('event_id', 'order_number', 'transaction_id')
    readonly_fields = ('created_at', 'updated_at', 'processed_at', 'payload')
