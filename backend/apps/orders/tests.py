import uuid
from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models import Address
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory
from apps.cart.models import Cart, CartItem
from apps.orders.models import Coupon, Order, OrderItem, Payment

User = get_user_model()


class OrdersWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(
            username='buyer@example.com',
            email='buyer@example.com',
            password='Password123!',
            first_name='Buyer',
            last_name='One'
        )
        self.other_buyer = User.objects.create_user(
            username='other@example.com',
            email='other@example.com',
            password='Password123!',
            first_name='Other',
            last_name='User'
        )

        self.address = Address.objects.create(
            user=self.buyer,
            full_name='Buyer Name',
            phone_number='+15551234567',
            street_address_1='456 Elm Street',
            city='Dallas',
            state_or_province='TX',
            postal_code='75001',
            country='United States'
        )

        self.category = ProductCategory.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            category=self.category,
            title='Wireless Studio Headphones',
            slug='wireless-studio-headphones',
            sku='AUD-HEAD-01',
            base_price=Decimal('200.00'),
            is_active=True
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            name='Color: Matte Black',
            sku='AUD-HEAD-BLK',
            price_override=Decimal('220.00'),
            is_active=True
        )
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=10,
            reserved_quantity=0
        )

    # ==========================================
    # 1. Historical Snapshots & Immutability
    # ==========================================

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
        self.assertEqual(item.line_total, Decimal('440.00'))

        # Mutate the source product & variant catalog values
        self.product.title = 'Updated Title 2027'
        self.product.base_price = Decimal('300.00')
        self.product.save()
        self.variant.price_override = Decimal('350.00')
        self.variant.save()

        # Reload order item: historical values MUST remain immutable
        item.refresh_from_db()
        self.assertEqual(item.product_title, 'Wireless Studio Headphones')
        self.assertEqual(item.unit_price, Decimal('220.00'))
        self.assertEqual(item.line_total, Decimal('440.00'))

    # ==========================================
    # 2. Checkout Execution & Server Calculations
    # ==========================================

    def test_checkout_success_with_saved_address(self):
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
            'customer_notes': 'Handle with care',
            'payment_method': 'CREDIT_CARD'
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['success'])

        data = res.data['data']
        self.assertIn('order_number', data)
        self.assertEqual(data['status'], Order.OrderStatus.PENDING)
        # Subtotal: 2 * 220.00 = 440.00 (qualifies for free shipping >= 50.00)
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('440.00'))
        self.assertEqual(Decimal(str(data['shipping_fee'])), Decimal('0.00'))
        # Tax: 8% of 440.00 = 35.20
        self.assertEqual(Decimal(str(data['tax_amount'])), Decimal('35.20'))
        # Total: 440.00 + 35.20 = 475.20
        self.assertEqual(Decimal(str(data['total_amount'])), Decimal('475.20'))

        # Verify address snapshot
        self.assertEqual(data['shipping_address_snapshot']['street_address_1'], '456 Elm Street')

        # Verify inventory decremented from 10 to 8
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 8)

        # Verify cart deactivated
        cart.refresh_from_db()
        self.assertFalse(cart.is_active)

    def test_checkout_success_with_new_address_input(self):
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        payload = {
            'shipping_address': {
                'full_name': 'Jane Doe',
                'phone_number': '+15559876543',
                'street_address_1': '789 Pine Ave',
                'city': 'Austin',
                'state_or_province': 'TX',
                'postal_code': '78701',
                'country': 'United States',
                'save_to_address_book': True
            },
            'customer_notes': 'Leave on porch'
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['data']['shipping_address_snapshot']['full_name'], 'Jane Doe')

        # Verify newly saved address was created in address book
        saved = Address.objects.filter(user=self.buyer, street_address_1='789 Pine Ave').first()
        self.assertIsNotNone(saved)

    def test_checkout_server_calculates_totals_never_trusts_frontend(self):
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        # Malicious client sends $1.00 subtotal and $0.00 total
        payload = {
            'shipping_address_id': str(self.address.id),
            'subtotal': '1.00',
            'total_amount': '1.00',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # Server must enforce actual catalog price 220.00 + 8% tax 17.60 = 237.60
        self.assertEqual(Decimal(str(res.data['data']['subtotal'])), Decimal('220.00'))
        self.assertEqual(Decimal(str(res.data['data']['total_amount'])), Decimal('237.60'))

    # ==========================================
    # 3. Stock Shortages, Validation & Idempotency
    # ==========================================

    def test_checkout_stock_shortage_aborts_transaction(self):
        # Cart requests 15 units, but inventory only has 10
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=15,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        payload = {'shipping_address_id': str(self.address.id)}
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'INSUFFICIENT_STOCK')

        # Verify inventory unchanged
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 10)

        # Verify no order created
        self.assertEqual(Order.objects.count(), 0)

    def test_checkout_empty_cart_rejected(self):
        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'shipping_address_id': str(self.address.id)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'EMPTY_CART')

    def test_checkout_invalid_address_rejected(self):
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(cart=cart, product=self.product, variant=self.variant, quantity=1)

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        # Random non-existent address ID
        res = self.client.post(url, {'shipping_address_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_duplicate_request_idempotency(self):
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        idempotency_key = f"key_{uuid.uuid4()}"
        payload = {
            'shipping_address_id': str(self.address.id),
            'idempotency_key': idempotency_key
        }

        # 1. First submission
        res1 = self.client.post(url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order_num = res1.data['data']['order_number']

        # Inventory decremented from 10 to 9
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 9)

        # 2. Repeated duplicate submission with same idempotency_key
        res2 = self.client.post(url, payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['data']['order_number'], order_num)

        # Total orders in database must strictly be 1
        self.assertEqual(Order.objects.filter(user=self.buyer).count(), 1)
        # Inventory must NOT be double-decremented
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 9)

    # ==========================================
    # 4. Security & Permissions
    # ==========================================

    def test_unauthenticated_checkout_denied(self):
        url = reverse('orders:order-list-create')
        res = self.client.post(url, {'shipping_address_id': str(self.address.id)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthorized_order_access_denied(self):
        order = Order.objects.create(user=self.buyer, total_amount=Decimal('100.00'))
        url = reverse('orders:order-detail', kwargs={'order_number': order.order_number})

        # other_buyer attempts to access buyer's order
        self.client.force_authenticate(user=self.other_buyer)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================
    # 5. Payment Verification & Failure Handling
    # ==========================================

    def test_payment_success_transitions_order_status_to_paid(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.PENDING,
            total_amount=Decimal('237.60')
        )
        url = reverse('orders:order-payments', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=self.buyer)

        payload = {
            'payment_method': 'CREDIT_CARD',
            'card_number': '4242424242424242',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['data']['status'], 'COMPLETED')

        # Verify order transitioned to PAID
        order.refresh_from_db()
        self.assertEqual(order.status, Order.OrderStatus.PAID)

    def test_payment_failure_does_not_mark_order_paid(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.PENDING,
            total_amount=Decimal('237.60')
        )
        url = reverse('orders:order-payments', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=self.buyer)

        payload = {
            'payment_method': 'CREDIT_CARD',
            'card_number': '4242424242420002',  # Simulated decline
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Order must remain PENDING
        order.refresh_from_db()
        self.assertEqual(order.status, Order.OrderStatus.PENDING)

        # Failed payment audit record exists
        payment = Payment.objects.filter(order=order).first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.status, Payment.PaymentStatus.FAILED)

    # ==========================================
    # 6. Cancellation & Inventory Restoration
    # ==========================================

    def test_order_cancellation_restores_inventory(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.PENDING,
            total_amount=Decimal('220.00')
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            variant=self.variant,
            product_title=self.product.title,
            variant_name=self.variant.name,
            sku=self.variant.sku,
            unit_price=Decimal('220.00'),
            quantity=3,
            line_total=Decimal('660.00')
        )
        # Simulate stock after order creation was 7 (10 - 3)
        self.inventory.quantity = 7
        self.inventory.save()

        url = reverse('orders:order-cancel', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=self.buyer)
        payload = {'reason': 'Found a better price elsewhere'}
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['status'], Order.OrderStatus.CANCELLED)
        self.assertEqual(res.data['data']['cancellation_reason'], 'Found a better price elsewhere')

        # Verify inventory restored from 7 back to 10
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, 10)

    def test_order_cancellation_prohibited_after_shipment(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.SHIPPED,
            total_amount=Decimal('220.00')
        )
        url = reverse('orders:order-cancel', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'reason': 'Want refund'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'CANNOT_CANCEL')

    # ==========================================
    # 7. Order Preview & Coupon Validation
    # ==========================================

    def test_order_preview_endpoint(self):
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )

        url = reverse('orders:order-preview')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        self.assertEqual(Decimal(str(res.data['data']['subtotal'])), Decimal('220.00'))
        self.assertEqual(Decimal(str(res.data['data']['shipping_fee'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(res.data['data']['total_amount'])), Decimal('237.60'))

    def test_coupon_validation_and_checkout_application(self):
        now = timezone.now()
        coupon = Coupon.objects.create(
            code='SAVE20',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('20.00'),
            minimum_order_amount=Decimal('50.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )

        # 1. Validate endpoint
        val_url = reverse('orders:coupon-validate')
        val_res = self.client.post(val_url, {'code': 'SAVE20', 'cart_subtotal': '200.00'}, format='json')
        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(val_res.data['data']['discount_amount'])), Decimal('40.00'))

        # 2. Checkout with coupon
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )

        checkout_url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            checkout_url,
            {'shipping_address_id': str(self.address.id), 'coupon_code': 'SAVE20'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # 20% of 220 = 44.00
        self.assertEqual(Decimal(str(res.data['data']['discount_amount'])), Decimal('44.00'))

        # Usage count incremented
        coupon.refresh_from_db()
        self.assertEqual(coupon.times_used, 1)

    # ==========================================
    # 8. Coupon Edge Cases & Safety Bounds
    # ==========================================

    def test_coupon_validation_expired(self):
        now = timezone.now()
        Coupon.objects.create(
            code='EXPIRED10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            valid_from=now - timedelta(days=10),
            valid_to=now - timedelta(days=1),
            is_active=True
        )
        url = reverse('orders:coupon-validate')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'code': 'EXPIRED10', 'cart_subtotal': '100.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data['success'])
        self.assertEqual(res.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('expired', str(res.data['error']).lower())

    def test_coupon_validation_not_yet_active(self):
        now = timezone.now()
        Coupon.objects.create(
            code='FUTURE10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            valid_from=now + timedelta(days=2),
            valid_to=now + timedelta(days=10),
            is_active=True
        )
        url = reverse('orders:coupon-validate')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'code': 'FUTURE10', 'cart_subtotal': '100.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('not started yet', str(res.data['error']).lower())

    def test_coupon_validation_inactive(self):
        now = timezone.now()
        Coupon.objects.create(
            code='DISABLED10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=False
        )
        url = reverse('orders:coupon-validate')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'code': 'DISABLED10', 'cart_subtotal': '100.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('inactive', str(res.data['error']).lower())

    def test_coupon_validation_min_order_unmet(self):
        now = timezone.now()
        Coupon.objects.create(
            code='BIGSPENDER',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('20.00'),
            minimum_order_amount=Decimal('500.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )
        url = reverse('orders:coupon-validate')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'code': 'BIGSPENDER', 'cart_subtotal': '150.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('minimum order amount', str(res.data['error']).lower())

    def test_coupon_validation_usage_limit_reached(self):
        now = timezone.now()
        Coupon.objects.create(
            code='LIMITED5',
            discount_type=Coupon.DiscountType.FIXED_AMOUNT,
            discount_value=Decimal('5.00'),
            usage_limit=2,
            times_used=2,
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )
        url = reverse('orders:coupon-validate')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'code': 'LIMITED5', 'cart_subtotal': '100.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('maximum usage limit', str(res.data['error']).lower())

    def test_checkout_with_expired_coupon_rejected(self):
        now = timezone.now()
        Coupon.objects.create(
            code='EXPIRED_CHECKOUT',
            discount_type=Coupon.DiscountType.FIXED_AMOUNT,
            discount_value=Decimal('20.00'),
            valid_from=now - timedelta(days=5),
            valid_to=now - timedelta(days=1),
            is_active=True
        )
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )
        checkout_url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            checkout_url,
            {'shipping_address_id': str(self.address.id), 'coupon_code': 'EXPIRED_CHECKOUT'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', str(res.data['error']).lower())

    def test_coupon_fixed_discount_capped_and_never_negative(self):
        now = timezone.now()
        Coupon.objects.create(
            code='HUGE1000',
            discount_type=Coupon.DiscountType.FIXED_AMOUNT,
            discount_value=Decimal('1000.00'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True
        )
        # Cart subtotal is $220.00
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )
        checkout_url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            checkout_url,
            {'shipping_address_id': str(self.address.id), 'coupon_code': 'HUGE1000'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # Discount should be capped at subtotal ($220.00)
        self.assertEqual(Decimal(str(res.data['data']['discount_amount'])), Decimal('220.00'))
        # Total amount must be non-negative
        self.assertGreaterEqual(Decimal(str(res.data['data']['total_amount'])), Decimal('0.00'))

    # ==========================================
    # 9. Email Notification Workflows
    # ==========================================

    def test_order_confirmation_email_dispatched_on_checkout(self):
        mail.outbox.clear()
        cart = Cart.objects.create(user=self.buyer, is_active=True)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            variant=self.variant,
            quantity=1,
            unit_price=self.variant.effective_price
        )
        checkout_url = reverse('orders:order-list-create')
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            checkout_url,
            {'shipping_address_id': str(self.address.id), 'payment_method': 'CASH_ON_DELIVERY'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_number = res.data['data']['order_number']

        # Verify confirmation email sent
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertIn(f"Order Confirmation: #{order_number}", sent.subject)
        self.assertIn(self.buyer.email, sent.to)
        self.assertIn(self.product.title, sent.body)
        self.assertTrue(len(sent.alternatives) > 0)
        self.assertEqual(sent.alternatives[0][1], 'text/html')

    def test_order_status_update_email_dispatched_on_cancellation(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.PENDING,
            total_amount=Decimal('220.00')
        )
        mail.outbox.clear()

        url = reverse('orders:order-cancel', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(url, {'reason': 'Found better deal'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertIn(f"Order #{order.order_number} Update: Cancelled", sent.subject)
        self.assertIn(self.buyer.email, sent.to)
        self.assertIn("Found better deal", sent.body)

    def test_order_status_update_email_dispatched_on_staff_status_update(self):
        order = Order.objects.create(
            user=self.buyer,
            status=Order.OrderStatus.PROCESSING,
            total_amount=Decimal('220.00')
        )
        staff_user = User.objects.create_superuser(
            username='orders_staff',
            email='staff@example.com',
            password='Password123!'
        )
        mail.outbox.clear()

        url = reverse('orders:order-detail', kwargs={'order_number': order.order_number})
        self.client.force_authenticate(user=staff_user)
        res = self.client.patch(url, {'status': Order.OrderStatus.SHIPPED}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertIn(f"Order #{order.order_number} Update: Shipped", sent.subject)
        self.assertIn(self.buyer.email, sent.to)

    def test_coupon_validation_rate_limiting(self):
        from unittest.mock import patch
        from django.core.cache import cache
        cache.clear()
        with patch.dict('rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES', {'coupons': '2/minute'}):
            url = reverse('orders:coupon-validate')
            payload = {'code': 'INVALID1', 'subtotal': '100.00'}

            r1 = self.client.post(url, payload, format='json')
            self.assertEqual(r1.status_code, status.HTTP_400_BAD_REQUEST)
            r2 = self.client.post(url, payload, format='json')
            self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

            # 3rd request is throttled
            r3 = self.client.post(url, payload, format='json')
            self.assertEqual(r3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        cache.clear()

