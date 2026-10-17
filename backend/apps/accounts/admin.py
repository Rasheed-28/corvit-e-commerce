from django.contrib import admin
from .models import CustomerProfile, Address

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone_number', 'date_of_birth', 'is_newsletter_subscribed', 'created_at')
    search_fields = ('user__username', 'user__email', 'phone_number')
    list_filter = ('is_newsletter_subscribed', 'created_at')

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'address_type', 'city', 'country', 'is_default', 'created_at')
    search_fields = ('user__username', 'full_name', 'street_address_1', 'city', 'postal_code')
    list_filter = ('address_type', 'is_default', 'country')
