from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from apps.catalog.models import ProductCategory, Product, ProductVariant
from apps.orders.models import Coupon, Order, OrderItem, Payment

User = get_user_model()

class OrdersModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='buyer', email='buyer@example.com', password='password123')
        self.category = ProductCategory.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            category=self.category,
            title='Wireless Noise-Cancelling Headphones',
            slug='wireless-headphones',
            sku='AUD-HEAD-01',
            base_price=Decimal('199.99')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='Color: Midnight Black',
            sku='AUD-HEAD-BLK',
            price_override=Decimal('219.99')
        )

    def test_order_item_historical_snapshot(self):
        order = Order.objects.create(user=self.user)
        item = OrderItem.objects.create(
            order=order,
            product=self.product,
            variant=self.variant,
            product_title=self.product.title,
            variant_name=self.variant.name,
            sku=self.variant.sku,
            unit_price=self.variant.effective_price,
            quantity=2
        )
        self.assertEqual(item.line_total, Decimal('439.98'))

        # Mutate the source product and variant to prove historical snapshot is immutable
        self.product.title = 'Updated Title 2027'
        self.product.base_price = Decimal('299.99')
        self.product.save()

        self.variant.price_override = Decimal('349.99')
        self.variant.save()

        # Reload order item from db: historical values MUST remain unchanged
        item.refresh_from_db()
        self.assertEqual(item.product_title, 'Wireless Noise-Cancelling Headphones')
        self.assertEqual(item.unit_price, Decimal('219.99'))
        self.assertEqual(item.line_total, Decimal('439.98'))

    def test_order_server_side_total_calculation(self):
        order = Order.objects.create(
            user=self.user,
            shipping_fee=Decimal('15.00'),
            tax_amount=Decimal('8.50')
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_title=self.product.title,
            sku=self.product.sku,
            unit_price=Decimal('100.00'),
            quantity=3
        )
        total = order.calculate_totals()
        order.save()

        self.assertEqual(order.subtotal, Decimal('300.00'))
        self.assertEqual(order.total_amount, Decimal('323.50'))

    def test_coupon_discount_calculation(self):
        now = timezone.now()
        coupon = Coupon.objects.create(
            code='SAVE20',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('20.00'),
            minimum_order_amount=Decimal('50.00'),
            max_discount_amount=Decimal('50.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )
        self.assertTrue(coupon.is_valid_for_amount(Decimal('100.00')))
        self.assertFalse(coupon.is_valid_for_amount(Decimal('30.00')))

        # 20% of $200 is $40 (below max discount $50)
        self.assertEqual(coupon.calculate_discount(Decimal('200.00')), Decimal('40.00'))

        # 20% of $500 is $100 -> capped at max discount $50
        self.assertEqual(coupon.calculate_discount(Decimal('500.00')), Decimal('50.00'))
