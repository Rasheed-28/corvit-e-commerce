import React from 'react';
import { Outlet } from 'react-router-dom';
import { AnnouncementBar } from '../components/layout/AnnouncementBar';
import { Navbar } from '../components/layout/Navbar';
import { CartDrawer } from '../components/layout/CartDrawer';
import { Footer } from '../components/layout/Footer';

export const RootLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/60 text-gray-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Announcement Bar */}
      <AnnouncementBar />

      {/* Primary Sticky Header */}
      <Navbar />

      {/* Global Slide-over Cart Drawer */}
      <CartDrawer />

      {/* Main Page Content */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Global Storefront Footer */}
      <Footer />
    </div>
  );
};
