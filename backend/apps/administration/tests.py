import json
import uuid
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Address, CustomerProfile
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory, ProductImage, Review
from apps.orders.models import Coupon, Order, OrderItem, Payment

User = get_user_model()


class AdminBaseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Regular Customer User
        self.customer = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='CustomerPassword123!',
            first_name='Jane',
            last_name='Doe'
        )

        # Create Admin Staff User
        self.admin = User.objects.create_user(
            username='admin@example.com',
            email='admin@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User',
            is_staff=True
        )

        # Setup standard category, product, variant, inventory
        self.category = ProductCategory.objects.create(
            name='Electronics',
            slug='electronics',
            description='Electronic gadgets and components'
        )

        self.product = Product.objects.create(
            category=self.category,
            title='Pro ANC Headphones',
            slug='pro-anc-headphones',
            sku='HEAD-ANC-01',
            base_price=Decimal('299.99'),
            is_active=True
        )

        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='Midnight Black',
            sku='HEAD-ANC-BLK',
            price_override=Decimal('299.99'),
            is_active=True
        )

        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=15,
            reserved_quantity=0,
            low_stock_threshold=5
        )

        # Setup shipping address
        self.address = Address.objects.create(
            user=self.customer,
            full_name='Jane Doe',
            phone_number='+15559876543',
            street_address_1='123 Market Street',
            city='San Francisco',
            state_or_province='CA',
            postal_code='94105',
            country='United States'
        )

        # Setup sample order
        self.order = Order.objects.create(
            user=self.customer,
            order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
            status=Order.OrderStatus.PAID,
            shipping_address=self.address,
            billing_address=self.address,
            subtotal=Decimal('299.99'),
            tax_amount=Decimal('25.00'),
            shipping_fee=Decimal('10.00'),
            discount_amount=Decimal('0.00'),
            total_amount=Decimal('334.99')
        )

        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            variant=self.variant,
            product_title=self.product.title,
            variant_name=self.variant.name,
            sku=self.variant.sku,
            unit_price=Decimal('299.99'),
            quantity=1,
            line_total=Decimal('299.99')
        )

        self.payment = Payment.objects.create(
            order=self.order,
            gateway='simulated',
            payment_method=Payment.PaymentMethod.STRIPE,
            transaction_id=f"tx_{uuid.uuid4().hex[:12]}",
            amount=Decimal('334.99'),
            status=Payment.PaymentStatus.COMPLETED
        )


class AdminSecurityPermissionTests(AdminBaseTestCase):
    def test_anonymous_user_blocked(self):
        """Unauthenticated requests to admin endpoints must return 401 Unauthorized."""
        endpoints = [
            '/api/v1/admin/overview/',
            '/api/v1/admin/reports/sales/',
            '/api/v1/admin/products/',
            '/api/v1/admin/categories/',
            '/api/v1/admin/inventory/',
            '/api/v1/admin/orders/',
            '/api/v1/admin/customers/',
            '/api/v1/admin/coupons/',
            '/api/v1/admin/reviews/',
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {url} should require authentication."
            )

    def test_regular_customer_blocked(self):
        """Authenticated non-staff users must receive 403 Forbidden on all admin endpoints."""
        self.client.force_authenticate(user=self.customer)
        endpoints = [
            '/api/v1/admin/overview/',
            '/api/v1/admin/reports/sales/',
            '/api/v1/admin/products/',
            '/api/v1/admin/categories/',
            '/api/v1/admin/inventory/',
            '/api/v1/admin/orders/',
            '/api/v1/admin/customers/',
            '/api/v1/admin/coupons/',
            '/api/v1/admin/reviews/',
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Endpoint {url} should forbid non-staff customer."
            )

    def test_staff_admin_allowed(self):
        """Authenticated staff users must be allowed access to admin endpoints."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/admin/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success'))


class AdminDashboardAndReportsTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_overview_metrics(self):
        response = self.client.get('/api/v1/admin/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})

        self.assertIn('metrics', data)
        metrics = data['metrics']
        self.assertIn('total_revenue', metrics)
        self.assertIn('total_orders', metrics)
        self.assertIn('total_customers', metrics)
        self.assertIn('low_stock_count', metrics)
        self.assertIn('average_order_value', metrics)

        # Revenue should match our paid order
        self.assertAlmostEqual(float(metrics['total_revenue']), 334.99, places=2)
        self.assertEqual(metrics['total_orders'], 1)

        self.assertIn('sales_trend', data)
        self.assertIn('recent_orders', data)
        self.assertIn('low_stock_items', data)

    def test_sales_report_calculations(self):
        response = self.client.get('/api/v1/admin/reports/sales/?period=30d')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report = response.data.get('data', {})

        self.assertIn('financial_summary', report)
        summary = report['financial_summary']
        self.assertAlmostEqual(float(summary['gross_subtotal']), 299.99, places=2)
        self.assertEqual(summary['total_units_sold'], 1)

        self.assertIn('status_breakdown', report)
        self.assertIn('top_products', report)
        self.assertIn('payment_methods', report)


class AdminCatalogManagementTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_category_crud(self):
        # Create category
        create_resp = self.client.post('/api/v1/admin/categories/', {
            'name': 'Wearables',
            'slug': 'wearables',
            'description': 'Smartwatches and fitness trackers',
            'is_active': True
        })
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        cat_id = create_resp.data['data']['id']

        # Update category
        update_resp = self.client.patch(f'/api/v1/admin/categories/{cat_id}/', {
            'name': 'Wearables & Health'
        })
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['data']['name'], 'Wearables & Health')

        # Delete category
        del_resp = self.client.delete(f'/api/v1/admin/categories/{cat_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)

    def test_product_crud_and_safety(self):
        # Create product with initial inventory
        payload = {
            'category': self.category.id,
            'title': 'Mechanical Gaming Keyboard',
            'slug': 'mech-keyboard',
            'sku': 'KB-MECH-01',
            'description': 'Pro mechanical gaming keyboard with RGB switches',
            'base_price': '149.99',
            'is_active': True,
            'initial_stock': 50
        }
        create_resp = self.client.post('/api/v1/admin/products/', payload)
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        prod_id = create_resp.data['data']['id']

        # Update product
        patch_resp = self.client.patch(f'/api/v1/admin/products/{prod_id}/', {
            'base_price': '139.99'
        })
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(str(patch_resp.data['data']['base_price']), '139.99')

        # Deleting a product that is in an active order deactivates rather than hard deletes
        del_ordered = self.client.delete(f'/api/v1/admin/products/{self.product.id}/')
        self.assertEqual(del_ordered.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)

        # Deleting unused product hard deletes it
        del_unused = self.client.delete(f'/api/v1/admin/products/{prod_id}/')
        self.assertEqual(del_unused.status_code, status.HTTP_200_OK)
        self.assertFalse(Product.objects.filter(id=prod_id).exists())


class AdminInventoryManagementTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_list_and_filter_inventory(self):
        response = self.client.get('/api/v1/admin/inventory/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('total_tracked', response.data['summary'])

    def test_adjust_inventory_quantity(self):
        # Directly set quantity
        resp = self.client.patch(f'/api/v1/admin/inventory/{self.inventory.id}/', {
            'quantity': 40,
            'low_stock_threshold': 10
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 40)
        self.assertEqual(self.inventory.low_stock_threshold, 10)

        # Relative adjustment
        adj_resp = self.client.patch(f'/api/v1/admin/inventory/{self.inventory.id}/', {
            'adjustment': -5
        })
        self.assertEqual(adj_resp.status_code, status.HTTP_200_OK)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 35)


class AdminOrderManagementTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_list_and_search_orders(self):
        resp = self.client.get(f'/api/v1/admin/orders/?search={self.order.order_number}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', resp.data.get('data', []))
        self.assertEqual(len(results), 1)

    def test_order_detail(self):
        resp = self.client.get(f'/api/v1/admin/orders/{self.order.order_number}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['data']['order_number'], self.order.order_number)

    def test_valid_status_transition(self):
        resp = self.client.patch(f'/api/v1/admin/orders/{self.order.order_number}/status/', {
            'status': Order.OrderStatus.PROCESSING
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.PROCESSING)

    def test_invalid_status_transition_rejected(self):
        # Order is CONFIRMED; jumping to REFUNDED without cancelling or delivering first is invalid
        resp = self.client.patch(f'/api/v1/admin/orders/{self.order.order_number}/status/', {
            'status': Order.OrderStatus.REFUNDED
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_cancellation_restores_inventory(self):
        initial_inv = self.inventory.quantity
        cancel_resp = self.client.patch(f'/api/v1/admin/orders/{self.order.order_number}/status/', {
            'status': Order.OrderStatus.CANCELLED,
            'reason': 'Customer requested cancellation'
        })
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.OrderStatus.CANCELLED)

        # Inventory quantity must have been restored by item quantity (1)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, initial_inv + self.order_item.quantity)


class AdminCustomerManagementTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_list_and_detail_customers(self):
        list_resp = self.client.get('/api/v1/admin/customers/')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        results = list_resp.data.get('results', list_resp.data.get('data', []))
        self.assertGreaterEqual(len(results), 1)

        detail_resp = self.client.get(f'/api/v1/admin/customers/{self.customer.id}/')
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data['data']['email'], self.customer.email)

    def test_toggle_customer_status(self):
        # Deactivate customer
        toggle_resp = self.client.patch(f'/api/v1/admin/customers/{self.customer.id}/status/')
        self.assertEqual(toggle_resp.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        # Reactivate customer
        toggle_resp = self.client.patch(f'/api/v1/admin/customers/{self.customer.id}/status/')
        self.assertEqual(toggle_resp.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)

    def test_cannot_deactivate_self_or_superuser(self):
        resp = self.client.patch(f'/api/v1/admin/customers/{self.admin.id}/status/')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class AdminCouponManagementTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)

    def test_coupon_crud(self):
        # Create coupon
        now = timezone.now()
        payload = {
            'code': 'SUMMER25',
            'discount_type': Coupon.DiscountType.PERCENTAGE,
            'discount_value': '25.00',
            'minimum_order_amount': '50.00',
            'max_discount_amount': '50.00',
            'usage_limit': 100,
            'is_active': True,
            'valid_from': (now - timedelta(days=1)).isoformat(),
            'valid_to': (now + timedelta(days=30)).isoformat()
        }
        create_resp = self.client.post('/api/v1/admin/coupons/', payload)
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        coupon_id = create_resp.data['data']['id']

        # Update coupon
        update_resp = self.client.patch(f'/api/v1/admin/coupons/{coupon_id}/', {
            'discount_value': '30.00'
        })
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(str(update_resp.data['data']['discount_value']), '30.00')

        # Delete coupon
        del_resp = self.client.delete(f'/api/v1/admin/coupons/{coupon_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(Coupon.objects.filter(id=coupon_id).exists())


class AdminReviewModerationTests(AdminBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)
        self.review = Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=5,
            title='Incredible Audio Quality',
            comment='The noise cancellation is phenomenal, highly recommended!',
            is_approved=False
        )

    def test_list_and_moderate_review(self):
        # List reviews
        list_resp = self.client.get('/api/v1/admin/reviews/?is_approved=false')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        results = list_resp.data.get('results', list_resp.data.get('data', []))
        self.assertEqual(len(results), 1)

        # Approve review
        mod_resp = self.client.patch(f'/api/v1/admin/reviews/{self.review.id}/moderate/', {
            'is_approved': True
        })
        self.assertEqual(mod_resp.status_code, status.HTTP_200_OK)
        self.review.refresh_from_db()
        self.assertTrue(self.review.is_approved)

        # Delete review
        del_resp = self.client.delete(f'/api/v1/admin/reviews/{self.review.id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())
