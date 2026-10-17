import axiosClient from './axiosClient';

/**
 * Catalog API Service Module
 * Handles category retrieval, product search, multi-faceted filtering,
 * pagination, product details with variants & reviews, and administrative catalogue management.
 */
export const catalogApi = {
  // =========================================================================
  // Public Catalog Endpoints
  // =========================================================================

  /**
   * Retrieves category tree or flat list
   * @param {Object} [params] - Query options (e.g. { flat: true })
   */
  async getCategories(params = {}) {
    return axiosClient.get('/categories/', { params });
  },

  /**
   * Retrieves details of a specific category by slug or UUID
   * @param {string} slugOrId - Category slug or UUID
   */
  async getCategory(slugOrId) {
    return axiosClient.get(`/categories/${slugOrId}/`);
  },

  /**
   * Retrieves paginated products with filtering, search, and sorting
   * @param {Object} [params] - Search, filter, sort and pagination parameters:
   *   search: string (product name, description, SKU)
   *   category: string (category slug or UUID)
   *   min_price: number (e.g. 50.00)
   *   max_price: number (e.g. 500.00)
   *   in_stock: boolean ('true' / 'false')
   *   is_featured: boolean ('true' / 'false')
   *   color: string (e.g. 'Space Gray')
   *   size: string (e.g. '15-inch')
   *   sort: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'title_asc' | 'title_desc'
   *   page: number
   *   page_size: number
   */
  async getProducts(params = {}) {
    return axiosClient.get('/products/', { params });
  },

  /**
   * Retrieves product details with variants, images, rating summary, and reviews
   * @param {string} slugOrId - Product slug or canonical UUID
   */
  async getProduct(slugOrId) {
    return axiosClient.get(`/products/${slugOrId}/`);
  },

  /**
   * Retrieves active variants for a product
   * @param {string} slugOrId - Product slug or UUID
   */
  async getProductVariants(slugOrId) {
    return axiosClient.get(`/products/${slugOrId}/variants/`);
  },

  /**
   * Retrieves approved reviews for a product with pagination
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} [params] - Pagination options
   */
  async getProductReviews(slugOrId, params = {}) {
    return axiosClient.get(`/products/${slugOrId}/reviews/`, { params });
  },

  /**
   * Submits a customer review for a product
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} reviewData - { rating: 1-5, title: string, comment: string }
   */
  async addProductReview(slugOrId, reviewData) {
    return axiosClient.post(`/products/${slugOrId}/reviews/`, reviewData);
  },

  // =========================================================================
  // Administrative Catalog Endpoints (Staff Only)
  // =========================================================================

  /**
   * Creates a new product with optional initial variants & stock
   * @param {Object} productData
   */
  async createProduct(productData) {
    return axiosClient.post('/products/', productData);
  },

  /**
   * Updates an existing product
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} productData
   */
  async updateProduct(slugOrId, productData) {
    return axiosClient.patch(`/products/${slugOrId}/`, productData);
  },

  /**
   * Deletes a product
   * @param {string} slugOrId - Product slug or UUID
   */
  async deleteProduct(slugOrId) {
    return axiosClient.delete(`/products/${slugOrId}/`);
  },

  /**
   * Publishes an unpublished product making it visible to customers
   * @param {string} slugOrId - Product slug or UUID
   */
  async publishProduct(slugOrId) {
    return axiosClient.post(`/products/${slugOrId}/publish/`);
  },

  /**
   * Unpublishes a product hiding it from public customer listings
   * @param {string} slugOrId - Product slug or UUID
   */
  async unpublishProduct(slugOrId) {
    return axiosClient.post(`/products/${slugOrId}/unpublish/`);
  },

  /**
   * Creates a new variant for a product
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} variantData - { name, sku, price_override, quantity, low_stock_threshold, color, size, attributes }
   */
  async createVariant(slugOrId, variantData) {
    return axiosClient.post(`/products/${slugOrId}/variants/`, variantData);
  },

  /**
   * Updates an existing variant's stock or attributes
   * @param {string} variantId - Variant UUID
   * @param {Object} variantData
   */
  async updateVariant(variantId, variantData) {
    return axiosClient.patch(`/variants/${variantId}/`, variantData);
  },

  /**
   * Deletes a variant
   * @param {string} variantId - Variant UUID
   */
  async deleteVariant(variantId) {
    return axiosClient.delete(`/variants/${variantId}/`);
  },

  /**
   * Uploads an image to the product gallery
   * @param {string} slugOrId - Product slug or UUID
   * @param {FormData} formData - Form containing 'image', 'alt_text', 'is_primary'
   */
  async uploadProductImage(slugOrId, formData) {
    return axiosClient.post(`/products/${slugOrId}/images/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Deletes an image from the product gallery
   * @param {string} imageId - Image UUID
   */
  async deleteProductImage(imageId) {
    return axiosClient.delete(`/images/${imageId}/`);
  },

  /**
   * Creates a new product category
   * @param {Object} categoryData - { name, slug, description, parent, is_active }
   */
  async createCategory(categoryData) {
    return axiosClient.post('/categories/', categoryData);
  },

  /**
   * Updates an existing product category
   * @param {string} slugOrId - Category slug or UUID
   * @param {Object} categoryData
   */
  async updateCategory(slugOrId, categoryData) {
    return axiosClient.patch(`/categories/${slugOrId}/`, categoryData);
  },

  /**
   * Deletes a category
   * @param {string} slugOrId - Category slug or UUID
   */
  async deleteCategory(slugOrId) {
    return axiosClient.delete(`/categories/${slugOrId}/`);
  },
};

export default catalogApi;
