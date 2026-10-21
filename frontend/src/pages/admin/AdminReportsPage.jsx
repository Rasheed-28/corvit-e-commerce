import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  CreditCard,
  Percent,
  Truck,
  Receipt,
  RefreshCw,
} from 'lucide-react';

const PERIOD_PRESETS = [
  { label: 'Past 7 Days', value: '7d' },
  { label: 'Past 30 Days', value: '30d' },
  { label: 'Past 90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
];

export const AdminReportsPage = () => {
  const [period, setPeriod] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      } else {
        params.period = period;
      }

      const res = await adminApi.getSalesReport(params);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        throw new Error('Failed to retrieve sales metrics');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Unable to generate sales telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    if (startDate && endDate) {
      setPeriod('custom');
      fetchReport();
    }
  };

  const handleResetPresets = (p) => {
    setStartDate('');
    setEndDate('');
    setPeriod(p);
  };

  if (isLoading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-xs text-gray-500">Aggregating transactional reporting data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Sales Telemetry Error"
        message={error}
        onRetry={fetchReport}
      />
    );
  }

  const { financial_summary, top_products, payment_methods, status_breakdown, date_range } = data || {};

  return (
    <div className="space-y-8">
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sales & Revenue Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trusted server-side revenue accounting, tax & shipping distribution, and best seller reports.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleResetPresets(p.value)}
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

          {/* Custom Date Form */}
          <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Filter report start date"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Filter report end date"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!startDate || !endDate}>
              Apply
            </Button>
          </form>

          <button
            type="button"
            onClick={fetchReport}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Net Revenue */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
            Net Revenue Collected
          </p>
          <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
            ${(financial_summary?.net_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Across {financial_summary?.total_orders || 0} confirmed transactions
          </p>
        </div>

        {/* Gross Subtotal */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Gross Items Subtotal</p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
            ${(financial_summary?.gross_subtotal || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {financial_summary?.total_units_sold || 0} units
          </p>
        </div>

        {/* Total Discounts */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">Discounts</p>
          <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
            -${(financial_summary?.total_discounts || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Coupons applied</p>
        </div>

        {/* Shipping Collected */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Shipping Fees</p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
            ${(financial_summary?.total_shipping || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Fulfillment charges</p>
        </div>

        {/* Tax Collected */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Sales Tax</p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
            ${(financial_summary?.total_tax || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Remitted tax liability</p>
        </div>
      </div>

      {/* Grid: Top 10 Best Selling Products & Payment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 Products (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Top-Selling Products by Velocity
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Ranked by unit purchase volume within active period.
          </p>

          {top_products && top_products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-center">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                  {top_products.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-3 font-bold text-gray-400">#{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                        {item.product_title}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-500">{item.sku}</td>
                      <td className="py-3 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {item.units_sold}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                        ${parseFloat(item.revenue_generated).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-gray-500">No items sold in this timeframe.</p>
          )}
        </div>

        {/* Payment Methods Distribution (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Payment Channels
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Gateway settlement volume breakdown.
            </p>

            {payment_methods && payment_methods.length > 0 ? (
              <div className="space-y-3">
                {payment_methods.map((pm, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {pm.payment_method}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {pm.count} transactions completed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ${parseFloat(pm.total_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-gray-500">No gateway payments captured.</p>
            )}
          </div>

          {/* Order Lifecycle Distribution */}
          <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-700">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Order Fulfillment Pipeline
            </p>
            <div className="space-y-1.5 text-xs">
              {status_breakdown?.map((sb, idx) => (
                <div key={idx} className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>{sb.status}:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {sb.count} ({sb.total_val ? `$${parseFloat(sb.total_val).toFixed(2)}` : '$0.00'})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReportsPage;
