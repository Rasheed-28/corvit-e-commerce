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
import { mockOrdersApi } from '../api/mockAdapter';

export const OrderHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    mockOrdersApi.getOrders()
      .then((res) => {
        if (res?.success) setOrders(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getStatusBadge = (status) => {
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

      {orders.length === 0 ? (
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
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.orderNumber}
              className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden"
            >
              {/* Order Meta Bar */}
              <div className="p-4 sm:p-6 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs">
                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">Order Number</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{order.orderNumber}</span>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">Date Placed</span>
                    <span className="font-semibold text-gray-800">{order.date}</span>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">Total Amount</span>
                    <span className="font-bold text-gray-950 text-sm">${order.financials.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(order.status)}

                  <Link to={`/account/orders/${order.orderNumber}`}>
                    <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                      Details
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Items Preview */}
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-16 h-16 rounded-xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          {item.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Qty: {item.quantity} · ${(item.unitPrice).toFixed(2)}
                          {item.variant ? ` · ${item.variant}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {order.trackingNumber && (
                  <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-800">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      {order.carrier}: <code className="font-mono text-gray-800">{order.trackingNumber}</code>
                    </span>
                    <span className="text-gray-400">
                      Delivered/Expected: {order.estimatedDelivery}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
