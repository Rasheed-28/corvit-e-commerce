import axiosClient from './axiosClient';

/**
 * Auth API Service Module
 * Handles customer authentication, profile management, and password flows.
 */
export const authApi = {
  /**
   * Initializes CSRF token cookie for the SPA session
   */
  async getCsrfToken() {
    return axiosClient.get('/auth/csrf/');
  },

  /**
   * Registers a new customer account
   */
  async register(data) {
    return axiosClient.post('/auth/register/', data);
  },

  /**
   * Authenticates user via username or email and password
   */
  async login(data) {
    return axiosClient.post('/auth/login/', data);
  },

  /**
   * Logs out user, blacklists token, and clears HttpOnly auth cookies
   */
  async logout() {
    return axiosClient.post('/auth/logout/');
  },

  /**
   * Refreshes JWT access token using the HttpOnly refresh token cookie
   */
  async refreshToken() {
    return axiosClient.post('/auth/token/refresh/');
  },

  /**
   * Retrieves profile data for the authenticated current user
   */
  async getCurrentUser() {
    return axiosClient.get('/auth/me/');
  },

  /**
   * Updates customer profile attributes (first_name, last_name, phone, etc.)
   */
  async updateProfile(data) {
    return axiosClient.patch('/auth/me/', data);
  },

  /**
   * Changes password for authenticated user requiring current password
   */
  async changePassword(data) {
    return axiosClient.post('/auth/password/change/', data);
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
};

export default authApi;
