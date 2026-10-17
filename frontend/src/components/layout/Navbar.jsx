import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold tracking-tight text-emerald-600 flex items-center gap-2">
              <span>🛒 NovaStore</span>
            </Link>
            <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
              <Link to="/products" className="hover:text-emerald-600 transition-colors">Catalog</Link>
              <Link to="/categories" className="hover:text-emerald-600 transition-colors">Categories</Link>
              <Link to="/deals" className="hover:text-emerald-600 transition-colors">Deals</Link>
            </nav>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-4">
            <Link to="/cart" className="p-2 text-gray-600 hover:text-emerald-600 transition-colors relative">
              <span className="text-sm font-medium">Cart</span>
              <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">0</span>
            </Link>
            <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-emerald-600 px-3 py-1.5 rounded-lg border border-gray-200">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
