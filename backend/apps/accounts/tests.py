from decimal import Decimal
from django.test import TestCase, override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core import mail
from django.middleware.csrf import _get_new_csrf_string, _mask_cipher_secret
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.models import Address, CustomerProfile
from apps.catalog.models import ProductCategory, Product, Review
from apps.cart.models import Cart, CartItem
from apps.orders.models import Order

User = get_user_model()


class AuthenticationAndAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Regular Customer A
        self.user_a = User.objects.create_user(
            username='customer_a',
            email='customer_a@example.com',
            password='StrongPassword123!',
            first_name='Alice',
            last_name='Smith'
        )
        CustomerProfile.objects.get_or_create(user=self.user_a, phone_number='+15550001')

        # Regular Customer B
        self.user_b = User.objects.create_user(
            username='customer_b',
            email='customer_b@example.com',
            password='StrongPassword456!',
            first_name='Bob',
            last_name='Jones'
        )
        CustomerProfile.objects.get_or_create(user=self.user_b, phone_number='+15550002')

        # Administrator / Staff User
        self.admin_user = User.objects.create_superuser(
            username='admin_user',
            email='admin@example.com',
            password='AdminPassword123!'
        )

        # Catalog fixtures for review and order tests
        self.category = ProductCategory.objects.create(
            name='Electronics',
            slug='electronics',
            description='Gadgets and devices'
        )
        self.product = Product.objects.create(
            category=self.category,
            title='Wireless Noise-Cancelling Headphones',
            slug='wireless-headphones',
            sku='WH-1000',
            base_price=Decimal('199.99'),
            is_active=True
        )

    # =========================================================================
    # 1. Customer Registration & Password Security Tests
    # =========================================================================

    def test_register_success(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'newcustomer',
            'email': 'newcustomer@example.com',
            'password': 'SecurePassWord789!',
            'password_confirm': 'SecurePassWord789!',
            'first_name': 'New',
            'last_name': 'Customer'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['user']['username'], 'newcustomer')
        self.assertIn('tokens', response.data['data'])

        # Verify HttpOnly cookies are set
        cookies = response.cookies
        self.assertIn('access_token', cookies)
        self.assertIn('refresh_token', cookies)
        self.assertTrue(cookies['access_token']['httponly'])
        self.assertTrue(cookies['refresh_token']['httponly'])
        self.assertEqual(cookies['access_token']['samesite'], 'Lax')

        # Verify welcome email was dispatched fail-safely
        self.assertEqual(len(mail.outbox), 1)
        welcome_mail = mail.outbox[0]
        self.assertIn("Welcome to Our Store!", welcome_mail.subject)
        self.assertIn('newcustomer@example.com', welcome_mail.to)

    def test_passwords_never_stored_in_plaintext(self):
        user = User.objects.get(username='customer_a')
        self.assertNotEqual(user.password, 'StrongPassword123!')
        self.assertTrue(user.password.startswith('pbkdf2_') or user.password.startswith('argon2'))
        self.assertTrue(user.check_password('StrongPassword123!'))

    def test_register_duplicate_username(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'customer_a', # Already registered
            'email': 'unique_email@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    def test_register_duplicate_email_case_insensitive(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'unique_user',
            'email': 'CUSTOMER_A@EXAMPLE.COM', # Matches customer_a@example.com case-insensitively
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    def test_register_password_mismatch(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'mismatch_user',
            'email': 'mismatch@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'DifferentPassword999!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_register_weak_password_rejected(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'weak_user',
            'email': 'weak@example.com',
            'password': '123', # Too short & entirely numeric
            'password_confirm': '123',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_register_privilege_escalation_attempt_ignored(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'attacker',
            'email': 'attacker@example.com',
            'password': 'AttackPassword123!',
            'password_confirm': 'AttackPassword123!',
            'is_staff': True,
            'is_superuser': True,
            'role': 'ADMIN'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username='attacker')
        self.assertFalse(created_user.is_staff)
        self.assertFalse(created_user.is_superuser)

    # =========================================================================
    # 2. Login, Logout, and Token Management Tests
    # =========================================================================

    def test_login_success_with_username(self):
        url = reverse('accounts:login')
        payload = {
            'username': 'customer_a',
            'password': 'StrongPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['user']['username'], 'customer_a')
        self.assertIn('tokens', response.data['data'])
        self.assertIn('access_token', response.cookies)
        self.assertTrue(response.cookies['access_token']['httponly'])

    def test_login_success_with_email(self):
        url = reverse('accounts:login')
        payload = {
            'username': 'customer_a@example.com', # Log in with email
            'password': 'StrongPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['user']['username'], 'customer_a')

    def test_login_invalid_password(self):
        url = reverse('accounts:login')
        payload = {
            'username': 'customer_a',
            'password': 'WrongPassword999!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'INVALID_CREDENTIALS')

    def test_login_nonexistent_user(self):
        url = reverse('accounts:login')
        payload = {
            'username': 'ghost_user',
            'password': 'AnyPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'INVALID_CREDENTIALS')

    def test_token_refresh(self):
        refresh = RefreshToken.for_user(self.user_a)
        url = reverse('accounts:token-refresh')
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('tokens', response.data['data'])
        self.assertIn('access', response.data['data']['tokens'])

    def test_logout_blacklists_token_and_clears_cookies(self):
        refresh = RefreshToken.for_user(self.user_a)
        url = reverse('accounts:logout')
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Verify token is now blacklisted
        refresh_url = reverse('accounts:token-refresh')
        failed_refresh = self.client.post(refresh_url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(failed_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # 3. Cookie Authentication & CSRF Protection Tests
    # =========================================================================

    def test_csrf_cookie_endpoint(self):
        url = reverse('accounts:csrf-cookie')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('csrfToken', response.data['data'])
        self.assertIn('csrftoken', response.cookies)
        self.assertFalse(response.cookies['csrftoken']['httponly']) # Must be readable by client JS

    def test_cookie_auth_read_safe_method_succeeds(self):
        refresh = RefreshToken.for_user(self.user_a)
        access_token = str(refresh.access_token)
        self.client.cookies['access_token'] = access_token

        # Safe GET request should succeed with cookie auth
        url = reverse('accounts:user-profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['username'], 'customer_a')

    def test_cookie_auth_mutating_method_without_csrf_is_blocked(self):
        refresh = RefreshToken.for_user(self.user_a)
        access_token = str(refresh.access_token)
        self.client.cookies['access_token'] = access_token

        # Unsafe POST without CSRF token must fail with 403 Forbidden
        url = reverse('accounts:password-change')
        payload = {
            'old_password': 'StrongPassword123!',
            'new_password': 'NewPassword123!',
            'new_password_confirm': 'NewPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('CSRF Failed', response.data['error']['message'])

    def test_cookie_auth_mutating_method_with_valid_csrf_succeeds(self):
        refresh = RefreshToken.for_user(self.user_a)
        access_token = str(refresh.access_token)
        self.client.cookies['access_token'] = access_token

        # Generate valid Django CSRF token and attach to cookie and header
        raw_secret = _get_new_csrf_string()
        masked_token = _mask_cipher_secret(raw_secret)
        self.client.cookies['csrftoken'] = raw_secret

        url = reverse('accounts:password-change')
        payload = {
            'old_password': 'StrongPassword123!',
            'new_password': 'NewSecurePassword789!',
            'new_password_confirm': 'NewSecurePassword789!'
        }
        response = self.client.post(url, payload, format='json', HTTP_X_CSRFTOKEN=masked_token)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.check_password('NewSecurePassword789!'))

    # =========================================================================
    # 4. User Profile & Profile Update Tests
    # =========================================================================

    def test_unauthenticated_profile_access_denied(self):
        url = reverse('accounts:user-profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error']['code'], 'UNAUTHORIZED')

    def test_authenticated_profile_view(self):
        url = reverse('accounts:user-profile')
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['email'], 'customer_a@example.com')
        self.assertEqual(response.data['data']['profile']['phone_number'], '+15550001')

    def test_profile_update_allowed_fields(self):
        url = reverse('accounts:user-profile')
        self.client.force_authenticate(user=self.user_a)
        payload = {
            'first_name': 'Alicia',
            'last_name': 'Vance',
            'profile': {
                'phone_number': '+15559999',
                'is_newsletter_subscribed': True
            }
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.first_name, 'Alicia')
        self.assertEqual(self.user_a.last_name, 'Vance')
        self.assertEqual(self.user_a.customer_profile.phone_number, '+15559999')
        self.assertTrue(self.user_a.customer_profile.is_newsletter_subscribed)

    def test_profile_update_privilege_escalation_blocked(self):
        url = reverse('accounts:user-profile')
        self.client.force_authenticate(user=self.user_a)
        payload = {
            'is_staff': True,
            'is_superuser': True,
            'username': 'super_alice',
            'email': 'hacked@example.com',
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertFalse(self.user_a.is_staff)
        self.assertFalse(self.user_a.is_superuser)
        self.assertEqual(self.user_a.username, 'customer_a')
        self.assertEqual(self.user_a.email, 'customer_a@example.com')

    # =========================================================================
    # 5. Password Change & Password Reset Flow Tests
    # =========================================================================

    def test_password_change_invalid_old_password(self):
        url = reverse('accounts:password-change')
        self.client.force_authenticate(user=self.user_a)
        payload = {
            'old_password': 'IncorrectOldPassword!',
            'new_password': 'BrandNewPassword123!',
            'new_password_confirm': 'BrandNewPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_password_change_same_password_rejected(self):
        url = reverse('accounts:password-change')
        self.client.force_authenticate(user=self.user_a)
        payload = {
            'old_password': 'StrongPassword123!',
            'new_password': 'StrongPassword123!',
            'new_password_confirm': 'StrongPassword123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_password_reset_anti_enumeration(self):
        url = reverse('accounts:password-reset-request')
        # Non-existent email should return same generic success envelope
        response = self.client.post(url, {'email': 'nobody@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('If an account with that email exists', response.data['message'])
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_flow_end_to_end(self):
        # 1. Request password reset email
        url = reverse('accounts:password-reset-request')
        response = self.client.post(url, {'email': 'customer_a@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        sent_email = mail.outbox[0]
        self.assertIn('customer_a@example.com', sent_email.to)
        self.assertIn('reset-password?uid=', sent_email.body)

        # Extract uid and token from email body
        body = sent_email.body
        uid_part = body.split('uid=')[1].split('&')[0]
        token_part = body.split('token=')[1].split('\n')[0].strip()

        # 2. Confirm password reset
        confirm_url = reverse('accounts:password-reset-confirm')
        confirm_payload = {
            'uid': uid_part,
            'token': token_part,
            'new_password': 'ResetSuccessful123!',
            'new_password_confirm': 'ResetSuccessful123!'
        }
        confirm_response = self.client.post(confirm_url, confirm_payload, format='json')
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertTrue(confirm_response.data['success'])

        # 3. Verify user can log in with new password
        login_url = reverse('accounts:login')
        login_response = self.client.post(login_url, {
            'username': 'customer_a',
            'password': 'ResetSuccessful123!'
        }, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        # 4. Verify token cannot be reused a second time (single-use token)
        self.client.cookies.clear()
        reused_response = self.client.post(confirm_url, confirm_payload, format='json')
        self.assertEqual(reused_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(reused_response.data['success'])

    # =========================================================================
    # 6. Customer-to-Customer Data Isolation Tests
    # =========================================================================

    def test_address_customer_isolation(self):
        addr_a = Address.objects.create(
            user=self.user_a,
            full_name='Alice Smith',
            street_address_1='100 Apple Way',
            city='Cupertino',
            state_or_province='CA',
            postal_code='95014',
            country='US'
        )
        url = reverse('accounts:address-detail', kwargs={'id': addr_a.id})

        # Customer B tries to view Customer A's address
        self.client.force_authenticate(user=self.user_b)
        get_response = self.client.get(url)
        self.assertIn(get_response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # Customer B tries to edit Customer A's address
        patch_response = self.client.patch(url, {'city': 'HackedCity'}, format='json')
        self.assertIn(patch_response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        addr_a.refresh_from_db()
        self.assertEqual(addr_a.city, 'Cupertino')

        # Customer B tries to delete Customer A's address
        del_response = self.client.delete(url)
        self.assertIn(del_response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        self.assertTrue(Address.objects.filter(id=addr_a.id).exists())

    def test_cart_customer_isolation(self):
        # Create cart item for Customer A
        cart_a = Cart.objects.create(user=self.user_a, is_active=True)
        item_a = CartItem.objects.create(
            cart=cart_a,
            product=self.product,
            quantity=1,
            unit_price=self.product.base_price
        )

        # Customer B tries to update Customer A's cart item
        self.client.force_authenticate(user=self.user_b)
        url = reverse('cart:cart-item-detail', kwargs={'id': item_a.id})
        response = self.client.patch(url, {'quantity': 10}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        item_a.refresh_from_db()
        self.assertEqual(item_a.quantity, 1)

    def test_order_customer_isolation(self):
        order_a = Order.objects.create(
            user=self.user_a,
            subtotal=Decimal('100.00'),
            total_amount=Decimal('105.00')
        )
        url = reverse('orders:order-detail', kwargs={'order_number': order_a.order_number})

        # Customer B tries to view Customer A's order
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(url)
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_review_customer_isolation(self):
        review_a = Review.objects.create(
            product=self.product,
            user=self.user_a,
            rating=5,
            title='Great headphones',
            comment='Super comfortable',
            is_approved=True
        )
        url = reverse('catalog:review-detail', kwargs={'id': review_a.id})

        # Customer B tries to update Customer A's review
        self.client.force_authenticate(user=self.user_b)
        patch_response = self.client.patch(url, {'title': 'Defaced title'}, format='json')
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)
        review_a.refresh_from_db()
        self.assertEqual(review_a.title, 'Great headphones')

        # Customer B tries to delete Customer A's review
        del_response = self.client.delete(url)
        self.assertEqual(del_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Review.objects.filter(id=review_a.id).exists())

    # =========================================================================
    # 7. Role-Based Administrative Permissions Tests
    # =========================================================================

    def test_admin_can_manage_any_customer_address(self):
        addr_a = Address.objects.create(
            user=self.user_a,
            full_name='Alice Smith',
            street_address_1='100 Apple Way',
            city='Cupertino',
            state_or_province='CA',
            postal_code='95014',
            country='US'
        )
        url = reverse('accounts:address-detail', kwargs={'id': addr_a.id})

        self.client.force_authenticate(user=self.admin_user)
        get_response = self.client.get(url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(url, {'city': 'San Jose'}, format='json')
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        addr_a.refresh_from_db()
        self.assertEqual(addr_a.city, 'San Jose')

    def test_admin_can_view_and_update_all_orders(self):
        order_a = Order.objects.create(
            user=self.user_a,
            subtotal=Decimal('100.00'),
            total_amount=Decimal('105.00')
        )
        url = reverse('orders:order-detail', kwargs={'order_number': order_a.order_number})

        # Admin can view Customer A's order
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Admin can update status to SHIPPED
        patch_response = self.client.patch(url, {'status': 'SHIPPED'}, format='json')
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        order_a.refresh_from_db()
        self.assertEqual(order_a.status, 'SHIPPED')

    def test_regular_customer_cannot_update_order_status(self):
        order_a = Order.objects.create(
            user=self.user_a,
            subtotal=Decimal('100.00'),
            total_amount=Decimal('105.00')
        )
        url = reverse('orders:order-detail', kwargs={'order_number': order_a.order_number})

        self.client.force_authenticate(user=self.user_a)
        # Even the owner of the order cannot modify order status directly
        patch_response = self.client.patch(url, {'status': 'DELIVERED'}, format='json')
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_creation_requires_admin(self):
        url = reverse('catalog:category-list-create')
        payload = {'name': 'New Category', 'slug': 'new-category'}

        # Regular customer cannot create category
        self.client.force_authenticate(user=self.user_a)
        customer_resp = self.client.post(url, payload, format='json')
        self.assertEqual(customer_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can create category
        self.client.force_authenticate(user=self.admin_user)
        admin_resp = self.client.post(url, payload, format='json')
        self.assertEqual(admin_resp.status_code, status.HTTP_201_CREATED)

    def test_product_creation_requires_admin(self):
        url = reverse('catalog:product-list-create')
        payload = {
            'title': 'New Tablet',
            'slug': 'new-tablet',
            'sku': 'TAB-001',
            'description': 'High resolution tablet',
            'base_price': '299.99',
            'category': str(self.category.id)
        }

        # Regular customer cannot create product
        self.client.force_authenticate(user=self.user_a)
        customer_resp = self.client.post(url, payload, format='json')
        self.assertEqual(customer_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can create product
        self.client.force_authenticate(user=self.admin_user)
        admin_resp = self.client.post(url, payload, format='json')
        self.assertEqual(admin_resp.status_code, status.HTTP_201_CREATED)

    def test_admin_can_moderate_and_delete_reviews(self):
        review_a = Review.objects.create(
            product=self.product,
            user=self.user_a,
            rating=1,
            title='Spam Title',
            comment='Inappropriate content',
            is_approved=False
        )
        url = reverse('catalog:review-detail', kwargs={'id': review_a.id})

        # Admin approves review
        self.client.force_authenticate(user=self.admin_user)
        approve_resp = self.client.patch(url, {'is_approved': True}, format='json')
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)
        review_a.refresh_from_db()
        self.assertTrue(review_a.is_approved)

        # Admin deletes inappropriate review
        del_resp = self.client.delete(url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(Review.objects.filter(id=review_a.id).exists())
