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
import { ordersApi } from '../api/ordersApi';

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
              <p className="font-semibold text-gray-900">{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.street}</p>
              <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
