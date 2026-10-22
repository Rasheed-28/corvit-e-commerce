import io
from decimal import Decimal
from PIL import Image
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from apps.catalog.models import ProductCategory, Product, ProductImage, ProductVariant, Inventory, Review

User = get_user_model()


def generate_test_image(filename='test.png', size=(100, 100), color='blue', format='PNG') -> SimpleUploadedFile:
    """Generates an in-memory test image valid for Pillow validation."""
    image_io = io.BytesIO()
    image = Image.new('RGB', size, color=color)
    image.save(image_io, format=format)
    image_io.seek(0)
    return SimpleUploadedFile(
        name=filename,
        content=image_io.getvalue(),
        content_type=f"image/{format.lower()}"
    )


class CatalogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.customer = User.objects.create_user(
            username='regular_customer',
            email='customer@example.com',
            password='Password123!'
        )
        self.staff_user = User.objects.create_user(
            username='catalog_admin',
            email='admin@example.com',
            password='Password123!',
            is_staff=True
        )

        # Categories
        self.root_category = ProductCategory.objects.create(
            name='Electronics',
            slug='electronics',
            description='Electronic gadgets and computing'
        )
        self.sub_category = ProductCategory.objects.create(
            name='Laptops',
            slug='laptops',
            parent=self.root_category,
            description='Portable computers'
        )
        self.audio_category = ProductCategory.objects.create(
            name='Audio',
            slug='audio',
            parent=self.root_category,
            description='Headphones and audio equipment'
        )

        # Active Product 1: In-Stock Laptop
        self.laptop = Product.objects.create(
            category=self.sub_category,
            title='Pro Laptop 15',
            slug='pro-laptop-15',
            sku='LAP-15-BASE',
            description='High performance laptop with aluminum chassis.',
            base_price=Decimal('1200.00'),
            is_active=True,
            is_featured=True
        )
        self.laptop_variant_1 = ProductVariant.objects.create(
            product=self.laptop,
            name='16GB RAM / Silver',
            sku='LAP-15-16-SLV',
            color='Silver',
            size='15-inch',
            price_override=Decimal('1299.99'),
            is_active=True
        )
        self.laptop_inventory_1 = Inventory.objects.create(
            variant=self.laptop_variant_1,
            quantity=10,
            reserved_quantity=2,
            low_stock_threshold=3
        )
        self.laptop_variant_2 = ProductVariant.objects.create(
            product=self.laptop,
            name='32GB RAM / Space Gray',
            sku='LAP-15-32-GRY',
            color='Gray',
            size='15-inch',
            price_override=Decimal('1599.99'),
            is_active=True
        )
        self.laptop_inventory_2 = Inventory.objects.create(
            variant=self.laptop_variant_2,
            quantity=5,
            reserved_quantity=0,
            low_stock_threshold=2
        )

        # Active Product 2: Out-of-Stock Headphones
        self.headphones = Product.objects.create(
            category=self.audio_category,
            title='Noise Cancelling Headphones',
            slug='noise-cancelling-headphones',
            sku='AUDIO-NC-100',
            description='Wireless active noise cancellation over-ear headphones.',
            base_price=Decimal('250.00'),
            is_active=True,
            is_featured=False
        )
        self.headphone_variant = ProductVariant.objects.create(
            product=self.headphones,
            name='Black',
            sku='AUDIO-NC-BLK',
            color='Black',
            is_active=True
        )
        self.headphone_inventory = Inventory.objects.create(
            variant=self.headphone_variant,
            quantity=0,
            reserved_quantity=0,
            low_stock_threshold=5
        )

        # Unpublished Product 3
        self.draft_product = Product.objects.create(
            category=self.sub_category,
            title='Unreleased Gaming Laptop',
            slug='unreleased-gaming-laptop',
            sku='LAP-GAME-DRAFT',
            description='Top secret prototype laptop.',
            base_price=Decimal('2499.00'),
            is_active=False
        )
        self.draft_variant = ProductVariant.objects.create(
            product=self.draft_product,
            name='Prototype Spec',
            sku='LAP-GAME-PROTO',
            is_active=True
        )
        Inventory.objects.create(variant=self.draft_variant, quantity=1)

    # =========================================================================
    # 1. Public Product Listing & Product Detail Tests
    # =========================================================================

    def test_public_product_list_only_returns_active_products(self):
        url = reverse('catalog:product-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        slugs = [p['slug'] for p in response.data['data']]
        self.assertIn('pro-laptop-15', slugs)
        self.assertIn('noise-cancelling-headphones', slugs)
        # Draft product must NOT be returned to the public
        self.assertNotIn('unreleased-gaming-laptop', slugs)

    def test_public_product_detail_by_slug(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'pro-laptop-15'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        data = response.data['data']

        self.assertEqual(data['title'], 'Pro Laptop 15')
        self.assertEqual(data['sku'], 'LAP-15-BASE')
        self.assertEqual(data['category']['name'], 'Laptops')
        self.assertEqual(len(data['variants']), 2)
        # Total stock = (10 - 2) + (5 - 0) = 13
        self.assertEqual(data['total_stock'], 13)
        self.assertTrue(data['is_in_stock'])

    def test_public_product_detail_by_uuid(self):
        url = reverse('catalog:product-detail', kwargs={'slug': str(self.laptop.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['slug'], 'pro-laptop-15')

    def test_invalid_product_identifier_returns_404(self):
        # Non-existent slug
        url = reverse('catalog:product-detail', kwargs={'slug': 'completely-unknown-slug'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Non-existent UUID
        fake_uuid = '00000000-0000-0000-0000-000000000000'
        url_uuid = reverse('catalog:product-detail', kwargs={'slug': fake_uuid})
        response_uuid = self.client.get(url_uuid)
        self.assertEqual(response_uuid.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 2. Category Listing & Category-Based Filtering Tests
    # =========================================================================

    def test_category_list_hierarchical(self):
        url = reverse('catalog:category-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Root category has children Laptops and Audio
        categories = response.data['data']
        root = next((c for c in categories if c['slug'] == 'electronics'), None)
        self.assertIsNotNone(root)
        child_slugs = [child['slug'] for child in root['children']]
        self.assertIn('laptops', child_slugs)
        self.assertIn('audio', child_slugs)

    def test_category_list_flat(self):
        url = reverse('catalog:category-list-create') + '?flat=true'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [c['slug'] for c in response.data['data']]
        self.assertIn('electronics', slugs)
        self.assertIn('laptops', slugs)
        self.assertIn('audio', slugs)

    def test_filter_by_parent_category(self):
        # Filtering by parent 'electronics' should return products in its subcategories (Laptops & Audio)
        url = reverse('catalog:product-list-create') + '?category=electronics'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['data']]
        self.assertIn('pro-laptop-15', slugs)
        self.assertIn('noise-cancelling-headphones', slugs)

    def test_filter_by_child_category(self):
        url = reverse('catalog:product-list-create') + '?category=laptops'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['data']]
        self.assertIn('pro-laptop-15', slugs)
        self.assertNotIn('noise-cancelling-headphones', slugs)

    # =========================================================================
    # 3. Search and Attribute Filtering Tests
    # =========================================================================

    def test_search_by_product_name(self):
        url = reverse('catalog:product-list-create') + '?search=Headphones'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['slug'], 'noise-cancelling-headphones')

    def test_search_by_variant_sku(self):
        url = reverse('catalog:product-list-create') + '?search=LAP-15-16-SLV'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['slug'], 'pro-laptop-15')

    def test_filter_by_price_range(self):
        # Laptop base_price is 1200.00; Headphones is 250.00
        url = reverse('catalog:product-list-create') + '?min_price=200&max_price=300'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['data']]
        self.assertIn('noise-cancelling-headphones', slugs)
        self.assertNotIn('pro-laptop-15', slugs)

    def test_filter_by_color_and_size(self):
        url = reverse('catalog:product-list-create') + '?color=Silver&size=15-inch'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['slug'], 'pro-laptop-15')

    def test_filter_by_is_featured(self):
        url = reverse('catalog:product-list-create') + '?is_featured=true'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['data']]
        self.assertIn('pro-laptop-15', slugs)
        self.assertNotIn('noise-cancelling-headphones', slugs)

    # =========================================================================
    # 4. Query Parameter Validation Tests
    # =========================================================================

    def test_invalid_price_format_rejected(self):
        url = reverse('catalog:product-list-create') + '?min_price=abc'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    def test_negative_price_rejected(self):
        url = reverse('catalog:product-list-create') + '?min_price=-10'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_min_price_exceeding_max_price_rejected(self):
        url = reverse('catalog:product-list-create') + '?min_price=500&max_price=100'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_invalid_boolean_filter_rejected(self):
        url = reverse('catalog:product-list-create') + '?in_stock=not_a_bool'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    # =========================================================================
    # 5. Sorting and Ordering Tests
    # =========================================================================

    def test_sorting_by_price_ascending(self):
        url = reverse('catalog:product-list-create') + '?sort=price_asc'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prices = [float(p['base_price']) for p in response.data['data']]
        self.assertEqual(prices, sorted(prices))

    def test_sorting_by_price_descending(self):
        url = reverse('catalog:product-list-create') + '?sort=price_desc'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prices = [float(p['base_price']) for p in response.data['data']]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_sorting_by_title_ascending(self):
        url = reverse('catalog:product-list-create') + '?sort=title_asc'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [p['title'] for p in response.data['data']]
        self.assertEqual(titles, sorted(titles))

    # =========================================================================
    # 6. Pagination Tests
    # =========================================================================

    def test_pagination_structure_and_limits(self):
        url = reverse('catalog:product-list-create') + '?page=1&page_size=1'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)

        pagination = response.data['meta']['pagination']
        self.assertEqual(pagination['page'], 1)
        self.assertEqual(pagination['page_size'], 1)
        self.assertEqual(pagination['total_count'], 2)
        self.assertEqual(pagination['total_pages'], 2)
        self.assertTrue(pagination['has_next'])
        self.assertFalse(pagination['has_prev'])

    def test_pagination_out_of_bounds_returns_404(self):
        url = reverse('catalog:product-list-create') + '?page=999'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 7. Stock Availability Tests
    # =========================================================================

    def test_stock_availability_filtering(self):
        # Laptop has stock (13 units); Headphones has 0 units
        in_stock_url = reverse('catalog:product-list-create') + '?in_stock=true'
        in_stock_resp = self.client.get(in_stock_url)
        self.assertEqual(in_stock_resp.status_code, status.HTTP_200_OK)
        in_stock_slugs = [p['slug'] for p in in_stock_resp.data['data']]
        self.assertIn('pro-laptop-15', in_stock_slugs)
        self.assertNotIn('noise-cancelling-headphones', in_stock_slugs)

        out_stock_url = reverse('catalog:product-list-create') + '?in_stock=false'
        out_stock_resp = self.client.get(out_stock_url)
        self.assertEqual(out_stock_resp.status_code, status.HTTP_200_OK)
        out_stock_slugs = [p['slug'] for p in out_stock_resp.data['data']]
        self.assertIn('noise-cancelling-headphones', out_stock_slugs)
        self.assertNotIn('pro-laptop-15', out_stock_slugs)

    def test_variant_stock_calculations(self):
        # laptop_variant_1: quantity 10, reserved 2 -> available 8
        self.assertEqual(self.laptop_inventory_1.available_quantity, 8)
        self.assertTrue(self.laptop_inventory_1.is_in_stock)
        self.assertFalse(self.laptop_inventory_1.is_low_stock)

        # Increase reserved to 8 -> available 2 (<= threshold 3 -> low stock)
        self.laptop_inventory_1.reserved_quantity = 8
        self.laptop_inventory_1.save()
        self.assertEqual(self.laptop_inventory_1.available_quantity, 2)
        self.assertTrue(self.laptop_inventory_1.is_low_stock)

    # =========================================================================
    # 8. Unpublished Products & Publishing Lifecycle Tests
    # =========================================================================

    def test_customer_cannot_view_unpublished_product(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'unreleased-gaming-laptop'})
        self.client.force_authenticate(user=self.customer)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_can_view_unpublished_product(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'unreleased-gaming-laptop'})
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['slug'], 'unreleased-gaming-laptop')
        self.assertFalse(response.data['data']['is_active'])

    def test_staff_publish_and_unpublish_product(self):
        # 1. Publish draft product
        publish_url = reverse('catalog:product-publish', kwargs={'slug': 'unreleased-gaming-laptop'})
        self.client.force_authenticate(user=self.staff_user)
        pub_resp = self.client.post(publish_url)
        self.assertEqual(pub_resp.status_code, status.HTTP_200_OK)
        self.draft_product.refresh_from_db()
        self.assertTrue(self.draft_product.is_active)

        # 2. Public can now view it
        self.client.logout()
        detail_url = reverse('catalog:product-detail', kwargs={'slug': 'unreleased-gaming-laptop'})
        pub_view = self.client.get(detail_url)
        self.assertEqual(pub_view.status_code, status.HTTP_200_OK)

        # 3. Unpublish product
        unpublish_url = reverse('catalog:product-unpublish', kwargs={'slug': 'unreleased-gaming-laptop'})
        self.client.force_authenticate(user=self.staff_user)
        unpub_resp = self.client.post(unpublish_url)
        self.assertEqual(unpub_resp.status_code, status.HTTP_200_OK)
        self.draft_product.refresh_from_db()
        self.assertFalse(self.draft_product.is_active)

    def test_customer_cannot_publish_product(self):
        publish_url = reverse('catalog:product-publish', kwargs={'slug': 'unreleased-gaming-laptop'})
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(publish_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 9. Administrative Product Creation, Editing, Deletion & Image Uploads
    # =========================================================================

    def test_staff_can_create_product_with_initial_variants(self):
        url = reverse('catalog:product-list-create')
        payload = {
            'title': 'Ultra Monitor 27',
            'sku': 'MON-27-4K',
            'description': '4K UHD IPS display.',
            'base_price': '449.99',
            'category': str(self.root_category.id),
            'variants': [
                {
                    'name': 'Standard Stand',
                    'sku': 'MON-27-STD',
                    'quantity': 20,
                    'low_stock_threshold': 3
                },
                {
                    'name': 'Ergonomic Arm',
                    'sku': 'MON-27-ARM',
                    'price_override': '499.99',
                    'quantity': 10
                }
            ]
        }
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])

        created = Product.objects.get(sku='MON-27-4K')
        self.assertEqual(created.variants.count(), 2)
        # Total stock = 20 + 10 = 30
        self.assertEqual(response.data['data']['total_stock'], 30)

    def test_customer_cannot_create_product(self):
        url = reverse('catalog:product-list-create')
        payload = {
            'title': 'Hacked Monitor',
            'sku': 'HACK-MON',
            'description': 'Disallowed creation',
            'base_price': '10.00'
        }
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_update_product(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'pro-laptop-15'})
        payload = {
            'title': 'Pro Laptop 15 M2 Edition',
            'base_price': '1349.99'
        }
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.laptop.refresh_from_db()
        self.assertEqual(self.laptop.title, 'Pro Laptop 15 M2 Edition')
        self.assertEqual(self.laptop.base_price, Decimal('1349.99'))

    def test_staff_can_delete_product(self):
        url = reverse('catalog:product-detail', kwargs={'slug': 'pro-laptop-15'})
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Product.objects.filter(slug='pro-laptop-15').exists())

    def test_staff_can_create_and_update_variant(self):
        create_url = reverse('catalog:product-variant-list-create', kwargs={'slug': 'pro-laptop-15'})
        payload = {
            'name': '64GB RAM / Titanium',
            'sku': 'LAP-15-64-TITAN',
            'price_override': '1999.99',
            'quantity': 7
        }
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        variant_id = response.data['data']['id']

        # Update stock quantity on the variant
        detail_url = reverse('catalog:variant-detail', kwargs={'id': variant_id})
        update_resp = self.client.patch(detail_url, {'quantity': 15}, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['data']['quantity'], 15)

    def test_staff_can_upload_valid_image(self):
        url = reverse('catalog:product-image-list-create', kwargs={'slug': 'pro-laptop-15'})
        image_file = generate_test_image('laptop_front.png')

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(
            url,
            {'image': image_file, 'alt_text': 'Front view', 'is_primary': True},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['alt_text'], 'Front view')
        self.assertTrue(response.data['data']['is_primary'])

    def test_non_image_file_upload_rejected(self):
        url = reverse('catalog:product-image-list-create', kwargs={'slug': 'pro-laptop-15'})
        fake_image = SimpleUploadedFile(
            name='virus.png',
            content=b'echo "malicious payload"',
            content_type='image/png'
        )
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(
            url,
            {'image': fake_image, 'alt_text': 'Fake image'},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_customer_cannot_upload_image(self):
        url = reverse('catalog:product-image-list-create', kwargs={'slug': 'pro-laptop-15'})
        image_file = generate_test_image('laptop.png')
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(url, {'image': image_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ProductReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='reviewer_customer',
            email='reviewer@example.com',
            password='Password123!'
        )
        self.other_customer = User.objects.create_user(
            username='other_reviewer',
            email='other_rev@example.com',
            password='Password123!'
        )
        self.staff_user = User.objects.create_user(
            username='review_moderator',
            email='moderator@example.com',
            password='Password123!',
            is_staff=True
        )

        self.category = ProductCategory.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            category=self.category,
            title='Premium Soundbar',
            slug='premium-soundbar',
            sku='SND-BAR-01',
            base_price=Decimal('350.00'),
            is_active=True
        )

    def test_authenticated_customer_can_post_review(self):
        url = reverse('catalog:product-review-list-create', kwargs={'slug': self.product.slug})
        self.client.force_authenticate(user=self.customer)

        payload = {
            'rating': 5,
            'title': 'Stunning sound quality',
            'comment': 'Clean bass response and crystal clear dialogue.'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['rating'], 5)
        self.assertEqual(response.data['data']['title'], 'Stunning sound quality')
        # Without an order, verified purchase must be False
        self.assertFalse(response.data['data']['is_verified_purchase'])

    def test_verified_purchase_indicator_for_actual_buyer(self):
        from apps.orders.models import Order, OrderItem
        # Create a paid order for this user containing this product
        order = Order.objects.create(user=self.customer, status=Order.OrderStatus.PAID)
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_title=self.product.title,
            sku=self.product.sku,
            unit_price=Decimal('350.00'),
            quantity=1,
            line_total=Decimal('350.00')
        )

        url = reverse('catalog:product-review-list-create', kwargs={'slug': self.product.slug})
        self.client.force_authenticate(user=self.customer)

        payload = {
            'rating': 5,
            'title': 'Verified Purchase Review',
            'comment': 'Verified acoustics are top tier!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['data']['is_verified_purchase'])

    def test_unauthenticated_user_cannot_post_review(self):
        url = reverse('catalog:product-review-list-create', kwargs={'slug': self.product.slug})
        payload = {'rating': 4, 'title': 'Anon', 'comment': 'Nice product.'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_duplicate_review_rejected(self):
        Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=5,
            title='Initial Review',
            comment='Good initial thoughts.'
        )

        url = reverse('catalog:product-review-list-create', kwargs={'slug': self.product.slug})
        self.client.force_authenticate(user=self.customer)

        payload = {'rating': 4, 'title': 'Second Review', 'comment': 'Trying again.'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'DUPLICATE_REVIEW')

    def test_customer_can_update_own_review_and_cannot_tamper_permissions(self):
        review = Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=4,
            title='Initial',
            comment='Initial comment.',
            is_approved=False,
            is_verified_purchase=False
        )

        url = reverse('catalog:review-detail', kwargs={'id': review.id})
        self.client.force_authenticate(user=self.customer)

        # Attempt to escalate is_approved and is_verified_purchase
        payload = {
            'rating': 5,
            'title': 'Updated Title',
            'comment': 'Updated comment after weeks of testing.',
            'is_approved': True,
            'is_verified_purchase': True
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['rating'], 5)
        self.assertEqual(response.data['data']['title'], 'Updated Title')

        # Escalations must be stripped for non-staff
        review.refresh_from_db()
        self.assertFalse(review.is_approved)
        self.assertFalse(review.is_verified_purchase)

    def test_customer_cannot_update_or_delete_other_user_review(self):
        review = Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=5,
            title='Owner Review',
            comment='Comment.'
        )

        url = reverse('catalog:review-detail', kwargs={'id': review.id})
        self.client.force_authenticate(user=self.other_customer)

        # Update attempt by different user
        patch_res = self.client.patch(url, {'rating': 1}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_403_FORBIDDEN)

        # Delete attempt by different user
        del_res = self.client.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_can_delete_own_review(self):
        review = Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=3,
            title='Old Review',
            comment='No longer relevant.'
        )

        url = reverse('catalog:review-detail', kwargs={'id': review.id})
        self.client.force_authenticate(user=self.customer)

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Review.objects.filter(id=review.id).exists())

    def test_get_my_review_endpoint(self):
        url = reverse('catalog:product-user-review', kwargs={'slug': self.product.slug})

        # 1. Unauthenticated -> has_reviewed: False, can_review: False
        res_anon = self.client.get(url)
        self.assertEqual(res_anon.status_code, status.HTTP_200_OK)
        self.assertFalse(res_anon.data['data']['has_reviewed'])
        self.assertFalse(res_anon.data['data']['can_review'])

        # 2. Authenticated without review -> has_reviewed: False, can_review: True
        self.client.force_authenticate(user=self.customer)
        res_authed = self.client.get(url)
        self.assertEqual(res_authed.status_code, status.HTTP_200_OK)
        self.assertFalse(res_authed.data['data']['has_reviewed'])
        self.assertTrue(res_authed.data['data']['can_review'])

        # 3. Create review -> has_reviewed: True, can_review: False
        Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=5,
            title='My Soundbar',
            comment='Awesome unit.'
        )
        res_reviewed = self.client.get(url)
        self.assertEqual(res_reviewed.status_code, status.HTTP_200_OK)
        self.assertTrue(res_reviewed.data['data']['has_reviewed'])
        self.assertFalse(res_reviewed.data['data']['can_review'])
        self.assertEqual(res_reviewed.data['data']['review']['title'], 'My Soundbar')

