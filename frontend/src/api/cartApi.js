import axiosClient from './axiosClient.js';
import { API_ROUTES } from '../utils/constants.js';

/**
 * Normalizes backend CartItem schema into standard UI item representation.
 */
export function normalizeCartItem(item) {
  if (!item) return null;

  const unitPrice = parseFloat(item.unit_price ?? item.price ?? 0);
  const subtotal = parseFloat(item.subtotal ?? unitPrice * (item.quantity || 1));
  const availableStock = typeof item.available_stock === 'number' ? item.available_stock : 10;
  const maxStock = typeof item.max_purchase_limit === 'number' ? item.max_purchase_limit : Math.min(availableStock, 10);

  return {
    id: item.id,
    productId: item.product_id || item.product,
    product: item.product,
    title: item.product_title || item.title || 'Product',
    product_title: item.product_title || item.title || 'Product',
    slug: item.product_slug || item.slug || '',
    product_slug: item.product_slug || item.slug || '',
    image: item.product_image || item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    product_image: item.product_image || item.image || '',
    variantId: item.variant_id || item.variant || null,
    variant: item.variant || item.variant_id || null,
    selectedVariant: item.variant_name || item.variant_color || null,
    variant_name: item.variant_name || '',
    variant_sku: item.variant_sku || '',
    variant_color: item.variant_color || '',
    quantity: item.quantity,
    price: unitPrice,
    unitPrice: unitPrice,
    unit_price: unitPrice,
    subtotal: subtotal,
    availableStock: availableStock,
    available_stock: availableStock,
    maxStock: maxStock,
    max_purchase_limit: maxStock,
    isInStock: item.is_in_stock !== false && availableStock > 0,
    is_in_stock: item.is_in_stock !== false && availableStock > 0,
    isAvailable: item.is_available !== false,
    is_available: item.is_available !== false,
    created_at: item.created_at,
  };
}

/**
 * Normalizes backend Cart schema.
 */
export function normalizeCart(cartData) {
  if (!cartData) {
    return {
      id: null,
      sessionKey: null,
      items: [],
      totalItems: 0,
      subtotal: 0,
    };
  }

  const rawItems = Array.isArray(cartData.items) ? cartData.items : [];
  const normalizedItems = rawItems.map(normalizeCartItem).filter(Boolean);
  const totalItems = typeof cartData.total_items === 'number'
    ? cartData.total_items
    : normalizedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const subtotal = typeof cartData.subtotal !== 'undefined'
    ? parseFloat(cartData.subtotal)
    : normalizedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);

  return {
    id: cartData.id || null,
    sessionKey: cartData.session_key || null,
    items: normalizedItems,
    totalItems: totalItems,
    subtotal: subtotal,
    updatedAt: cartData.updated_at,
  };
}

/**
 * Builds request config with optional X-Cart-Session header for guest persistence.
 */
function buildConfig(sessionKey, customHeaders = {}) {
  const headers = { ...customHeaders };
  if (sessionKey) {
    headers['X-Cart-Session'] = sessionKey;
  }
  return { headers };
}

export const cartApi = {
  /**
   * Retrieves active shopping cart.
   */
  async getCart(sessionKey = null) {
    const res = await axiosClient.get(API_ROUTES.CART.ROOT, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Adds an item to active cart.
   */
  async addToCart({ productId, variantId = null, quantity = 1, sessionKey = null }) {
    const payload = {
      product_id: productId,
      variant_id: variantId || null,
      quantity: quantity,
    };
    const res = await axiosClient.post(API_ROUTES.CART.ITEMS, payload, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Updates line item quantity in cart.
   */
  async updateCartItem(itemId, quantity, sessionKey = null) {
    const payload = { quantity };
    const res = await axiosClient.patch(`${API_ROUTES.CART.ITEMS}${itemId}/`, payload, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Removes line item from active cart.
   */
  async removeCartItem(itemId, sessionKey = null) {
    const res = await axiosClient.delete(`${API_ROUTES.CART.ITEMS}${itemId}/`, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Empties all items from active cart.
   */
  async clearCart(sessionKey = null) {
    const res = await axiosClient.delete(API_ROUTES.CART.CLEAR, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Merges an anonymous guest cart into authenticated customer account.
   */
  async mergeCart(sessionKey) {
    const payload = { session_key: sessionKey };
    const res = await axiosClient.post('/cart/merge/', payload, buildConfig(sessionKey));
    return {
      ...res,
      data: normalizeCart(res.data),
    };
  },

  /**
   * Lists customer wishlist items.
   */
  async getWishlist() {
    const res = await axiosClient.get(API_ROUTES.CART.WISHLIST);
    return res;
  },

  /**
   * Adds product to wishlist.
   */
  async addToWishlist(productId) {
    const payload = { product_id: productId };
    return axiosClient.post(API_ROUTES.CART.WISHLIST, payload);
  },

  /**
   * Removes product from wishlist.
   */
  async removeFromWishlist(productId) {
    return axiosClient.delete(`${API_ROUTES.CART.WISHLIST}${productId}/`);
  },

  /**
   * Clears entire wishlist.
   */
  async clearWishlist() {
    return axiosClient.delete(`${API_ROUTES.CART.WISHLIST}clear/`);
  },
};

export default cartApi;
