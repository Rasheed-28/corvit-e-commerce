from django.contrib import admin
from .models import Coupon, Order, OrderItem, Payment

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product_title', 'variant_name', 'sku', 'unit_price', 'quantity', 'line_total')

class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ('transaction_id', 'payment_method', 'status', 'amount', 'currency', 'created_at')

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'minimum_order_amount', 'usage_limit', 'times_used', 'is_active', 'valid_to')
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'user', 'status', 'total_amount', 'currency', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order_number', 'user__username', 'user__email')
    readonly_fields = ('order_number', 'subtotal', 'total_amount', 'shipping_address_snapshot', 'billing_address_snapshot', 'created_at', 'updated_at')
    inlines = [OrderItemInline, PaymentInline]

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'order', 'payment_method', 'status', 'amount', 'currency', 'created_at')
    list_filter = ('payment_method', 'status', 'currency')
    search_fields = ('transaction_id', 'order__order_number')
