import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useNotification } from './NotificationContext';

const CartContext = createContext(null);
const STORAGE_KEY = 'novastore_cart';

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { notify } = useNotification();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items]);

  const addItem = useCallback((product, quantity = 1, selectedVariant = null) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.id === product.id && item.selectedVariant === selectedVariant
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: product.maxStock ? Math.min(newQty, product.maxStock) : newQty,
        };
        return updated;
      }

      return [
        ...prevItems,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image || (product.images && product.images[0]) || '',
          quantity,
          selectedVariant: selectedVariant || product.selectedVariant || null,
          maxStock: product.maxStock || product.stock || 10,
        },
      ];
    });

    notify.success(`Added "${product.title}" to your cart.`, 'Item Added');
  }, [notify]);

  const removeItem = useCallback((id, selectedVariant = null) => {
    setItems((prev) =>
      prev.filter((item) => !(item.id === id && item.selectedVariant === selectedVariant))
    );
    notify.info('Item removed from cart.', 'Cart Updated');
  }, [notify]);

  const updateQuantity = useCallback((id, quantity, selectedVariant = null) => {
    if (quantity <= 0) {
      removeItem(id, selectedVariant);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.selectedVariant === selectedVariant) {
          const clampedQty = item.maxStock ? Math.min(quantity, item.maxStock) : quantity;
          return { ...item, quantity: clampedQty };
        }
        return item;
      })
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const value = {
    items,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
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
