import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, User, Menu, Sparkles, ShieldCheck } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../hooks/useAuth';
import { SearchInput } from '../common/SearchInput';
import { MobileNavDrawer } from './MobileNavDrawer';

/**
 * Premium Storefront Header with responsive navigation, quick search, and cart counter.
 */
export const Navbar = () => {
  const { totalItems, openCart, subtotal } = useCart();
  const { totalWishlistItems } = useWishlist();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Catalog', to: '/products' },
    { label: 'Audio', to: '/categories/audio' },
    { label: 'Wearables', to: '/categories/wearables' },
    { label: 'Lifestyle', to: '/categories/lifestyle' },
    { label: 'Workspace', to: '/categories/workspace' },
    { label: 'Deals', to: '/deals', highlight: true },
  ];

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 gap-4 sm:gap-8">
            {/* Left: Mobile Menu Toggle & Brand Logo */}
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Open mobile menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                to="/"
                className="flex items-center gap-2.5 text-xl sm:text-2xl font-black tracking-tight text-gray-950 select-none group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="flex items-center gap-1">
                  Nova<span className="text-emerald-600">Store</span>
                </span>
              </Link>
            </div>

            {/* Middle: Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`
                      px-3 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5
                      ${
                        link.highlight
                          ? 'text-rose-600 hover:bg-rose-50'
                          : isActive
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-gray-700 hover:text-emerald-700 hover:bg-gray-100/70'
                      }
                    `}
                  >
                    {link.highlight && <Sparkles className="w-3.5 h-3.5" />}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Search & Actions */}
            <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end max-w-md">
              {/* Search Bar (Desktop) */}
              <form onSubmit={handleSearchSubmit} className="hidden md:block flex-1 max-w-xs">
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  placeholder="Search products..."
                  size="sm"
                />
              </form>

              {/* Wishlist Icon */}
              <Link
                to="/wishlist"
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={`View saved wishlist, ${totalWishlistItems} items`}
                title="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {totalWishlistItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-xs">
                    {totalWishlistItems}
                  </span>
                )}
              </Link>

              {/* Staff Administrator Quick Switch */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                  title="Admin Dashboard"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Admin</span>
                </Link>
              )}

              {/* User Account / Sign In */}
              <Link
                to={isAuthenticated ? '/account' : '/login'}
                className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={isAuthenticated ? 'My Account' : 'Sign In'}
              >
                <User className="w-4 h-4 text-gray-500" />
                <span className="hidden xl:inline">
                  {isAuthenticated ? user?.first_name || 'Account' : 'Sign In'}
                </span>
              </Link>

              {/* Shopping Cart Button */}
              <button
                type="button"
                onClick={openCart}
                className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-slate-800 transition-all shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={`Shopping cart, ${totalItems} items, subtotal $${subtotal.toFixed(2)}`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">Cart</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-emerald-500 text-white rounded-full">
                  {totalItems}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onSearchClear={() => setSearchQuery('')}
        onSearchSubmit={handleSearchSubmit}
      />
    </>
  );
};
