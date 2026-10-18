import axiosClient, { setCsrfToken, setAccessToken } from './axiosClient.js';
import { API_ROUTES } from '../utils/constants.js';

/**
 * Normalizes backend address format to frontend state representation.
 */
export function normalizeAddress(a) {
  if (!a) return null;
  return {
    ...a,
    id: a.id,
    label:
      a.label ||
      (a.address_type
        ? a.address_type.charAt(0).toUpperCase() + a.address_type.slice(1)
        : 'Home'),
    recipientName: a.full_name || a.recipientName || '',
    streetAddress: a.street_address_1 || a.streetAddress || '',
    streetAddress2: a.street_address_2 || a.streetAddress2 || '',
    city: a.city || '',
    state: a.state_or_province || a.state || '',
    postalCode: a.postal_code || a.postalCode || '',
    country: a.country || 'United States',
    phone: a.phone_number || a.phone || '',
    isDefault: Boolean(a.is_default ?? a.isDefault),
  };
}

/**
 * Maps frontend address form data to backend DRF AddressSerializer schema.
 */
export function denormalizeAddress(formData) {
  return {
    address_type: (formData.label || formData.address_type || 'home').toLowerCase(),
    full_name: formData.recipientName || formData.full_name || '',
    phone_number: formData.phone || formData.phone_number || '',
    street_address_1: formData.streetAddress || formData.street_address_1 || '',
    street_address_2: formData.streetAddress2 || formData.street_address_2 || '',
    city: formData.city || '',
    state_or_province: formData.state || formData.state_or_province || '',
    postal_code: formData.postalCode || formData.postal_code || '',
    country: formData.country || 'US',
    is_default: Boolean(formData.isDefault ?? formData.is_default),
  };
}

/**
 * Auth API Service Module
 * Handles customer authentication, profile management, addresses, and password flows.
 */
export const authApi = {
  /**
   * Initializes CSRF token cookie and stores token for SPA mutating requests
   */
  async getCsrfToken() {
    const res = await axiosClient.get(API_ROUTES.AUTH.CSRF);
    if (res?.data?.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res;
  },

  /**
   * Registers a new customer account
   */
  async register(data) {
    const payload = {
      username: data.username || data.email,
      email: data.email,
      first_name: data.first_name || data.firstName || '',
      last_name: data.last_name || data.lastName || '',
      password: data.password,
      password_confirm: data.password_confirm || data.confirmPassword || data.password,
    };
    return axiosClient.post(API_ROUTES.AUTH.REGISTER, payload);
  },

  /**
   * Authenticates user via username or email and password
   */
  async login(credentials) {
    const payload = {
      username: credentials.username || credentials.email,
      password: credentials.password,
    };
    return axiosClient.post(API_ROUTES.AUTH.LOGIN, payload);
  },

  /**
   * Logs out user, blacklists token, and clears HttpOnly auth cookies
   */
  async logout() {
    try {
      return await axiosClient.post(API_ROUTES.AUTH.LOGOUT);
    } finally {
      setAccessToken(null);
    }
  },

  /**
   * Refreshes JWT access token using the HttpOnly refresh token cookie
   */
  async refreshToken() {
    return axiosClient.post(API_ROUTES.AUTH.REFRESH);
  },

  /**
   * Retrieves profile data for the authenticated current user
   */
  async getCurrentUser() {
    return axiosClient.get(API_ROUTES.AUTH.ME);
  },

  /**
   * Updates customer profile attributes (first_name, last_name, phone, etc.)
   */
  async updateProfile(data) {
    const payload = {};
    if (data.firstName !== undefined || data.first_name !== undefined) {
      payload.first_name = data.first_name ?? data.firstName;
    }
    if (data.lastName !== undefined || data.last_name !== undefined) {
      payload.last_name = data.last_name ?? data.lastName;
    }
    if (data.phone !== undefined || data.phone_number !== undefined) {
      payload.customer_profile = {
        phone_number: data.phone_number ?? data.phone,
      };
    }
    if (data.profile) {
      payload.customer_profile = {
        ...payload.customer_profile,
        ...data.profile,
      };
    }
    return axiosClient.patch(API_ROUTES.AUTH.ME, payload);
  },

  /**
   * Changes password for authenticated user requiring current password
   */
  async changePassword(data) {
    const payload = {
      old_password: data.old_password || data.currentPassword,
      new_password: data.new_password || data.newPassword,
      new_password_confirm: data.new_password_confirm || data.confirmNewPassword,
    };
    return axiosClient.post(API_ROUTES.AUTH.CHANGE_PASSWORD, payload);
  },

  /**
   * Requests password reset link sent to customer email
   */
  async requestPasswordReset(email) {
    return axiosClient.post('/auth/password/reset/', { email });
  },

  /**
   * Confirms password reset using one-time uid and token
   */
  async confirmPasswordReset(data) {
    return axiosClient.post('/auth/password/reset/confirm/', data);
  },

  // =========================================================================
  // Address Book Endpoints
  // =========================================================================

  /**
   * Retrieves all saved addresses for the authenticated user
   */
  async getAddresses() {
    const res = await axiosClient.get(API_ROUTES.AUTH.ADDRESSES);
    if (res?.data && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map(normalizeAddress),
      };
    }
    return res;
  },

  /**
   * Adds a new address for the authenticated user
   */
  async addAddress(formData) {
    const payload = denormalizeAddress(formData);
    const res = await axiosClient.post(API_ROUTES.AUTH.ADDRESSES, payload);
    if (res?.data) {
      return {
        ...res,
        data: normalizeAddress(res.data),
      };
    }
    return res;
  },

  /**
   * Updates an existing address
   */
  async updateAddress(id, formData) {
    const payload = denormalizeAddress(formData);
    const res = await axiosClient.patch(`${API_ROUTES.AUTH.ADDRESSES}${id}/`, payload);
    if (res?.data) {
      return {
        ...res,
        data: normalizeAddress(res.data),
      };
    }
    return res;
  },

  /**
   * Deletes an address by ID
   */
  async deleteAddress(id) {
    return axiosClient.delete(`${API_ROUTES.AUTH.ADDRESSES}${id}/`);
  },

  /**
   * Sets an address as primary/default
   */
  async setDefaultAddress(id) {
    const res = await axiosClient.patch(`${API_ROUTES.AUTH.ADDRESSES}${id}/`, {
      is_default: true,
    });
    if (res?.data) {
      return {
        ...res,
        data: normalizeAddress(res.data),
      };
    }
    return res;
  },
};

export default authApi;
