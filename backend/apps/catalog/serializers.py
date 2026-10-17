from rest_framework import serializers
from apps.accounts.serializers import UserSummarySerializer
from .models import ProductCategory, Product, ProductImage, ProductVariant, Inventory, Review

class ProductCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = ('id', 'name', 'slug', 'description', 'parent', 'parent_name', 'image', 'is_active', 'children')
        read_only_fields = ('id',)

    def get_children(self, obj):
        active_children = obj.children.filter(is_active=True)
        return [
            {'id': str(child.id), 'name': child.name, 'slug': child.slug}
            for child in active_children
        ]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'is_primary', 'display_order')
        read_only_fields = ('id',)


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    available_quantity = serializers.IntegerField(source='inventory.available_quantity', read_only=True)
    is_in_stock = serializers.BooleanField(source='inventory.is_in_stock', read_only=True)

    class Meta:
        model = ProductVariant
        fields = (
            'id', 'name', 'sku', 'color', 'size',
            'price_override', 'effective_price',
            'available_quantity', 'is_in_stock',
            'attributes', 'is_active'
        )
        read_only_fields = ('id', 'effective_price', 'available_quantity', 'is_in_stock')


class ReviewSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'user', 'rating', 'title', 'comment', 'is_verified_purchase', 'created_at')
        read_only_fields = ('id', 'user', 'is_verified_purchase', 'created_at')

    def create(self, validated_data):
        request = self.context['request']
        product = self.context['product']
        return Review.objects.create(
            user=request.user,
            product=product,
            **validated_data
        )


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'title', 'slug', 'sku', 'base_price',
            'category', 'category_name', 'primary_image',
            'is_active', 'is_featured', 'created_at'
        )
        read_only_fields = ('id', 'created_at')

    def get_primary_image(self, obj):
        image = obj.images.filter(is_primary=True).first() or obj.images.first()
        if image and image.image:
            request = self.context.get('request')
            return request.build_absolute_uri(image.image.url) if request else image.image.url
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    category = ProductCategorySerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'title', 'slug', 'sku', 'description', 'base_price',
            'category', 'images', 'variants', 'reviews',
            'is_active', 'is_featured', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_reviews(self, obj):
        approved_reviews = obj.reviews.filter(is_approved=True)[:10]
        return ReviewSerializer(approved_reviews, many=True).data
