from decimal import Decimal
from rest_framework import serializers
from django.conf import settings
from apps.catalog.models import Product, ProductVariant
from apps.catalog.serializers import ProductListSerializer
from .models import Cart, CartItem, Wishlist, WishlistItem
from .services import MAX_PURCHASE_LIMIT

class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(source='product.id', read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_image = serializers.SerializerMethodField()
    variant_id = serializers.UUIDField(source='variant.id', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_color = serializers.CharField(source='variant.color', read_only=True)
    price = serializers.DecimalField(source='unit_price', max_digits=10, decimal_places=2, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    available_stock = serializers.SerializerMethodField()
    max_purchase_limit = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = (
            'id', 'product', 'product_id', 'product_title', 'product_slug', 'product_image',
            'variant', 'variant_id', 'variant_name', 'variant_sku', 'variant_color',
            'quantity', 'unit_price', 'price', 'subtotal',
            'available_stock', 'max_purchase_limit', 'is_in_stock', 'is_available', 'created_at'
        )
        read_only_fields = ('id', 'unit_price', 'subtotal', 'created_at')

    def get_product_image(self, obj) -> str | None:
        if not obj.product:
            return None
        images = obj.product.images.all()
        primary = next((img for img in images if img.is_primary), None) or (images[0] if images else None)
        if primary and primary.image:
            request = self.context.get('request')
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return None

    def get_available_stock(self, obj) -> int:
        if obj.variant and hasattr(obj.variant, 'inventory'):
            return obj.variant.inventory.available_quantity
        return 0

    def get_max_purchase_limit(self, obj) -> int:
        stock = self.get_available_stock(obj)
        return min(stock, MAX_PURCHASE_LIMIT)

    def get_is_in_stock(self, obj) -> bool:
        return self.get_available_stock(obj) > 0

    def get_is_available(self, obj) -> bool:
        if not obj.product or not obj.product.is_active:
            return False
        if obj.variant and not obj.variant.is_active:
            return False
        return True


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    session_key = serializers.CharField(read_only=True)

    class Meta:
        model = Cart
        fields = ('id', 'session_key', 'items', 'total_items', 'subtotal', 'updated_at')
        read_only_fields = ('id', 'session_key', 'items', 'total_items', 'subtotal', 'updated_at')


class AddToCartSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=True)
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_PURCHASE_LIMIT, default=1)

    def validate(self, attrs):
        try:
            product = Product.objects.get(id=attrs['product_id'], is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError({"product_id": "Selected product is not available."})
        attrs['product_obj'] = product

        variant = None
        variant_id = attrs.get('variant_id')
        if variant_id:
            try:
                variant = ProductVariant.objects.get(id=variant_id, product=product, is_active=True)
            except ProductVariant.DoesNotExist:
                raise serializers.ValidationError({"variant_id": "Selected variant does not exist for this product."})
            attrs['variant_obj'] = variant
        else:
            # If product has active variants but none specified, select the first default active variant
            if product.variants.filter(is_active=True).exists():
                attrs['variant_obj'] = product.variants.filter(is_active=True).first()
            else:
                attrs['variant_obj'] = None

        target_variant = attrs.get('variant_obj')
        available_stock = None
        if target_variant and hasattr(target_variant, 'inventory'):
            available_stock = target_variant.inventory.available_quantity
            if available_stock <= 0:
                raise serializers.ValidationError({
                    "product_id": f"'{target_variant.name}' is currently out of stock."
                })

        # Check existing item quantity in current cart if cart is available in context
        cart = self.context.get('cart')
        current_qty = 0
        if cart:
            existing = cart.items.filter(product=product, variant=target_variant).first()
            if existing:
                current_qty = existing.quantity

        combined_qty = current_qty + attrs['quantity']

        if combined_qty > MAX_PURCHASE_LIMIT:
            raise serializers.ValidationError({
                "quantity": f"Cannot exceed maximum purchase limit of {MAX_PURCHASE_LIMIT} items. (You currently have {current_qty} in cart)."
            })

        if available_stock is not None and combined_qty > available_stock:
            raise serializers.ValidationError({
                "quantity": f"Only {available_stock} units available in stock. (You currently have {current_qty} in cart)."
            })

        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_PURCHASE_LIMIT, required=True)


class MergeCartSerializer(serializers.Serializer):
    session_key = serializers.CharField(required=False, allow_blank=True)


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    is_available = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = ('id', 'product', 'is_available', 'stock_status', 'created_at')
        read_only_fields = ('id', 'is_available', 'stock_status', 'created_at')

    def get_is_available(self, obj) -> bool:
        return bool(obj.product and obj.product.is_active)

    def get_stock_status(self, obj) -> str:
        if not obj.product or not obj.product.is_active:
            return 'discontinued'
        has_stock = obj.product.variants.filter(is_active=True, inventory__quantity__gt=0).exists()
        return 'in_stock' if has_stock else 'out_of_stock'


class AddWishlistSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=True)

    def validate_product_id(self, value):
        if not Product.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Product does not exist or is inactive.")
        return value
