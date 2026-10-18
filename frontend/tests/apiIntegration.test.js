import test, { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

// Set environment variable before importing API modules
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// Dynamic import after setting environment
const { axiosClient } = await import('../src/api/axiosClient.js');
const { catalogApi } = await import('../src/api/catalogApi.js');
const { authApi } = await import('../src/api/authApi.js');
const { ordersApi } = await import('../src/api/ordersApi.js');

describe('Django REST Framework & React Frontend Integration Tests', () => {
  before(async () => {
    // Prime CSRF token cookie from live backend
    const csrfRes = await authApi.getCsrfToken();
    assert.equal(csrfRes.success, true);
    assert.ok(csrfRes.data?.csrfToken);
  });

  describe('1. Health & Infrastructure Endpoints', () => {
    it('verifies backend health check endpoint is responsive and database is connected', async () => {
      const res = await axiosClient.get('/common/health/');
      assert.equal(res.success, true);
      assert.equal(res.data.status, 'healthy');
      assert.equal(res.data.database, 'connected');
    });

    it('retrieves CSRF token and sets in-memory headers for mutating methods', async () => {
      const res = await authApi.getCsrfToken();
      assert.equal(res.success, true);
      assert.equal(typeof res.data.csrfToken, 'string');
      assert.ok(res.data.csrfToken.length > 20);
    });
  });

  describe('2. Catalog API Integration (Categories, Products, Search, Sorting, Pagination)', () => {
    it('retrieves category tree with normalized attributes', async () => {
      const res = await catalogApi.getCategories();
      assert.equal(res.success, true);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.length >= 4);

      const audioCat = res.data.find((c) => c.slug === 'audio');
      assert.ok(audioCat, 'Audio category exists in live DB');
      assert.equal(audioCat.name, 'Audio & Acoustics');
      assert.ok(audioCat.id);
    });

    it('retrieves paginated products with metadata', async () => {
      const res = await catalogApi.getProducts({ page: 1, page_size: 4 });
      assert.equal(res.success, true);
      assert.ok(Array.isArray(res.data));
      assert.equal(res.data.length, 4);

      assert.ok(res.meta?.pagination);
      assert.equal(res.meta.pagination.page, 1);
      assert.equal(res.meta.pagination.page_size, 4);
      assert.ok(res.meta.pagination.total_count >= 8);
      assert.ok(res.meta.pagination.total_pages >= 2);
    });

    it('filters products by category slug', async () => {
      const res = await catalogApi.getProducts({ category: 'audio' });
      assert.equal(res.success, true);
      assert.ok(res.data.length > 0);
      for (const prod of res.data) {
        assert.equal(prod.categorySlug, 'audio');
      }
    });

    it('filters products by search keyword across title, description, or SKU', async () => {
      const res = await catalogApi.getProducts({ search: 'headphones' });
      assert.equal(res.success, true);
      assert.ok(res.data.length >= 1);
      assert.match(res.data[0].title.toLowerCase(), /headphone/);
    });

    it('sorts products by price ascending', async () => {
      const res = await catalogApi.getProducts({ sort: 'price-low' });
      assert.equal(res.success, true);
      assert.ok(res.data.length >= 2);

      for (let i = 0; i < res.data.length - 1; i++) {
        assert.ok(
          res.data[i].price <= res.data[i + 1].price,
          `Expected ${res.data[i].price} <= ${res.data[i + 1].price}`
        );
      }
    });

    it('retrieves full product details including variants, inventory stock, and reviews', async () => {
      const res = await catalogApi.getProduct('aura-studio-wireless-headphones');
      assert.equal(res.success, true);
      const product = res.data;

      assert.equal(product.slug, 'aura-studio-wireless-headphones');
      assert.equal(product.sku, 'AUR-WL-01');
      assert.equal(product.price, 249.0);
      assert.ok(product.stock > 0);
      assert.ok(Array.isArray(product.images));
      assert.ok(product.images.length > 0);
      assert.ok(Array.isArray(product.variants));
      assert.ok(product.variants.length >= 3);
      assert.ok(Array.isArray(product.reviews));
      assert.ok(product.reviews.length >= 2);
      assert.ok(product.rating >= 4);
    });
  });

  describe('3. Customer Authentication & Profile API Integration', () => {
    it('rejects invalid login credentials with standard error envelope', async () => {
      await assert.rejects(
        async () => {
          await authApi.login({
            username: 'alex.reynolds@example.com',
            password: 'IncorrectPassword999!',
          });
        },
        (err) => {
          assert.equal(err.status, 401);
          assert.ok(err.message);
          return true;
        }
      );
    });

    it('authenticates customer with valid credentials and sets session', async () => {
      const loginRes = await authApi.login({
        username: 'alex.reynolds@example.com',
        password: 'NovaStore2026!',
      });

      assert.equal(loginRes.success, true);
      assert.equal(loginRes.data.user.email, 'alex.reynolds@example.com');
      assert.equal(loginRes.data.user.first_name, 'Alex');
      assert.equal(loginRes.data.user.last_name, 'Reynolds');
      assert.ok(loginRes.data.tokens?.access);

      // Verify getCurrentUser with established session
      const meRes = await authApi.getCurrentUser();
      assert.equal(meRes.success, true);
      assert.equal(meRes.data.email, 'alex.reynolds@example.com');
      assert.equal(meRes.data.first_name, 'Alex');
    });

    it('retrieves and manages customer saved address book', async () => {
      const addressesRes = await authApi.getAddresses();
      assert.equal(addressesRes.success, true);
      assert.ok(Array.isArray(addressesRes.data));
      assert.ok(addressesRes.data.length >= 1);

      const defaultAddr = addressesRes.data[0];
      assert.equal(defaultAddr.recipientName, 'Alex Reynolds');
      assert.equal(defaultAddr.city, 'San Francisco');
      assert.equal(defaultAddr.state, 'CA');
    });

    it('updates customer profile data through PATCH /auth/me/', async () => {
      const updateRes = await authApi.updateProfile({
        firstName: 'Alexander',
        lastName: 'Reynolds',
        phone: '+1 (555) 999-8888',
      });

      assert.equal(updateRes.success, true);
      assert.equal(updateRes.data.first_name, 'Alexander');

      // Revert back to Alex
      await authApi.updateProfile({
        firstName: 'Alex',
        lastName: 'Reynolds',
        phone: '+1 (555) 234-5678',
      });
    });

    it('registers a new customer account, validates session, and performs logout', async () => {
      const uniqueSuffix = Date.now();
      const freshUser = {
        username: `buyer_${uniqueSuffix}@example.com`,
        email: `buyer_${uniqueSuffix}@example.com`,
        firstName: 'Test',
        lastName: 'Customer',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const registerRes = await authApi.register(freshUser);
      assert.equal(registerRes.success, true);
      assert.equal(registerRes.data.user.email, freshUser.email);

      // Verify authenticated session for newly registered user
      const meRes = await authApi.getCurrentUser();
      assert.equal(meRes.success, true);
      assert.equal(meRes.data.email, freshUser.email);

      // Logout
      const logoutRes = await authApi.logout();
      assert.equal(logoutRes.success, true);

      // Verify session is cleared
      await assert.rejects(
        async () => {
          await authApi.getCurrentUser();
        },
        (err) => {
          assert.equal(err.status, 401);
          return true;
        }
      );
    });
  });

  describe('4. Orders & Checkout API Integration', () => {
    it('authenticates customer and retrieves user order list', async () => {
      // Re-authenticate customer
      await authApi.login({
        username: 'alex.reynolds@example.com',
        password: 'NovaStore2026!',
      });

      const ordersRes = await ordersApi.getOrders();
      assert.equal(ordersRes.success, true);
      assert.ok(Array.isArray(ordersRes.data));
    });

    it('handles coupon code validation response appropriately', async () => {
      // If code doesn't exist, returns validation error envelope
      await assert.rejects(
        async () => {
          await ordersApi.validateCoupon('NON_EXISTENT_CODE', 100);
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });
  });
});
