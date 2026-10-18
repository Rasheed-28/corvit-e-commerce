import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
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

export const AppRoutes = () => {
  return (
    <Routes>
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
    </Routes>
  );
};
