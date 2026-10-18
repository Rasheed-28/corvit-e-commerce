import React, { createContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api/authApi';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      // Ensure CSRF token cookie is primed
      await authApi.getCsrfToken().catch(() => {});
      const response = await authApi.getCurrentUser();
      if (response?.success && response.data) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Handle global auth expiration events from Axios interceptors
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:expired', handleAuthExpired);
      return () => {
        window.removeEventListener('auth:expired', handleAuthExpired);
      };
    }
  }, []);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    if (response?.success && response.data?.user) {
      setUser(response.data.user);
    }
    return response;
  };

  const register = async (formData) => {
    const response = await authApi.register(formData);
    if (response?.success && response.data?.user) {
      setUser(response.data.user);
    }
    return response;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (profileData) => {
    const response = await authApi.updateProfile(profileData);
    if (response?.success && response.data) {
      setUser(response.data);
    }
    return response;
  };

  const changePassword = async (passwords) => {
    return authApi.changePassword(passwords);
  };

  const requestPasswordReset = async (email) => {
    return authApi.requestPasswordReset(email);
  };

  const confirmPasswordReset = async (resetData) => {
    return authApi.confirmPasswordReset(resetData);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: !!user?.is_staff,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    requestPasswordReset,
    confirmPasswordReset,
    refreshUser: fetchCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
