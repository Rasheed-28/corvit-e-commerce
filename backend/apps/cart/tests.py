from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.catalog.models import ProductCategory, Product, ProductVariant, Inventory
from apps.cart.models import Cart, CartItem, Wishlist, WishlistItem
from apps.cart.services import MAX_PURCHASE_LIMIT

User = get_user_model()


class CartAndWishlistAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='buyer@example.com',
            email='buyer@example.com',
            password='Password123!',
            first_name='Buyer',
            last_name='One'
        )
        self.other_user = User.objects.create_user(
            username='other@example.com',
            email='other@example.com',
            password='Password123!'
        )

        self.category = ProductCategory.objects.create(name='Apparel', slug='apparel')

        # Product 1: Classic T-Shirt (in stock = 10)
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
            sku='APP-TSHIRT-L-WHT',
            price_override=Decimal('28.00')  # Override price
        )
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity=10,
            reserved_quantity=0
        )

        # Product 2: Limited Edition Hoodie (low stock = 3)
        self.product_hoodie = Product.objects.create(
            category=self.category,
            title='Artisan Fleece Hoodie',
            slug='artisan-fleece-hoodie',
            sku='APP-HOODIE-BASE',
            base_price=Decimal('80.00')
        )
        self.variant_hoodie = ProductVariant.objects.create(
            product=self.product_hoodie,
            name='Size: M | Color: Black',
            sku='APP-HOODIE-M-BLK'
        )
        self.inventory_hoodie = Inventory.objects.create(
            variant=self.variant_hoodie,
            quantity=3,
            reserved_quantity=0
        )

        # Product 3: Sold Out Shoes (out of stock = 0)
        self.product_shoes = Product.objects.create(
            category=self.category,
            title='Minimalist Runner Shoes',
            slug='minimalist-runner-shoes',
            sku='APP-SHOES-BASE',
            base_price=Decimal('120.00')
        )
        self.variant_shoes = ProductVariant.objects.create(
            product=self.product_shoes,
            name='Size: 42 | Color: Grey',
            sku='APP-SHOES-42-GRY'
        )
        self.inventory_shoes = Inventory.objects.create(
            variant=self.variant_shoes,
            quantity=0,
            reserved_quantity=0
        )

    # ==========================================
    # 1. Cart API Tests & Server-Side Price Verification
    # ==========================================

    def test_get_cart_initial_empty(self):
        url = reverse('cart:cart-detail')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['total_items'], 0)
        self.assertEqual(Decimal(str(response.data['data']['subtotal'])), Decimal('0.00'))

    def test_add_to_cart_success_with_variant(self):
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'variant_id': str(self.variant.id),
            'quantity': 2,
            # Malicious client sends fake unit price and fake subtotal; backend must ignore it!
            'unit_price': '1.00',
            'subtotal': '2.00',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        data = response.data['data']
        self.assertEqual(data['total_items'], 2)
        # 2 * variant effective price (28.00) = 56.00
        self.assertEqual(Decimal(str(data['subtotal'])), Decimal('56.00'))

        item = data['items'][0]
        self.assertEqual(item['quantity'], 2)
        self.assertEqual(Decimal(str(item['unit_price'])), Decimal('28.00'))
        self.assertEqual(Decimal(str(item['subtotal'])), Decimal('56.00'))
        self.assertEqual(item['available_stock'], 10)
        self.assertEqual(item['max_purchase_limit'], 10)
        self.assertTrue(item['is_in_stock'])

    def test_add_to_cart_repeated_clicks_increments_quantity(self):
        """Simulate repeated clicks: first adding 1, then adding 2 more."""
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'variant_id': str(self.variant.id),
            'quantity': 1
        }
        r1 = self.client.post(url, payload, format='json')
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data['data']['total_items'], 1)

        payload['quantity'] = 2
        r2 = self.client.post(url, payload, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data['data']['total_items'], 3)
        self.assertEqual(Decimal(str(r2.data['data']['subtotal'])), Decimal('84.00'))

    # ==========================================
    # 2. Validation: Invalid Quantities, Stock & Limits
    # ==========================================

    def test_add_to_cart_invalid_zero_or_negative_quantity(self):
        url = reverse('cart:cart-add-item')
        # Zero
        r_zero = self.client.post(url, {'product_id': str(self.product.id), 'quantity': 0}, format='json')
        self.assertEqual(r_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative
        r_neg = self.client.post(url, {'product_id': str(self.product.id), 'quantity': -3}, format='json')
        self.assertEqual(r_neg.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_to_cart_exceeding_purchase_limit(self):
        """Max purchase limit is 10. Attempting to add 11 should fail."""
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product.id),
            'variant_id': str(self.variant.id),
            'quantity': 11
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_to_cart_cumulative_purchase_limit(self):
        """If cart already has 8, adding 3 more (total 11) should fail."""
        url = reverse('cart:cart-add-item')
        self.client.post(url, {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 8}, format='json')

        r_exceed = self.client.post(url, {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 3}, format='json')
        self.assertEqual(r_exceed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_to_cart_insufficient_stock(self):
        """Hoodie only has 3 in stock. Adding 5 should be rejected."""
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product_hoodie.id),
            'variant_id': str(self.variant_hoodie.id),
            'quantity': 5
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_to_cart_out_of_stock(self):
        """Shoes have 0 stock. Adding 1 should be rejected."""
        url = reverse('cart:cart-add-item')
        payload = {
            'product_id': str(self.product_shoes.id),
            'variant_id': str(self.variant_shoes.id),
            'quantity': 1
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ==========================================
    # 3. Item Quantity Updates and Removal
    # ==========================================

    def test_update_cart_item_quantity_success(self):
        add_url = reverse('cart:cart-add-item')
        add_res = self.client.post(add_url, {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 1}, format='json')
        item_id = add_res.data['data']['items'][0]['id']

        patch_url = reverse('cart:cart-item-detail', kwargs={'id': item_id})
        patch_res = self.client.patch(patch_url, {'quantity': 4}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['data']['total_items'], 4)
        self.assertEqual(Decimal(str(patch_res.data['data']['subtotal'])), Decimal('112.00'))

    def test_update_cart_item_exceeds_stock(self):
        add_url = reverse('cart:cart-add-item')
        add_res = self.client.post(add_url, {'product_id': str(self.product_hoodie.id), 'variant_id': str(self.variant_hoodie.id), 'quantity': 1}, format='json')
        item_id = add_res.data['data']['items'][0]['id']

        patch_url = reverse('cart:cart-item-detail', kwargs={'id': item_id})
        # Stock is 3, requesting 5
        patch_res = self.client.patch(patch_url, {'quantity': 5}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remove_cart_item_success(self):
        add_url = reverse('cart:cart-add-item')
        add_res = self.client.post(add_url, {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 2}, format='json')
        item_id = add_res.data['data']['items'][0]['id']

        del_url = reverse('cart:cart-item-detail', kwargs={'id': item_id})
        del_res = self.client.delete(del_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertEqual(del_res.data['data']['total_items'], 0)
        self.assertEqual(len(del_res.data['data']['items']), 0)

    def test_clear_cart_success(self):
        add_url = reverse('cart:cart-add-item')
        self.client.post(add_url, {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 2}, format='json')
        self.client.post(add_url, {'product_id': str(self.product_hoodie.id), 'variant_id': str(self.variant_hoodie.id), 'quantity': 1}, format='json')

        clear_url = reverse('cart:cart-clear')
        clear_res = self.client.delete(clear_url)
        self.assertEqual(clear_res.status_code, status.HTTP_200_OK)
        self.assertEqual(clear_res.data['data']['total_items'], 0)
        self.assertEqual(Decimal(str(clear_res.data['data']['subtotal'])), Decimal('0.00'))

    # ==========================================
    # 4. Anonymous Cart Persistence & Login Merging
    # ==========================================

    def test_anonymous_cart_persistence_via_header(self):
        custom_session = 'guest_session_xyz_789'
        add_url = reverse('cart:cart-add-item')
        res = self.client.post(
            add_url,
            {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 2},
            HTTP_X_CART_SESSION=custom_session,
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Retrieve cart with same header
        get_url = reverse('cart:cart-detail')
        get_res = self.client.get(get_url, HTTP_X_CART_SESSION=custom_session)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data['data']['total_items'], 2)

    def test_cart_merge_upon_login(self):
        guest_session = 'guest_merge_session_123'

        # 1. Guest adds 2x T-Shirt
        add_url = reverse('cart:cart-add-item')
        self.client.post(
            add_url,
            {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 2},
            HTTP_X_CART_SESSION=guest_session,
            format='json'
        )

        # 2. Existing user already had 1x Hoodie in their cart
        user_cart = Cart.objects.create(user=self.user, is_active=True)
        CartItem.objects.create(
            cart=user_cart,
            product=self.product_hoodie,
            variant=self.variant_hoodie,
            quantity=1,
            unit_price=Decimal('80.00')
        )

        # 3. User logs in with guest session header
        login_url = reverse('accounts:login')
        login_res = self.client.post(
            login_url,
            {'username': 'buyer@example.com', 'password': 'Password123!'},
            HTTP_X_CART_SESSION=guest_session,
            format='json'
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # 4. Check user's cart now has both items (total items = 3, subtotal = 56.00 + 80.00 = 136.00)
        self.client.force_authenticate(user=self.user)
        cart_url = reverse('cart:cart-detail')
        merged_res = self.client.get(cart_url)
        self.assertEqual(merged_res.status_code, status.HTTP_200_OK)
        self.assertEqual(merged_res.data['data']['total_items'], 3)
        self.assertEqual(Decimal(str(merged_res.data['data']['subtotal'])), Decimal('136.00'))

        # 5. Verify guest cart is deactivated
        guest_cart = Cart.objects.filter(session_key=guest_session).first()
        self.assertFalse(guest_cart.is_active)

    def test_explicit_cart_merge_endpoint(self):
        guest_session = 'guest_explicit_merge_456'
        add_url = reverse('cart:cart-add-item')
        self.client.post(
            add_url,
            {'product_id': str(self.product.id), 'variant_id': str(self.variant.id), 'quantity': 3},
            HTTP_X_CART_SESSION=guest_session,
            format='json'
        )

        self.client.force_authenticate(user=self.other_user)
        merge_url = reverse('cart:cart-merge')
        merge_res = self.client.post(merge_url, {'session_key': guest_session}, format='json')
        self.assertEqual(merge_res.status_code, status.HTTP_200_OK)
        self.assertEqual(merge_res.data['data']['total_items'], 3)

    # ==========================================
    # 5. Wishlist API Tests
    # ==========================================

    def test_unauthenticated_wishlist_access_denied(self):
        url = reverse('cart:wishlist-list-create')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wishlist_add_and_list_success(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('cart:wishlist-list-create')

        # Add T-shirt
        res = self.client.post(url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['success'])

        # List wishlist
        list_res = self.client.get(url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data['data']), 1)
        self.assertEqual(list_res.data['data'][0]['product']['id'], str(self.product.id))
        self.assertTrue(list_res.data['data'][0]['is_available'])
        self.assertEqual(list_res.data['data'][0]['stock_status'], 'in_stock')

    def test_wishlist_duplicate_prevention(self):
        """Repeatedly adding the same product does NOT create duplicates."""
        self.client.force_authenticate(user=self.user)
        url = reverse('cart:wishlist-list-create')

        # First add: 201 Created
        r1 = self.client.post(url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

        # Repeated click: 200 OK
        r2 = self.client.post(url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn('already in wishlist', r2.data['message'].lower())

        # Check total count remains 1
        wishlist = Wishlist.objects.get(user=self.user)
        self.assertEqual(wishlist.items.count(), 1)

    def test_wishlist_delete_item(self):
        self.client.force_authenticate(user=self.user)
        add_url = reverse('cart:wishlist-list-create')
        self.client.post(add_url, {'product_id': str(self.product.id)}, format='json')

        del_url = reverse('cart:wishlist-delete-item', kwargs={'product_id': str(self.product.id)})
        del_res = self.client.delete(del_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

        # Verify empty
        list_res = self.client.get(add_url)
        self.assertEqual(len(list_res.data['data']), 0)

    def test_wishlist_handles_unavailable_or_inactive_product(self):
        self.client.force_authenticate(user=self.user)
        add_url = reverse('cart:wishlist-list-create')
        self.client.post(add_url, {'product_id': str(self.product.id)}, format='json')

        # Deactivate product in catalog
        self.product.is_active = False
        self.product.save()

        # Wishlist should still render with is_available = False and stock_status = 'discontinued'
        list_res = self.client.get(add_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data['data']), 1)
        item_data = list_res.data['data'][0]
        self.assertFalse(item_data['is_available'])
        self.assertEqual(item_data['stock_status'], 'discontinued')

        # Customer can still remove the inactive product
        del_url = reverse('cart:wishlist-delete-item', kwargs={'product_id': str(self.product.id)})
        del_res = self.client.delete(del_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
