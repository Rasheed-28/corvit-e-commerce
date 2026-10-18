import test, { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const { axiosClient } = await import('../src/api/axiosClient.js');
const { authApi } = await import('../src/api/authApi.js');
const { catalogApi } = await import('../src/api/catalogApi.js');
const { cartApi } = await import('../src/api/cartApi.js');

describe('Shopping Cart & Wishlist End-to-End API Integration Tests', () => {
  let headphonesProduct = null;
  let headphonesVariant1 = null;
  let headphonesVariant2 = null;
  let outOfStockProduct = null;
  let guestSession = null;

  before(async () => {
    // Prime CSRF token
    const csrfRes = await authApi.getCsrfToken();
    assert.equal(csrfRes.success, true);

    // Retrieve active catalog products
    const prodRes = await catalogApi.getProduct('aura-studio-wireless-headphones');
    assert.equal(prodRes.success, true);
    headphonesProduct = prodRes.data;
    assert.ok(headphonesProduct.variants?.length >= 2);
    headphonesVariant1 = headphonesProduct.variants[0];
    headphonesVariant2 = headphonesProduct.variants[1];

    const outOfStockRes = await catalogApi.getProduct('walnut-artisan-desk-shelf-riser');
    if (outOfStockRes?.success) {
      outOfStockProduct = outOfStockRes.data;
    }

    guestSession = `test_guest_session_${Date.now()}`;
  });

  describe('1. Shopping Cart Core Operations & Anonymous Persistence', () => {
    it('retrieves initial empty cart for a fresh guest session', async () => {
      const res = await cartApi.getCart(guestSession);
      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 0);
      assert.equal(res.data.subtotal, 0);
      assert.deepEqual(res.data.items, []);
    });

    it('adds product with specific variant to cart and calculates server totals', async () => {
      const res = await cartApi.addToCart({
        productId: headphonesProduct.id,
        variantId: headphonesVariant1.id,
        quantity: 2,
        sessionKey: guestSession,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 2);
      assert.ok(res.data.subtotal > 0);
      assert.equal(res.data.items.length, 1);

      const item = res.data.items[0];
      assert.equal(item.productId, headphonesProduct.id);
      assert.equal(item.variantId, headphonesVariant1.id);
      assert.equal(item.quantity, 2);
      assert.equal(typeof item.price, 'number');
      assert.equal(item.subtotal, item.price * 2);
      assert.ok(item.availableStock > 0);
    });

    it('adds a second distinct variant of the same product as separate line item', async () => {
      const res = await cartApi.addToCart({
        productId: headphonesProduct.id,
        variantId: headphonesVariant2.id,
        quantity: 1,
        sessionKey: guestSession,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 3);
      assert.equal(res.data.items.length, 2);
    });

    it('persists guest cart state across separate requests with sessionKey', async () => {
      const res = await cartApi.getCart(guestSession);
      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 3);
      assert.equal(res.data.items.length, 2);
    });

    it('increments item quantity when adding existing variant (repeated additions)', async () => {
      const res = await cartApi.addToCart({
        productId: headphonesProduct.id,
        variantId: headphonesVariant2.id,
        quantity: 1,
        sessionKey: guestSession,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 4);

      const targetItem = res.data.items.find((it) => it.variantId === headphonesVariant2.id);
      assert.ok(targetItem);
      assert.equal(targetItem.quantity, 2);
    });

    it('updates item quantity and recalculates server subtotal', async () => {
      const initialCart = await cartApi.getCart(guestSession);
      const itemToUpdate = initialCart.data.items[0];

      const res = await cartApi.updateCartItem(itemToUpdate.id, 3, guestSession);
      assert.equal(res.success, true);

      const updatedItem = res.data.items.find((it) => it.id === itemToUpdate.id);
      assert.equal(updatedItem.quantity, 3);
      assert.equal(updatedItem.subtotal, updatedItem.price * 3);
    });

    it('removes a line item and updates cart subtotal and count', async () => {
      const currentCart = await cartApi.getCart(guestSession);
      const itemToRemove = currentCart.data.items[0];
      const remainingCount = currentCart.data.totalItems - itemToRemove.quantity;

      const res = await cartApi.removeCartItem(itemToRemove.id, guestSession);
      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, remainingCount);
      assert.ok(!res.data.items.some((it) => it.id === itemToRemove.id));
    });

    it('clears all items from cart', async () => {
      const res = await cartApi.clearCart(guestSession);
      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 0);
      assert.equal(res.data.subtotal, 0);
      assert.deepEqual(res.data.items, []);
    });
  });

  describe('2. Stock Validations, Purchase Limits & Error Envelopes', () => {
    it('rejects adding invalid non-positive quantities (0 or negative)', async () => {
      await assert.rejects(
        async () => {
          await cartApi.addToCart({
            productId: headphonesProduct.id,
            variantId: headphonesVariant1.id,
            quantity: 0,
            sessionKey: guestSession,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await cartApi.addToCart({
            productId: headphonesProduct.id,
            variantId: headphonesVariant1.id,
            quantity: -2,
            sessionKey: guestSession,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });

    it('rejects adding quantity that exceeds maximum purchase limit (limit = 10)', async () => {
      await assert.rejects(
        async () => {
          await cartApi.addToCart({
            productId: headphonesProduct.id,
            variantId: headphonesVariant1.id,
            quantity: 11,
            sessionKey: guestSession,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /limit|10/i);
          return true;
        }
      );
    });

    it('rejects adding out of stock products', async () => {
      if (!outOfStockProduct) return;

      await assert.rejects(
        async () => {
          await cartApi.addToCart({
            productId: outOfStockProduct.id,
            quantity: 1,
            sessionKey: guestSession,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /stock|out of stock/i);
          return true;
        }
      );
    });

    it('rejects invalid product IDs', async () => {
      await assert.rejects(
        async () => {
          await cartApi.addToCart({
            productId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
            sessionKey: guestSession,
          });
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('3. Login, Cart Merging & Authenticated Persistence', () => {
    const testBuyerEmail = `cart_merge_buyer_${Date.now()}@example.com`;
    const buyerPassword = 'Password123!';
    const preLoginSession = `pre_login_session_${Date.now()}`;

    before(async () => {
      // 1. Add 2 units of headphones to guest cart
      await cartApi.addToCart({
        productId: headphonesProduct.id,
        variantId: headphonesVariant1.id,
        quantity: 2,
        sessionKey: preLoginSession,
      });

      // 2. Register fresh buyer account
      await authApi.register({
        username: testBuyerEmail,
        email: testBuyerEmail,
        firstName: 'Merge',
        lastName: 'Test',
        password: buyerPassword,
        confirmPassword: buyerPassword,
      });

      // 3. Login with X-Cart-Session header so automatic cart merge occurs
      await axiosClient.post(
        '/auth/login/',
        { username: testBuyerEmail, password: buyerPassword },
        { headers: { 'X-Cart-Session': preLoginSession } }
      );
    });

    it('merges guest cart into authenticated customer account upon login', async () => {
      const res = await cartApi.getCart();
      assert.equal(res.success, true);
      assert.ok(res.data.totalItems >= 2);
      assert.ok(res.data.items.some((it) => it.productId === headphonesProduct.id));
    });

    it('supports explicit POST /cart/merge/ endpoint', async () => {
      const secondarySession = `secondary_guest_${Date.now()}`;
      await cartApi.addToCart({
        productId: headphonesProduct.id,
        variantId: headphonesVariant2.id,
        quantity: 1,
        sessionKey: secondarySession,
      });

      const mergeRes = await cartApi.mergeCart(secondarySession);
      assert.equal(mergeRes.success, true);
      assert.ok(mergeRes.data.items.some((it) => it.variantId === headphonesVariant2.id));
    });

    it('persists cart after logout for new guest sessions without leakage', async () => {
      // Log out
      await authApi.logout();

      // Fresh guest session gets fresh empty cart
      const freshGuestKey = `fresh_guest_${Date.now()}`;
      const res = await cartApi.getCart(freshGuestKey);
      assert.equal(res.success, true);
      assert.equal(res.data.totalItems, 0);
    });
  });

  describe('4. Wishlist API Integration & Duplicate Prevention', () => {
    const wishlistBuyerEmail = `wishlist_buyer_${Date.now()}@example.com`;
    const wishlistBuyerPassword = 'Password123!';

    before(async () => {
      // Register and login buyer for wishlist tests
      await authApi.register({
        username: wishlistBuyerEmail,
        email: wishlistBuyerEmail,
        firstName: 'Wishlist',
        lastName: 'Tester',
        password: wishlistBuyerPassword,
        confirmPassword: wishlistBuyerPassword,
      });
      await authApi.login({
        username: wishlistBuyerEmail,
        password: wishlistBuyerPassword,
      });
    });

    it('retrieves initial empty wishlist for authenticated customer', async () => {
      const res = await cartApi.getWishlist();
      assert.equal(res.success, true);
      assert.deepEqual(res.data, []);
    });

    it('adds product to wishlist successfully', async () => {
      const res = await cartApi.addToWishlist(headphonesProduct.id);
      assert.equal(res.success, true);
      assert.equal(res.data.product.id, headphonesProduct.id);
      assert.equal(res.data.is_available, true);
    });

    it('prevents duplicate wishlist entries when clicked repeatedly', async () => {
      // Second click on already saved product
      const res = await cartApi.addToWishlist(headphonesProduct.id);
      assert.equal(res.success, true);
      assert.match(res.message.toLowerCase(), /already in wishlist/i);

      // Verify list has only 1 item
      const listRes = await cartApi.getWishlist();
      assert.equal(listRes.data.length, 1);
    });

    it('removes product from customer wishlist', async () => {
      const delRes = await cartApi.removeFromWishlist(headphonesProduct.id);
      assert.equal(delRes.success, true);

      // Verify wishlist is now empty
      const listRes = await cartApi.getWishlist();
      assert.equal(listRes.data.length, 0);
    });

    it('rejects adding invalid product ID to wishlist', async () => {
      await assert.rejects(
        async () => {
          await cartApi.addToWishlist('00000000-0000-0000-0000-000000000000');
        },
        (err) => {
          assert.equal(err.status, 400);
          return true;
        }
      );
    });
  });
});
