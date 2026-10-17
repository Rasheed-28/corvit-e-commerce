import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { PriceDisplay } from '../components/common/PriceDisplay';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import { mockOrdersApi } from '../api/mockAdapter';

export const OrderDetailPage = () => {
  const { orderNumber } = useParams();
  const { addItem, openCart } = useCart();
  const { notify } = useNotification();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);

    mockOrdersApi.getOrder(orderNumber)
      .then((res) => {
        if (res?.success) setOrder(res.data);
      })
      .catch((err) => {
        console.error(err);
        setNotFound(true);
      })
      .finally(() => setIsLoading(false));
  }, [orderNumber]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'My Account', to: '/account' },
          { label: 'Order History', to: '/account/orders' },
          { label: order.orderNumber },
        ]}
      />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
              Order #{order.orderNumber}
            </h1>
            <Badge variant="success" size="md" dot>{order.status}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Placed on {order.date} · {order.items.length} items · Total: ${order.financials.total.toFixed(2)}
          </p>
        </div>

        <div className="flex gap-2">
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
                    step.completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-300'
                  }`}
                >
                  {step.completed ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </div>
                <span className={`text-xs font-bold ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.status}
                </span>
              </div>
              <span className="text-[11px] text-gray-500 pl-10 sm:pl-0 sm:mt-1">
                {step.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Items & Financials Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Purchased Items Table (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
          <h3 className="font-bold text-gray-900 text-base">Purchased Items</h3>

          <div className="divide-y divide-gray-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-16 h-16 rounded-xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">
                      {item.title}
                    </h4>
                    {item.variant && (
                      <p className="text-xs text-gray-500 mt-0.5">Option: {item.variant}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Qty: {item.quantity} × ${(item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-950 text-sm">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </span>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      addItem(item, 1, item.variant);
                      notify.success(`Added "${item.title}" back into your bag.`, 'Reordered');
                      openCart();
                    }}
                  >
                    Buy Again
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Breakdown & Address (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Financial Breakdown */}
          <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100">
              Payment Summary
            </h3>

            <div className="space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">${order.financials.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-medium text-emerald-600">
                  {order.financials.shipping === 0 ? 'FREE' : `$${order.financials.shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax</span>
                <span className="font-medium text-gray-900">${order.financials.tax.toFixed(2)}</span>
              </div>
              {order.financials.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span>-${order.financials.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline text-sm font-bold text-gray-900">
                <span>Total Paid</span>
                <span className="text-xl font-black text-gray-950">${order.financials.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Info */}
          <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Shipping Destination
              </h4>
              <p className="font-semibold text-gray-800">{order.shippingAddress.fullName}</p>
              <p className="text-gray-500">{order.shippingAddress.street}</p>
              <p className="text-gray-500">{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                Payment Method
              </h4>
              <p className="text-gray-600">
                {order.paymentMethod.type} ending in <span className="font-mono font-bold text-gray-900">*{order.paymentMethod.last4}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
