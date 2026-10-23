import test, { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

// Set base URL for integration testing against local backend
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const { authApi } = await import('../src/api/authApi.js');
const { catalogApi } = await import('../src/api/catalogApi.js');
const { cartApi } = await import('../src/api/cartApi.js');
const { ordersApi } = await import('../src/api/ordersApi.js');
const { adminApi } = await import('../src/api/adminApi.js');

describe('Full End-to-End Customer & Administrator Lifecycle Journey', () => {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const customerEmail = `e2e_buyer_${uniqueId}@example.com`;
  const customerPassword = 'SecurePassword123!';
  const customerFirstName = 'Jane';
  const customerLastName = 'Doe';

  let customerUser = null;
  let searchedProduct = null;
  let selectedVariant = null;
  let orderNumber = null;
  let cartItemId = null;

  before(async () => {
    // Prime CSRF token
    const csrfRes = await authApi.getCsrfToken();
    assert.equal(csrfRes.success, true, 'CSRF cookie primed');
  });

  it('Step 1: Register a new customer and verify active session', async () => {
    const registerRes = await authApi.register({
      username: customerEmail,
      email: customerEmail,
      password: customerPassword,
      password_confirm: customerPassword,
      first_name: customerFirstName,
      last_name: customerLastName,
    });

    assert.equal(registerRes.success, true, 'Customer registration successful');
    assert.ok(registerRes.data.user, 'Customer user returned');
    assert.equal(registerRes.data.user.email, customerEmail);
    assert.equal(registerRes.data.user.first_name, customerFirstName);
    assert.equal(registerRes.data.user.last_name, customerLastName);
    customerUser = registerRes.data.user;

    // Verify authenticated session via getCurrentUser()
    const meRes = await authApi.getCurrentUser();
    assert.equal(meRes.success, true);
    assert.equal(meRes.data.email, customerEmail);
  });

  it('Step 2: Browse categories and search catalog products', async () => {
    // 2a. Browse categories
    const catListRes = await catalogApi.getCategories();
    assert.equal(catListRes.success, true, 'Categories fetched');
    assert.ok(Array.isArray(catListRes.data) && catListRes.data.length > 0, 'Catalog has categories');

    // 2b. Search products by keyword
    const searchRes = await catalogApi.getProducts({ search: 'headphones' });
    assert.equal(searchRes.success, true, 'Search succeeded');
    assert.ok(Array.isArray(searchRes.data) && searchRes.data.length > 0, 'Found matching products');

    const matched = searchRes.data[0];
    assert.ok(matched.slug, 'Product has slug');

    // 2c. Retrieve full product details with variants
    const productDetailRes = await catalogApi.getProduct(matched.slug);
    assert.equal(productDetailRes.success, true, 'Retrieved product detail');
    searchedProduct = productDetailRes.data;

    assert.ok(searchedProduct.variants && searchedProduct.variants.length > 0, 'Product has active variants');
    selectedVariant =
      searchedProduct.variants.find((v) => (v.stock || v.available_stock || 0) >= 5) ||
      searchedProduct.variants[0];
  });

  it('Step 3: Add product to shopping cart with selected variant', async () => {
    const addRes = await cartApi.addToCart({
      productId: searchedProduct.id,
      variantId: selectedVariant.id,
      quantity: 1,
    });

    assert.equal(addRes.success, true, 'Product added to cart');
    assert.ok(Array.isArray(addRes.data.items), 'Cart has items array');
    assert.equal(addRes.data.totalItems, 1, 'Total items count is 1');

    const addedItem = addRes.data.items.find(
      (item) => item.productId === searchedProduct.id || item.variantId === selectedVariant.id
    );
    assert.ok(addedItem, 'Found newly added item in cart');
    cartItemId = addedItem.id;
  });

  it('Step 4: Update cart item quantity and verify recalculations', async () => {
    assert.ok(cartItemId, 'Cart item id must exist');

    const updateRes = await cartApi.updateCartItem(cartItemId, 2);
    assert.equal(updateRes.success, true, 'Updated cart quantity to 2');
    assert.equal(updateRes.data.totalItems, 2, 'Total items in cart updated to 2');

    const updatedItem = updateRes.data.items.find((item) => item.id === cartItemId);
    assert.equal(updatedItem.quantity, 2, 'Line item quantity is 2');

    const expectedItemSubtotal = (parseFloat(updatedItem.unit_price) * 2).toFixed(2);
    assert.equal(parseFloat(updatedItem.subtotal).toFixed(2), expectedItemSubtotal);
  });

  it('Step 5: Validate and apply eligible promotional coupon', async () => {
    // 5a. Validate coupon directly
    const validateRes = await ordersApi.validateCoupon('SAVE10', 100.00);
    assert.equal(validateRes.success, true, 'Coupon SAVE10 is valid');
    assert.equal(validateRes.data.code, 'SAVE10');
    assert.equal(validateRes.data.discount_type, 'PERCENTAGE');
    assert.equal(parseFloat(validateRes.data.discount_value), 10);

    // 5b. Preview checkout with coupon applied
    const previewRes = await ordersApi.previewOrder({ coupon_code: 'SAVE10' });
    assert.equal(previewRes.success, true, 'Order preview with coupon successful');
    assert.equal(previewRes.data.coupon_code, 'SAVE10', 'Preview reflects applied coupon');
    assert.ok(parseFloat(previewRes.data.discount_amount) > 0, 'Discount amount applied');
  });

  it('Step 6: Complete checkout and verify payment processing', async () => {
    const idempotencyKey = `e2e_flow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const checkoutPayload = {
      idempotency_key: idempotencyKey,
      coupon_code: 'SAVE10',
      payment_method: 'CREDIT_CARD',
      customer_notes: 'Automated E2E full journey test order',
      shipping_address: {
        full_name: `${customerFirstName} ${customerLastName}`,
        phone_number: '+1 (555) 019-2834',
        street_address_1: '123 Innovation Blvd',
        city: 'San Jose',
        state_or_province: 'CA',
        postal_code: '95112',
        country: 'United States',
        save_to_address_book: true,
      },
    };

    // 6a. Create order
    const orderRes = await ordersApi.createOrder(checkoutPayload);
    assert.equal(orderRes.success, true, 'Order created successfully');
    assert.ok(orderRes.data.order_number, 'Received order number');
    orderNumber = orderRes.data.order_number;
    assert.equal(orderRes.data.status, 'PENDING', 'Initial order status is PENDING');

    // 6b. Process test payment
    const payRes = await ordersApi.processPayment(orderNumber, {
      payment_method: 'CREDIT_CARD',
      card_number: '4242424242424242',
    });
    assert.equal(payRes.success, true, 'Payment processing succeeded');
    assert.equal(payRes.data.status, 'COMPLETED', 'Payment status is COMPLETED');

    // 6c. Verify order transitioned to PAID
    const paidOrder = await ordersApi.getOrder(orderNumber);
    assert.equal(paidOrder.success, true);
    assert.equal(paidOrder.data.status, 'Paid', 'Order transitioned to Paid status');
  });

  it('Step 7: Inspect customer order details and audit snapshots', async () => {
    assert.ok(orderNumber, 'Order number must be defined');

    const detailRes = await ordersApi.getOrder(orderNumber);
    assert.equal(detailRes.success, true, 'Customer can inspect order');
    assert.equal(detailRes.data.orderNumber, orderNumber);
    assert.ok(detailRes.data.financials.subtotal > 0, 'Subtotal snapshot recorded');
    assert.ok(detailRes.data.financials.discount > 0, 'Coupon discount recorded');
    assert.ok(detailRes.data.financials.total > 0, 'Total recorded');
    assert.equal(detailRes.data.shippingAddress.full_name, `${customerFirstName} ${customerLastName}`);
    assert.equal(detailRes.data.shippingAddress.city, 'San Jose');
    assert.ok(Array.isArray(detailRes.data.items) && detailRes.data.items.length >= 1, 'Items snapshot preserved');
  });

  it('Step 8: Authenticate as administrator and transition order status to PROCESSING', async () => {
    assert.ok(orderNumber, 'Order number must be defined');

    // 8a. Log out customer session
    await authApi.logout();

    // 8b. Authenticate as Administrator
    const adminLoginRes = await authApi.login({
      username: 'admin',
      password: 'AdminPass2026!',
    });
    assert.equal(adminLoginRes.success, true, 'Administrator logged in successfully');
    assert.equal(adminLoginRes.data.user.is_staff, true, 'User is verified staff/admin');

    // 8c. Inspect order as administrator
    const adminOrderRes = await adminApi.getOrder(orderNumber);
    assert.equal(adminOrderRes.success, true, 'Admin successfully inspected order');
    assert.equal(adminOrderRes.data.order_number, orderNumber);
    assert.equal(adminOrderRes.data.status, 'PAID');

    // 8d. Update order status as administrator to PROCESSING
    const updateStatusRes = await adminApi.updateOrderStatus(orderNumber, {
      status: 'PROCESSING',
      reason: 'Admin approved and dispatched to fulfillment center',
    });
    assert.equal(updateStatusRes.success, true, 'Admin status update succeeded');
    assert.equal(updateStatusRes.data.status, 'PROCESSING', 'Order status moved to PROCESSING');

    // 8e. Verify updated status persists upon re-fetching
    const verifiedOrder = await adminApi.getOrder(orderNumber);
    assert.equal(verifiedOrder.success, true);
    assert.equal(verifiedOrder.data.status, 'PROCESSING', 'Persisted order status is PROCESSING');
  });
});
