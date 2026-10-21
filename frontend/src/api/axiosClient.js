import axios from 'axios';

/**
 * Helper to retrieve cookie by name from document.cookie
 */
export function getCookie(name) {
  let cookieValue = null;
  if (typeof document !== 'undefined' && document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// In-memory token storage for CSRF and JWT Authorization header support
let inMemoryCsrfToken = null;
let inMemoryAccessToken = null;

export function setCsrfToken(token) {
  inMemoryCsrfToken = token;
}

export function getCsrfToken() {
  return getCookie('csrftoken') || inMemoryCsrfToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
  '/api/v1';

export const axiosClient = axios.create({
  baseURL,
  withCredentials: true, // Send HttpOnly auth & csrf cookies automatically
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Bearer authorization & CSRF token on mutating HTTP methods
axiosClient.interceptors.request.use(
  (config) => {
    // Attach Bearer token if active
    const accessToken = getAccessToken();
    if (accessToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automatic token refresh on 401 & standardized error envelopes
axiosClient.interceptors.response.use(
  (response) => {
    // If response payload contains a CSRF token, cache it for fallback
    if (response?.data?.data?.csrfToken) {
      setCsrfToken(response.data.data.csrfToken);
    }
    // If response payload returns JWT tokens, cache access token
    if (response?.data?.data?.tokens?.access) {
      setAccessToken(response.data.data.tokens.access);
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Skip retry on login, register, csrf, or refresh attempts to prevent loops
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login/') ||
      originalRequest?.url?.includes('/auth/register/') ||
      originalRequest?.url?.includes('/auth/token/refresh/') ||
      originalRequest?.url?.includes('/auth/csrf/');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        // Attempt silent token refresh via HttpOnly cookie or Authorization
        const refreshHeaders = {};
        const csrfToken = getCsrfToken();
        if (csrfToken) refreshHeaders['X-CSRFToken'] = csrfToken;

        const refreshRes = await axios.post(
          `${baseURL}/auth/token/refresh/`,
          {},
          { withCredentials: true, headers: refreshHeaders }
        );

        if (refreshRes?.data?.data?.tokens?.access) {
          setAccessToken(refreshRes.data.data.tokens.access);
        }

        return axiosClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:expired', {
              detail: { message: 'Your session has expired. Please sign in again.' },
            })
          );
        }
      }
    }

    // Emit event for forbidden / permission errors
    if (error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:forbidden', {
            detail: {
              message:
                error.response?.data?.error?.message ||
                error.response?.data?.detail ||
                'You do not have permission to perform this action.',
            },
          })
        );
      }
    }

    let message =
      error.response?.data?.error?.message ||
      (typeof error.response?.data?.detail === 'string' ? error.response.data.detail : null);

    const details = error.response?.data?.error?.details || error.response?.data || null;

    if ((!message || message === 'Invalid input provided.') && details && typeof details === 'object') {
      const firstVal = Object.values(details)[0];
      if (Array.isArray(firstVal) && firstVal.length > 0) {
        message = String(firstVal[0]);
      } else if (typeof firstVal === 'string') {
        message = firstVal;
      }
    }

    if (!message) {
      message = error.message || 'An unexpected error occurred.';
    }

    const normalizedError = {
      message,
      code:
        error.response?.data?.error?.code ||
        (error.response?.status === 403
          ? 'FORBIDDEN'
          : error.response?.status === 401
          ? 'UNAUTHORIZED'
          : error.response?.status === 404
          ? 'NOT_FOUND'
          : 'UNKNOWN_ERROR'),
      status: error.response?.status,
      details,
      response: error.response,
    };

    return Promise.reject(normalizedError);
  }
);

export default axiosClient;
