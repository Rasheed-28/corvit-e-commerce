import React from 'react';
import { Drawer } from '../common/Drawer';
import { useCart } from '../../contexts/CartContext';
import { Button } from '../common/Button';
import { QuantityPicker } from '../common/QuantityPicker';
import { PriceDisplay } from '../common/PriceDisplay';
import { EmptyState } from '../common/EmptyState';
import { Trash2, ShoppingBag, ShieldCheck, ArrowRight, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Slide-over Cart Drawer with interactive item management and shipping progress.
 */
export const CartDrawer = () => {
  const {
    items,
    totalItems,
    subtotal,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
  } = useCart();

  const FREE_SHIPPING_THRESHOLD = 100.00;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  return (
    <Drawer
      isOpen={isCartOpen}
      onClose={closeCart}
      title={
        <span className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-emerald-600" />
          <span>Shopping Cart</span>
          {totalItems > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
              {totalItems}
            </span>
          )}
        </span>
      }
      subtitle={totalItems > 0 ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'} in your bag` : undefined}
      size="md"
      footer={
        items.length > 0 ? (
          <div className="space-y-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-gray-700">Subtotal</span>
              <PriceDisplay price={subtotal} size="md" showBadge={false} />
            </div>

            <p className="text-xs text-gray-500">
              Shipping, taxes, and promotional discount codes calculated during checkout.
            </p>

            {/* Checkout Action Button */}
            <div className="space-y-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  alert('Checkout flow will be enabled in the upcoming Checkout milestone!');
                }}
                leftIcon={<ShieldCheck className="w-5 h-5" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Checkout
              </Button>

              <button
                type="button"
                onClick={closeCart}
                className="w-full text-center text-xs text-gray-600 hover:text-emerald-700 font-medium py-1.5 transition-colors"
              >
                or Continue Shopping
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-gray-400" />}
          title="Your cart is currently empty"
          description="Looks like you haven't added anything to your cart yet. Explore our curated catalog to get started."
          action={
            <Button
              variant="primary"
              size="md"
              onClick={closeCart}
            >
              Start Shopping
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Free Shipping Progress Indicator */}
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                {amountToFreeShipping === 0 ? (
                  <span>Congratulations! You qualify for <strong>FREE Express Shipping</strong></span>
                ) : (
                  <span>
                    Add <strong>${amountToFreeShipping.toFixed(2)}</strong> more to get <strong>FREE Shipping</strong>
                  </span>
                )}
              </span>
              <span>{freeShippingProgress}%</span>
            </div>

            <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Item Cards */}
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.selectedVariant || 'default'}`}
                className="py-4 first:pt-0 last:pb-0 flex gap-4 items-start"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                      {item.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.selectedVariant)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      aria-label={`Remove ${item.title} from cart`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.selectedVariant && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Color: <span className="font-medium text-gray-700">{item.selectedVariant}</span>
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <QuantityPicker
                      size="sm"
                      value={item.quantity}
                      onChange={(qty) => updateQuantity(item.id, qty, item.selectedVariant)}
                      min={1}
                      max={item.maxStock || 10}
                    />

                    <PriceDisplay
                      price={item.price * item.quantity}
                      size="sm"
                      showBadge={false}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
};
