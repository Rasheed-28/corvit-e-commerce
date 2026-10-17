from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory
from apps.cart.models import Cart, CartItem, Wishlist, WishlistItem

User = get_user_model()

class CartModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
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
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=10,
            reserved_quantity=0
        )

    # 1. Cart API Tests (Success Responses)
    def test_get_cart_success(self):
        url = reverse('cart:cart-detail')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['total_items'], 0)

    def test_add_to_cart_success(self):
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'variant_id': str(self.variant.id),
            'quantity': 2
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['total_items'], 2)
        self.assertEqual(Decimal(str(response.data['data']['subtotal'])), Decimal('50.00'))

    # 2. Invalid Input Tests
    def test_add_to_cart_invalid_zero_quantity(self):
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'quantity': 0 # Min value is 1
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_add_to_cart_insufficient_stock(self):
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'variant_id': str(self.variant.id),
            'quantity': 50 # Only 10 available
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    # 3. Unauthenticated Wishlist Access
    def test_unauthenticated_wishlist_access(self):
        url = reverse('cart:wishlist-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_wishlist_add(self):
        url = reverse('cart:wishlist-list-create')
        self.client.force_authenticate(user=self.user)
        payload = {'product_id': str(self.product.id)}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
