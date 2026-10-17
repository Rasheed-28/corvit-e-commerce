from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from apps.catalog.models import ProductCategory, Product, ProductVariant
from apps.cart.models import Cart, CartItem, Wishlist, WishlistItem

User = get_user_model()

class CartModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='cartuser', email='cartuser@example.com', password='password123')
        self.category = ProductCategory.objects.create(name='Apparel', slug='apparel')
        self.product = Product.objects.create(
            category=self.category,
            title='Classic Cotton T-Shirt',
            slug='classic-cotton-tshirt',
            sku='APP-TSHIRT-BASE',
            base_price=Decimal('25.00')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='Size: L | Color: White',
            sku='APP-TSHIRT-L-WHT'
        )

    def test_cart_item_totals_and_uniqueness(self):
        cart = Cart.objects.create(user=self.user)
        item1 = CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=2,
            unit_price=Decimal('25.00')
        )
        self.assertEqual(item1.subtotal, Decimal('50.00'))
        self.assertEqual(cart.total_items, 2)
        self.assertEqual(cart.subtotal, Decimal('50.00'))

        # Duplicate item for same cart, product, and variant must violate unique constraint
        with self.assertRaises(IntegrityError):
            CartItem.objects.create(
                cart=cart,
                product=self.product,
                variant=self.variant,
                quantity=1,
                unit_price=Decimal('25.00')
            )

    def test_wishlist_uniqueness(self):
        wishlist = Wishlist.objects.create(user=self.user)
        WishlistItem.objects.create(wishlist=wishlist, product=self.product)

        with self.assertRaises(IntegrityError):
            WishlistItem.objects.create(wishlist=wishlist, product=self.product)
