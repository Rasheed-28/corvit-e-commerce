import test, { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

// Set base URL for integration testing against local backend
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const { adminApi } = await import('../src/api/adminApi.js');
const { authApi } = await import('../src/api/authApi.js');
const { axiosClient } = await import('../src/api/axiosClient.js');

describe('Administrator Dashboard API & Client Contract Tests', () => {
  before(async () => {
    // Prime CSRF token cookie
    try {
      await authApi.getCsrfToken();
    } catch {
      // Offline fallback
    }
  });

  describe('1. Admin Permission Boundaries & Security', () => {
    it('blocks unauthenticated requests to overview metrics with 401 Unauthorized', async () => {
      try {
        await adminApi.getOverview({ period: '30d' });
        assert.fail('Expected unauthenticated request to fail with 401');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED', 'HTTP 401 Unauthorized enforced');
      }
    });

    it('blocks unauthenticated requests to sales telemetry report with 401 Unauthorized', async () => {
      try {
        await adminApi.getSalesReport({ period: '30d' });
        assert.fail('Expected unauthenticated sales report request to fail');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });

    it('blocks unauthenticated access to administrative inventory levels', async () => {
      try {
        await adminApi.getInventory();
        assert.fail('Expected inventory endpoint to require authentication');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });

    it('blocks unauthenticated order lifecycle inspection', async () => {
      try {
        await adminApi.getOrders();
        assert.fail('Expected admin orders endpoint to require authentication');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });

    it('blocks unauthenticated customer directory listing', async () => {
      try {
        await adminApi.getCustomers();
        assert.fail('Expected admin customers endpoint to require authentication');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });

    it('blocks unauthenticated coupon CRUD access', async () => {
      try {
        await adminApi.getCoupons();
        assert.fail('Expected coupons endpoint to require authentication');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });

    it('blocks unauthenticated review moderation queue', async () => {
      try {
        await adminApi.getReviews();
        assert.fail('Expected reviews endpoint to require authentication');
      } catch (err) {
        assert.ok(err.status === 401 || err.code === 'UNAUTHORIZED');
      }
    });
  });

  describe('2. Client API Interface & Method Contracts', () => {
    it('adminApi exposes all mandatory administrative modules', () => {
      // Overview & Sales Reports
      assert.equal(typeof adminApi.getOverview, 'function');
      assert.equal(typeof adminApi.getSalesReport, 'function');

      // Products & Categories
      assert.equal(typeof adminApi.getProducts, 'function');
      assert.equal(typeof adminApi.getProduct, 'function');
      assert.equal(typeof adminApi.createProduct, 'function');
      assert.equal(typeof adminApi.updateProduct, 'function');
      assert.equal(typeof adminApi.deleteProduct, 'function');
      assert.equal(typeof adminApi.getCategories, 'function');
      assert.equal(typeof adminApi.createCategory, 'function');
      assert.equal(typeof adminApi.updateCategory, 'function');
      assert.equal(typeof adminApi.deleteCategory, 'function');

      // Product Media
      assert.equal(typeof adminApi.getProductImages, 'function');
      assert.equal(typeof adminApi.uploadProductImage, 'function');
      assert.equal(typeof adminApi.updateProductImage, 'function');
      assert.equal(typeof adminApi.deleteProductImage, 'function');

      // Inventory
      assert.equal(typeof adminApi.getInventory, 'function');
      assert.equal(typeof adminApi.updateInventory, 'function');

      // Orders
      assert.equal(typeof adminApi.getOrders, 'function');
      assert.equal(typeof adminApi.getOrder, 'function');
      assert.equal(typeof adminApi.updateOrderStatus, 'function');

      // Customers
      assert.equal(typeof adminApi.getCustomers, 'function');
      assert.equal(typeof adminApi.getCustomer, 'function');
      assert.equal(typeof adminApi.toggleCustomerStatus, 'function');

      // Coupons
      assert.equal(typeof adminApi.getCoupons, 'function');
      assert.equal(typeof adminApi.getCoupon, 'function');
      assert.equal(typeof adminApi.createCoupon, 'function');
      assert.equal(typeof adminApi.updateCoupon, 'function');
      assert.equal(typeof adminApi.deleteCoupon, 'function');

      // Reviews
      assert.equal(typeof adminApi.getReviews, 'function');
      assert.equal(typeof adminApi.moderateReview, 'function');
      assert.equal(typeof adminApi.deleteReview, 'function');
    });
  });
});
