import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminRoute } from '../components/admin/AdminRoute';

// Storefront Pages
import { HomePage } from '../pages/HomePage';
import { ProductListPage } from '../pages/ProductListPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { SearchResultsPage } from '../pages/SearchResultsPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { WishlistPage } from '../pages/WishlistPage';
import { CartPage } from '../pages/CartPage';
import { CustomerProfilePage } from '../pages/CustomerProfilePage';
import { AddressBookPage } from '../pages/AddressBookPage';
import { OrderHistoryPage } from '../pages/OrderHistoryPage';
import { OrderDetailPage } from '../pages/OrderDetailPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { NotFoundPage } from '../pages/NotFoundPage';

// Administration Pages
import {
  AdminOverviewPage,
  AdminProductsPage,
  AdminCategoriesPage,
  AdminInventoryPage,
  AdminOrdersPage,
  AdminCustomersPage,
  AdminCouponsPage,
  AdminReviewsPage,
  AdminReportsPage,
} from '../pages/admin';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Storefront Customer Routes */}
      <Route path="/" element={<RootLayout />}>
        {/* Storefront Home */}
        <Route index element={<HomePage />} />

        {/* Product Catalog & Category Browsing */}
        <Route path="products" element={<ProductListPage />} />
        <Route path="categories/:slug" element={<ProductListPage />} />
        <Route path="deals" element={<ProductListPage />} />

        {/* Product Detail Pages */}
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="product/:slug" element={<ProductDetailPage />} />

        {/* Search Results */}
        <Route path="search" element={<SearchResultsPage />} />

        {/* Authentication Pages */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Customer Commerce Activities */}
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="checkout/success/:orderNumber" element={<OrderDetailPage isConfirmation={true} />} />
        <Route path="orders/:orderNumber" element={<OrderDetailPage />} />

        {/* Customer Account & Settings */}
        <Route path="account" element={<CustomerProfilePage />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="account/addresses" element={<AddressBookPage />} />
        <Route path="account/orders" element={<OrderHistoryPage />} />
        <Route path="account/orders/:orderNumber" element={<OrderDetailPage />} />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Protected Administrator Dashboard */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="overview" element={<Navigate to="/admin" replace />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="coupons" element={<AdminCouponsPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
