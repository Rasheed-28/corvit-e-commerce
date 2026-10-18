import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CreditCard,
  Truck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  ShoppingBag,
  RotateCcw,
  Lock,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Checkbox } from '../components/common/Checkbox';
import { EmptyState } from '../components/common/EmptyState';
import { AlertBanner } from '../components/common/AlertBanner';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { ordersApi } from '../api/ordersApi';
import authApi from '../api/authApi';

function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { items, totalItems, subtotal: cartSubtotal, clearCart, refreshCart } = useCart();
  const { notify } = useNotification();

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    fullName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    phone: user?.customer_profile?.phone_number || '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    saveToAddressBook: true,
  });

  // Customer Notes & Coupon
  const [customerNotes, setCustomerNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Server Preview Financials
  const [previewTotals, setPreviewTotals] = useState({
    subtotal: cartSubtotal,
    shippingFee: cartSubtotal >= 50 ? 0 : 9.99,
    taxAmount: cartSubtotal * 0.08,
    discountAmount: 0,
    totalAmount: cartSubtotal + (cartSubtotal >= 50 ? 0 : 9.99) + cartSubtotal * 0.08,
  });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [cardData, setCardData] = useState({
    nameOnCard: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Jane Doe' : 'Jane Doe',
    cardNumber: '4242 •••• •••• 4242',
    rawCardNumber: '4242424242424242',
    expiry: '12/28',
    cvv: '123',
  });
  const [simulateDecline, setSimulateDecline] = useState(false);

  // Submission State
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [existingOrderNumber, setExistingOrderNumber] = useState(null);

  // Fetch saved addresses on mount if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingAddresses(true);
    authApi
      .getAddresses()
      .then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setSavedAddresses(res.data);
          const defaultAddr = res.data.find((a) => a.isDefault) || res.data[0];
          setSelectedAddressId(defaultAddr.id);
          setUseNewAddress(false);
        } else {
          setSavedAddresses([]);
          setUseNewAddress(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load customer addresses:', err);
        setUseNewAddress(true);
      })
      .finally(() => setIsLoadingAddresses(false));
  }, [isAuthenticated]);

  // Sync new address name with user if loaded later
  useEffect(() => {
    if (user && !newAddress.fullName) {
      setNewAddress((prev) => ({
        ...prev,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        phone: prev.phone || user.customer_profile?.phone_number || '',
      }));
    }
  }, [user]);

  // Recalculate server order preview whenever coupon or address changes
  const fetchPreview = useCallback(async (codeToUse = appliedCoupon) => {
    if (!isAuthenticated || items.length === 0) return;
    setIsPreviewLoading(true);

    try {
      const payload = {
        coupon_code: codeToUse || '',
      };
      if (!useNewAddress && selectedAddressId) {
        payload.shipping_address_id = selectedAddressId;
      }

      const res = await ordersApi.previewOrder(payload);
      if (res?.success && res.data) {
        setPreviewTotals({
          subtotal: parseFloat(res.data.subtotal || 0),
          shippingFee: parseFloat(res.data.shipping_fee || 0),
          taxAmount: parseFloat(res.data.tax_amount || 0),
          discountAmount: parseFloat(res.data.discount_amount || 0),
          totalAmount: parseFloat(res.data.total_amount || 0),
        });
      }
    } catch (err) {
      console.warn('Order preview calculation error:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [isAuthenticated, items.length, useNewAddress, selectedAddressId, appliedCoupon]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Handle Coupon Application
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    setCouponMessage(null);
    setErrorMessage(null);

    try {
      const res = await ordersApi.validateCoupon(couponCode.trim(), cartSubtotal);
      if (res?.success && res.data) {
        const discount = parseFloat(res.data.discount_amount || 0);
        setAppliedCoupon(res.data.code);
        setCouponDiscount(discount);
        setCouponMessage({
          type: 'success',
          text: `Coupon "${res.data.code}" applied: $${discount.toFixed(2)} savings!`,
        });
        await fetchPreview(res.data.code);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Invalid or expired coupon code.';
      setCouponMessage({ type: 'error', text: msg });
      setAppliedCoupon('');
      setCouponDiscount(0);
      await fetchPreview('');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon('');
    setCouponCode('');
    setCouponDiscount(0);
    setCouponMessage(null);
    await fetchPreview('');
  };

  // Form Validation
  const validateAddress = () => {
    if (!useNewAddress) {
      if (!selectedAddressId) {
        setErrorMessage('Please select a saved shipping address or provide a new delivery address.');
        return false;
      }
      return true;
    }

    if (!newAddress.fullName.trim()) {
      setErrorMessage('Full recipient name is required for shipping.');
      return false;
    }
    if (!newAddress.street1.trim()) {
      setErrorMessage('Street address is required.');
      return false;
    }
    if (!newAddress.city.trim()) {
      setErrorMessage('City is required.');
      return false;
    }
    if (!newAddress.state.trim()) {
      setErrorMessage('State or province is required.');
      return false;
    }
    if (!newAddress.postalCode.trim()) {
      setErrorMessage('Postal code is required.');
      return false;
    }
    return true;
  };

  // Place Order Submission
  const handlePlaceOrder = async () => {
    setErrorMessage(null);

    if (!validateAddress()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      let orderNumber = existingOrderNumber;

      // Step 1: Create Order if not already created (or retry)
      if (!orderNumber) {
        const checkoutPayload = {
          idempotency_key: idempotencyKey,
          coupon_code: appliedCoupon || '',
          customer_notes: customerNotes.trim(),
          payment_method: paymentMethod,
        };

        if (!useNewAddress && selectedAddressId) {
          checkoutPayload.shipping_address_id = selectedAddressId;
        } else {
          checkoutPayload.shipping_address = {
            full_name: newAddress.fullName.trim(),
            phone_number: newAddress.phone.trim(),
            street_address_1: newAddress.street1.trim(),
            street_address_2: newAddress.street2.trim(),
            city: newAddress.city.trim(),
            state_or_province: newAddress.state.trim(),
            postal_code: newAddress.postalCode.trim(),
            country: newAddress.country.trim() || 'United States',
            save_to_address_book: Boolean(newAddress.saveToAddressBook),
          };
        }

        const orderRes = await ordersApi.createOrder(checkoutPayload);
        if (!orderRes?.success || !orderRes.data?.order_number) {
          throw new Error(orderRes?.error?.message || 'Failed to initialize order.');
        }

        orderNumber = orderRes.data.order_number;
        setExistingOrderNumber(orderNumber);
      }

      // Step 2: Process Payment (unless Cash on Delivery)
      if (paymentMethod === 'CASH_ON_DELIVERY') {
        clearCart();
        notify.success(`Order #${orderNumber} placed successfully!`, 'Order Confirmed');
        navigate(`/checkout/success/${orderNumber}`);
        return;
      }

      // Card/Stripe/PayPal Payment Execution
      const cardNumToSubmit = simulateDecline
        ? '4242424242420002'
        : cardData.rawCardNumber || '4242424242424242';

      try {
        const paymentRes = await ordersApi.processPayment(orderNumber, {
          payment_method: paymentMethod,
          card_number: cardNumToSubmit,
          simulate_failure: simulateDecline,
        });

        if (paymentRes?.success) {
          clearCart();
          notify.success(`Payment verified and Order #${orderNumber} confirmed!`, 'Order Placed');
          navigate(`/checkout/success/${orderNumber}`);
        } else {
          throw new Error('Payment processing could not be completed.');
        }
      } catch (payErr) {
        // Backend declined payment or failed validation
        const declineMsg =
          payErr.response?.data?.error?.details?.payment ||
          payErr.response?.data?.error?.message ||
          payErr.message ||
          'Your card was declined by the bank. Please try another card.';

        setErrorMessage(
          `Payment Authorization Failed: ${declineMsg}. Your order #${orderNumber} has been created and remains pending payment. You may enter new payment details and retry.`
        );
        notify.error(declineMsg, 'Payment Declined');
        // Do not clear order number so user can retry payment without creating duplicate order
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const serverMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred during checkout. Please review your cart and retry.';
      setErrorMessage(serverMsg);
      notify.error(serverMsg, 'Checkout Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth Guard
  if (isAuthLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-500">Securing checkout session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon={<Lock className="w-12 h-12 text-emerald-600" />}
          title="Sign in to Checkout"
          description="To safeguard your personal address details, apply member coupons, and securely process payments, please sign in or register an account."
          action={
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login?redirect=/checkout">
                <Button variant="primary" size="md">
                  Sign In to Continue
                </Button>
              </Link>
              <Link to="/register?redirect=/checkout">
                <Button variant="outline" size="md">
                  Create New Account
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  // Empty Cart Guard
  if (items.length === 0 && !existingOrderNumber) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon={<ShoppingBag className="w-12 h-12 text-gray-400" />}
          title="Your Shopping Cart is Empty"
          description="You don't have any items ready for checkout. Browse our collection to add design pieces to your cart."
          action={
            <Link to="/products">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Explore Full Catalog
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Cart', to: '/cart' },
          { label: 'Checkout' },
        ]}
      />

      {/* Header */}
      <div className="border-b border-gray-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-950 flex items-center gap-3">
            <span>Secure Checkout</span>
            <Badge variant="success" size="sm" dot>SSL 256-Bit</Badge>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review items, select your delivery address, and confirm payment details.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Server-verified pricing & stock guarantee</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <AlertBanner
          variant="danger"
          title="Action Required"
          onDismiss={() => setErrorMessage(null)}
        >
          {errorMessage}
        </AlertBanner>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Checkout Steps (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Step 1: Shipping Address */}
          <section className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-bold text-gray-950">Shipping Destination</h2>
              </div>

              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseNewAddress(!useNewAddress)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
                >
                  {useNewAddress ? 'Use Saved Address' : '+ Add New Address'}
                </button>
              )}
            </div>

            {/* Saved Addresses List */}
            {!useNewAddress && savedAddresses.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-600">Select delivery address:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            {addr.label || 'Home'}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] uppercase font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-900 mt-2">{addr.recipientName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{addr.streetAddress}</p>
                        {addr.streetAddress2 && (
                          <p className="text-xs text-gray-500">{addr.streetAddress2}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {addr.city}, {addr.state} {addr.postalCode}
                        </p>
                        {addr.phone && (
                          <p className="text-xs text-gray-400 mt-1">📞 {addr.phone}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* New Address Input Form */}
            {(useNewAddress || savedAddresses.length === 0) && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Recipient Full Name"
                    required
                    placeholder="Jane Doe"
                    value={newAddress.fullName}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, fullName: e.target.value })
                    }
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+1 (555) 019-2834"
                    value={newAddress.phone}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, phone: e.target.value })
                    }
                  />
                </div>

                <Input
                  label="Street Address"
                  required
                  placeholder="123 Artisan Way"
                  value={newAddress.street1}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, street1: e.target.value })
                  }
                />

                <Input
                  label="Apartment, Suite, Unit (Optional)"
                  placeholder="Apt 4B"
                  value={newAddress.street2}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, street2: e.target.value })
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    required
                    placeholder="San Francisco"
                    value={newAddress.city}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, city: e.target.value })
                    }
                  />
                  <Input
                    label="State / Province"
                    required
                    placeholder="California"
                    value={newAddress.state}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, state: e.target.value })
                    }
                  />
                  <Input
                    label="Postal Code"
                    required
                    placeholder="94103"
                    value={newAddress.postalCode}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, postalCode: e.target.value })
                    }
                  />
                </div>

                <div className="pt-2">
                  <Checkbox
                    id="save_addr_book"
                    label="Save this address to my account address book for future orders"
                    checked={newAddress.saveToAddressBook}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        saveToAddressBook: e.target.checked,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Payment Method */}
          <section className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h2 className="text-lg font-bold text-gray-950">Payment Method</h2>
            </div>

            {/* Payment Method Selector Radio Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
                { id: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
                { id: 'STRIPE', label: 'Stripe Pay', icon: ShieldCheck },
                { id: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: Truck },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                const IconComponent = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 ${
                        isSelected ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Card Inputs Form */}
            {paymentMethod !== 'CASH_ON_DELIVERY' && (
              <div className="space-y-4 pt-2">
                <Input
                  label="Name on Card"
                  placeholder="Jane Doe"
                  value={cardData.nameOnCard}
                  onChange={(e) =>
                    setCardData({ ...cardData, nameOnCard: e.target.value })
                  }
                />

                <Input
                  label="Card Number"
                  placeholder="4242 4242 4242 4242"
                  value={cardData.rawCardNumber}
                  onChange={(e) =>
                    setCardData({ ...cardData, rawCardNumber: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Expiration Date"
                    placeholder="MM/YY"
                    value={cardData.expiry}
                    onChange={(e) =>
                      setCardData({ ...cardData, expiry: e.target.value })
                    }
                  />
                  <Input
                    label="Security Code (CVV)"
                    placeholder="123"
                    value={cardData.cvv}
                    onChange={(e) =>
                      setCardData({ ...cardData, cvv: e.target.value })
                    }
                  />
                </div>

                {/* Developer Simulation Toggle */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-amber-900">
                      Payment Verification Simulation
                    </span>
                  </div>
                  <Checkbox
                    id="simulate_card_decline"
                    label="Simulate Card Decline (Tests server-side transaction rejection & non-paid order persistence)"
                    checked={simulateDecline}
                    onChange={(e) => setSimulateDecline(e.target.checked)}
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'CASH_ON_DELIVERY' && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 space-y-1">
                <p className="font-bold text-gray-900">Pay on Courier Arrival</p>
                <p>
                  You will pay the courier in cash when your package is delivered to your doorstep. Please ensure exact change is available.
                </p>
              </div>
            )}
          </section>

          {/* Step 3: Customer Instructions / Order Notes */}
          <section className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900">Delivery Notes (Optional)</h3>
            <textarea
              rows={2}
              placeholder="e.g. Leave package by side porch or call gate code #4410 upon delivery"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </section>
        </div>

        {/* Right Column: Order Review & Live Totals (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6 sticky top-24">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">Order Summary</h3>
              <span className="text-xs font-semibold text-gray-500">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Ordered Items Preview */}
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={`${item.id}-${item.selectedVariant || 'def'}`}
                  className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {item.title}
                      </p>
                      {item.selectedVariant && (
                        <p className="text-[11px] text-gray-400">
                          {item.selectedVariant}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400">Qty: {item.quantity}</p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <Input
                  placeholder="Coupon code (e.g. SAVE10)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="text-xs"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="md"
                  isLoading={isApplyingCoupon}
                >
                  Apply
                </Button>
              </form>

              {couponMessage && (
                <div
                  className={`text-xs p-2 rounded-xl flex items-center justify-between ${
                    couponMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <span>{couponMessage.text}</span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-rose-600 hover:underline ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Server Financials Breakdown */}
            <div className="space-y-3 text-xs text-gray-600 pt-2 border-t border-gray-100">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ${previewTotals.subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <span>Shipping</span>
                  {previewTotals.shippingFee === 0 && (
                    <Badge variant="success" size="sm">Free</Badge>
                  )}
                </span>
                <span className="font-semibold text-gray-900">
                  {previewTotals.shippingFee === 0
                    ? '$0.00'
                    : `$${previewTotals.shippingFee.toFixed(2)}`}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Estimated Sales Tax (8%)</span>
                <span className="font-semibold text-gray-900">
                  ${previewTotals.taxAmount.toFixed(2)}
                </span>
              </div>

              {previewTotals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span>-${previewTotals.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900">Final Total</span>
                <span className="text-2xl font-black text-gray-950">
                  ${previewTotals.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Place Order Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              disabled={isSubmitting || items.length === 0}
              onClick={handlePlaceOrder}
              leftIcon={<ShieldCheck className="w-5 h-5" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting
                ? 'Processing Order...'
                : existingOrderNumber
                ? `Retry Payment for #${existingOrderNumber}`
                : `Confirm & Pay $${previewTotals.totalAmount.toFixed(2)}`}
            </Button>

            {/* Trust and Guarantee Badges */}
            <div className="pt-2 space-y-2 text-[11px] text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted 256-bit secure checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Easy 30-day returns and inventory protection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
