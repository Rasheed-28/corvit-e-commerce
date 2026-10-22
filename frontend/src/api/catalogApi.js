import axiosClient from './axiosClient.js';
import { API_ROUTES } from '../utils/constants.js';

/**
 * Normalizes backend Product schema into standard UI product model.
 */
export function normalizeProduct(p) {
  if (!p) return null;

  const price =
    typeof p.base_price !== 'undefined'
      ? parseFloat(p.base_price)
      : typeof p.price !== 'undefined'
      ? parseFloat(p.price)
      : 0;

  const originalPrice =
    p.originalPrice !== undefined && p.originalPrice !== null
      ? parseFloat(p.originalPrice)
      : p.original_price
      ? parseFloat(p.original_price)
      : null;

  // Format gallery images
  let images = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    images = p.images.map((img) =>
      typeof img === 'string' ? img : img?.image || ''
    ).filter(Boolean);
  }
  if (images.length === 0 && p.primary_image) {
    images = [p.primary_image];
  }
  if (images.length === 0) {
    images = ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80'];
  }

  // Calculate stock levels
  const stock =
    typeof p.available_quantity !== 'undefined'
      ? p.available_quantity
      : typeof p.total_stock !== 'undefined'
      ? p.total_stock
      : p.stock ?? 0;

  const categoryName =
    p.category_name ||
    (typeof p.category === 'object' ? p.category?.name : p.category) ||
    'Storefront';

  const categorySlug =
    p.category_slug ||
    (typeof p.category === 'object' ? p.category?.slug : p.categorySlug) ||
    '';

  const rating =
    p.rating_summary?.average_rating ??
    (typeof p.rating === 'number' ? p.rating : 4.8);

  const reviewCount =
    p.rating_summary?.review_count ??
    p.reviewCount ??
    (Array.isArray(p.reviews) ? p.reviews.length : 0);

  // Normalize variants & colors
  const colors =
    p.colors ||
    (Array.isArray(p.variants)
      ? [
          ...new Map(
            p.variants
              .filter((v) => v.color)
              .map((v) => [v.color, { name: v.color, hex: '#334155' }])
          ).values(),
        ]
      : []);

  return {
    ...p,
    id: p.id,
    title: p.title,
    slug: p.slug,
    sku: p.sku || '',
    description: p.description || '',
    price,
    base_price: p.base_price || price,
    originalPrice,
    images,
    primary_image: images[0] || p.primary_image,
    stock,
    is_in_stock: p.is_in_stock ?? stock > 0,
    category: categoryName,
    categoryName,
    categorySlug,
    rating,
    reviewCount,
    colors,
    isNew: Boolean(p.isNew ?? p.is_new ?? false),
    isBestseller: Boolean(p.is_featured ?? p.isBestseller ?? false),
    is_featured: Boolean(p.is_featured),
    variants: p.variants || [],
    reviews: p.reviews || [],
  };
}

/**
 * Normalizes category models
 */
export function normalizeCategory(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    image:
      c.image ||
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    itemCount: c.product_count ?? c.itemCount ?? 0,
    parent: c.parent,
    children: c.children || [],
  };
}

/**
 * Catalog API Service Module
 * Connects directly to Django REST Framework `/api/v1/catalog/` endpoints.
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
    const res = await axiosClient.get(API_ROUTES.CATALOG.CATEGORIES, { params });
    if (res?.data && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map(normalizeCategory),
      };
    }
    return res;
  },

  /**
   * Retrieves details of a specific category by slug or UUID
   * @param {string} slugOrId - Category slug or UUID
   */
  async getCategory(slugOrId) {
    const res = await axiosClient.get(`${API_ROUTES.CATALOG.CATEGORIES}${slugOrId}/`);
    if (res?.data) {
      return {
        ...res,
        data: normalizeCategory(res.data),
      };
    }
    return res;
  },

  /**
   * Retrieves paginated products with filtering, search, and sorting
   * @param {Object} [params] - Search, filter, sort and pagination parameters
   */
  async getProducts(params = {}) {
    const queryParams = {};

    // Category
    if (params.category && params.category !== 'all') {
      queryParams.category = params.category;
    }

    // Search query
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }

    // Price Bounds
    if (params.min_price !== undefined && params.min_price !== '') {
      queryParams.min_price = params.min_price;
    }
    if (params.max_price !== undefined && params.max_price !== '') {
      queryParams.max_price = params.max_price;
    }

    // In Stock
    if (params.in_stock === true || params.in_stock === 'true') {
      queryParams.in_stock = 'true';
    }

    // Sorting mapping
    if (params.sort) {
      const sortMap = {
        'price-low': 'price_asc',
        price_asc: 'price_asc',
        'price-high': 'price_desc',
        price_desc: 'price_desc',
        newest: 'newest',
        oldest: 'oldest',
        'title-asc': 'title_asc',
        title_asc: 'title_asc',
        'title-desc': 'title_desc',
        title_desc: 'title_desc',
      };
      if (sortMap[params.sort]) {
        queryParams.sort = sortMap[params.sort];
      }
    }

    // Pagination
    if (params.page) {
      queryParams.page = params.page;
    }
    if (params.page_size) {
      queryParams.page_size = params.page_size;
    }

    const res = await axiosClient.get(API_ROUTES.CATALOG.PRODUCTS, {
      params: queryParams,
    });

    if (res?.data && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map(normalizeProduct),
      };
    }

    return res;
  },

  /**
   * Retrieves product details with variants, images, rating summary, and reviews
   * @param {string} slugOrId - Product slug or canonical UUID
   */
  async getProduct(slugOrId) {
    const res = await axiosClient.get(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/`);
    if (res?.data) {
      return {
        ...res,
        data: normalizeProduct(res.data),
      };
    }
    return res;
  },

  /**
   * Retrieves related products for a product
   */
  async getRelatedProducts(currentSlug, categorySlug, limit = 4) {
    try {
      const res = await this.getProducts({
        category: categorySlug,
        page_size: limit + 2,
      });
      if (res?.data) {
        const filtered = res.data.filter((p) => p.slug !== currentSlug).slice(0, limit);
        return {
          success: true,
          data: filtered,
        };
      }
      return { success: true, data: [] };
    } catch {
      return { success: true, data: [] };
    }
  },

  /**
   * Retrieves active variants for a product
   * @param {string} slugOrId - Product slug or UUID
   */
  async getProductVariants(slugOrId) {
    return axiosClient.get(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/variants/`);
  },

  /**
   * Retrieves approved reviews for a product with pagination
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} [params] - Pagination options
   */
  async getProductReviews(slugOrId, params = {}) {
    return axiosClient.get(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/reviews/`, {
      params,
    });
  },

  /**
   * Submits a customer review for a product
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} reviewData - { rating: 1-5, title: string, comment: string }
   */
  /**
   * Submits a customer review for a product
   * @param {string} slugOrId - Product slug or UUID
   * @param {Object} reviewData - { rating: 1-5, title: string, comment: string }
   */
  async addProductReview(slugOrId, reviewData) {
    return axiosClient.post(
      `${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/reviews/`,
      reviewData
    );
  },

  /**
   * Alias for addProductReview
   */
  async addReview(slugOrId, reviewData) {
    return this.addProductReview(slugOrId, reviewData);
  },

  /**
   * Retrieves the current customer's review for a product and verified-buyer qualification
   * @param {string} slugOrId - Product slug or UUID
   */
  async getMyReview(slugOrId) {
    return axiosClient.get(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/reviews/mine/`);
  },

  /**
   * Updates an existing customer review
   * @param {string} reviewId - UUID of the review
   * @param {Object} reviewData - { rating, title, comment }
   */
  async updateReview(reviewId, reviewData) {
    return axiosClient.patch(`${API_ROUTES.CATALOG.REVIEWS}${reviewId}/`, reviewData);
  },

  /**
   * Deletes a customer review
   * @param {string} reviewId - UUID of the review
   */
  async deleteReview(reviewId) {
    return axiosClient.delete(`${API_ROUTES.CATALOG.REVIEWS}${reviewId}/`);
  },


  // =========================================================================
  // Administrative Catalog Endpoints (Staff Only)
  // =========================================================================

  async createProduct(productData) {
    return axiosClient.post(API_ROUTES.CATALOG.PRODUCTS, productData);
  },

  async updateProduct(slugOrId, productData) {
    return axiosClient.patch(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/`, productData);
  },

  async deleteProduct(slugOrId) {
    return axiosClient.delete(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/`);
  },

  async publishProduct(slugOrId) {
    return axiosClient.post(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/publish/`);
  },

  async unpublishProduct(slugOrId) {
    return axiosClient.post(`${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/unpublish/`);
  },

  async createVariant(slugOrId, variantData) {
    return axiosClient.post(
      `${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/variants/`,
      variantData
    );
  },

  async updateVariant(variantId, variantData) {
    return axiosClient.patch(`${API_ROUTES.CATALOG.VARIANTS}${variantId}/`, variantData);
  },

  async deleteVariant(variantId) {
    return axiosClient.delete(`${API_ROUTES.CATALOG.VARIANTS}${variantId}/`);
  },

  async uploadProductImage(slugOrId, formData) {
    return axiosClient.post(
      `${API_ROUTES.CATALOG.PRODUCTS}${slugOrId}/images/`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  async deleteProductImage(imageId) {
    return axiosClient.delete(`${API_ROUTES.CATALOG.IMAGES}${imageId}/`);
  },

  async createCategory(categoryData) {
    return axiosClient.post(API_ROUTES.CATALOG.CATEGORIES, categoryData);
  },

  async updateCategory(slugOrId, categoryData) {
    return axiosClient.patch(
      `${API_ROUTES.CATALOG.CATEGORIES}${slugOrId}/`,
      categoryData
    );
  },

  async deleteCategory(slugOrId) {
    return axiosClient.delete(`${API_ROUTES.CATALOG.CATEGORIES}${slugOrId}/`);
  },
};

export default catalogApi;
