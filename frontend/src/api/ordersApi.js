import axiosClient from './axiosClient.js';
import { API_ROUTES } from '../utils/constants.js';

/**
 * Normalizes backend order schema to frontend representation
 */
export function normalizeOrder(o) {
  if (!o) return null;
  const subtotal = typeof o.subtotal !== 'undefined' ? parseFloat(o.subtotal) : 0;
  const shipping = typeof o.shipping_fee !== 'undefined' ? parseFloat(o.shipping_fee) : 0;
  const tax = typeof o.tax_amount !== 'undefined' ? parseFloat(o.tax_amount) : 0;
  const discount = typeof o.discount_amount !== 'undefined' ? parseFloat(o.discount_amount) : 0;
  const total =
    typeof o.total_amount !== 'undefined'
      ? parseFloat(o.total_amount)
      : o.total ?? subtotal + shipping + tax - discount;

  const items = Array.isArray(o.items)
    ? o.items.map((item) => ({
        id: item.id,
        title: item.product_title || item.title || 'Product Item',
        variant: item.variant_name || item.variant || null,
        price: parseFloat(item.unit_price || item.price || 0),
        quantity: item.quantity,
        image:
          item.image ||
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
      }))
    : [];

  const statusStr = String(o.status || 'processing').toLowerCase();

  const timeline = o.timeline || [
    {
      title: 'Order Confirmed',
      date: o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Confirmed',
      completed: true,
    },
    {
      title: 'Processing',
      date: ['processing', 'shipped', 'delivered'].includes(statusStr) ? 'In Progress' : 'Pending',
      completed: ['processing', 'shipped', 'delivered'].includes(statusStr),
    },
    {
      title: 'Out for Delivery',
      date: ['shipped', 'delivered'].includes(statusStr) ? 'Shipped' : 'Pending',
      completed: ['shipped', 'delivered'].includes(statusStr),
    },
    {
      title: 'Delivered',
      date: statusStr === 'delivered' ? 'Completed' : 'Pending',
      completed: statusStr === 'delivered',
    },
  ];

  return {
    ...o,
    id: o.id,
    orderNumber: o.order_number || o.orderNumber,
    status: o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1) : 'Processing',
    date: o.created_at ? new Date(o.created_at).toLocaleDateString() : o.date || 'Recent',
    total,
    itemsCount: o.items_count ?? items.length,
    items,
    financials: {
      subtotal: o.financials?.subtotal ?? subtotal,
      shipping: o.financials?.shipping ?? shipping,
      tax: o.financials?.tax ?? tax,
      discount: o.financials?.discount ?? discount,
      total: o.financials?.total ?? total,
    },
    shippingAddress: o.shipping_address_snapshot || o.shippingAddress || {
      name: 'Valued Customer',
      street: '100 Market St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
    },
    paymentMethod: o.payments?.[0]?.payment_method || o.paymentMethod || 'Credit Card (**** 4242)',
    timeline,
  };
}

/**
 * Orders API Service Module
 * Connects directly to Django REST Framework `/api/v1/orders/` endpoints.
 */
export const ordersApi = {
  /**
   * Retrieves current customer's order history
   */
  async getOrders() {
    const res = await axiosClient.get(API_ROUTES.ORDERS.ROOT);
    if (res?.data && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map(normalizeOrder),
      };
    }
    return res;
  },

  /**
   * Retrieves single order by unique order number
   */
  async getOrder(orderNumber) {
    const res = await axiosClient.get(`${API_ROUTES.ORDERS.ROOT}${orderNumber}/`);
    if (res?.data) {
      return {
        ...res,
        data: normalizeOrder(res.data),
      };
    }
    return res;
  },

  /**
   * Places an order from the active user cart
   */
  async createOrder(checkoutData) {
    return axiosClient.post(API_ROUTES.ORDERS.ROOT, checkoutData);
  },

  /**
   * Validates promotional coupon code with current subtotal
   */
  async validateCoupon(code, cartSubtotal = 0) {
    return axiosClient.post(API_ROUTES.ORDERS.COUPONS_VALIDATE, {
      code,
      cart_subtotal: cartSubtotal,
    });
  },
};

export default ordersApi;
