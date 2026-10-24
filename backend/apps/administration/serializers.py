from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from apps.catalog.models import (
    ProductCategory,
    Product,
    ProductImage,
    ProductVariant,
    Inventory,
    Review,
)
from apps.orders.models import Order, OrderItem, Coupon, Payment

User = get_user_model()


# ==============================================================================
# 1. Product & Category Administration Serializers
# ==============================================================================

class AdminCategorySerializer(serializers.ModelSerializer):
    """Admin serializer for category creation, hierarchy inspection, and updates."""
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    products_count = serializers.IntegerField(source='products.count', read_only=True)
    children_count = serializers.IntegerField(source='children.count', read_only=True)

    class Meta:
        model = ProductCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'parent',
            'parent_name',
            'image',
            'is_active',
            'products_count',
            'children_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_slug(self, value):
        slug = slugify(value)
        qs = ProductCategory.objects.filter(slug__iexact=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Category slug '{slug}' is already in use.")
        return slug

    def validate_image(self, value):
        if value:
            from apps.catalog.validators import validate_image_file
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                validate_image_file(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages) if hasattr(exc, 'messages') else str(exc))
        return value

    def validate(self, attrs):
        parent = attrs.get('parent')
        if self.instance and parent:
            if parent.pk == self.instance.pk:
                raise serializers.ValidationError({"parent": "A category cannot be its own parent."})
        return attrs


class AdminProductImageSerializer(serializers.ModelSerializer):
    """Admin serializer for product gallery media."""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = [
            'id',
            'product',
            'image',
            'image_url',
            'alt_text',
            'is_primary',
            'display_order',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'image_url']

    def validate_image(self, value):
        if value:
            from apps.catalog.validators import validate_image_file
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                validate_image_file(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages) if hasattr(exc, 'messages') else str(exc))
        return value

    def get_image_url(self, obj) -> str | None:
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class AdminProductVariantSerializer(serializers.ModelSerializer):
    """Admin serializer for product variant details and inventory connection."""
    stock_quantity = serializers.IntegerField(source='inventory.quantity', read_only=True, default=0)
    available_stock = serializers.IntegerField(source='inventory.available_quantity', read_only=True, default=0)
    is_low_stock = serializers.BooleanField(source='inventory.is_low_stock', read_only=True, default=False)

    class Meta:
        model = ProductVariant
        fields = [
            'id',
            'product',
            'name',
            'sku',
            'color',
            'size',
            'price_override',
            'effective_price',
            'attributes',
            'is_active',
            'stock_quantity',
            'available_stock',
            'is_low_stock',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'effective_price', 'created_at', 'updated_at']

    def validate_sku(self, value):
        clean_sku = value.strip().upper()
        qs = ProductVariant.objects.filter(sku__iexact=clean_sku)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Variant SKU '{clean_sku}' is already taken.")
        return clean_sku


class AdminProductListSerializer(serializers.ModelSerializer):
    """Concise admin product list view with category, stock, and media indicators."""
    category_name = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    primary_image = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    variants_count = serializers.IntegerField(source='variants.count', read_only=True)
    reviews_count = serializers.IntegerField(source='reviews.count', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'slug',
            'sku',
            'category',
            'category_name',
            'base_price',
            'is_active',
            'is_featured',
            'primary_image',
            'total_stock',
            'variants_count',
            'reviews_count',
            'created_at',
            'updated_at',
        ]

    def get_primary_image(self, obj) -> str | None:
        primary = obj.images.filter(is_primary=True).first() or obj.images.first()
        if primary and primary.image:
            request = self.context.get('request')
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return None

    def get_total_stock(self, obj) -> int:
        return sum((v.inventory.available_quantity for v in obj.variants.all() if hasattr(v, 'inventory')), 0)


class AdminProductDetailSerializer(serializers.ModelSerializer):
    """Full admin product detail serializer with nested gallery and variants."""
    category_name = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    images = AdminProductImageSerializer(many=True, read_only=True)
    variants = AdminProductVariantSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'slug',
            'sku',
            'category',
            'category_name',
            'description',
            'base_price',
            'is_active',
            'is_featured',
            'total_stock',
            'images',
            'variants',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_stock(self, obj) -> int:
        return sum((v.inventory.available_quantity for v in obj.variants.all() if hasattr(v, 'inventory')), 0)


class AdminProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Strictly validates product creation and modification."""
    initial_stock = serializers.IntegerField(required=False, default=10, min_value=0)

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'slug',
            'sku',
            'category',
            'description',
            'base_price',
            'is_active',
            'is_featured',
            'initial_stock',
        ]
        read_only_fields = ['id']

    def validate_sku(self, value):
        clean_sku = value.strip().upper()
        qs = Product.objects.filter(sku__iexact=clean_sku)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Product SKU '{clean_sku}' is already taken.")
        return clean_sku

    def validate_slug(self, value):
        slug = slugify(value) if value else ''
        if not slug:
            return slug
        qs = Product.objects.filter(slug__iexact=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Product slug '{slug}' is already taken.")
        return slug

    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', 10)
        if not validated_data.get('slug'):
            base_slug = slugify(validated_data['title'])
            slug = base_slug
            idx = 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{idx}"
                idx += 1
            validated_data['slug'] = slug

        product = Product.objects.create(**validated_data)

        # Automatically create default variant and inventory tracking record
        default_variant = ProductVariant.objects.create(
            product=product,
            name='Standard',
            sku=f"{product.sku}-STD",
            is_active=True
        )
        Inventory.objects.create(
            variant=default_variant,
            quantity=initial_stock,
            low_stock_threshold=5
        )

        return product


# ==============================================================================
# 2. Inventory & Stock Administration Serializers
# ==============================================================================

class AdminInventorySerializer(serializers.ModelSerializer):
    """Detailed inventory monitoring serializer with low stock flags."""
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    product_id = serializers.UUIDField(source='variant.product.id', read_only=True)
    product_title = serializers.CharField(source='variant.product.title', read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Inventory
        fields = [
            'id',
            'product_id',
            'product_title',
            'variant',
            'variant_sku',
            'variant_name',
            'quantity',
            'reserved_quantity',
            'available_quantity',
            'low_stock_threshold',
            'is_in_stock',
            'is_low_stock',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'product_id',
            'product_title',
            'variant',
            'variant_sku',
            'variant_name',
            'available_quantity',
            'is_in_stock',
            'is_low_stock',
            'updated_at',
        ]


class AdminInventoryUpdateSerializer(serializers.Serializer):
    """Validates stock adjustment writes."""
    quantity = serializers.IntegerField(min_value=0, required=False)
    low_stock_threshold = serializers.IntegerField(min_value=0, required=False)
    adjustment = serializers.IntegerField(required=False)  # Relative delta (+5, -2)

    def validate(self, attrs):
        if 'quantity' not in attrs and 'adjustment' not in attrs and 'low_stock_threshold' not in attrs:
            raise serializers.ValidationError("Must provide 'quantity', 'adjustment', or 'low_stock_threshold'.")
        return attrs


# ==============================================================================
# 3. Order Administration Serializers
# ==============================================================================

class AdminOrderListSerializer(serializers.ModelSerializer):
    """Admin order list with customer details, item count, and payment state."""
    customer_email = serializers.CharField(source='user.email', read_only=True, default='Guest')
    customer_name = serializers.SerializerMethodField()
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'customer_email',
            'customer_name',
            'status',
            'currency',
            'subtotal',
            'shipping_fee',
            'tax_amount',
            'discount_amount',
            'total_amount',
            'items_count',
            'payment_status',
            'created_at',
            'updated_at',
        ]

    def get_customer_name(self, obj) -> str:
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        snapshot = obj.shipping_address_snapshot or {}
        return snapshot.get('full_name', 'Customer')

    def get_payment_status(self, obj) -> str:
        latest = obj.payments.order_by('-created_at').first()
        return latest.status if latest else 'UNPAID'


class AdminOrderItemSerializer(serializers.ModelSerializer):
    """Item detail snapshot in admin order inspection."""
    class Meta:
        model = OrderItem
        fields = [
            'id',
            'product_title',
            'variant_name',
            'sku',
            'unit_price',
            'quantity',
            'line_total',
        ]


class AdminPaymentRecordSerializer(serializers.ModelSerializer):
    """Safe payment transaction audit view for order details."""
    class Meta:
        model = Payment
        fields = [
            'id',
            'transaction_id',
            'gateway',
            'payment_method',
            'status',
            'amount',
            'currency',
            'card_brand',
            'card_last4',
            'refund_amount',
            'refund_reason',
            'created_at',
        ]


class AdminOrderDetailSerializer(serializers.ModelSerializer):
    """Comprehensive admin order detail with items, snapshots, and payment history."""
    customer_email = serializers.CharField(source='user.email', read_only=True, default='Guest')
    customer_name = serializers.SerializerMethodField()
    items = AdminOrderItemSerializer(many=True, read_only=True)
    payments = AdminPaymentRecordSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'customer_email',
            'customer_name',
            'status',
            'currency',
            'subtotal',
            'shipping_fee',
            'tax_amount',
            'discount_amount',
            'total_amount',
            'customer_notes',
            'cancellation_reason',
            'shipping_address_snapshot',
            'billing_address_snapshot',
            'items',
            'payments',
            'created_at',
            'updated_at',
        ]

    def get_customer_name(self, obj) -> str:
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        snapshot = obj.shipping_address_snapshot or {}
        return snapshot.get('full_name', 'Customer')


class AdminOrderStatusUpdateSerializer(serializers.Serializer):
    """Validates order status lifecycle changes by administrators."""
    status = serializers.ChoiceField(choices=Order.OrderStatus.choices)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate_status(self, new_status):
        order = self.context.get('order')
        if not order:
            return new_status

        current = order.status
        terminal_statuses = [Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED]
        if current in terminal_statuses:
            raise serializers.ValidationError(
                f"Order {order.order_number} is in terminal status '{current}' and cannot be modified."
            )

        valid_transitions = {
            Order.OrderStatus.PENDING: [Order.OrderStatus.PAID, Order.OrderStatus.CANCELLED],
            Order.OrderStatus.PAID: [Order.OrderStatus.PROCESSING, Order.OrderStatus.CANCELLED],
            Order.OrderStatus.PROCESSING: [Order.OrderStatus.SHIPPED, Order.OrderStatus.CANCELLED],
            Order.OrderStatus.SHIPPED: [Order.OrderStatus.DELIVERED, Order.OrderStatus.CANCELLED],
            Order.OrderStatus.DELIVERED: [Order.OrderStatus.REFUNDED],
        }

        allowed = valid_transitions.get(current, [])
        if new_status != current and new_status not in allowed:
            raise serializers.ValidationError(
                f"Transition from '{current}' to '{new_status}' is invalid. Allowed transitions: {allowed}"
            )

        return new_status


# ==============================================================================
# 4. Customer Administration Serializers
# ==============================================================================

class AdminCustomerListSerializer(serializers.ModelSerializer):
    """Admin view for user/customer management with aggregated metrics."""
    full_name = serializers.SerializerMethodField()
    phone_number = serializers.CharField(source='customer_profile.phone_number', read_only=True, default='')
    total_orders = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'is_active',
            'is_staff',
            'date_joined',
            'total_orders',
            'total_spent',
            'last_order_date',
        ]

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_total_orders(self, obj) -> int:
        return getattr(obj, 'orders_count', None) or obj.orders.count()

    def get_total_spent(self, obj) -> Decimal:
        return getattr(obj, 'spent_total', None) or sum(
            (o.total_amount for o in obj.orders.filter(status__in=[
                Order.OrderStatus.PAID,
                Order.OrderStatus.PROCESSING,
                Order.OrderStatus.SHIPPED,
                Order.OrderStatus.DELIVERED
            ])),
            Decimal('0.00')
        )

    def get_last_order_date(self, obj):
        latest = obj.orders.order_by('-created_at').first()
        return latest.created_at if latest else None


class AdminCustomerDetailSerializer(serializers.ModelSerializer):
    """Detailed customer profile, addresses, and order history."""
    full_name = serializers.SerializerMethodField()
    phone_number = serializers.CharField(source='customer_profile.phone_number', read_only=True, default='')
    total_orders = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'is_active',
            'is_staff',
            'date_joined',
            'total_orders',
            'total_spent',
            'recent_orders',
        ]

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_total_orders(self, obj) -> int:
        return obj.orders.count()

    def get_total_spent(self, obj) -> Decimal:
        return sum(
            (o.total_amount for o in obj.orders.filter(status__in=[
                Order.OrderStatus.PAID,
                Order.OrderStatus.PROCESSING,
                Order.OrderStatus.SHIPPED,
                Order.OrderStatus.DELIVERED
            ])),
            Decimal('0.00')
        )

    def get_recent_orders(self, obj):
        return AdminOrderListSerializer(obj.orders.order_by('-created_at')[:10], many=True).data


# ==============================================================================
# 5. Coupon Administration Serializers
# ==============================================================================

class AdminCouponSerializer(serializers.ModelSerializer):
    """Full administrative control and validation for discount coupons."""
    is_valid_now = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            'id',
            'code',
            'discount_type',
            'discount_value',
            'minimum_order_amount',
            'max_discount_amount',
            'usage_limit',
            'times_used',
            'valid_from',
            'valid_to',
            'is_active',
            'is_valid_now',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'times_used', 'is_valid_now', 'created_at', 'updated_at']

    def get_is_valid_now(self, obj) -> bool:
        return obj.is_valid_for_amount(obj.minimum_order_amount or Decimal('1.00'))

    def validate_code(self, value):
        code = value.strip().upper()
        qs = Coupon.objects.filter(code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Coupon code '{code}' already exists.")
        return code

    def validate(self, attrs):
        valid_from = attrs.get('valid_from') or (self.instance.valid_from if self.instance else None)
        valid_to = attrs.get('valid_to') or (self.instance.valid_to if self.instance else None)
        if valid_from and valid_to and valid_to <= valid_from:
            raise serializers.ValidationError({"valid_to": "Expiration date must be strictly after valid_from date."})

        discount_type = attrs.get('discount_type') or (self.instance.discount_type if self.instance else Coupon.DiscountType.PERCENTAGE)
        discount_value = attrs.get('discount_value') or (self.instance.discount_value if self.instance else Decimal('0.00'))
        if discount_type == Coupon.DiscountType.PERCENTAGE and discount_value > Decimal('100.00'):
            raise serializers.ValidationError({"discount_value": "Percentage discount cannot exceed 100%."})

        return attrs


# ==============================================================================
# 6. Review Moderation Serializers
# ==============================================================================

class AdminReviewSerializer(serializers.ModelSerializer):
    """Review inspection and moderation serializer."""
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    customer_email = serializers.CharField(source='user.email', read_only=True)
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id',
            'product',
            'product_title',
            'product_slug',
            'user',
            'customer_email',
            'customer_name',
            'rating',
            'title',
            'comment',
            'is_verified_purchase',
            'is_approved',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'product',
            'product_title',
            'product_slug',
            'user',
            'customer_email',
            'customer_name',
            'rating',
            'title',
            'comment',
            'is_verified_purchase',
            'created_at',
            'updated_at',
        ]

    def get_customer_name(self, obj) -> str:
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return 'Anonymous'
