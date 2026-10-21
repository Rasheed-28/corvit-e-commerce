import React, { useState, useEffect } from 'react';
import { Drawer } from '../common/Drawer';
import { Link } from 'react-router-dom';
import { SearchInput } from '../common/SearchInput';
import { User, Heart, Sparkles, Phone, ShieldCheck } from 'lucide-react';
import { catalogApi } from '../../api/catalogApi';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../hooks/useAuth';

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Audio', slug: 'audio' },
  { id: 2, name: 'Wearables', slug: 'wearables' },
  { id: 3, name: 'Lifestyle', slug: 'lifestyle' },
  { id: 4, name: 'Workspace', slug: 'workspace' },
];

/**
 * Mobile Navigation Drawer for phone and tablet viewports.
 */
export const MobileNavDrawer = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  onSearchClear,
  onSearchSubmit,
}) => {
  const { totalWishlistItems } = useWishlist();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    let mounted = true;
    catalogApi
      .getCategories()
      .then((res) => {
        if (mounted && res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setCategories(res.data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      placement="left"
      title="NovaStore"
      size="sm"
    >
      <div className="space-y-6">
        {/* Search */}
        <form
          onSubmit={(e) => {
            onClose();
            if (onSearchSubmit) onSearchSubmit(e);
          }}
        >
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder="Search catalog..."
            size="sm"
          />
        </form>

        {/* Categories Section */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Categories
          </h4>
          <nav className="space-y-1">
            <Link
              to="/products"
              onClick={onClose}
              className="flex items-center justify-between p-2.5 rounded-xl font-medium text-gray-900 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
            >
              <span>All Products</span>
              <span className="text-xs text-gray-400">View All</span>
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id || cat.slug}
                to={`/categories/${cat.slug}`}
                onClick={onClose}
                className="flex items-center justify-between p-2.5 rounded-xl font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <span>{cat.name}</span>
                {cat.itemCount ? <span className="text-xs text-gray-400">{cat.itemCount}</span> : null}
              </Link>
            ))}
          </nav>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Highlights
          </h4>
          <nav className="space-y-1 text-sm font-medium">
            <Link
              to="/deals"
              onClick={onClose}
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Special Offers & Deals</span>
            </Link>
            <Link
              to="/wishlist"
              onClick={onClose}
              className="flex items-center justify-between p-2.5 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-gray-500" />
                <span>Saved Wishlist</span>
              </div>
              {totalWishlistItems > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  {totalWishlistItems}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Account & Help */}
        <div className="pt-4 border-t border-gray-100 space-y-2">
          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Admin Center</span>
            </Link>
          )}
          <Link
            to={isAuthenticated ? '/account' : '/login'}
            onClick={onClose}
            className="flex items-center gap-2.5 p-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <User className="w-4 h-4 text-gray-500" />
            <span>{isAuthenticated ? user?.first_name || 'My Account' : 'Sign In / Register'}</span>
          </Link>
          <a
            href="tel:+18005550199"
            className="flex items-center gap-2.5 p-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>1-800-555-0199 (24/7)</span>
          </a>
        </div>
      </div>
    </Drawer>
  );
};
