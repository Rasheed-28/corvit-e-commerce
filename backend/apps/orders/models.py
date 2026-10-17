import secrets
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils import timezone
from apps.common.models import TimeStampedUUIDModel

def generate_order_number() -> str:
    """Generate unique human-readable order identifier, e.g. ORD-20261017-A1B2C3"""
    today_str = timezone.now().strftime('%Y%m%d')
    random_suffix = secrets.token_hex(3).upper()
    return f"ORD-{today_str}-{random_suffix}"


class Coupon(TimeStampedUUIDModel):
    """
    Promotional coupon codes supporting fixed amount or percentage discounts with qualification rules.
    """
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', 'Percentage Discount'
        FIXED_AMOUNT = 'FIXED_AMOUNT', 'Fixed Amount Discount'

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    minimum_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    times_used = models.PositiveIntegerField(default=0)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Coupon'
        verbose_name_plural = 'Coupons'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', 'valid_from', 'valid_to']),
        ]

    def __str__(self):
        val = f"{self.discount_value}%" if self.discount_type == self.DiscountType.PERCENTAGE else f"${self.discount_value}"
        return f"{self.code} ({val} off)"

    def is_valid_for_amount(self, order_amount: Decimal) -> bool:
        now = timezone.now()
        if not self.is_active or now < self.valid_from or now > self.valid_to:
            return False
        if self.usage_limit is not None and self.times_used >= self.usage_limit:
            return False
        if order_amount < self.minimum_order_amount:
            return False
        return True

    def calculate_discount(self, subtotal: Decimal) -> Decimal:
        if not self.is_valid_for_amount(subtotal):
            return Decimal('0.00')

        if self.discount_type == self.DiscountType.PERCENTAGE:
            discount = (subtotal * self.discount_value) / Decimal('100.00')
        else:
            discount = self.discount_value

        if self.max_discount_amount is not None:
            discount = min(discount, self.max_discount_amount)

        return min(discount, subtotal).quantize(Decimal('0.01'))


class Order(TimeStampedUUIDModel):
    """
    Customer purchase order with server-calculated totals, status lifecycle, and address snapshots.
    """
    class OrderStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Payment'
        PAID = 'PAID', 'Paid'
        PROCESSING = 'PROCESSING', 'Processing'
        SHIPPED = 'SHIPPED', 'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'
        REFUNDED = 'REFUNDED', 'Refunded'

    order_number = models.CharField(
        max_length=32,
        unique=True,
        default=generate_order_number,
        editable=False,
        db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True
    )
    # Foreign keys to saved addresses (optional, address may be deleted later)
    shipping_address = models.ForeignKey(
        'accounts.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    billing_address = models.ForeignKey(
        'accounts.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    # Immutable address snapshots preserved forever
    shipping_address_snapshot = models.JSONField(default=dict, blank=True)
    billing_address_snapshot = models.JSONField(default=dict, blank=True)

    currency = models.CharField(max_length=3, default='USD')
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    shipping_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )
    customer_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.order_number} - {self.status} (${self.total_amount})"

    def calculate_totals(self) -> Decimal:
        """
        Recalculates order subtotal and total on the server side from actual order items.
        Strictly prevents accepting unvalidated client totals.
        """
        self.subtotal = sum((item.line_total for item in self.items.all()), Decimal('0.00'))
        self.total_amount = max(
            Decimal('0.00'),
            self.subtotal + self.shipping_fee + self.tax_amount - self.discount_amount
        ).quantize(Decimal('0.01'))
        return self.total_amount

    def snapshot_addresses(self):
        """Preserves immutable address snapshots at checkout time."""
        if self.shipping_address and not self.shipping_address_snapshot:
            self.shipping_address_snapshot = {
                'full_name': self.shipping_address.full_name,
                'phone_number': self.shipping_address.phone_number,
                'street_address_1': self.shipping_address.street_address_1,
                'street_address_2': self.shipping_address.street_address_2,
                'city': self.shipping_address.city,
                'state_or_province': self.shipping_address.state_or_province,
                'postal_code': self.shipping_address.postal_code,
                'country': self.shipping_address.country,
            }
        if self.billing_address and not self.billing_address_snapshot:
            self.billing_address_snapshot = {
                'full_name': self.billing_address.full_name,
                'phone_number': self.billing_address.phone_number,
                'street_address_1': self.billing_address.street_address_1,
                'street_address_2': self.billing_address.street_address_2,
                'city': self.billing_address.city,
                'state_or_province': self.billing_address.state_or_province,
                'postal_code': self.billing_address.postal_code,
                'country': self.billing_address.country,
            }


class OrderItem(TimeStampedUUIDModel):
    """
    Immutable line item snapshot of an ordered product variant and historical pricing.
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    # Historical Snapshot Fields: Preserves exact title, SKU, and unit price forever
    product_title = models.CharField(max_length=255)
    variant_name = models.CharField(max_length=150, blank=True)
    sku = models.CharField(max_length=64, db_index=True)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )
    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['order', 'sku']),
        ]

    def __str__(self):
        return f"{self.quantity}x {self.product_title} (${self.line_total})"

    def save(self, *args, **kwargs):
        # Enforce server-side line total calculation
        self.line_total = (self.unit_price * self.quantity).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)


class Payment(TimeStampedUUIDModel):
    """
    Payment transaction audit record linked to an Order.
    """
    class PaymentMethod(models.TextChoices):
        CREDIT_CARD = 'CREDIT_CARD', 'Credit Card'
        DEBIT_CARD = 'DEBIT_CARD', 'Debit Card'
        PAYPAL = 'PAYPAL', 'PayPal'
        STRIPE = 'STRIPE', 'Stripe'
        CASH_ON_DELIVERY = 'CASH_ON_DELIVERY', 'Cash On Delivery'

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    transaction_id = models.CharField(
        max_length=128,
        unique=True,
        db_index=True
    )
    payment_method = models.CharField(
        max_length=25,
        choices=PaymentMethod.choices
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    currency = models.CharField(max_length=3, default='USD')
    gateway_response = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Payment Record'
        verbose_name_plural = 'Payment Records'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'status']),
        ]

    def __str__(self):
        return f"Payment {self.transaction_id} ({self.status}) - ${self.amount}"
