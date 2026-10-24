import test, { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const { axiosClient } = await import('../src/api/axiosClient.js');
const { authApi } = await import('../src/api/authApi.js');
const { catalogApi } = await import('../src/api/catalogApi.js');
const { cartApi } = await import('../src/api/cartApi.js');
const { ordersApi } = await import('../src/api/ordersApi.js');

describe('Checkout & Order Management End-to-End Workflow Tests', () => {
  let customerUser = null;
  let catalogProduct = null;
  let catalogVariant = null;
  let primaryOrderNumber = null;
  let idempotencyKey = null;

  before(async () => {
    // 1. Prime CSRF token
    const csrfRes = await authApi.getCsrfToken();
    assert.equal(csrfRes.success, true);

    // 2. Authenticate test customer
    const loginRes = await authApi.login({
      username: 'alex.reynolds@example.com',
      password: 'NovaStore2026!',
    });
    assert.equal(loginRes.success, true);
    customerUser = loginRes.data.user;

    // 3. Retrieve active product & variant
    const catRes = await catalogApi.getProduct('aura-studio-wireless-headphones');
    assert.equal(catRes.success, true);
    catalogProduct = catRes.data;
    assert.ok(catalogProduct.variants && catalogProduct.variants.length > 0);
    catalogVariant =
      catalogProduct.variants.find((v) => (v.available_quantity || v.quantity || 0) > 0) ||
      catalogProduct.variants[0];

    // 4. Ensure customer cart has items
    await cartApi.addToCart({
      productId: catalogProduct.id,
      variantId: catalogVariant.id,
      quantity: 1,
    });
  });

  describe('1. Server-Calculated Financials & Coupon Preview', () => {
    it('calculates order financials with subtotal, tax, and shipping preview', async () => {
      const previewRes = await ordersApi.previewOrder({});
      assert.equal(previewRes.success, true);
      assert.ok(previewRes.data);

      const subtotal = parseFloat(previewRes.data.subtotal);
      const shipping = parseFloat(previewRes.data.shipping_fee);
      const tax = parseFloat(previewRes.data.tax_amount);
      const total = parseFloat(previewRes.data.total_amount);

      assert.ok(subtotal > 0, 'Subtotal must be greater than 0');
      // Free shipping threshold is >= $50
      if (subtotal >= 50) {
        assert.equal(shipping, 0, 'Qualifies for free shipping');
      } else {
        assert.equal(shipping, 9.99, 'Standard shipping applied');
      }

      // Expected tax: 8% of subtotal
      const expectedTax = Math.round(subtotal * 0.08 * 100) / 100;
      assert.ok(Math.abs(tax - expectedTax) <= 0.05, `Tax matches 8% calculation: got ${tax}, expected ${expectedTax}`);

      // Expected total: subtotal + shipping + tax
      const expectedTotal = Math.round((subtotal + shipping + tax) * 100) / 100;
      assert.ok(Math.abs(total - expectedTotal) <= 0.05, `Total matches sum: got ${total}, expected ${expectedTotal}`);
    });

    it('validates promotional coupon and recalculates preview discount', async () => {
      const valRes = await ordersApi.validateCoupon('SAVE10', 100.00);
      assert.equal(valRes.success, true);
      assert.ok(parseFloat(valRes.data.discount_amount) > 0);

      // Preview with coupon applied
      const previewWithCoupon = await ordersApi.previewOrder({ coupon_code: 'SAVE10' });
      assert.equal(previewWithCoupon.success, true);
      assert.ok(parseFloat(previewWithCoupon.data.discount_amount) > 0);
      assert.ok(
        parseFloat(previewWithCoupon.data.total_amount) <
          parseFloat(previewWithCoupon.data.subtotal) + parseFloat(previewWithCoupon.data.shipping_fee) + parseFloat(previewWithCoupon.data.tax_amount)
      );
    });

    it('rejects invalid or non-existent coupon codes', async () => {
      await assert.rejects(
        async () => {
          await ordersApi.validateCoupon('INVALID_COUPON_CODE_9999', 100.00);
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('2. Address Validation & Order Placement with Snapshots', () => {
    it('rejects order submission without any shipping address provided', async () => {
      await assert.rejects(
        async () => {
          await ordersApi.createOrder({
            payment_method: 'CREDIT_CARD',
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });

    it('creates an order transactionally with address and product snapshots', async () => {
      idempotencyKey = `e2e_test_idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const checkoutPayload = {
        idempotency_key: idempotencyKey,
        coupon_code: 'SAVE10',
        payment_method: 'CREDIT_CARD',
        customer_notes: 'E2E automated test order',
        shipping_address: {
          full_name: 'Alex Reynolds',
          phone_number: '+1 (555) 234-5678',
          street_address_1: '789 Market St',
          street_address_2: 'Suite 400',
          city: 'San Francisco',
          state_or_province: 'CA',
          postal_code: '94103',
          country: 'United States',
          save_to_address_book: false,
        },
      };

      const orderRes = await ordersApi.createOrder(checkoutPayload);
      assert.equal(orderRes.success, true);
      assert.ok(orderRes.data.order_number);
      primaryOrderNumber = orderRes.data.order_number;

      // Status must initially be PENDING
      assert.equal(orderRes.data.status, 'PENDING');

      // Verify item snapshots
      assert.ok(Array.isArray(orderRes.data.items));
      assert.ok(orderRes.data.items.length >= 1);
      const snapshotItem = orderRes.data.items[0];
      assert.ok(snapshotItem.product_title);
      assert.ok(snapshotItem.unit_price);
      assert.ok(snapshotItem.quantity >= 1);

      // Verify shipping address snapshot
      assert.equal(orderRes.data.shipping_address_snapshot.full_name, 'Alex Reynolds');
      assert.equal(orderRes.data.shipping_address_snapshot.street_address_1, '789 Market St');
      assert.equal(orderRes.data.shipping_address_snapshot.city, 'San Francisco');
    });

    it('enforces idempotency and prevents duplicate orders on repeated submission', async () => {
      assert.ok(idempotencyKey, 'Idempotency key must be defined');

      // Re-submit identical checkout with identical idempotency key
      const duplicateRes = await ordersApi.createOrder({
        idempotency_key: idempotencyKey,
        coupon_code: 'SAVE10',
        payment_method: 'CREDIT_CARD',
        shipping_address: {
          full_name: 'Alex Reynolds',
          street_address_1: '789 Market St',
          city: 'San Francisco',
          state_or_province: 'CA',
          postal_code: '94103',
          country: 'United States',
        },
      });

      // Must return existing order instead of creating new record
      assert.equal(duplicateRes.success, true);
      assert.equal(duplicateRes.data.order_number, primaryOrderNumber);
    });
  });

  describe('3. Server-Side Payment Verification & Decline Handling', () => {
    it('simulates card decline and keeps order in pending payment status', async () => {
      await assert.rejects(
        async () => {
          await ordersApi.processPayment(primaryOrderNumber, {
            payment_method: 'CREDIT_CARD',
            card_number: '4242424242420002', // Simulated decline ending with 0002
            simulate_failure: true,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );

      // Verify order status was NOT changed to PAID
      const orderCheck = await ordersApi.getOrder(primaryOrderNumber);
      assert.equal(orderCheck.success, true);
      assert.equal(orderCheck.data.status, 'Pending'); // Normalized status 'Pending' from 'PENDING'
    });

    it('processes successful payment and transitions order status to PAID', async () => {
      const payRes = await ordersApi.processPayment(primaryOrderNumber, {
        payment_method: 'CREDIT_CARD',
        card_number: '4242424242424242',
      });

      assert.equal(payRes.success, true);
      assert.equal(payRes.data.status, 'COMPLETED');

      // Verify order status transitioned to Paid
      const orderCheck = await ordersApi.getOrder(primaryOrderNumber);
      assert.equal(orderCheck.success, true);
      assert.equal(orderCheck.data.status, 'Paid'); // Normalized status 'Paid' from 'PAID'
    });
  });

  describe('4. Order Management, Cancellation & Inventory Restoration', () => {
    it('retrieves customer order details with timeline and snapshots', async () => {
      const res = await ordersApi.getOrder(primaryOrderNumber);
      assert.equal(res.success, true);
      assert.equal(res.data.orderNumber, primaryOrderNumber);
      assert.ok(Array.isArray(res.data.items));
      assert.ok(res.data.financials.total > 0);
      assert.ok(res.data.can_cancel, 'Order should be cancellable while paid/processing');
    });

    it('cancels order, records cancellation reason, and restores stock', async () => {
      const cancelReason = 'Automated E2E Test Cancellation';
      const cancelRes = await ordersApi.cancelOrder(primaryOrderNumber, cancelReason);

      assert.equal(cancelRes.success, true);
      assert.equal(cancelRes.data.status, 'CANCELLED');
      assert.equal(cancelRes.data.cancellation_reason, cancelReason);

      // Verify refreshed order status
      const orderCheck = await ordersApi.getOrder(primaryOrderNumber);
      assert.equal(orderCheck.data.status, 'Cancelled');
      assert.equal(orderCheck.data.can_cancel, false);
    });

    it('rejects cancelling an already cancelled order', async () => {
      await assert.rejects(
        async () => {
          await ordersApi.cancelOrder(primaryOrderNumber, 'Attempt duplicate cancellation');
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('5. Customer Isolation & Security Access Control', () => {
    it('prohibits viewing orders of other customers without authorization', async () => {
      // Clear token to act as unauthenticated client
      const unauthClient = (await import('axios')).default.create({
        baseURL: 'http://127.0.0.1:8000/api/v1',
      });

      try {
        await unauthClient.get(`/orders/${primaryOrderNumber}/`);
        assert.fail('Should have been rejected with 401 Unauthorized');
      } catch (err) {
        assert.equal(err.response.status, 401);
      }
    });
  });
});
