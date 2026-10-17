/**
 * ==============================================================================
 * Documented Mock API Adapter
 * ==============================================================================
 * This adapter provides asynchronous data fetching and state mutation for storefront
 * pages when the backend database is unseeded or endpoints are in progress.
 *
 * Each method strictly mirrors the Django REST Framework response envelope:
 * {
 *   success: true,
 *   data: <payload>,
 *   meta: { pagination: { ... } }
 * }
 *
 * Migration to Production API:
 * To switch any domain to live backend endpoints, replace the method body with
 * the corresponding `axiosClient` call (e.g. `axiosClient.get('/catalog/products/')`).
 */

import { MOCK_PRODUCTS, MOCK_CATEGORIES, MOCK_REVIEWS } from '../data/mockProducts';

// Simulated network latency helper
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

// ==============================================================================
// 1. Catalog & Products Adapter
// Equivalent Django endpoint: /api/v1/catalog/
// ==============================================================================
export const mockCatalogApi = {
  /**
   * Retrieves paginated products with filtering and sorting
   * Django Endpoint: GET /api/v1/catalog/products/
   */
  async getProducts({
    category,
    search,
    min_price,
    max_price,
    in_stock,
    sort = 'featured',
    page = 1,
    page_size = 12,
  } = {}) {
    await delay();

    let items = [...MOCK_PRODUCTS];

    // Category filter
    if (category && category !== 'all') {
      items = items.filter(
        (p) => p.categorySlug.toLowerCase() === category.toLowerCase()
      );
    }

    // Search query filter
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Price range filter
    if (min_price !== undefined && min_price !== '') {
      items = items.filter((p) => p.price >= parseFloat(min_price));
    }
    if (max_price !== undefined && max_price !== '') {
      items = items.filter((p) => p.price <= parseFloat(max_price));
    }

    // Stock availability filter
    if (in_stock === true || in_stock === 'true') {
      items = items.filter((p) => p.stock > 0);
    }

    // Sorting
    if (sort === 'price_asc' || sort === 'price-low') {
      items.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc' || sort === 'price-high') {
      items.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      items.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'newest') {
      items.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }

    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / page_size));
    const startIndex = (page - 1) * page_size;
    const paginatedItems = items.slice(startIndex, startIndex + page_size);

    return {
      success: true,
      data: paginatedItems,
      meta: {
        pagination: {
          page: Number(page),
          page_size: Number(page_size),
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      },
    };
  },

  /**
   * Retrieves single product by slug or identifier
   * Django Endpoint: GET /api/v1/catalog/products/<slug>/
   */
  async getProduct(slugOrId) {
    await delay();
    const product = MOCK_PRODUCTS.find(
      (p) => p.slug === slugOrId || p.id === slugOrId
    );

    if (!product) {
      const error = new Error(`Product "${slugOrId}" could not be found.`);
      error.status = 404;
      throw error;
    }

    return {
      success: true,
      data: product,
    };
  },

  /**
   * Retrieves category list
   * Django Endpoint: GET /api/v1/catalog/categories/
   */
  async getCategories() {
    await delay(100);
    return {
      success: true,
      data: MOCK_CATEGORIES,
    };
  },

  /**
   * Retrieves single category by slug
   * Django Endpoint: GET /api/v1/catalog/categories/<slug>/
   */
  async getCategory(slug) {
    await delay(100);
    const category = MOCK_CATEGORIES.find((c) => c.slug === slug);
    if (!category) {
      const error = new Error(`Category "${slug}" not found.`);
      error.status = 404;
      throw error;
    }
    return {
      success: true,
      data: category,
    };
  },

  /**
   * Retrieves related products in the same category
   * Django Endpoint: GET /api/v1/catalog/products/?category=<slug>
   */
  async getRelatedProducts(currentSlug, categorySlug, limit = 4) {
    await delay(100);
    const related = MOCK_PRODUCTS.filter(
      (p) => p.slug !== currentSlug && (!categorySlug || p.categorySlug === categorySlug)
    ).slice(0, limit);

    return {
      success: true,
      data: related,
    };
  },

  /**
   * Submits product review
   * Django Endpoint: POST /api/v1/catalog/products/<slug>/reviews/
   */
  async addReview(slug, reviewData) {
    await delay(300);
    return {
      success: true,
      data: {
        id: `rev-${Date.now()}`,
        author: reviewData.author || 'Verified Customer',
        role: 'Verified Buyer',
        rating: reviewData.rating,
        date: new Date().toISOString().split('T')[0],
        comment: reviewData.comment,
      },
      message: 'Review submitted successfully and pending moderation.',
    };
  },
};

// ==============================================================================
// 2. Orders Adapter
// Equivalent Django endpoint: /api/v1/orders/
// ==============================================================================
let mockOrdersState = [
  {
    orderNumber: 'ORD-2026-9284',
    date: '2026-10-15',
    status: 'Delivered', // 'Delivered' | 'Shipped' | 'Processing' | 'Cancelled'
    statusColor: 'success',
    trackingNumber: 'TRK-US-9842104928',
    carrier: 'FedEx Express Courier',
    estimatedDelivery: '2026-10-17',
    shippingAddress: {
      fullName: 'Alex Reynolds',
      street: '742 Evergreen Terrace, Suite 4B',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'United States',
      phone: '+1 (555) 234-5678',
    },
    paymentMethod: {
      type: 'Visa',
      last4: '4242',
      expDate: '08/28',
    },
    items: [
      {
        id: 'prod-1',
        title: 'Aura Studio Wireless Over-Ear Headphones',
        variant: 'Matte Black',
        quantity: 1,
        unitPrice: 249.00,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod-8',
        title: 'Nordic Double-Wall Vacuum Thermal Tumbler',
        variant: 'Sage Green',
        quantity: 2,
        unitPrice: 42.00,
        image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
      },
    ],
    financials: {
      subtotal: 333.00,
      shipping: 0.00, // Free over $50
      tax: 26.64,
      discount: 20.00,
      total: 339.64,
    },
    timeline: [
      { status: 'Order Placed', date: 'Oct 15, 2026 10:14 AM', completed: true },
      { status: 'Processing & Packaged', date: 'Oct 15, 2026 02:40 PM', completed: true },
      { status: 'In Transit', date: 'Oct 16, 2026 09:20 AM', completed: true },
      { status: 'Delivered', date: 'Oct 17, 2026 01:15 PM', completed: true },
    ],
  },
  {
    orderNumber: 'ORD-2026-8812',
    date: '2026-10-02',
    status: 'Shipped',
    statusColor: 'info',
    trackingNumber: 'TRK-DHL-44029112',
    carrier: 'DHL International Priority',
    estimatedDelivery: '2026-10-20',
    shippingAddress: {
      fullName: 'Alex Reynolds',
      street: '742 Evergreen Terrace, Suite 4B',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'United States',
      phone: '+1 (555) 234-5678',
    },
    paymentMethod: {
      type: 'Apple Pay',
      last4: '8821',
      expDate: '11/27',
    },
    items: [
      {
        id: 'prod-2',
        title: 'Chronos Vanguard Titanium Smartwatch',
        variant: 'Brushed Titanium',
        quantity: 1,
        unitPrice: 389.00,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
      },
    ],
    financials: {
      subtotal: 389.00,
      shipping: 0.00,
      tax: 31.12,
      discount: 0.00,
      total: 420.12,
    },
    timeline: [
      { status: 'Order Placed', date: 'Oct 02, 2026 08:30 PM', completed: true },
      { status: 'Processing & Packaged', date: 'Oct 03, 2026 11:15 AM', completed: true },
      { status: 'In Transit', date: 'Oct 04, 2026 03:00 PM', completed: true },
      { status: 'Delivered', date: 'Pending Arrival', completed: false },
    ],
  },
];

export const mockOrdersApi = {
  /**
   * Retrieves list of customer orders
   * Django Endpoint: GET /api/v1/orders/
   */
  async getOrders() {
    await delay(200);
    return {
      success: true,
      data: mockOrdersState,
    };
  },

  /**
   * Retrieves detail for a specific order by orderNumber
   * Django Endpoint: GET /api/v1/orders/<order_number>/
   */
  async getOrder(orderNumber) {
    await delay(200);
    const order = mockOrdersState.find(
      (o) => o.orderNumber.toUpperCase() === orderNumber.toUpperCase()
    );

    if (!order) {
      const error = new Error(`Order "${orderNumber}" could not be found.`);
      error.status = 404;
      throw error;
    }

    return {
      success: true,
      data: order,
    };
  },
};

// ==============================================================================
// 3. Customer Profile & Addresses Adapter
// Equivalent Django endpoint: /api/v1/auth/me/ & /api/v1/auth/addresses/
// ==============================================================================
let mockProfileState = {
  id: 'usr-9941',
  firstName: 'Alex',
  lastName: 'Reynolds',
  email: 'alex.reynolds@example.com',
  phone: '+1 (555) 234-5678',
  memberSince: 'March 2024',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  orderCount: 12,
  rewardPoints: 480,
  newsletterSubscribed: true,
};

let mockAddressesState = [
  {
    id: 'addr-1',
    isDefault: true,
    label: 'Home (Primary)',
    recipientName: 'Alex Reynolds',
    streetAddress: '742 Evergreen Terrace, Suite 4B',
    city: 'Seattle',
    state: 'WA',
    postalCode: '98101',
    country: 'United States',
    phone: '+1 (555) 234-5678',
  },
  {
    id: 'addr-2',
    isDefault: false,
    label: 'Studio Office',
    recipientName: 'Alex Reynolds (Design Dept)',
    streetAddress: '1200 4th Ave, Level 8',
    city: 'Seattle',
    state: 'WA',
    postalCode: '98104',
    country: 'United States',
    phone: '+1 (555) 987-6543',
  },
];

export const mockAccountApi = {
  /**
   * Retrieves profile details for current customer
   * Django Endpoint: GET /api/v1/auth/me/
   */
  async getProfile() {
    await delay(150);
    return {
      success: true,
      data: mockProfileState,
    };
  },

  /**
   * Updates customer profile details
   * Django Endpoint: PATCH /api/v1/auth/me/
   */
  async updateProfile(updates) {
    await delay(300);
    mockProfileState = { ...mockProfileState, ...updates };
    return {
      success: true,
      data: mockProfileState,
      message: 'Profile information updated successfully.',
    };
  },

  /**
   * Retrieves customer saved address book
   * Django Endpoint: GET /api/v1/auth/addresses/
   */
  async getAddresses() {
    await delay(150);
    return {
      success: true,
      data: mockAddressesState,
    };
  },

  /**
   * Adds new shipping/billing address
   * Django Endpoint: POST /api/v1/auth/addresses/
   */
  async addAddress(addressData) {
    await delay(250);
    const newAddr = {
      id: `addr-${Date.now()}`,
      isDefault: addressData.isDefault || mockAddressesState.length === 0,
      ...addressData,
    };

    if (newAddr.isDefault) {
      mockAddressesState = mockAddressesState.map((a) => ({ ...a, isDefault: false }));
    }

    mockAddressesState.push(newAddr);
    return {
      success: true,
      data: newAddr,
    };
  },

  /**
   * Deletes an address
   * Django Endpoint: DELETE /api/v1/auth/addresses/<id>/
   */
  async deleteAddress(addressId) {
    await delay(200);
    mockAddressesState = mockAddressesState.filter((a) => a.id !== addressId);
    return {
      success: true,
      message: 'Address deleted successfully.',
    };
  },

  /**
   * Sets an address as primary default
   * Django Endpoint: PATCH /api/v1/auth/addresses/<id>/
   */
  async setDefaultAddress(addressId) {
    await delay(180);
    mockAddressesState = mockAddressesState.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));
    return {
      success: true,
      message: 'Default shipping address updated.',
    };
  },
};
