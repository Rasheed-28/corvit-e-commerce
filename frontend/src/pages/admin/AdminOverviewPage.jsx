import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import {
  DollarSign,
  ShoppingBag,
  Users,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
} from 'lucide-react';

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
];

export const AdminOverviewPage = () => {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Restock Modal State
  const [restockItem, setRestockItem] = useState(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [stockSuccessMsg, setStockSuccessMsg] = useState('');

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminApi.getOverview({ period });
      if (response?.success && response.data) {
        setData(response.data);
      } else {
        throw new Error(response?.error?.message || 'Failed to load overview data');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Unable to connect to administrative metrics service');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleQuickRestock = async (e) => {
    e.preventDefault();
    if (!restockItem || newQuantity === '') return;
    setIsUpdatingStock(true);
    try {
      await adminApi.updateInventory(restockItem.inventory_id, {
        quantity: parseInt(newQuantity, 10),
      });
      setStockSuccessMsg(`Stock updated successfully for ${restockItem.sku}`);
      setTimeout(() => {
        setStockSuccessMsg('');
        setRestockItem(null);
        fetchOverview();
      }, 1200);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to adjust inventory stock.');
    } finally {
      setIsUpdatingStock(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-gray-500">Calculating store metrics and sales velocity...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Dashboard Overview Error"
        message={error}
        onRetry={fetchOverview}
      />
    );
  }

  const { metrics, sales_trend, recent_orders, low_stock_items } = data || {};

  return (
    <div className="space-y-8">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Performance Overview
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time financial telemetry, order processing volume, and inventory health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchOverview}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Revenue
            </p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
              ${(metrics?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-emerald-600 font-semibold">
                ${(metrics?.average_order_value || 0).toFixed(2)}
              </span>{' '}
              avg order
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Orders */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Orders Volume
            </p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
              {(metrics?.total_orders || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold text-emerald-600">{metrics?.paid_orders_count || 0}</span> paid ·{' '}
              <span className="font-semibold text-amber-600">{metrics?.pending_orders_count || 0}</span> pending
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Total Customers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Registered Customers
            </p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
              {(metrics?.total_customers || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              +{metrics?.new_customers_count || 0} in selected period
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Low Stock Alerts
            </p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
              {(metrics?.low_stock_count || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics?.low_stock_count > 0 ? (
                <span className="text-amber-600 font-medium">Variants require replenishment</span>
              ) : (
                <span className="text-emerald-600 font-medium">All variants healthy</span>
              )}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            (metrics?.low_stock_count || 0) > 0
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Sales Velocity Chart Trend Visualizer */}
      <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Daily Revenue & Order Volume
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Daily confirmed purchase aggregation across selected date window.
            </p>
          </div>
          <Link
            to="/admin/reports"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Detailed Report <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {sales_trend && sales_trend.length > 0 ? (
          <div className="space-y-4">
            {/* Visualizer bars */}
            <div className="h-48 flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
              {(() => {
                const maxRevenue = Math.max(...sales_trend.map((d) => d.revenue || 0), 1);
                return sales_trend.map((item, idx) => {
                  const heightPercent = Math.max(8, Math.round(((item.revenue || 0) / maxRevenue) * 100));
                  return (
                    <div key={idx} className="flex-1 min-w-[28px] flex flex-col items-center group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap pointer-events-none">
                        <span>{item.date}</span>
                        <span className="font-bold text-indigo-300">
                          ${(item.revenue || 0).toFixed(2)} ({item.orders_count || 0} orders)
                        </span>
                      </div>
                      <div
                        className="w-full max-w-[32px] bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-t-md transition-all duration-300 cursor-pointer"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">
                        {item.date.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>{sales_trend[0]?.date}</span>
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {sales_trend.reduce((sum, d) => sum + (d.orders_count || 0), 0)} Orders Placed
              </span>
              <span>{sales_trend[sales_trend.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500">
            No sales recorded in this period.
          </div>
        )}
      </div>

      {/* Grid: Recent Orders & Low Stock Quick Replenishment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Recent Orders
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Latest customer transactions requiring fulfillment.
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              All Orders <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recent_orders && recent_orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 pr-3">Order</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                  {recent_orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="py-3 pr-3 font-medium text-gray-900 dark:text-white">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-3">
                        <div className="truncate max-w-[140px] font-medium text-gray-900 dark:text-white">
                          {ord.customer_name || 'Guest'}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {ord.customer_email}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            ord.status === 'PAID'
                              ? 'success'
                              : ord.status === 'PROCESSING'
                              ? 'info'
                              : ord.status === 'SHIPPED'
                              ? 'primary'
                              : ord.status === 'DELIVERED'
                              ? 'success'
                              : ord.status === 'CANCELLED'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {ord.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                        ${parseFloat(ord.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <Link
                          to={`/admin/orders?search=${ord.order_number}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-500">
              No recent orders found.
            </div>
          )}
        </div>

        {/* Low Stock Replenishment List (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-amber-500" />
                  Stock Alerts
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Items nearing exhaustion threshold.
                </p>
              </div>
              <Link
                to="/admin/inventory?low_stock_only=true"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </div>

            {low_stock_items && low_stock_items.length > 0 ? (
              <div className="space-y-3">
                {low_stock_items.map((item) => (
                  <div
                    key={item.inventory_id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {item.product_title}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {item.variant_name} · SKU: {item.sku}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold">
                          {item.quantity} in stock
                        </span>
                        <span className="text-[10px] text-gray-400">
                          (min {item.threshold})
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRestockItem(item);
                        setNewQuantity(item.quantity.toString());
                      }}
                      className="shrink-0 text-xs py-1"
                    >
                      Restock
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  Inventory Healthy
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  No active variants are currently below their minimum safety thresholds.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <Link
              to="/admin/inventory"
              className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-1"
            >
              Open Full Inventory Manager <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {restockItem && (
        <Modal
          isOpen={true}
          onClose={() => setRestockItem(null)}
          title={`Quick Restock: ${restockItem.product_title}`}
        >
          <form onSubmit={handleQuickRestock} className="space-y-4">
            {stockSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-medium">
                {stockSuccessMsg}
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500">
                Variant: <span className="font-semibold text-gray-700 dark:text-gray-300">{restockItem.variant_name}</span> (SKU: {restockItem.sku})
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Current Level: <span className="font-semibold text-red-600">{restockItem.quantity} units</span> (Minimum Safety Threshold: {restockItem.threshold})
              </p>
            </div>

            <Input
              label="New Quantity Level"
              type="number"
              min="0"
              required
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              placeholder="e.g. 50"
              helperText="Set absolute total quantity available in inventory."
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRestockItem(null)}
                disabled={isUpdatingStock}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isUpdatingStock}
              >
                Update Stock
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminOverviewPage;
