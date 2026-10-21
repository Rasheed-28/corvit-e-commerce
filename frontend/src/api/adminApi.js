import { axiosClient } from './axiosClient.js';

/**
 * Administrative API Client for Dashboard, Catalog, Orders, Inventory,
 * Customers, Discounts, Reviews, and Analytics.
 */
export const adminApi = {
  // --- 1. Dashboard Overview & Analytics ---
  getOverview: async (params = {}) => {
    const response = await axiosClient.get('/admin/overview/', { params });
    return response.data;
  },

  getSalesReport: async (params = {}) => {
    const response = await axiosClient.get('/admin/reports/sales/', { params });
    return response.data;
  },

  // --- 2. Products Management ---
  getProducts: async (params = {}) => {
    const response = await axiosClient.get('/admin/products/', { params });
    return response.data;
  },

  getProduct: async (id) => {
    const response = await axiosClient.get(`/admin/products/${id}/`);
    return response.data;
  },

  createProduct: async (productData) => {
    const isFormData = productData instanceof FormData;
    const response = await axiosClient.post('/admin/products/', productData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  updateProduct: async (id, productData) => {
    const isFormData = productData instanceof FormData;
    const response = await axiosClient.patch(`/admin/products/${id}/`, productData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  deleteProduct: async (id) => {
    const response = await axiosClient.delete(`/admin/products/${id}/`);
    return response.data;
  },

  // --- 3. Categories Management ---
  getCategories: async (params = {}) => {
    const response = await axiosClient.get('/admin/categories/', { params });
    return response.data;
  },

  createCategory: async (categoryData) => {
    const isFormData = categoryData instanceof FormData;
    const response = await axiosClient.post('/admin/categories/', categoryData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  updateCategory: async (id, categoryData) => {
    const isFormData = categoryData instanceof FormData;
    const response = await axiosClient.patch(`/admin/categories/${id}/`, categoryData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await axiosClient.delete(`/admin/categories/${id}/`);
    return response.data;
  },

  // --- 4. Product Media Management ---
  getProductImages: async (productId) => {
    const response = await axiosClient.get(`/admin/products/${productId}/images/`);
    return response.data;
  },

  uploadProductImage: async (productId, formData) => {
    const response = await axiosClient.post(`/admin/products/${productId}/images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateProductImage: async (productId, imageId, data) => {
    const response = await axiosClient.patch(`/admin/products/${productId}/images/${imageId}/`, data);
    return response.data;
  },

  deleteProductImage: async (productId, imageId) => {
    const response = await axiosClient.delete(`/admin/products/${productId}/images/${imageId}/`);
    return response.data;
  },

  // --- 5. Inventory Management ---
  getInventory: async (params = {}) => {
    const response = await axiosClient.get('/admin/inventory/', { params });
    return response.data;
  },

  updateInventory: async (id, data) => {
    const response = await axiosClient.patch(`/admin/inventory/${id}/`, data);
    return response.data;
  },

  // --- 6. Orders Management ---
  getOrders: async (params = {}) => {
    const response = await axiosClient.get('/admin/orders/', { params });
    return response.data;
  },

  getOrder: async (orderNumber) => {
    const response = await axiosClient.get(`/admin/orders/${orderNumber}/`);
    return response.data;
  },

  updateOrderStatus: async (orderNumber, data) => {
    const response = await axiosClient.patch(`/admin/orders/${orderNumber}/status/`, data);
    return response.data;
  },

  // --- 7. Customers Management ---
  getCustomers: async (params = {}) => {
    const response = await axiosClient.get('/admin/customers/', { params });
    return response.data;
  },

  getCustomer: async (id) => {
    const response = await axiosClient.get(`/admin/customers/${id}/`);
    return response.data;
  },

  toggleCustomerStatus: async (id) => {
    const response = await axiosClient.patch(`/admin/customers/${id}/status/`);
    return response.data;
  },

  // --- 8. Coupons Management ---
  getCoupons: async (params = {}) => {
    const response = await axiosClient.get('/admin/coupons/', { params });
    return response.data;
  },

  getCoupon: async (id) => {
    const response = await axiosClient.get(`/admin/coupons/${id}/`);
    return response.data;
  },

  createCoupon: async (data) => {
    const response = await axiosClient.post('/admin/coupons/', data);
    return response.data;
  },

  updateCoupon: async (id, data) => {
    const response = await axiosClient.patch(`/admin/coupons/${id}/`, data);
    return response.data;
  },

  deleteCoupon: async (id) => {
    const response = await axiosClient.delete(`/admin/coupons/${id}/`);
    return response.data;
  },

  // --- 9. Reviews Moderation ---
  getReviews: async (params = {}) => {
    const response = await axiosClient.get('/admin/reviews/', { params });
    return response.data;
  },

  moderateReview: async (id, data = {}) => {
    const response = await axiosClient.patch(`/admin/reviews/${id}/moderate/`, data);
    return response.data;
  },

  deleteReview: async (id) => {
    const response = await axiosClient.delete(`/admin/reviews/${id}/`);
    return response.data;
  },
};

export default adminApi;
