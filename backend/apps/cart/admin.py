from django.contrib import admin
from .models import Cart, CartItem, Wishlist, WishlistItem

class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'session_key', 'is_active', 'total_items', 'subtotal', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__username', 'session_key')
    inlines = [CartItemInline]

class WishlistItemInline(admin.TabularInline):
    model = WishlistItem
    extra = 0

@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_public', 'created_at')
    list_filter = ('is_public',)
    search_fields = ('name', 'user__username')
    inlines = [WishlistItemInline]
