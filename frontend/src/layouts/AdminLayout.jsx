import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  ShoppingBag,
  Users,
  Tag,
  Star,
  BarChart3,
  Store,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Products', to: '/admin/products', icon: Package },
  { label: 'Categories', to: '/admin/categories', icon: FolderTree },
  { label: 'Inventory', to: '/admin/inventory', icon: Boxes },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Coupons', to: '/admin/coupons', icon: Tag },
  { label: 'Reviews', to: '/admin/reviews', icon: Star },
  { label: 'Sales Reports', to: '/admin/reports', icon: BarChart3 },
];

export const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentNav = NAV_ITEMS.find((item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col lg:flex-row text-gray-900 dark:text-gray-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col border-r border-gray-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800">
          <Link to="/admin" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span>Admin Center</span>
          </Link>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Link to Storefront */}
        <div className="p-3">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/80 transition-colors border border-indigo-800/40"
          >
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Live Storefront
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/70'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Current Staff User Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {user?.first_name?.[0] || user?.email?.[0] || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-white">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
              </p>
              <p className="text-[10px] text-indigo-300 font-medium tracking-wide uppercase">
                Staff Administrator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Administrative Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {currentNav?.label || 'Administration'}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Staff Mode
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              Visit Store
            </Link>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
