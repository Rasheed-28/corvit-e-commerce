import React from 'react';
import { Drawer } from '../common/Drawer';
import { Link } from 'react-router-dom';
import { SearchInput } from '../common/SearchInput';
import { User, ShieldCheck, Heart, Sparkles, Phone, HelpCircle } from 'lucide-react';
import { MOCK_CATEGORIES } from '../../data/mockProducts';

/**
 * Mobile Navigation Drawer for phone and tablet viewports.
 */
export const MobileNavDrawer = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  onSearchClear,
}) => {
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
        <div>
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder="Search catalog..."
            size="sm"
          />
        </div>

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
            {MOCK_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                onClick={onClose}
                className="flex items-center justify-between p-2.5 rounded-xl font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <span>{cat.name}</span>
                <span className="text-xs text-gray-400">{cat.itemCount}</span>
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
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Heart className="w-4 h-4 text-gray-500" />
              <span>Saved Wishlist</span>
            </Link>
          </nav>
        </div>

        {/* Account & Help */}
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <Link
            to="/login"
            onClick={onClose}
            className="flex items-center gap-2.5 p-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <User className="w-4 h-4 text-gray-500" />
            <span>Sign In / My Account</span>
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
