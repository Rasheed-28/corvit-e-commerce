/**
 * Application-wide constants and API route definitions.
 */
export const API_ROUTES = {
  HEALTH: '/common/health/',
  AUTH: {
    CSRF: '/auth/csrf/',
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    LOGOUT: '/auth/logout/',
    REFRESH: '/auth/token/refresh/',
    ME: '/auth/me/',
    CHANGE_PASSWORD: '/auth/password/change/',
    ADDRESSES: '/auth/addresses/',
  },
  CATALOG: {
    CATEGORIES: '/catalog/categories/',
    PRODUCTS: '/catalog/products/',
    VARIANTS: '/catalog/variants/',
    IMAGES: '/catalog/images/',
    REVIEWS: '/catalog/reviews/',
  },
  CART: {
    ROOT: '/cart/',
    ITEMS: '/cart/items/',
    CLEAR: '/cart/clear/',
    WISHLIST: '/cart/wishlist/',
  },
  ORDERS: {
    ROOT: '/orders/',
    COUPONS_VALIDATE: '/orders/coupons/validate/',
  },
  PAYMENTS: {
    CONFIG: '/payments/config/',
    INTENT: '/payments/intent/',
    CONFIRM: '/payments/confirm/',
    REFUND: (transactionId) => `/payments/refund/${transactionId}/`,
  },
  ADMIN: {
    OVERVIEW: '/admin/overview/',
    SALES_REPORT: '/admin/reports/sales/',
    PRODUCTS: '/admin/products/',
    CATEGORIES: '/admin/categories/',
    INVENTORY: '/admin/inventory/',
    ORDERS: '/admin/orders/',
    CUSTOMERS: '/admin/customers/',
    COUPONS: '/admin/coupons/',
    REVIEWS: '/admin/reviews/',
  },
};


export const DEFAULT_PAGE_SIZE = 12;
