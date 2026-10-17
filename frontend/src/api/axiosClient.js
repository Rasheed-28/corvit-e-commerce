import axios from 'axios';

/**
 * Helper to retrieve cookie by name from document.cookie
 */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
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

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const axiosClient = axios.create({
  baseURL,
  withCredentials: true, // Send HttpOnly auth & csrf cookies automatically
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach CSRF token on mutating methods
axiosClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('csrftoken');
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
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Skip retry on login, register, csrf, or refresh attempts
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login/') ||
      originalRequest?.url?.includes('/auth/register/') ||
      originalRequest?.url?.includes('/auth/token/refresh/') ||
      originalRequest?.url?.includes('/auth/csrf/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        // Attempt silent token refresh via HttpOnly cookie
        await axios.post(`${baseURL}/auth/token/refresh/`, {}, { withCredentials: true });
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed (token expired or blacklisted)
        // Bubble up error so AuthContext can handle logout
      }
    }

    const normalizedError = {
      message: error.response?.data?.error?.message || error.message || 'An unexpected error occurred.',
      code: error.response?.data?.error?.code || 'UNKNOWN_ERROR',
      status: error.response?.status,
      details: error.response?.data?.error?.details || null,
    };
    return Promise.reject(normalizedError);
  }
);

export default axiosClient;
