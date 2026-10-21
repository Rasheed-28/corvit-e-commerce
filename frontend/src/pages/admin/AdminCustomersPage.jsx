import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Eye,
  AlertTriangle,
  Mail,
  Calendar,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';

export const AdminCustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Customer Detail Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Status Toggle Modal
  const [toggleTarget, setToggleTarget] = useState(null);
  const [isToggling, setIsToggling] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (activeFilter !== '') params.is_active = activeFilter;

      const res = await adminApi.getCustomers(params);
      if (res?.results || res?.data) {
        const results = res.results || res.data || [];
        setCustomers(results);
        setTotalCount(res.count || results.length);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load customer directory');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, search, activeFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenDetail = async (customerId) => {
    setSelectedCustomerId(customerId);
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getCustomer(customerId);
      if (res?.success) {
        setCustomerDetail(res.data);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to load customer profile');
      setSelectedCustomerId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleTarget) return;
    setIsToggling(true);
    try {
      const res = await adminApi.toggleCustomerStatus(toggleTarget.id);
      alert(res?.message || 'Customer account status updated.');
      setToggleTarget(null);
      fetchCustomers();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to toggle customer status');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Customer Directory & Accounts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View registered user profiles, lifetime purchase histories, and manage account statuses.
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
            placeholder="Search by name, email, or username..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by account status"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Accounts</option>
            <option value="true">Active Accounts Only</option>
            <option value="false">Suspended / Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading customer directory...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Customers" message={error} onRetry={fetchCustomers} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Customers Found"
          message="No customer accounts matched your search criteria."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-3">Email Address</th>
                  <th className="py-3.5 px-3">Date Joined</th>
                  <th className="py-3.5 px-3 text-center">Orders</th>
                  <th className="py-3.5 px-3 text-right">Lifetime Spend</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {cust.first_name?.[0] || cust.email?.[0] || 'C'}
                        </div>
                        <div>
                          <p className="truncate max-w-[150px]">{cust.full_name || cust.username}</p>
                          {cust.phone_number && (
                            <p className="text-[10px] text-gray-400 font-normal">{cust.phone_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-gray-600 dark:text-gray-300">
                      {cust.email}
                    </td>
                    <td className="py-3.5 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(cust.date_joined).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold">
                      {cust.total_orders || 0}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      ${parseFloat(cust.total_spent || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3">
                      <Badge variant={cust.is_active ? 'success' : 'danger'} size="sm">
                        {cust.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(cust.id)}
                          title="View Customer Profile"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToggleTarget(cust)}
                          title={cust.is_active ? 'Suspend Account' : 'Reactivate Account'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            cust.is_active
                              ? 'text-gray-500 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                              : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {cust.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
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

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCustomerId(null)}
          title="Customer Profile Details"
        >
          {isLoadingDetail || !customerDetail ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Profile Info */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {customerDetail.full_name}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5" /> {customerDetail.email}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" /> Member since {new Date(customerDetail.date_joined).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={customerDetail.is_active ? 'success' : 'danger'}>
                  {customerDetail.is_active ? 'Active Customer' : 'Suspended Account'}
                </Badge>
              </div>

              {/* Lifetime Spend Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-400 uppercase font-semibold">Total Orders Placed</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                    {customerDetail.total_orders || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-400 uppercase font-semibold">Lifetime Total Spend</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                    ${parseFloat(customerDetail.total_spent || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Recent Orders List */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                  Recent Order History
                </h4>
                {customerDetail.recent_orders && customerDetail.recent_orders.length > 0 ? (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-400 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Order Number</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                        {customerDetail.recent_orders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                              {ord.order_number}
                            </td>
                            <td className="py-2 px-3 text-gray-500">
                              {new Date(ord.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant="neutral" size="sm">{ord.status}</Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                              ${parseFloat(ord.total_amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No previous orders placed.</p>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Account Status Toggle Modal */}
      {toggleTarget && (
        <Modal
          isOpen={true}
          onClose={() => setToggleTarget(null)}
          title={`Confirm Account ${toggleTarget.is_active ? 'Suspension' : 'Activation'}`}
        >
          <div className="space-y-4">
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
              toggleTarget.is_active
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {toggleTarget.is_active ? 'Account Suspension Warning' : 'Account Reactivation'}
                </p>
                <p className="mt-0.5 text-[11px]">
                  {toggleTarget.is_active
                    ? `Deactivating ${toggleTarget.email} will immediately revoke their ability to log in and make purchases.`
                    : `Activating ${toggleTarget.email} will restore their login access.`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setToggleTarget(null)} disabled={isToggling}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={toggleTarget.is_active ? 'danger' : 'primary'}
                isLoading={isToggling}
                onClick={handleToggleStatus}
              >
                Confirm {toggleTarget.is_active ? 'Suspension' : 'Activation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminCustomersPage;
