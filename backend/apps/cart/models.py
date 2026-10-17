from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from apps.common.models import TimeStampedUUIDModel

class Cart(TimeStampedUUIDModel):
    """
    Shopping cart instance representing active session or user basket.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='carts'
    )
    session_key = models.CharField(max_length=40, null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Cart'
        verbose_name_plural = 'Carts'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['session_key', 'is_active']),
        ]

    def __str__(self):
        owner = self.user.get_username() if self.user else f"Guest ({self.session_key})"
        return f"Cart {self.id} for {owner}"

    @property
    def total_items(self) -> int:
        return sum(item.quantity for item in self.items.all())

    @property
    def subtotal(self) -> Decimal:
        return sum((item.subtotal for item in self.items.all()), Decimal('0.00'))


class CartItem(TimeStampedUUIDModel):
    """
    Line item inside an active shopping cart with chosen product, variant, and quantity.
    """
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    class Meta:
        verbose_name = 'Cart Item'
        verbose_name_plural = 'Cart Items'
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product', 'variant'],
                name='unique_cart_product_variant'
            )
        ]

    def __str__(self):
        item_name = self.variant.name if self.variant else self.product.title
        return f"{self.quantity}x {item_name} in Cart {self.cart_id}"

    @property
    def subtotal(self) -> Decimal:
        return self.unit_price * self.quantity

    def save(self, *args, **kwargs):
        # Automatically synchronize unit price from variant or product if not specified
        if self.unit_price is None or self.unit_price == Decimal('0.00'):
            if self.variant:
                self.unit_price = self.variant.effective_price
            elif self.product:
                self.unit_price = self.product.base_price
        super().save(*args, **kwargs)


class Wishlist(TimeStampedUUIDModel):
    """
    Customer saved items wishlist.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wishlists'
    )
    name = models.CharField(max_length=100, default='My Wishlist')
    is_public = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Wishlist'
        verbose_name_plural = 'Wishlists'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_public']),
        ]

    def __str__(self):
        return f"{self.name} of {self.user.get_username()}"


class WishlistItem(TimeStampedUUIDModel):
    """
    Individual product saved in a user wishlist.
    """
    wishlist = models.ForeignKey(
        Wishlist,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        related_name='wishlist_items'
    )

    class Meta:
        verbose_name = 'Wishlist Item'
        verbose_name_plural = 'Wishlist Items'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['wishlist', 'product'],
                name='unique_wishlist_product'
            )
        ]

    def __str__(self):
        return f"{self.product.title} in {self.wishlist.name}"
