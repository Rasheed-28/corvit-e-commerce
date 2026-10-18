import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { cartApi } from '../api/cartApi';
import { normalizeProduct } from '../api/catalogApi';
import { useNotification } from './NotificationContext';
import { useAuth } from '../hooks/useAuth';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'novastore_wishlist';

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState(new Set());
  const { notify } = useNotification();
  const { isAuthenticated } = useAuth();
  const prevAuthRef = useRef(isAuthenticated);

  /**
   * Helper to normalize backend wishlist item to product model with availability metadata.
   */
  const normalizeWishlistEntry = (backendItem) => {
    if (!backendItem) return null;
    const rawProd = backendItem.product || {};
    const normalizedProd = normalizeProduct(rawProd) || rawProd;

    return {
      ...normalizedProd,
      id: rawProd.id || backendItem.id,
      wishlistItemId: backendItem.id,
      is_available: backendItem.is_available !== false,
      stock_status: backendItem.stock_status || (normalizedProd.stock > 0 ? 'in_stock' : 'out_of_stock'),
      savedAt: backendItem.created_at,
    };
  };

  /**
   * Fetch authenticated wishlist from server.
   */
  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const res = await cartApi.getWishlist();
      if (res?.success && Array.isArray(res.data)) {
        const mapped = res.data.map(normalizeWishlistEntry).filter(Boolean);
        setWishlist(mapped);
      }
    } catch (err) {
      console.warn('Failed to load wishlist:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Handle Login and Logout transitions
  useEffect(() => {
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!wasAuth && isAuthenticated) {
      // User just logged in: sync any offline guest items to server
      const localGuestItems = [...wishlist];
      if (localGuestItems.length > 0) {
        Promise.all(
          localGuestItems.map((item) =>
            cartApi.addToWishlist(item.id).catch(() => null)
          )
        ).then(() => {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
          loadWishlist();
        });
      } else {
        loadWishlist();
      }
    } else if (wasAuth && !isAuthenticated) {
      // User logged out: clear private account wishlist from memory
      setWishlist([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    } else if (isAuthenticated) {
      loadWishlist();
    }
  }, [isAuthenticated, loadWishlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist guest wishlist to localStorage when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
      } catch {}
    }
  }, [wishlist, isAuthenticated]);

  const isInWishlist = useCallback(
    (productId) => {
      return wishlist.some((item) => item.id === productId || item.wishlistItemId === productId);
    },
    [wishlist]
  );

  const addToWishlist = useCallback(
    async (product) => {
      if (!product?.id) return;
      if (isInWishlist(product.id)) {
        notify.info(`"${product.title}" is already in your wishlist.`, 'Wishlist Notice');
        return;
      }

      // Guard against repeated rapid clicks
      if (pendingItems.has(product.id)) return;
      setPendingItems((prev) => new Set(prev).add(product.id));

      if (isAuthenticated) {
        try {
          const res = await cartApi.addToWishlist(product.id);
          if (res?.success) {
            const newItem = normalizeWishlistEntry(res.data) || {
              ...product,
              id: product.id,
              wishlistItemId: res.data?.id,
              is_available: true,
              stock_status: product.stock > 0 ? 'in_stock' : 'out_of_stock',
            };
            setWishlist((prev) => [...prev.filter((p) => p.id !== product.id), newItem]);
            notify.success(`"${product.title}" saved to your wishlist.`, 'Wishlist Updated');
          }
        } catch (err) {
          notify.error(err?.message || 'Failed to save product to wishlist.', 'Wishlist Error');
        } finally {
          setPendingItems((prev) => {
            const next = new Set(prev);
            next.delete(product.id);
            return next;
          });
        }
      } else {
        // Guest mode
        setWishlist((prev) => [...prev, product]);
        notify.success(`"${product.title}" saved to your wishlist.`, 'Wishlist Updated');
        setPendingItems((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }
    },
    [isAuthenticated, isInWishlist, pendingItems, notify]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      if (!productId) return;
      const targetItem = wishlist.find((p) => p.id === productId || p.wishlistItemId === productId);
      const title = targetItem?.title || 'Product';

      if (pendingItems.has(productId)) return;
      setPendingItems((prev) => new Set(prev).add(productId));

      // Optimistic removal
      const previous = [...wishlist];
      setWishlist((prev) => prev.filter((p) => p.id !== productId && p.wishlistItemId !== productId));

      if (isAuthenticated) {
        try {
          await cartApi.removeFromWishlist(productId);
          notify.info(`"${title}" removed from wishlist.`, 'Wishlist Updated');
        } catch (err) {
          setWishlist(previous);
          notify.error(err?.message || 'Failed to remove from wishlist.', 'Wishlist Error');
        } finally {
          setPendingItems((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        }
      } else {
        notify.info(`"${title}" removed from wishlist.`, 'Wishlist Updated');
        setPendingItems((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [isAuthenticated, wishlist, pendingItems, notify]
  );

  const toggleWishlist = useCallback(
    (product) => {
      if (!product) return;
      if (isInWishlist(product.id)) {
        removeFromWishlist(product.id);
      } else {
        addToWishlist(product);
      }
    },
    [isInWishlist, addToWishlist, removeFromWishlist]
  );

  const clearWishlist = useCallback(async () => {
    const previous = [...wishlist];
    setWishlist([]);

    if (isAuthenticated) {
      try {
        await cartApi.clearWishlist();
        notify.info('Wishlist has been cleared.', 'Wishlist Cleared');
      } catch (err) {
        setWishlist(previous);
        notify.error(err?.message || 'Failed to clear wishlist.', 'Wishlist Error');
      }
    } else {
      notify.info('Wishlist has been cleared.', 'Wishlist Cleared');
    }
  }, [isAuthenticated, wishlist, notify]);

  const value = {
    wishlist,
    totalWishlistItems: wishlist.length,
    isLoading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
    refreshWishlist: loadWishlist,
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

export default WishlistContext;
