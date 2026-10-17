from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory, Review

User = get_user_model()

class CatalogModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='shopper', email='shopper@example.com', password='password123')
        self.category = ProductCategory.objects.create(name='Electronics', slug='electronics')
        self.sub_category = ProductCategory.objects.create(name='Laptops', slug='laptops', parent=self.category)
        self.product = Product.objects.create(
            category=self.sub_category,
            title='Pro Laptop 15',
            slug='pro-laptop-15',
            sku='LAP-15-BASE',
            description='High performance laptop.',
            base_price=Decimal('1299.99')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='16GB RAM / 512GB SSD',
            sku='LAP-15-16-512',
            price_override=Decimal('1499.99')
        )
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=15,
            reserved_quantity=3,
            low_stock_threshold=5
        )

    def test_category_hierarchy(self):
        self.assertEqual(str(self.sub_category), 'Electronics -> Laptops')
        self.assertEqual(list(self.category.children.all()), [self.sub_category])

    def test_variant_effective_price(self):
        # Variant with override
        self.assertEqual(self.variant.effective_price, Decimal('1499.99'))

        # Variant without override falls back to base_price
        variant_no_override = ProductVariant.objects.create(
            product=self.product,
            name='8GB RAM',
            sku='LAP-15-8-256'
        )
        self.assertEqual(variant_no_override.effective_price, Decimal('1299.99'))

    def test_inventory_availability(self):
        self.assertEqual(self.inventory.available_quantity, 12)
        self.assertTrue(self.inventory.is_in_stock)
        self.assertFalse(self.inventory.is_low_stock)

    def test_review_and_uniqueness(self):
        review = Review.objects.create(
            product=self.product,
            user=self.user,
            rating=5,
            title='Fantastic Machine',
            comment='Super fast and reliable.'
        )
        self.assertEqual(review.rating, 5)
        self.assertEqual(self.product.reviews.count(), 1)
