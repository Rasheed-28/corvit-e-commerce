import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationContext';
import { MOCK_PRODUCTS } from '../data/mockProducts';

const WishlistContext = createContext(null);

const STORAGE_KEY = 'novastore_wishlist';

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    // Default starter wishlist items for realistic showcase
    return [MOCK_PRODUCTS[1], MOCK_PRODUCTS[3]];
  });

  const { notify } = useNotification();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Ignore storage errors
    }
  }, [wishlist]);

  const isInWishlist = useCallback(
    (productId) => {
      return wishlist.some((item) => item.id === productId);
    },
    [wishlist]
  );

  const addToWishlist = useCallback(
    (product) => {
      if (!isInWishlist(product.id)) {
        setWishlist((prev) => [...prev, product]);
        notify.success(`"${product.title}" saved to your wishlist.`, 'Wishlist Updated');
      }
    },
    [isInWishlist, notify]
  );

  const removeFromWishlist = useCallback(
    (productId) => {
      setWishlist((prev) => {
        const item = prev.find((p) => p.id === productId);
        if (item) {
          notify.info(`"${item.title}" removed from wishlist.`, 'Wishlist Updated');
        }
        return prev.filter((p) => p.id !== productId);
      });
    },
    [notify]
  );

  const toggleWishlist = useCallback(
    (product) => {
      if (isInWishlist(product.id)) {
        removeFromWishlist(product.id);
      } else {
        addToWishlist(product);
      }
    },
    [isInWishlist, addToWishlist, removeFromWishlist]
  );

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    notify.info('Wishlist has been cleared.', 'Wishlist Cleared');
  }, [notify]);

  const value = {
    wishlist,
    totalWishlistItems: wishlist.length,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
