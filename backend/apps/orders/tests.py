from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models import Address
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory
from apps.cart.models import Cart, CartItem
from apps.orders.models import Coupon, Order, OrderItem, Payment

User = get_user_model()

class OrdersModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(username='buyer', email='buyer@example.com', password='password123')
        self.other_buyer = User.objects.create_user(username='other', email='other@example.com', password='password123')

        self.address = Address.objects.create(
            user=self.buyer,
            full_name='Buyer Name',
            street_address_1='456 Elm Street',
            city='Dallas',
            state_or_province='TX',
            postal_code='75001',
            country='US'
        )

        self.category = ProductCategory.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            category=self.category,
            title='Wireless Noise-Cancelling Headphones',
            slug='wireless-headphones',
            sku='AUD-HEAD-01',
            base_price=Decimal('199.99'),
            is_active=True
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='Color: Midnight Black',
            sku='AUD-HEAD-BLK',
            price_override=Decimal('219.99'),
            is_active=True
        )
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=20,
            reserved_quantity=0
        )

    # 1. Model Logic Tests
    def test_order_item_historical_snapshot(self):
        order = Order.objects.create(user=self.buyer)
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

        # Mutate the source product & variant
        self.product.title = 'Updated Title 2027'
        self.product.base_price = Decimal('299.99')
        self.product.save()

        # Reload order item from db: historical values MUST remain unchanged
        item.refresh_from_db()
        self.assertEqual(item.product_title, 'Wireless Noise-Cancelling Headphones')
        self.assertEqual(item.unit_price, Decimal('219.99'))
        self.assertEqual(item.line_total, Decimal('439.98'))

    # 2. Checkout API Tests (Success Responses)
    def test_checkout_success(self):
        # Set up active cart with items
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=2,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        payload = {
            'shipping_address_id': str(self.address.id),
            'customer_notes': 'Please ring doorbell on arrival'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        order_data = response.data['data']
        self.assertIn('order_number', order_data)
        # Server subtotal = 2 * $219.99 = $439.98
        self.assertEqual(Decimal(str(order_data['subtotal'])), Decimal('439.98'))

        # Verify inventory was decremented
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 18)

    # 3. Invalid Input (Empty Cart Checkout)
    def test_checkout_fails_with_empty_cart(self):
        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        payload = {'shipping_address_id': str(self.address.id)}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'EMPTY_CART')

    # 4. Unauthenticated Checkout Attempt
    def test_unauthenticated_checkout(self):
        url = reverse('orders:order-list-create')
        payload = {'shipping_address_id': str(self.address.id)}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 5. Unauthorized Order Access
    def test_unauthorized_order_access(self):
        order = Order.objects.create(user=self.buyer, total_amount=Decimal('100.00'))
        url = reverse('orders:order-detail', kwargs={'order_number': order.order_number})

        # 'other_buyer' attempts to view 'buyer' order
        self.client.force_authenticate(user=self.other_buyer)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 6. Coupon Validation API
    def test_coupon_validation_endpoint(self):
        now = timezone.now()
        Coupon.objects.create(
            code='SAVE10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            minimum_order_amount=Decimal('50.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )

        url = reverse('orders:coupon-validate')
        # Valid coupon
        res = self.client.post(url, {'code': 'SAVE10', 'subtotal': '100.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        self.assertEqual(Decimal(str(res.data['data']['discount_amount'])), Decimal('10.00'))

        # Invalid coupon
        bad_res = self.client.post(url, {'code': 'NOTREAL', 'subtotal': '100.00'}, format='json')
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(bad_res.data['success'])
