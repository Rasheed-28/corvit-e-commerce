import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  XCircle,
  Eye,
  AlertTriangle,
  Receipt,
  MapPin,
  CreditCard,
} from 'lucide-react';

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const VALID_TRANSITIONS = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export const AdminOrdersPage = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Order Detail Drawer/Modal
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Status Change State
  const [newStatus, setNewStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;

      const res = await adminApi.getOrders(params);
      if (res?.results || res?.data) {
        const results = res.results || res.data || [];
        setOrders(results);
        setTotalCount(res.count || results.length);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenDetail = async (orderNum) => {
    setSelectedOrderNumber(orderNum);
    setIsLoadingDetail(true);
    setNewStatus('');
    setCancelReason('');
    setStatusSuccessMsg('');
    try {
      const res = await adminApi.getOrder(orderNum);
      if (res?.success) {
        setOrderDetail(res.data);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to load order details');
      setSelectedOrderNumber(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!orderDetail || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      const payload = { status: newStatus };
      if (newStatus === 'CANCELLED' && cancelReason.trim()) {
        payload.reason = cancelReason.trim();
      }

      const res = await adminApi.updateOrderStatus(orderDetail.order_number, payload);
      setStatusSuccessMsg(`Order updated to ${newStatus}`);
      setOrderDetail(res.data);
      setNewStatus('');
      fetchOrders();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err?.response?.data?.status?.[0] || 'Invalid status transition');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success" size="sm">Paid</Badge>;
      case 'PROCESSING':
        return <Badge variant="info" size="sm">Processing</Badge>;
      case 'SHIPPED':
        return <Badge variant="primary" size="sm">Shipped</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" size="sm">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="sm">Cancelled</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm">Refunded</Badge>;
      default:
        return <Badge variant="warning" size="sm">Pending Payment</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Order Lifecycle Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track customer purchases, fulfill packages, and safely manage order status state machines.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by order #, customer, email..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by order status"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading store orders...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Orders" message={error} onRetry={fetchOrders} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No Orders Found"
          message="No customer orders matched your criteria."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Order Identifier</th>
                  <th className="py-3.5 px-3">Customer</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3">Items</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Payment</th>
                  <th className="py-3.5 px-3 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900 dark:text-white">
                      {ord.order_number}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]">
                        {ord.customer_name || 'Guest'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[160px]">
                        {ord.customer_email}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(ord.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-3 font-medium">
                      {ord.items_count || 1} items
                    </td>
                    <td className="py-3.5 px-3">
                      {getStatusBadge(ord.status)}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[10px]">
                      <span className={ord.payment_status === 'COMPLETED' ? 'text-emerald-600' : 'text-gray-500'}>
                        {ord.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      ${parseFloat(ord.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(ord.order_number)}
                        className="text-xs py-1 flex items-center gap-1.5 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalCount > pageSize && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrderNumber && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrderNumber(null)}
          title={`Order Inspection: ${selectedOrderNumber}`}
        >
          {isLoadingDetail || !orderDetail ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {statusSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-medium">
                  {statusSuccessMsg}
                </div>
              )}

              {/* Status & Lifecycle Transition Section */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Current Status:</span>
                    {getStatusBadge(orderDetail.status)}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    Placed {new Date(orderDetail.created_at).toLocaleString()}
                  </span>
                </div>

                {orderDetail.cancellation_reason && (
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg">
                    Cancellation Reason: <strong>{orderDetail.cancellation_reason}</strong>
                  </p>
                )}

                {/* State Machine Transition Form */}
                {VALID_TRANSITIONS[orderDetail.status]?.length > 0 ? (
                  <form onSubmit={handleStatusUpdate} className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Transition Lifecycle State
                        </label>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Select Next Permitted State</option>
                          {VALID_TRANSITIONS[orderDetail.status].map((target) => (
                            <option key={target} value={target}>
                              {target}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={isUpdatingStatus}
                        disabled={!newStatus}
                      >
                        Apply Status
                      </Button>
                    </div>

                    {newStatus === 'CANCELLED' && (
                      <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-xs">
                        <p className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Cancelling this order will automatically restore reserved stock to inventory.
                        </p>
                        <input
                          type="text"
                          required
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="State reason for customer records..."
                          className="w-full px-3 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800"
                        />
                      </div>
                    )}
                  </form>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    This order is in terminal status '{orderDetail.status}' and cannot be transitioned further.
                  </p>
                )}
              </div>

              {/* Items Snapshot Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                  Order Line Items
                </h4>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-400 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Item Details</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                      {orderDetail.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                            {item.product_title}
                            {item.variant_name && (
                              <span className="block text-[10px] text-gray-400">
                                {item.variant_name}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-500">{item.sku}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right">${parseFloat(item.unit_price).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white">
                            ${parseFloat(item.line_total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown & Address Snapshots Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Financial Summary */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1.5">
                  <p className="font-bold text-gray-900 dark:text-white mb-2">Financial Totals</p>
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal:</span>
                    <span>${parseFloat(orderDetail.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping Fee:</span>
                    <span>${parseFloat(orderDetail.shipping_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Tax:</span>
                    <span>${parseFloat(orderDetail.tax_amount).toFixed(2)}</span>
                  </div>
                  {parseFloat(orderDetail.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount Applied:</span>
                      <span>-${parseFloat(orderDetail.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-sm text-gray-900 dark:text-white">
                    <span>Total Amount:</span>
                    <span>${parseFloat(orderDetail.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Shipping Address Snapshot */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1">
                  <p className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    Delivery Destination Snapshot
                  </p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {orderDetail.shipping_address_snapshot?.full_name || orderDetail.customer_name}
                  </p>
                  <p className="text-gray-500">{orderDetail.shipping_address_snapshot?.street_address_1}</p>
                  <p className="text-gray-500">
                    {orderDetail.shipping_address_snapshot?.city},{' '}
                    {orderDetail.shipping_address_snapshot?.state_or_province}{' '}
                    {orderDetail.shipping_address_snapshot?.postal_code}
                  </p>
                  <p className="text-gray-500">{orderDetail.shipping_address_snapshot?.country}</p>
                  {orderDetail.shipping_address_snapshot?.phone_number && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Tel: {orderDetail.shipping_address_snapshot.phone_number}
                    </p>
                  )}
                </div>
              </div>

              {/* Payments History */}
              {orderDetail.payments && orderDetail.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    Payment Gateway Transactions
                  </h4>
                  <div className="space-y-2">
                    {orderDetail.payments.map((pmt) => (
                      <div
                        key={pmt.id}
                        className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between bg-white dark:bg-gray-800"
                      >
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {pmt.payment_method} · {pmt.gateway}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            TXID: {pmt.transaction_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-white">
                            ${parseFloat(pmt.amount).toFixed(2)}
                          </p>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            {pmt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default AdminOrdersPage;
