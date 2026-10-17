from decimal import Decimal
from rest_framework import serializers
from django.utils.text import slugify
from django.db import transaction
from apps.accounts.serializers import UserSummarySerializer
from .models import ProductCategory, Product, ProductImage, ProductVariant, Inventory, Review
from .validators import validate_image_file


class ProductCategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = ('id', 'name', 'slug', 'description', 'parent', 'parent_name', 'image', 'is_active', 'children')
        read_only_fields = ('id',)

    def validate_image(self, value):
        if value:
            validate_image_file(value)
        return value

    def validate(self, attrs):
        name = attrs.get('name')
        slug = attrs.get('slug')
        if not slug and name:
            attrs['slug'] = slugify(name)
        return attrs

    def get_children(self, obj):
        active_children = obj.children.filter(is_active=True)
        return [
            {'id': str(child.id), 'name': child.name, 'slug': child.slug}
            for child in active_children
        ]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'is_primary', 'display_order', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_image(self, value):
        if value:
            validate_image_file(value)
        return value


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    quantity = serializers.IntegerField(source='inventory.quantity', read_only=True)
    available_quantity = serializers.IntegerField(source='inventory.available_quantity', read_only=True)
    is_in_stock = serializers.BooleanField(source='inventory.is_in_stock', read_only=True)
    is_low_stock = serializers.BooleanField(source='inventory.is_low_stock', read_only=True)

    class Meta:
        model = ProductVariant
        fields = (
            'id', 'name', 'sku', 'color', 'size',
            'price_override', 'effective_price',
            'quantity', 'available_quantity', 'is_in_stock', 'is_low_stock',
            'attributes', 'is_active'
        )
        read_only_fields = ('id', 'effective_price', 'quantity', 'available_quantity', 'is_in_stock', 'is_low_stock')


class ProductVariantCreateUpdateSerializer(serializers.ModelSerializer):
    quantity = serializers.IntegerField(required=False, default=0, min_value=0)
    low_stock_threshold = serializers.IntegerField(required=False, default=5, min_value=0)
    price_override = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, min_value=Decimal('0.00'))

    class Meta:
        model = ProductVariant
        fields = (
            'id', 'name', 'sku', 'color', 'size',
            'price_override', 'attributes', 'is_active',
            'quantity', 'low_stock_threshold'
        )
        read_only_fields = ('id',)

    def validate_sku(self, value):
        cleaned = value.strip()
        qs = ProductVariant.objects.filter(sku__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Product variant with SKU '{cleaned}' already exists.")
        return cleaned

    def create(self, validated_data):
        quantity = validated_data.pop('quantity', 0)
        low_stock_threshold = validated_data.pop('low_stock_threshold', 5)
        product = self.context['product']

        with transaction.atomic():
            variant = ProductVariant.objects.create(product=product, **validated_data)
            Inventory.objects.create(
                variant=variant,
                quantity=quantity,
                low_stock_threshold=low_stock_threshold
            )
        return variant

    def update(self, instance, validated_data):
        quantity = validated_data.pop('quantity', None)
        low_stock_threshold = validated_data.pop('low_stock_threshold', None)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if quantity is not None or low_stock_threshold is not None:
                inventory, _ = Inventory.objects.get_or_create(variant=instance)
                if quantity is not None:
                    inventory.quantity = quantity
                if low_stock_threshold is not None:
                    inventory.low_stock_threshold = low_stock_threshold
                inventory.save()
                instance.inventory = inventory

        return instance

    def to_representation(self, instance):
        return ProductVariantSerializer(instance, context=self.context).data


class ReviewSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'user', 'rating', 'title', 'comment', 'is_verified_purchase', 'is_approved', 'created_at')
        read_only_fields = ('id', 'user', 'is_verified_purchase', 'created_at')

    def create(self, validated_data):
        request = self.context['request']
        product = self.context['product']
        return Review.objects.create(
            user=request.user,
            product=product,
            **validated_data
        )

    def update(self, instance, validated_data):
        request = self.context.get('request')
        # Only administrative staff can change the review approval status
        if not (request and getattr(request.user, 'is_staff', False)):
            validated_data.pop('is_approved', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    primary_image = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'title', 'slug', 'sku', 'base_price',
            'category', 'category_name', 'category_slug',
            'primary_image', 'is_in_stock', 'available_quantity',
            'is_active', 'is_featured', 'created_at'
        )
        read_only_fields = ('id', 'created_at')

    def get_primary_image(self, obj):
        # In-memory lookup from prefetched images (zero extra SQL queries)
        images = obj.images.all()
        primary = next((img for img in images if img.is_primary), None) or (images[0] if images else None)
        if primary and primary.image:
            request = self.context.get('request')
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return None

    def get_available_quantity(self, obj):
        # In-memory summation from prefetched variants & inventory
        return sum(
            v.inventory.available_quantity
            for v in obj.variants.all()
            if v.is_active and hasattr(v, 'inventory')
        )

    def get_is_in_stock(self, obj):
        return self.get_available_quantity(obj) > 0


class ProductDetailSerializer(serializers.ModelSerializer):
    category = ProductCategorySerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    rating_summary = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'title', 'slug', 'sku', 'description', 'base_price',
            'category', 'images', 'variants', 'reviews',
            'total_stock', 'is_in_stock', 'rating_summary',
            'is_active', 'is_featured', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_total_stock(self, obj):
        # In-memory calculation using prefetched variants & inventory
        return sum(
            variant.inventory.available_quantity
            for variant in obj.variants.all()
            if variant.is_active and hasattr(variant, 'inventory')
        )

    def get_is_in_stock(self, obj):
        return self.get_total_stock(obj) > 0

    def get_rating_summary(self, obj):
        approved = [r for r in obj.reviews.all() if r.is_approved]
        count = len(approved)
        avg = round(sum(r.rating for r in approved) / count, 1) if count > 0 else 0.0
        return {
            'average_rating': avg,
            'review_count': count
        }

    def get_reviews(self, obj):
        approved_reviews = [r for r in obj.reviews.all() if r.is_approved][:10]
        return ReviewSerializer(approved_reviews, many=True, context=self.context).data


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=ProductCategory.objects.all(),
        required=False,
        allow_null=True
    )
    variants = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Product
        fields = (
            'id', 'title', 'slug', 'sku', 'description',
            'base_price', 'category', 'is_active', 'is_featured',
            'variants'
        )
        read_only_fields = ('id',)

    def validate_base_price(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Base price must be greater than or equal to 0.00.")
        return value

    def validate_sku(self, value):
        cleaned = value.strip()
        qs = Product.objects.filter(sku__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Product with SKU '{cleaned}' already exists.")
        return cleaned

    def validate(self, attrs):
        title = attrs.get('title')
        slug = attrs.get('slug')
        if not slug and title:
            base_slug = slugify(title)
            slug = base_slug
            counter = 1
            qs = Product.objects.filter(slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            while qs.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs = Product.objects.filter(slug=slug)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
            attrs['slug'] = slug
        return attrs

    def create(self, validated_data):
        variants_data = validated_data.pop('variants', [])
        with transaction.atomic():
            product = Product.objects.create(**validated_data)
            for v_data in variants_data:
                qty = v_data.pop('quantity', 0)
                low_stock = v_data.pop('low_stock_threshold', 5)
                v_sku = v_data.get('sku') or f"{product.sku}-V{ProductVariant.objects.filter(product=product).count() + 1}"
                v_name = v_data.get('name') or 'Default'
                variant = ProductVariant.objects.create(
                    product=product,
                    sku=v_sku,
                    name=v_name,
                    color=v_data.get('color', ''),
                    size=v_data.get('size', ''),
                    price_override=v_data.get('price_override'),
                    attributes=v_data.get('attributes', {}),
                    is_active=v_data.get('is_active', True)
                )
                Inventory.objects.create(
                    variant=variant,
                    quantity=qty,
                    low_stock_threshold=low_stock
                )
        return product

    def to_representation(self, instance):
        return ProductDetailSerializer(instance, context=self.context).data
