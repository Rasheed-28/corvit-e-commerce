from decimal import Decimal
from rest_framework import serializers
from apps.catalog.models import Product, ProductVariant
from apps.catalog.serializers import ProductListSerializer
from .models import Cart, CartItem, Wishlist, WishlistItem

class CartItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = (
            'id', 'product', 'product_title', 'product_slug',
            'variant', 'variant_name', 'variant_sku',
            'quantity', 'unit_price', 'subtotal', 'created_at'
        )
        read_only_fields = ('id', 'unit_price', 'subtotal', 'created_at')


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Cart
        fields = ('id', 'items', 'total_items', 'subtotal', 'updated_at')
        read_only_fields = ('id', 'items', 'total_items', 'subtotal', 'updated_at')


class AddToCartSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=True)
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)

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

        # Check stock availability
        target_variant = attrs.get('variant_obj')
        if target_variant and hasattr(target_variant, 'inventory'):
            if target_variant.inventory.available_quantity < attrs['quantity']:
                raise serializers.ValidationError({
                    "quantity": f"Only {target_variant.inventory.available_quantity} units available in stock."
                })

        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, required=True)


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ('id', 'product', 'created_at')
        read_only_fields = ('id', 'created_at')


class AddWishlistSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=True)

    def validate_product_id(self, value):
        if not Product.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Product does not exist or is inactive.")
        return value
