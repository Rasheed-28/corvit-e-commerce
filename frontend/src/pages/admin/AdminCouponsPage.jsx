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
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const AdminCouponsPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
    minimum_order_amount: '0.00',
    max_discount_amount: '',
    usage_limit: '',
    valid_from: '',
    valid_to: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (activeFilter !== '') params.is_active = activeFilter;

      const res = await adminApi.getCoupons(params);
      if (res?.success) {
        setCoupons(res.data || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load coupons');
    } finally {
      setIsLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleOpenAdd = () => {
    setEditingCoupon(null);
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    setFormData({
      code: '',
      discount_type: 'PERCENTAGE',
      discount_value: '15.00',
      minimum_order_amount: '0.00',
      max_discount_amount: '',
      usage_limit: '100',
      valid_from: now.toISOString().slice(0, 16),
      valid_to: nextMonth.toISOString().slice(0, 16),
      is_active: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cpn) => {
    setEditingCoupon(cpn);
    setFormData({
      code: cpn.code || '',
      discount_type: cpn.discount_type || 'PERCENTAGE',
      discount_value: cpn.discount_value || '',
      minimum_order_amount: cpn.minimum_order_amount || '0.00',
      max_discount_amount: cpn.max_discount_amount || '',
      usage_limit: cpn.usage_limit ? cpn.usage_limit.toString() : '',
      valid_from: cpn.valid_from ? new Date(cpn.valid_from).toISOString().slice(0, 16) : '',
      valid_to: cpn.valid_to ? new Date(cpn.valid_to).toISOString().slice(0, 16) : '',
      is_active: cpn.is_active,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        minimum_order_amount: parseFloat(formData.minimum_order_amount || 0),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_to: new Date(formData.valid_to).toISOString(),
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        await adminApi.updateCoupon(editingCoupon.id, payload);
      } else {
        await adminApi.createCoupon(payload);
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err) {
      const backendErrors = err?.response?.data?.error?.details || err?.response?.data;
      if (typeof backendErrors === 'object' && backendErrors !== null) {
        setFormErrors(backendErrors);
      } else {
        setFormErrors({ non_field_errors: err.message || 'Failed to save coupon.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteCoupon(deleteTarget.id);
      setDeleteTarget(null);
      fetchCoupons();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete coupon');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Promotional Coupons & Discounts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure percentage discounts, cart minimums, validity dates, and redemption limits.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Coupon
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon codes..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            aria-label="Filter by coupon status"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Coupons</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Coupons Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading discount vouchers...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Coupons" message={error} onRetry={fetchCoupons} />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No Coupons Found"
          message="Create promotional codes to offer discounts to customers."
          actionLabel="Create Coupon"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Coupon Code</th>
                  <th className="py-3.5 px-3">Discount Value</th>
                  <th className="py-3.5 px-3">Cart Constraints</th>
                  <th className="py-3.5 px-3">Validity Schedule</th>
                  <th className="py-3.5 px-3">Usage Counter</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {coupons.map((cpn) => (
                  <tr key={cpn.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-mono font-bold text-gray-900 dark:text-white text-sm tracking-wide">
                          {cpn.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-gray-900 dark:text-white text-xs">
                        {cpn.discount_type === 'PERCENTAGE'
                          ? `${parseFloat(cpn.discount_value)}% Off`
                          : `$${parseFloat(cpn.discount_value).toFixed(2)} Off`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-gray-500">
                      <div>Min: ${parseFloat(cpn.minimum_order_amount).toFixed(2)}</div>
                      {cpn.max_discount_amount && (
                        <div className="text-[10px]">Cap: ${parseFloat(cpn.max_discount_amount).toFixed(2)}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-gray-500">
                      <div className="flex items-center gap-1 text-[10px]">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {new Date(cpn.valid_from).toLocaleDateString()} – {new Date(cpn.valid_to).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {cpn.times_used}
                      </span>
                      <span className="text-gray-400">
                        {cpn.usage_limit ? ` / ${cpn.usage_limit}` : ' (unlimited)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {cpn.is_active && cpn.is_valid_now ? (
                        <Badge variant="success" size="sm">Valid Now</Badge>
                      ) : cpn.is_active ? (
                        <Badge variant="warning" size="sm">Scheduled/Capped</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Disabled</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cpn)}
                          title="Edit Coupon"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cpn)}
                          title="Delete Coupon"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Coupon Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {formErrors.non_field_errors && (
              <div className="p-3 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 rounded-lg text-xs font-medium">
                {formErrors.non_field_errors}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Coupon Code"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. FLASH20"
                error={formErrors.code?.[0]}
              />

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Discount Type *
                </label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Dollar Amount ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label={formData.discount_type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount ($)'}
                type="number"
                step="0.01"
                min="0.01"
                max={formData.discount_type === 'PERCENTAGE' ? '100' : undefined}
                required
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder="15"
                error={formErrors.discount_value?.[0]}
              />

              <Input
                label="Minimum Order ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_order_amount}
                onChange={(e) => setFormData({ ...formData, minimum_order_amount: e.target.value })}
                placeholder="0.00"
              />

              <Input
                label="Max Discount Cap ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.max_discount_amount}
                onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                placeholder="Optional"
                helperText="Maximum discount ceiling."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Usage Limit Count"
                type="number"
                min="1"
                value={formData.usage_limit}
                onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                placeholder="e.g. 500"
                helperText="Leave blank for infinite."
              />

              <Input
                label="Valid From *"
                type="datetime-local"
                required
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                error={formErrors.valid_from?.[0]}
              />

              <Input
                label="Valid To *"
                type="datetime-local"
                required
                value={formData.valid_to}
                onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                error={formErrors.valid_to?.[0]}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Active Coupon (Redeemable in Checkout)
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                {editingCoupon ? 'Save Coupon' : 'Create Coupon'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Coupon Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Coupon"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete coupon code <strong>{deleteTarget.code}</strong>? Past orders that redeemed this code will retain their discounts.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" isLoading={isDeleting} onClick={handleDelete}>
                Delete Coupon
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminCouponsPage;
