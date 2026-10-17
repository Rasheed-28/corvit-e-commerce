from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory, Review

User = get_user_model()

class CatalogModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(username='customer', email='cust@example.com', password='password123')
        self.staff_user = User.objects.create_user(username='staff', email='staff@example.com', password='password123', is_staff=True)

        self.category = ProductCategory.objects.create(name='Electronics', slug='electronics')
        self.sub_category = ProductCategory.objects.create(name='Laptops', slug='laptops', parent=self.category)
        self.product = Product.objects.create(
            category=self.sub_category,
            title='Pro Laptop 15',
            slug='pro-laptop-15',
            sku='LAP-15-BASE',
            description='High performance laptop.',
            base_price=Decimal('1299.99'),
            is_active=True
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

    # 1. Model Domain Logic Tests
    def test_category_hierarchy(self):
        self.assertEqual(str(self.sub_category), 'Electronics -> Laptops')
        self.assertEqual(list(self.category.children.all()), [self.sub_category])

    def test_variant_effective_price(self):
        self.assertEqual(self.variant.effective_price, Decimal('1499.99'))

    def test_inventory_availability(self):
        self.assertEqual(self.inventory.available_quantity, 12)
        self.assertTrue(self.inventory.is_in_stock)

    # 2. Public Catalog API Tests (Success Responses)
    def test_public_product_list(self):
        url = reverse('catalog:product-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertGreaterEqual(len(response.data['data']), 1)

    def test_public_product_detail(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'pro-laptop-15'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['sku'], 'LAP-15-BASE')
        self.assertGreaterEqual(len(response.data['data']['variants']), 1)

    # 3. Filtering & Search Tests
    def test_product_search_filter(self):
        url = reverse('catalog:product-list-create') + '?search=Laptop'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)

    # 4. Unauthorized Access (Protected Admin Write Endpoints)
    def test_non_staff_cannot_create_product(self):
        url = reverse('catalog:product-list-create')
        payload = {
            'title': 'Hacked Product',
            'slug': 'hacked-product',
            'sku': 'HACK-01',
            'description': 'Malicious',
            'base_price': '10.00'
        }
        # Attempted by regular non-staff user
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'FORBIDDEN')

    def test_staff_can_create_product(self):
        url = reverse('catalog:product-list-create')
        payload = {
            'title': 'Admin Added Headphones',
            'slug': 'admin-headphones',
            'sku': 'ADM-HEAD-01',
            'description': 'Studio quality',
            'base_price': '199.99'
        }
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])

    # 5. Reviews - Unauthenticated & Invalid Input
    def test_unauthenticated_user_cannot_post_review(self):
        url = reverse('catalog:product-review-list-create', kwargs={'slug': 'pro-laptop-15'})
        payload = {'rating': 5, 'title': 'Great', 'comment': 'Loved it'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_review_rating_out_of_range(self):
        url = reverse('catalog:product-review-list-create', kwargs={'slug': 'pro-laptop-15'})
        payload = {'rating': 10, 'title': 'Over 5 stars', 'comment': 'Impossible score'} # Max rating is 5
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
