import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import axiosClient from '../api/axiosClient';
import { API_ROUTES } from '../utils/constants';

export const HomePage = () => {
  const [health, setHealth] = useState({ status: 'checking', message: 'Checking backend connectivity...' });

  useEffect(() => {
    let isMounted = true;
    axiosClient.get(API_ROUTES.HEALTH)
      .then((res) => {
        if (isMounted) {
          const data = res?.data || res;
          setHealth({
            status: data?.status === 'healthy' ? 'online' : 'degraded',
            message: `Backend API: ${data?.status || 'online'} | DB: ${data?.database || 'connected'} | v${data?.version || '0.1.0'}`
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHealth({
            status: 'offline',
            message: `Backend API offline or unreachable (${err.message || 'connection failed'})`
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 shadow-sm text-center max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full">
            Production Architecture Foundation
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${
              health.status === 'online'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : health.status === 'checking'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                health.status === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : health.status === 'checking'
                  ? 'bg-amber-500 animate-bounce'
                  : 'bg-red-500'
              }`}
            />
            {health.message}
          </span>
        </div>
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
