import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { cartApi, normalizeCart } from '../api/cartApi';
import { useNotification } from './NotificationContext';
import { useAuth } from '../hooks/useAuth';

const CartContext = createContext(null);
const STORAGE_SESSION_KEY = 'novastore_cart_session';
const STORAGE_LOCAL_BACKUP = 'novastore_cart_backup';

function getOrCreateGuestSession() {
  try {
    let key = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!key) {
      key = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem(STORAGE_SESSION_KEY, key);
    }
    return key;
  } catch {
    return 'guest_fallback_' + Date.now();
  }
}

export const CartProvider = ({ children }) => {
  const [sessionKey, setSessionKey] = useState(getOrCreateGuestSession);
  const [cart, setCart] = useState(() => {
    // Attempt local storage cache restoration for instant initial render
    try {
      const cached = localStorage.getItem(STORAGE_LOCAL_BACKUP);
      if (cached) return normalizeCart(JSON.parse(cached));
    } catch {}
    return { id: null, sessionKey: null, items: [], totalItems: 0, subtotal: 0 };
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingItems, setPendingItems] = useState(new Set());

  const { notify } = useNotification();
  const { isAuthenticated } = useAuth();
  const prevAuthRef = useRef(isAuthenticated);

  // Sync state to local cache for instant offline/initial hydration
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCAL_BACKUP, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Load cart from backend
  const loadCart = useCallback(async (currentSessionKey = sessionKey) => {
    try {
      setIsLoading(true);
      const res = await cartApi.getCart(currentSessionKey);
      if (res?.success && res.data) {
        setCart(res.data);
      }
    } catch (err) {
      console.warn('Backend cart load deferred or network offline:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey]);

  // Initialize cart on mount
  useEffect(() => {
    loadCart(sessionKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Login and Logout transitions
  useEffect(() => {
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!wasAuth && isAuthenticated) {
      // Customer logged in: Merge anonymous guest cart into user account
      const guestKey = sessionKey;
      cartApi
        .mergeCart(guestKey)
        .then((res) => {
          if (res?.success && res.data) {
            setCart(res.data);
            notify.info('Your guest items were merged into your account.', 'Cart Updated');
          } else {
            loadCart(null);
          }
        })
        .catch(() => {
          loadCart(null);
        });
    } else if (wasAuth && !isAuthenticated) {
      // Customer logged out: initialize a fresh anonymous session
      const newKey = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, newKey);
      } catch {}
      setSessionKey(newKey);
      setCart({ id: null, sessionKey: newKey, items: [], totalItems: 0, subtotal: 0 });
      loadCart(newKey);
    }
  }, [isAuthenticated, sessionKey, loadCart, notify]);

  /**
   * Helper to resolve variant ID from flexible inputs (ID, name, color, or object).
   */
  const resolveVariantId = (product, selectedVariant) => {
    if (!product) return null;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length === 0) return null;

    if (!selectedVariant) {
      return variants[0]?.id || null;
    }
    if (typeof selectedVariant === 'object' && selectedVariant.id) {
      return selectedVariant.id;
    }
    if (typeof selectedVariant === 'string') {
      const match = variants.find(
        (v) =>
          v.id === selectedVariant ||
          v.name === selectedVariant ||
          v.color === selectedVariant ||
          v.sku === selectedVariant
      );
      if (match) return match.id;
    }
    return variants[0]?.id || null;
  };

  /**
   * Adds product or variant to cart. Prevents repeated rapid clicks while in flight.
   */
  const addItem = useCallback(
    async (product, quantity = 1, selectedVariant = null) => {
      if (!product || quantity < 1) return;

      const variantId = resolveVariantId(product, selectedVariant);
      const actionKey = `add_${product.id}_${variantId || 'def'}`;

      // Prevent repeated clicks during in-flight network request
      if (pendingItems.has(actionKey)) {
        return;
      }

      setPendingItems((prev) => new Set(prev).add(actionKey));
      setIsUpdating(true);

      try {
        const res = await cartApi.addToCart({
          productId: product.id,
          variantId,
          quantity,
          sessionKey,
        });

        if (res?.success && res.data) {
          setCart(res.data);
          notify.success(`Added "${product.title}" to your cart.`, 'Item Added');
        }
      } catch (err) {
        const errMsg = err?.message || 'Failed to add item to cart.';
        notify.error(errMsg, 'Cart Notice');
      } finally {
        setPendingItems((prev) => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
        setIsUpdating(false);
      }
    },
    [sessionKey, pendingItems, notify]
  );

  /**
   * Resolves target CartItem ID from either CartItem UUID or product ID & variant.
   */
  const findCartItem = useCallback(
    (identifier, selectedVariant = null) => {
      // 1. Direct CartItem ID match
      let item = cart.items.find((it) => it.id === identifier);
      if (item) return item;

      // 2. Product ID match
      item = cart.items.find(
        (it) =>
          (it.productId === identifier || it.product === identifier) &&
          (!selectedVariant || it.selectedVariant === selectedVariant || it.variantId === selectedVariant)
      );
      return item || null;
    },
    [cart.items]
  );

  /**
   * Updates line item quantity. Validates limits and guards against rapid repeated clicks.
   */
  const updateQuantity = useCallback(
    async (identifier, quantity, selectedVariant = null) => {
      const item = findCartItem(identifier, selectedVariant);
      if (!item) return;

      if (quantity <= 0) {
        return removeItem(item.id);
      }

      const actionKey = `update_${item.id}`;
      if (pendingItems.has(actionKey)) return;

      // Validate client limits before sending
      if (item.availableStock && quantity > item.availableStock) {
        notify.warning(
          `Only ${item.availableStock} units available in stock.`,
          'Stock Limit Reached'
        );
        return;
      }
      if (quantity > 10) {
        notify.warning('Maximum 10 units per order item.', 'Purchase Limit');
        return;
      }

      setPendingItems((prev) => new Set(prev).add(actionKey));
      setIsUpdating(true);

      // Optimistic update
      const previousCart = { ...cart };
      setCart((prev) => {
        const updated = prev.items.map((it) =>
          it.id === item.id ? { ...it, quantity, subtotal: it.price * quantity } : it
        );
        const newTotalItems = updated.reduce((sum, it) => sum + it.quantity, 0);
        const newSubtotal = updated.reduce((sum, it) => sum + it.price * it.quantity, 0);
        return { ...prev, items: updated, totalItems: newTotalItems, subtotal: newSubtotal };
      });

      try {
        const res = await cartApi.updateCartItem(item.id, quantity, sessionKey);
        if (res?.success && res.data) {
          setCart(res.data);
        }
      } catch (err) {
        // Rollback optimistic update on network failure or validation error
        setCart(previousCart);
        notify.error(err?.message || 'Failed to update item quantity.', 'Cart Error');
      } finally {
        setPendingItems((prev) => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
        setIsUpdating(false);
      }
    },
    [cart, findCartItem, sessionKey, pendingItems, notify]
  );

  /**
   * Removes line item from cart.
   */
  const removeItem = useCallback(
    async (identifier, selectedVariant = null) => {
      const item = findCartItem(identifier, selectedVariant);
      if (!item) return;

      const actionKey = `remove_${item.id}`;
      if (pendingItems.has(actionKey)) return;

      setPendingItems((prev) => new Set(prev).add(actionKey));
      setIsUpdating(true);

      // Optimistic removal
      const previousCart = { ...cart };
      setCart((prev) => {
        const updated = prev.items.filter((it) => it.id !== item.id);
        const newTotalItems = updated.reduce((sum, it) => sum + it.quantity, 0);
        const newSubtotal = updated.reduce((sum, it) => sum + it.price * it.quantity, 0);
        return { ...prev, items: updated, totalItems: newTotalItems, subtotal: newSubtotal };
      });

      try {
        const res = await cartApi.removeCartItem(item.id, sessionKey);
        if (res?.success && res.data) {
          setCart(res.data);
          notify.info('Item removed from cart.', 'Cart Updated');
        }
      } catch (err) {
        setCart(previousCart);
        notify.error(err?.message || 'Failed to remove item.', 'Cart Error');
      } finally {
        setPendingItems((prev) => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
        setIsUpdating(false);
      }
    },
    [cart, findCartItem, sessionKey, pendingItems, notify]
  );

  /**
   * Empties active cart.
   */
  const clearCart = useCallback(async () => {
    setIsUpdating(true);
    const previousCart = { ...cart };
    setCart((prev) => ({ ...prev, items: [], totalItems: 0, subtotal: 0 }));

    try {
      const res = await cartApi.clearCart(sessionKey);
      if (res?.success && res.data) {
        setCart(res.data);
        notify.info('Shopping cart cleared.', 'Cart Cleared');
      }
    } catch (err) {
      setCart(previousCart);
      notify.error(err?.message || 'Failed to clear cart.', 'Cart Error');
    } finally {
      setIsUpdating(false);
    }
  }, [cart, sessionKey, notify]);

  const isItemUpdating = useCallback(
    (identifier) => {
      return (
        pendingItems.has(`update_${identifier}`) ||
        pendingItems.has(`remove_${identifier}`) ||
        pendingItems.has(`add_${identifier}`)
      );
    },
    [pendingItems]
  );

  const value = {
    cart,
    items: cart.items,
    totalItems: cart.totalItems,
    subtotal: cart.subtotal,
    sessionKey,
    isLoading,
    isUpdating,
    isItemUpdating,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    refreshCart: () => loadCart(sessionKey),
    isCartOpen,
    setIsCartOpen,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
