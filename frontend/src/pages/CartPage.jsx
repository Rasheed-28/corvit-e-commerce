import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { PriceDisplay } from '../components/common/PriceDisplay';
import { QuantityPicker } from '../components/common/QuantityPicker';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { EmptyState } from '../components/common/EmptyState';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import { ordersApi } from '../api/ordersApi';

export const CartPage = () => {
  const { items, totalItems, subtotal, updateQuantity, removeItem, clearCart, isItemUpdating } = useCart();
  const { notify } = useNotification();

  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0); // in dollars
  const [couponSuccess, setCouponSuccess] = useState(null);

  const FREE_SHIPPING_THRESHOLD = 50.00;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingCost = isFreeShipping || subtotal === 0 ? 0.00 : 9.99;
  const estimatedTax = subtotal * 0.08; // 8% estimated sales tax
  const orderTotal = Math.max(0, subtotal + shippingCost + estimatedTax - appliedDiscount);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    const code = couponCode.trim().toUpperCase();
    try {
      const res = await ordersApi.validateCoupon(code, subtotal);
      if (res?.success && res.data) {
        const discountVal = parseFloat(res.data.discount_amount || 0);
        setAppliedDiscount(discountVal);
        setCouponSuccess(`Coupon "${res.data.code}" applied (-$${discountVal.toFixed(2)})`);
        notify.success('Coupon applied successfully!', 'Coupon Applied');
        return;
      }
    } catch {
      // Fallback local promo codes
      if (code === 'SAVE10' || code === 'NOVA10') {
        const discountVal = subtotal * 0.10;
        setAppliedDiscount(discountVal);
        setCouponSuccess(`Coupon "${code}" applied (-10% off)`);
        notify.success(`10% discount applied to your order!`, 'Coupon Applied');
      } else if (code === 'FREESHIP') {
        setAppliedDiscount(shippingCost);
        setCouponSuccess(`Free shipping unlocked!`);
        notify.success('Free shipping coupon applied.', 'Coupon Applied');
      } else {
        notify.error('Invalid or expired promotional code.', 'Coupon Error');
        setCouponSuccess(null);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Shopping Cart' }]} />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Checkout Bag
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">
              {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
            Shopping Cart
          </h1>
        </div>

        {totalItems > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-gray-500 hover:text-red-600 self-start sm:self-auto"
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Empty Cart
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-10 h-10 text-gray-400" />}
          title="Your Shopping Cart is Empty"
          description="You haven't added any items to your bag yet. Explore our curated collections to find handcrafted acoustic and workspace pieces."
          action={
            <Link to="/products">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Explore Full Catalog
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items List (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Free Shipping Progress */}
            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    {isFreeShipping
                      ? 'You qualify for Free Express Courier Shipping!'
                      : `Add $${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} more for Free Shipping`}
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Orders over $50 receive tracked doorstep courier delivery at zero charge.
                  </p>
                </div>
              </div>
            </div>

            {/* Cart Table */}
            <div className="bg-white rounded-3xl border border-gray-200 divide-y divide-gray-100 shadow-xs overflow-hidden">
              {items.map((item) => (
                <div
                  key={`${item.id}-${item.selectedVariant || 'def'}`}
                  className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-gray-900 leading-snug">
                        <Link to={`/products/${item.slug || item.id}`} className="hover:text-emerald-700">
                          {item.title}
                        </Link>
                      </h3>
                      {item.selectedVariant && (
                        <p className="text-xs text-gray-500 mt-1">
                          Option: <span className="font-semibold text-gray-700">{item.selectedVariant}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Unit Price: ${(item.price).toFixed(2)}
                      </p>
                      {item.availableStock > 0 && item.availableStock <= 5 && (
                        <p className="text-xs text-amber-600 font-semibold mt-1">
                          Only {item.availableStock} left in stock!
                        </p>
                      )}
                      {item.availableStock && item.quantity > item.availableStock && (
                        <p className="text-xs text-rose-600 font-bold mt-1">
                          Reduced stock: only {item.availableStock} available
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                    <QuantityPicker
                      value={item.quantity}
                      onChange={(qty) => updateQuantity(item.id, qty, item.selectedVariant)}
                      min={1}
                      max={item.maxStock || 10}
                      disabled={isItemUpdating ? isItemUpdating(item.id) : false}
                      size="sm"
                    />

                    <div className="text-right min-w-[80px]">
                      <span className="font-bold text-gray-950 text-base">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.selectedVariant)}
                      disabled={isItemUpdating ? isItemUpdating(item.id) : false}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Back link */}
            <div className="flex justify-between items-center text-xs">
              <Link to="/products" className="font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5">
                ← Continue Shopping
              </Link>
            </div>
          </div>

          {/* Order Summary (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
              <h3 className="text-lg font-bold text-gray-950 pb-3 border-b border-gray-100">
                Order Summary
              </h3>

              {/* Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalItems} items)</span>
                  <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Estimated Shipping</span>
                  <span className="font-medium text-gray-900">
                    {shippingCost === 0 ? (
                      <span className="text-emerald-600 font-bold uppercase text-xs">Free</span>
                    ) : (
                      `$${shippingCost.toFixed(2)}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Estimated Sales Tax (8%)</span>
                  <span className="font-medium text-gray-900">${estimatedTax.toFixed(2)}</span>
                </div>

                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount Applied</span>
                    <span>-${appliedDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-black text-gray-950">${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Coupon Code Form */}
              <form onSubmit={handleApplyCoupon} className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Coupon code (e.g. SAVE10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="text-xs"
                  />
                  <Button type="submit" variant="outline" size="md">
                    Apply
                  </Button>
                </div>
                {couponSuccess && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{couponSuccess}</span>
                  </p>
                )}
              </form>

              {/* Checkout Button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  alert('Proceeding to checkout flow! (Full checkout processing will be connected in milestone 3).');
                }}
                leftIcon={<ShieldCheck className="w-5 h-5" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Checkout
              </Button>

              {/* Trust markers */}
              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>256-bit bank-grade SSL secure checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span>30-day money-back guarantee with easy returns</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
