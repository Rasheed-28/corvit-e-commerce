import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  RefreshCw,
} from 'lucide-react';

export const AdminInventoryPage = () => {
  const [inventoryList, setInventoryList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stock Adjustment Modal
  const [selectedInv, setSelectedInv] = useState(null);
  const [adjustmentMode, setAdjustmentMode] = useState('set'); // 'set' | 'adjust'
  const [quantityInput, setQuantityInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (lowStockOnly) params.low_stock_only = 'true';
      if (outOfStockOnly) params.out_of_stock = 'true';

      const res = await adminApi.getInventory(params);
      if (res?.success) {
        setInventoryList(res.data || []);
        setSummary(res.summary || null);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, [search, lowStockOnly, outOfStockOnly]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleOpenAdjust = (inv) => {
    setSelectedInv(inv);
    setAdjustmentMode('set');
    setQuantityInput(inv.quantity.toString());
    setThresholdInput(inv.low_stock_threshold.toString());
    setSaveSuccessMsg('');
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!selectedInv) return;
    setIsSaving(true);
    try {
      const payload = {
        low_stock_threshold: parseInt(thresholdInput, 10),
      };
      if (adjustmentMode === 'set') {
        payload.quantity = parseInt(quantityInput, 10);
      } else {
        payload.adjustment = parseInt(quantityInput, 10);
      }

      const res = await adminApi.updateInventory(selectedInv.id, payload);
      setSaveSuccessMsg(res?.message || 'Inventory updated.');
      setTimeout(() => {
        setSelectedInv(null);
        fetchInventory();
      }, 900);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update stock');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Inventory & Stock Tracking
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time multi-variant inventory control, reserve locks, and safety stock thresholds.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchInventory}
          disabled={isLoading}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors self-start sm:self-auto"
          title="Refresh inventory"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
            <p className="text-[11px] font-semibold uppercase text-gray-400">Total Tracked</p>
            <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
              {summary.total_tracked} variants
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
            <p className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
              Healthy Stock
            </p>
            <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {summary.healthy_count}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
            <p className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400">
              Low Stock Warnings
            </p>
            <p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              {summary.low_stock_count}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs">
            <p className="text-[11px] font-semibold uppercase text-red-600 dark:text-red-400">
              Depleted / Out of Stock
            </p>
            <p className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">
              {summary.out_of_stock_count}
            </p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by SKU or Product name..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                if (e.target.checked) setOutOfStockOnly(false);
              }}
              className="rounded text-amber-600"
            />
            Low Stock Only
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={outOfStockOnly}
              onChange={(e) => {
                setOutOfStockOnly(e.target.checked);
                if (e.target.checked) setLowStockOnly(false);
              }}
              className="rounded text-red-600"
            />
            Out of Stock Only
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Checking physical stock records...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Inventory" message={error} onRetry={fetchInventory} />
      ) : inventoryList.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No Inventory Items Found"
          message="No variant inventory matched the selected filters."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Variant & Product</th>
                  <th className="py-3.5 px-3">SKU</th>
                  <th className="py-3.5 px-3">Physical Stock</th>
                  <th className="py-3.5 px-3">Reserved</th>
                  <th className="py-3.5 px-3">Available to Sell</th>
                  <th className="py-3.5 px-3">Min Threshold</th>
                  <th className="py-3.5 px-3">Stock Health</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {inventoryList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {inv.product_title}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {inv.variant_name}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-medium text-gray-600 dark:text-gray-300">
                      {inv.sku}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-gray-900 dark:text-white">
                      {inv.quantity}
                    </td>
                    <td className="py-3.5 px-3 text-gray-500">
                      {inv.reserved_quantity}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                      {inv.available_quantity}
                    </td>
                    <td className="py-3.5 px-3 text-gray-500">
                      {inv.low_stock_threshold}
                    </td>
                    <td className="py-3.5 px-3">
                      {inv.is_out_of_stock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                          <XCircle className="w-3 h-3" /> Depleted
                        </span>
                      ) : inv.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdjust(inv)}
                        className="text-xs py-1"
                      >
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedInv && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInv(null)}
          title={`Adjust Inventory: ${selectedInv.sku}`}
        >
          <form onSubmit={handleSaveStock} className="space-y-4">
            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-medium">
                {saveSuccessMsg}
              </div>
            )}

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 space-y-1 text-xs">
              <p className="text-gray-500">
                Product: <strong className="text-gray-900 dark:text-white">{selectedInv.product_title}</strong>
              </p>
              <p className="text-gray-500">
                Variant: <strong>{selectedInv.variant_name}</strong>
              </p>
              <p className="text-gray-500">
                Current Stock: <strong className="text-indigo-600">{selectedInv.quantity}</strong> (Reserved: {selectedInv.reserved_quantity})
              </p>
            </div>

            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => {
                  setAdjustmentMode('set');
                  setQuantityInput(selectedInv.quantity.toString());
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  adjustmentMode === 'set'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Set Exact Quantity
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustmentMode('adjust');
                  setQuantityInput('0');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  adjustmentMode === 'adjust'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Relative Delta (+/-)
              </button>
            </div>

            <Input
              label={adjustmentMode === 'set' ? 'New Total Quantity' : 'Adjustment Count (+/-)'}
              type="number"
              required
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              helperText={
                adjustmentMode === 'set'
                  ? 'Replaces the existing physical stock level.'
                  : 'Positive number adds stock; negative number subtracts stock.'
              }
            />

            <Input
              label="Safety Stock Alert Threshold"
              type="number"
              min="0"
              required
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              helperText="Alerts when available stock drops to or below this quantity."
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setSelectedInv(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                Save Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminInventoryPage;
