import { axiosClient } from './axiosClient.js';

/**
 * Administrative API Client for Dashboard, Catalog, Orders, Inventory,
 * Customers, Discounts, Reviews, and Analytics.
 */
export const adminApi = {
  // --- 1. Dashboard Overview & Analytics ---
  getOverview: async (params = {}) => {
    return axiosClient.get('/admin/overview/', { params });
  },

  getSalesReport: async (params = {}) => {
    return axiosClient.get('/admin/reports/sales/', { params });
  },

  // --- 2. Products Management ---
  getProducts: async (params = {}) => {
    return axiosClient.get('/admin/products/', { params });
  },

  getProduct: async (id) => {
    return axiosClient.get(`/admin/products/${id}/`);
  },

  createProduct: async (productData) => {
    const isFormData = productData instanceof FormData;
    return axiosClient.post('/admin/products/', productData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
  },

  updateProduct: async (id, productData) => {
    const isFormData = productData instanceof FormData;
    return axiosClient.patch(`/admin/products/${id}/`, productData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
  },

  deleteProduct: async (id) => {
    return axiosClient.delete(`/admin/products/${id}/`);
  },

  // --- 3. Categories Management ---
  getCategories: async (params = {}) => {
    return axiosClient.get('/admin/categories/', { params });
  },

  createCategory: async (categoryData) => {
    const isFormData = categoryData instanceof FormData;
    return axiosClient.post('/admin/categories/', categoryData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
  },

  updateCategory: async (id, categoryData) => {
    const isFormData = categoryData instanceof FormData;
    return axiosClient.patch(`/admin/categories/${id}/`, categoryData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
  },

  deleteCategory: async (id) => {
    return axiosClient.delete(`/admin/categories/${id}/`);
  },

  // --- 4. Product Media Management ---
  getProductImages: async (productId) => {
    return axiosClient.get(`/admin/products/${productId}/images/`);
  },

  uploadProductImage: async (productId, formData) => {
    return axiosClient.post(`/admin/products/${productId}/images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  updateProductImage: async (productId, imageId, data) => {
    return axiosClient.patch(`/admin/products/${productId}/images/${imageId}/`, data);
  },

  deleteProductImage: async (productId, imageId) => {
    return axiosClient.delete(`/admin/products/${productId}/images/${imageId}/`);
  },

  // --- 5. Inventory Management ---
  getInventory: async (params = {}) => {
    return axiosClient.get('/admin/inventory/', { params });
  },

  updateInventory: async (id, data) => {
    return axiosClient.patch(`/admin/inventory/${id}/`, data);
  },

  // --- 6. Orders Management ---
  getOrders: async (params = {}) => {
    return axiosClient.get('/admin/orders/', { params });
  },

  getOrder: async (orderNumber) => {
    return axiosClient.get(`/admin/orders/${orderNumber}/`);
  },

  updateOrderStatus: async (orderNumber, data) => {
    return axiosClient.patch(`/admin/orders/${orderNumber}/status/`, data);
  },

  // --- 7. Customers Management ---
  getCustomers: async (params = {}) => {
    return axiosClient.get('/admin/customers/', { params });
  },

  getCustomer: async (id) => {
    return axiosClient.get(`/admin/customers/${id}/`);
  },

  toggleCustomerStatus: async (id) => {
    return axiosClient.patch(`/admin/customers/${id}/status/`);
  },

  // --- 8. Coupons Management ---
  getCoupons: async (params = {}) => {
    return axiosClient.get('/admin/coupons/', { params });
  },

  getCoupon: async (id) => {
    return axiosClient.get(`/admin/coupons/${id}/`);
  },

  createCoupon: async (data) => {
    return axiosClient.post('/admin/coupons/', data);
  },

  updateCoupon: async (id, data) => {
    return axiosClient.patch(`/admin/coupons/${id}/`, data);
  },

  deleteCoupon: async (id) => {
    return axiosClient.delete(`/admin/coupons/${id}/`);
  },

  // --- 9. Reviews Moderation ---
  getReviews: async (params = {}) => {
    return axiosClient.get('/admin/reviews/', { params });
  },

  moderateReview: async (id, data = {}) => {
    return axiosClient.patch(`/admin/reviews/${id}/moderate/`, data);
  },

  deleteReview: async (id) => {
    return axiosClient.delete(`/admin/reviews/${id}/`);
  },
};

export default adminApi;
