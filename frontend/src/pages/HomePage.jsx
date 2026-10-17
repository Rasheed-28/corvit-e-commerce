import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Flame,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  Sliders,
  Bell,
  Layers,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { SearchInput } from '../components/common/SearchInput';
import { Checkbox } from '../components/common/Checkbox';
import { PriceDisplay } from '../components/common/PriceDisplay';
import { RatingStars } from '../components/common/RatingStars';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Skeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { AlertBanner } from '../components/common/AlertBanner';
import { ProductGrid } from '../components/product/ProductGrid';
import { QuickViewModal } from '../components/product/QuickViewModal';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import axiosClient from '../api/axiosClient';
import { API_ROUTES } from '../utils/constants';

// Clean temporary mock data isolated strictly for design showcase
import {
  MOCK_CATEGORIES,
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
} from '../data/mockProducts';

export const HomePage = () => {
  const { addItem, openCart } = useCart();
  const { notify } = useNotification();

  // Storefront Filtering & Search State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Design System Verification State Toggles (Normal / Skeleton / Empty / Error)
  const [viewState, setViewState] = useState('normal'); // 'normal' | 'loading' | 'empty' | 'error'
  const [showComponentInspector, setShowComponentInspector] = useState(false);
  const [inspectorButtonLoading, setInspectorButtonLoading] = useState(false);

  // Backend Connectivity Check (Preserved from foundation)
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Probing API...',
  });

  useEffect(() => {
    let isMounted = true;
    axiosClient
      .get(API_ROUTES.HEALTH)
      .then((res) => {
        if (isMounted) {
          const data = res?.data || res;
          setBackendHealth({
            status: data?.status === 'healthy' ? 'online' : 'degraded',
            message: `API: ${data?.status || 'online'} | DB: ${data?.database || 'connected'}`,
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setBackendHealth({
            status: 'offline',
            message: 'Backend API offline (Mock Storefront Active)',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter and sort product list
  const filteredProducts = useMemo(() => {
    if (viewState === 'empty') return [];

    let list = [...MOCK_PRODUCTS];

    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.categorySlug === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [selectedCategory, searchQuery, sortBy, viewState]);

  return (
    <div className="space-y-16 pb-12">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-8 sm:p-14 lg:p-16 shadow-2xl border border-slate-800">
        {/* Subtle Background Glow Accent */}
        <div
          className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              <Badge variant="primary" size="md" dot>
                Autumn / Winter 2026 Release
              </Badge>

              {/* Backend API live indicator badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full ${
                  backendHealth.status === 'online'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
                title={backendHealth.message}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    backendHealth.status === 'online'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                {backendHealth.message}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Elevated essentials for the <span className="text-emerald-400">modern lifestyle.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Precision acoustic audio, titanium smartwatches, and minimalist workspace gear engineered with obsessive attention to detail.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a href="#featured-products">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore Collection
                </Button>
              </a>

              <button
                type="button"
                onClick={() => setShowComponentInspector(!showComponentInspector)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{showComponentInspector ? 'Hide Design Inspector' : 'Inspect Design System'}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 text-left">
              <div>
                <span className="block text-xl sm:text-2xl font-bold text-white">4.9 / 5</span>
                <span className="text-xs text-slate-400">Customer Rating</span>
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-bold text-white">2-Day</span>
                <span className="text-xs text-slate-400">Express Delivery</span>
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-bold text-white">30-Day</span>
                <span className="text-xs text-slate-400">Risk-Free Trial</span>
              </div>
            </div>
          </div>

          {/* Hero Right Featured Spotlight Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl text-white">
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-5 bg-slate-800">
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"
                  alt="Aura Studio Wireless"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="discount" size="sm">
                    Featured Hero Drop
                  </Badge>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Acoustic Flagship
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Aura Studio Wireless Over-Ear
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white">$249</span>
                  <span className="block text-xs text-slate-400 line-through">$299</span>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    addItem(MOCK_PRODUCTS[0], 1, 'Matte Black');
                  }}
                >
                  Add to Cart
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="border-white/30 text-white hover:bg-white/10"
                  onClick={() => setQuickViewProduct(MOCK_PRODUCTS[0])}
                >
                  Quick View
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OPTIONAL EXPANDABLE DESIGN SYSTEM COMPONENT INSPECTOR */}
      {showComponentInspector && (
        <section
          role="region"
          aria-label="Design System Component Inspector"
          className="bg-white rounded-3xl border border-emerald-200 p-8 shadow-sm space-y-8 animate-slide-up"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">Design System Reference</Badge>
                <h2 className="text-xl font-bold text-gray-900">
                  Interactive UI Component Inspector
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Visual testbed verifying all button variants, badges, form inputs, loading indicators, and toast triggers.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComponentInspector(false)}
            >
              Close
            </Button>
          </div>

          {/* Buttons Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              1. Button Variants & States
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button
                variant="primary"
                isLoading={inspectorButtonLoading}
                onClick={() => {
                  setInspectorButtonLoading(true);
                  setTimeout(() => setInspectorButtonLoading(false), 2000);
                }}
              >
                {inspectorButtonLoading ? 'Saving...' : 'Click for Loading State'}
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-xs text-gray-400 mr-2">Sizes:</span>
              <Button size="xs" variant="outline">XS</Button>
              <Button size="sm" variant="outline">SM</Button>
              <Button size="md" variant="outline">MD</Button>
              <Button size="lg" variant="outline">LG</Button>
              <Button size="xl" variant="outline">XL</Button>
            </div>
          </div>

          {/* Badges Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              2. Badges & Inventory Tags
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="primary" dot>Primary Dot</Badge>
              <Badge variant="success" dot>In Stock</Badge>
              <Badge variant="warning" dot>Low Stock (3)</Badge>
              <Badge variant="danger">Out of Stock</Badge>
              <Badge variant="info">Pre-order</Badge>
              <Badge variant="discount">Sale -25%</Badge>
              <Badge variant="neutral">Category Tag</Badge>
              <Badge variant="outline">Outline Badge</Badge>
            </div>
          </div>

          {/* Form Fields Showcase */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              3. Accessible Form Controls
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Sample Text Input"
                placeholder="e.g. Jane Doe"
                helperText="Standard input with accessible label"
              />
              <Input
                label="Error State Input"
                defaultValue="invalid-email"
                error="Please provide a valid corporate email"
              />
              <Select
                label="Sample Select Dropdown"
                options={[
                  { value: 'opt-1', label: 'Priority Express (1-2 Days)' },
                  { value: 'opt-2', label: 'Standard Tracked (3-5 Days)' },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-6 pt-2">
              <Checkbox label="Send me promotional discount drops" defaultChecked />
              <Checkbox label="Disabled option" disabled />
            </div>
          </div>

          {/* Toast Triggers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              4. Notification Toasts
            </h4>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify.success('Item successfully placed into your bag.', 'Cart Updated')}
              >
                Trigger Success Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify.error('Payment card verification failed. Try another card.', 'Payment Error')}
              >
                Trigger Error Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify.warning('Only 2 units remaining in stock!', 'Low Inventory')}
              >
                Trigger Warning Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify.info('Free shipping unlocked on your current order.', 'Promotion Applied')}
              >
                Trigger Info Toast
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 3. CATEGORIES SHOWCASE */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Curated Departments
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
              Explore by Category
            </h2>
          </div>
          <Link
            to="/products"
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.slug);
                const elem = document.getElementById('featured-products');
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group cursor-pointer bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-card-hover transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <span className="text-xs font-medium text-emerald-300">
                    {cat.itemCount} Items
                  </span>
                  <h3 className="text-base font-bold leading-tight">
                    {cat.name}
                  </h3>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-gray-500 leading-relaxed">
                  {cat.description}
                </p>
                <div className="mt-3 pt-2 text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                  <span>Shop Collection</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURED PRODUCTS & DESIGN SYSTEM FILTER CONTROLS */}
      <section id="featured-products" className="space-y-6 pt-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Current Catalog
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">Live Inventory Preview</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
              Featured Products & Design Testbed
            </h2>
          </div>

          {/* Reviewer State Switcher (Normal / Skeleton / Empty / Error) */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 self-start md:self-auto text-xs font-medium">
            <span className="px-2 text-gray-400 font-semibold uppercase text-[10px]">
              State View:
            </span>
            <button
              type="button"
              onClick={() => setViewState('normal')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewState === 'normal'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Normal ({filteredProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setViewState('loading')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewState === 'loading'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Loading Skeleton
            </button>
            <button
              type="button"
              onClick={() => setViewState('empty')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewState === 'empty'
                  ? 'bg-white text-gray-900 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Empty State
            </button>
            <button
              type="button"
              onClick={() => setViewState('error')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewState === 'error'
                  ? 'bg-white text-red-700 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Error State
            </button>
          </div>
        </div>

        {/* Filters & Search Control Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Categories
            </button>
            {MOCK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Query and Sorting Selector */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="w-full sm:w-60">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Filter items..."
                size="sm"
              />
            </div>

            <div className="w-40 flex-shrink-0">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'featured', label: 'Sort: Featured' },
                  { value: 'price-low', label: 'Price: Low to High' },
                  { value: 'price-high', label: 'Price: High to Low' },
                  { value: 'rating', label: 'Highest Rated' },
                ]}
                className="py-1.5 text-xs"
              />
            </div>
          </div>
        </div>

        {/* View State Rendering: Normal / Loading / Empty / Error */}
        {viewState === 'error' ? (
          <ErrorState
            title="Unable to load catalog"
            message="Simulated error state to verify error recovery design and retry button mechanics."
            onRetry={() => {
              setViewState('normal');
              notify.success('Catalog restored successfully.', 'State Reset');
            }}
          />
        ) : (
          <ProductGrid
            products={filteredProducts}
            isLoading={viewState === 'loading'}
            skeletonCount={8}
            onQuickView={(p) => setQuickViewProduct(p)}
            emptyState={
              <EmptyState
                title="No items matched your filters"
                description={`No products found matching "${searchQuery}" in ${
                  selectedCategory === 'all' ? 'any category' : selectedCategory
                }.`}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setViewState('normal');
                    }}
                  >
                    Reset All Filters
                  </Button>
                }
              />
            }
          />
        )}
      </section>

      {/* 5. PROMOTIONAL FLASH SALE BANNER */}
      <section className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Limited-Time Bundle Drop
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Acoustic Studio + Smartwear Ecosystem
            </h3>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
              Pair any Aura Studio Headphone with a Chronos Vanguard Titanium Watch and receive an instant $80 credit at checkout.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                addItem(MOCK_PRODUCTS[0], 1);
                addItem(MOCK_PRODUCTS[1], 1);
                openCart();
              }}
            >
              Claim Bundle Deal
            </Button>
          </div>
        </div>
      </section>

      {/* 6. CUSTOMER REVIEWS & SOCIAL PROOF */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Customer Confidence
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            Trusted by Creators & Professionals
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Over 12,000 verified orders delivered globally with a 99.4% customer satisfaction index.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_REVIEWS.map((rev) => (
            <div
              key={rev.id}
              className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <RatingStars rating={rev.rating} size="sm" showScore={false} />
                <p className="mt-3 text-sm text-gray-700 leading-relaxed italic">
                  "{rev.comment}"
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{rev.author}</h4>
                  <span className="text-xs text-gray-500">{rev.role}</span>
                </div>
                <Badge variant="success" size="sm" dot>
                  Verified Buyer
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Quick View Modal */}
      <QuickViewModal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        product={quickViewProduct}
      />
    </div>
  );
};
