import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  Package,
  Calendar,
  Truck,
  CreditCard,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Printer,
  RotateCcw,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Select } from '../components/common/Select';
import { EmptyState } from '../components/common/EmptyState';
import { AlertBanner } from '../components/common/AlertBanner';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../contexts/NotificationContext';
import { ordersApi } from '../api/ordersApi';

export const OrderDetailPage = ({ isConfirmation = false }) => {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { notify } = useNotification();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonCategory, setCancelReasonCategory] = useState('Found a better price elsewhere');
  const [cancelCustomNotes, setCancelCustomNotes] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Check if confirmation query or path was passed
  const showConfirmationBanner =
    isConfirmation ||
    location.pathname.includes('/checkout/success') ||
    location.search.includes('confirmed=true');

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);

    ordersApi
      .getOrder(orderNumber)
      .then((res) => {
        if (res?.success && res.data) {
          setOrder(res.data);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load order details:', err);
        setNotFound(true);
      })
      .finally(() => setIsLoading(false));
  }, [orderNumber]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setIsCancelling(true);

    const fullReason = cancelCustomNotes.trim()
      ? `${cancelReasonCategory}: ${cancelCustomNotes.trim()}`
      : cancelReasonCategory;

    try {
      const res = await ordersApi.cancelOrder(order.orderNumber, fullReason);
      if (res?.success && res.data) {
        setOrder((prev) => ({
          ...prev,
          status: 'Cancelled',
          can_cancel: false,
          cancellation_reason: fullReason,
          timeline: [
            ...prev.timeline,
            {
              title: 'Order Cancelled',
              date: new Date().toLocaleDateString(),
              completed: true,
            },
          ],
        }));
        notify.success('Order has been cancelled and inventory restored.', 'Order Cancelled');
        setIsCancelModalOpen(false);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Unable to cancel this order.';
      notify.error(msg, 'Cancellation Error');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status = '') => {
    const s = String(status).toLowerCase();
    switch (s) {
      case 'delivered':
        return <Badge variant="success" size="md" dot>Delivered</Badge>;
      case 'shipped':
        return <Badge variant="info" size="md" dot>In Transit</Badge>;
      case 'processing':
        return <Badge variant="warning" size="md" dot>Processing</Badge>;
      case 'paid':
        return <Badge variant="success" size="md" dot>Payment Confirmed</Badge>;
      case 'cancelled':
        return <Badge variant="danger" size="md" dot>Cancelled</Badge>;
      case 'pending':
      case 'pending payment':
        return <Badge variant="warning" size="md" dot>Pending Payment</Badge>;
      default:
        return <Badge variant="neutral" size="md">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-48 skeleton-shimmer bg-gray-200 rounded" />
        <div className="h-64 skeleton-shimmer bg-gray-200 rounded-3xl" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon={<Package className="w-10 h-10 text-gray-400" />}
          title="Order Not Found"
          description={`Order #${orderNumber} could not be found or you may not have authorization to view it.`}
          action={
            <Link to="/account/orders">
              <Button variant="primary" size="md">
                Back to Order History
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isCancelled = String(order.status).toLowerCase() === 'cancelled';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'My Account', to: '/account' },
          { label: 'Order History', to: '/account/orders' },
          { label: `#${order.orderNumber}` },
        ]}
      />

      {/* Confirmation Banner for fresh purchases */}
      {showConfirmationBanner && !isCancelled && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-emerald-950">
                Order Confirmed! Thank you for your purchase.
              </h2>
              <p className="text-xs text-emerald-800 mt-1 max-w-xl">
                We have verified your order #{order.orderNumber}. Inventory has been allocated, and we are preparing your items for packaging and courier pickup.
              </p>
            </div>
          </div>

          <Link to="/products">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              Continue Shopping
            </Button>
          </Link>
        </div>
      )}

      {/* Cancellation Notice Banner */}
      {isCancelled && (
        <AlertBanner
          variant="danger"
          title="Order Cancelled"
        >
          This order was cancelled. Reserved inventory has been restored to the catalog.
          {order.cancellation_reason && (
            <span className="block mt-1 font-semibold text-rose-900">
              Reason: {order.cancellation_reason}
            </span>
          )}
        </AlertBanner>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
              Order #{order.orderNumber}
            </h1>
            {getStatusBadge(order.status)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Placed on {order.date} · {order.items.length} items · Total: ${order.financials.total.toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Order Cancellation Action Button */}
          {order.can_cancel && !isCancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
              leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}
            >
              Cancel Order
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Invoice
          </Button>

          <Link to="/account/orders">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Order Tracking Timeline */}
      <div className="p-6 sm:p-8 bg-white rounded-3xl border border-gray-200 shadow-xs space-y-6">
        <h3 className="font-bold text-gray-900 text-base">Delivery Progress & Timeline</h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
          {order.timeline.map((step, idx) => (
            <div key={idx} className="relative flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCancelled
                      ? 'bg-rose-100 text-rose-600 border border-rose-200'
                      : step.completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-300'
                  }`}
                >
                  {isCancelled ? (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  ) : step.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-xs font-bold ${
                    isCancelled
                      ? 'text-rose-700'
                      : step.completed
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              <span className="text-[11px] text-gray-500 pl-10 sm:pl-0 sm:mt-1">
                {step.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Order Items & Financials Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Items List (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
          <h3 className="font-bold text-gray-900 text-base">Ordered Pieces</h3>

          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                    {item.variant && (
                      <span className="text-xs text-gray-500 block">Variant: {item.variant}</span>
                    )}
                    <span className="text-xs text-gray-400">Qty: {item.quantity}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {order.customer_notes && (
            <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Delivery Notes:</span>{' '}
              {order.customer_notes}
            </div>
          )}
        </div>

        {/* Cost Summary & Address (1 col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Payment & Totals</h3>

            <div className="space-y-2 text-xs text-gray-600 border-b border-gray-100 pb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">${order.financials.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-gray-900">
                  {order.financials.shipping === 0 ? 'FREE' : `$${order.financials.shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-semibold text-gray-900">${order.financials.tax.toFixed(2)}</span>
              </div>
              {order.financials.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-${order.financials.discount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-sm font-bold text-gray-900">Order Total</span>
              <span className="text-xl font-black text-emerald-700">
                ${order.financials.total.toFixed(2)}
              </span>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>{order.paymentMethod}</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-gray-900 text-sm">Shipping Destination</h3>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <p className="font-semibold text-gray-900">
                {order.shippingAddress.full_name || order.shippingAddress.name}
              </p>
              <p>
                {order.shippingAddress.street_address_1 || order.shippingAddress.street}
              </p>
              {(order.shippingAddress.street_address_2 || order.shippingAddress.street2) && (
                <p>
                  {order.shippingAddress.street_address_2 || order.shippingAddress.street2}
                </p>
              )}
              <p>
                {order.shippingAddress.city},{' '}
                {order.shippingAddress.state_or_province || order.shippingAddress.state}{' '}
                {order.shippingAddress.postal_code || order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Order Confirmation"
        size="md"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Keep Order
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isCancelling}
              onClick={handleCancelOrder}
            >
              Confirm Cancellation
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Are you sure you want to cancel order <strong>#{order.orderNumber}</strong>?
          </p>
          <p className="text-xs text-gray-500 bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900">
            Cancelling this order will release all allocated items back into the catalog stock and void pending payment authorizations.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 block">
              Please tell us why you are cancelling:
            </label>
            <select
              value={cancelReasonCategory}
              onChange={(e) => setCancelReasonCategory(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Found a better price elsewhere">Found a better price elsewhere</option>
              <option value="Order placed by mistake">Order placed by mistake</option>
              <option value="Shipping time too long">Shipping time too long</option>
              <option value="Decided not to purchase">Decided not to purchase</option>
              <option value="Other reason">Other reason</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 block">
              Additional Details (Optional):
            </label>
            <textarea
              rows={2}
              placeholder="Provide any feedback..."
              value={cancelCustomNotes}
              onChange={(e) => setCancelCustomNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetailPage;
