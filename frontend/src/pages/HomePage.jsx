import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';

export const HomePage = () => {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 shadow-sm text-center max-w-4xl mx-auto">
        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full mb-4">
          Production Architecture Foundation
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
          Modern Full-Stack E-Commerce Platform
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
          Built with React 18, Vite, Tailwind CSS, Django REST Framework, and PostgreSQL.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/products">
            <Button variant="primary" size="lg">
              Explore Catalog
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg">
              Architecture Specs
            </Button>
          </a>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 text-lg">Robust Security</h3>
          <p className="mt-2 text-sm text-gray-600">
            Cookie-based JWT authentication with refresh token rotation and strict CSRF double-submit protection.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 text-lg">Atomic Concurrency</h3>
          <p className="mt-2 text-sm text-gray-600">
            Database-level row locking with select_for_update prevents overselling during flash-checkouts.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 text-lg">Domain Service Layer</h3>
          <p className="mt-2 text-sm text-gray-600">
            Pure service functions orchestrate multi-model operations, keeping views and serializers clean and testable.
          </p>
        </div>
      </section>
    </div>
  );
};
