import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Calendar,
  DollarSign,
  ChevronRight,
  Truck,
  CheckCircle2,
  Clock,
  User,
  MapPin,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { AlertBanner } from '../components/common/AlertBanner';
import { ordersApi } from '../api/ordersApi';

export const OrderHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    ordersApi
      .getOrders()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setOrders(res.data);
        } else {
          setOrders([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load orders:', err);
        setErrorMessage(err.message || 'Unable to retrieve your order history.');
        setOrders([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getStatusBadge = (status = '') => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return <Badge variant="success" size="sm" dot>Delivered</Badge>;
      case 'shipped':
        return <Badge variant="info" size="sm" dot>In Transit</Badge>;
      case 'processing':
        return <Badge variant="warning" size="sm" dot>Processing</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'My Account', to: '/account' },
          { label: 'Order History' },
        ]}
      />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
          Order History
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Review previous shipments, download digital invoices, and track live deliveries
        </p>
      </div>

      {/* Account Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <Link
          to="/account"
          className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <User className="w-4 h-4" />
          <span>Profile Info</span>
        </Link>
        <Link
          to="/account/addresses"
          className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          <span>Address Book</span>
        </Link>
        <Link
          to="/account/orders"
          className="pb-3 text-emerald-700 border-b-2 border-emerald-600 flex items-center gap-2"
        >
          <Package className="w-4 h-4" />
          <span>Order History</span>
        </Link>
      </div>

      {errorMessage && (
        <AlertBanner variant="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </AlertBanner>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 skeleton-shimmer bg-gray-100 rounded-3xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-gray-400" />}
          title="No Orders Placed Yet"
          description="You haven't completed any orders yet. When you purchase pieces, your tracking information and order timelines will show here."
          action={
            <Link to="/products">
              <Button variant="primary" size="md">
                Start Shopping
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs hover:border-gray-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-gray-900 text-sm">
                    #{ord.orderNumber}
                  </span>
                  {getStatusBadge(ord.status)}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {ord.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    {ord.itemsCount} {ord.itemsCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                <div className="text-right">
                  <span className="text-xs text-gray-400 block">Total</span>
                  <span className="text-lg font-black text-gray-950">
                    ${ord.total.toFixed(2)}
                  </span>
                </div>

                <Link to={`/account/orders/${ord.orderNumber}`}>
                  <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
