from django.contrib import admin
from .models import ProductCategory, Product, ProductImage, ProductVariant, Inventory, Review

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

class ProductVariantInline(admin.StackedInline):
    model = ProductVariant
    extra = 1

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'parent', 'is_active', 'created_at')
    prepopulated_fields = {'slug': ('name',)}
    list_filter = ('is_active', 'parent')
    search_fields = ('name', 'description')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'sku', 'category', 'base_price', 'is_active', 'is_featured', 'created_at')
    prepopulated_fields = {'slug': ('title',)}
    list_filter = ('is_active', 'is_featured', 'category')
    search_fields = ('title', 'sku', 'description')
    inlines = [ProductImageInline, ProductVariantInline]

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'product', 'price_override', 'is_active')
    search_fields = ('name', 'sku', 'product__title')
    list_filter = ('is_active',)

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('variant', 'quantity', 'reserved_quantity', 'available_quantity', 'low_stock_threshold')
    search_fields = ('variant__sku', 'variant__name')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'title', 'is_verified_purchase', 'is_approved', 'created_at')
    list_filter = ('rating', 'is_verified_purchase', 'is_approved')
    search_fields = ('title', 'comment', 'user__username', 'product__title')
