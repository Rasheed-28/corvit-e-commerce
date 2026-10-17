from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models import Address

User = get_user_model()

class AccountsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='johndoe',
            email='john@example.com',
            password='Password123!',
            first_name='John',
            last_name='Doe'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='Password123!'
        )

    # 1. Success Responses
    def test_register_success(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'newcustomer',
            'email': 'newcustomer@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
            'first_name': 'Jane',
            'last_name': 'Doe'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertIn('tokens', response.data['data'])
        self.assertEqual(response.data['data']['user']['username'], 'newcustomer')

    def test_login_success(self):
        url = reverse('accounts:login')
        payload = {
            'username': 'johndoe',
            'password': 'Password123!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('tokens', response.data['data'])

    def test_authenticated_profile_view(self):
        url = reverse('accounts:user-profile')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['email'], 'john@example.com')

    # 2. Invalid Input
    def test_register_password_mismatch(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'baduser',
            'email': 'baduser@example.com',
            'password': 'Password123!',
            'password_confirm': 'DifferentPassword!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    def test_register_duplicate_email(self):
        url = reverse('accounts:register')
        payload = {
            'username': 'johnduplicate',
            'email': 'john@example.com', # Already registered in setUp
            'password': 'Password123!',
            'password_confirm': 'Password123!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

    # 3. Unauthenticated Requests
    def test_unauthenticated_profile_access(self):
        url = reverse('accounts:user-profile')
        response = self.client.get(url) # No authentication provided
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'UNAUTHORIZED')

    def test_unauthenticated_address_list_access(self):
        url = reverse('accounts:address-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])

    # 4. Unauthorized Access
    def test_unauthorized_address_deletion(self):
        # Address belongs to user 'johndoe'
        address = Address.objects.create(
            user=self.user,
            full_name='John Doe',
            street_address_1='123 Main St',
            city='Seattle',
            state_or_province='WA',
            postal_code='98101',
            country='US'
        )
        url = reverse('accounts:address-detail', kwargs={'id': address.id})

        # 'other_user' tries to delete 'johndoe' address
        self.client.force_authenticate(user=self.other_user)
        response = self.client.delete(url)
        # Should be 404 (not found in queryset) or 403 (forbidden by object permission)
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
