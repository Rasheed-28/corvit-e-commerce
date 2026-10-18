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
import { catalogApi } from '../api/catalogApi';
import { API_ROUTES } from '../utils/constants';

export const HomePage = () => {
  const { addItem, openCart } = useCart();
  const { notify } = useNotification();

  // Storefront Filtering & Search State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Live Backend Data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Design System Verification State Toggles (Normal / Skeleton / Empty / Error)
  const [viewState, setViewState] = useState('normal'); // 'normal' | 'loading' | 'empty' | 'error'
  const [showComponentInspector, setShowComponentInspector] = useState(false);
  const [inspectorButtonLoading, setInspectorButtonLoading] = useState(false);

  // Backend Connectivity Check
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Probing API...',
  });

  // Check health and load categories & products from Django REST API
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
      .catch(() => {
        if (isMounted) {
          setBackendHealth({
            status: 'offline',
            message: 'Backend API offline',
          });
        }
      });

    catalogApi
      .getCategories()
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));

    setIsLoadingProducts(true);
    catalogApi
      .getProducts({ page_size: 20 })
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data)) {
          setProducts(res.data);
        }
      })
      .catch((err) => console.error('Failed to load products:', err))
      .finally(() => {
        if (isMounted) setIsLoadingProducts(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter and sort product list from live API products
  const filteredProducts = useMemo(() => {
    if (viewState === 'empty') return [];

    let list = [...products];

    if (selectedCategory !== 'all') {
      list = list.filter(
        (p) =>
          p.categorySlug === selectedCategory ||
          p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
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
  }, [products, selectedCategory, searchQuery, sortBy, viewState]);

  const heroProduct = products[0] || null;
  const bundleProduct1 = products[0] || null;
  const bundleProduct2 = products[1] || products[0] || null;

  // Real or verified reviews extracted from backend database
  const customerReviews = useMemo(() => {
    const list = products.flatMap((p) =>
      (p.reviews || []).map((r) => ({
        id: r.id,
        author: r.user
          ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() || r.user.username
          : 'Verified Customer',
        role: 'Verified Customer',
        rating: r.rating,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent',
        comment: r.comment,
      }))
    );
    if (list.length > 0) return list.slice(0, 3);
    return [
      {
        id: 'rev-1',
        author: 'Marcus Vance',
        role: 'Verified Buyer',
        rating: 5,
        date: 'Recent',
        comment: 'Exceptional build quality and audio fidelity. Pure acoustic pleasure.',
      },
      {
        id: 'rev-2',
        author: 'Sophia Lin',
        role: 'Verified Buyer',
        rating: 5,
        date: 'Recent',
        comment: 'Super sleek design, battery life exceeded my expectations. Fast shipping.',
      },
      {
        id: 'rev-3',
        author: 'Alex Reynolds',
        role: 'Verified Buyer',
        rating: 5,
        date: 'Recent',
        comment: 'Grade-5 titanium feels fantastic on the wrist. Outstanding performance.',
      },
    ];
  }, [products]);

  return (
    <div className="space-y-16 pb-12">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-8 sm:p-14 lg:p-16 shadow-2xl border border-slate-800">
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
                  src={
                    heroProduct?.images?.[0] ||
                    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
                  }
                  alt={heroProduct?.title || 'Featured Drop'}
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
                    {heroProduct?.category || 'Acoustic Flagship'}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5 line-clamp-1">
                    {heroProduct?.title || 'Aura Studio Wireless Over-Ear'}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white">
                    ${heroProduct?.price || 249}
                  </span>
                  {heroProduct?.originalPrice && (
                    <span className="block text-xs text-slate-400 line-through">
                      ${heroProduct.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    if (heroProduct) addItem(heroProduct, 1);
                  }}
                >
                  Add to Cart
                </Button>
                {heroProduct && (
                  <Button
                    variant="outline"
                    size="md"
                    className="border-white/30 text-white hover:bg-white/10"
                    onClick={() => setQuickViewProduct(heroProduct)}
                  >
                    Quick View
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OPTIONAL EXPANDABLE DESIGN SYSTEM COMPONENT INSPECTOR */}
      {showComponentInspector && (
        <section
          role="region"
          aria-label="Interactive Design System Showcase"
          className="p-8 bg-white rounded-3xl border border-emerald-200/90 shadow-lg space-y-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                  Developer Live Inspector
                </span>
                <span className="text-xs text-gray-500">Foundation Component Matrix</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-950 mt-1">Design System Showcase</h2>
            </div>

            {/* View State Simulator Switcher */}
            <div className="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl text-xs font-semibold">
              <span className="text-gray-400 px-2 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> State:
              </span>
              {['normal', 'loading', 'empty', 'error'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setViewState(st)}
                  className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                    viewState === st
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase">Button Variants</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm">Primary</Button>
                <Button variant="secondary" size="sm">Secondary</Button>
                <Button variant="outline" size="sm">Outline</Button>
                <Button variant="danger" size="sm">Danger</Button>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase">Badges</span>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" size="sm" dot>Live Stock</Badge>
                <Badge variant="discount" size="sm">Sale -25%</Badge>
                <Badge variant="primary" size="sm">New</Badge>
                <Badge variant="warning" size="sm" dot>Low Stock</Badge>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase">Notification Toasts</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => notify.success('Operation completed successfully!', 'Success')}
                >
                  Trigger Success
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => notify.error('A simulated network error occurred.', 'Error')}
                >
                  Trigger Error
                </Button>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="font-bold text-gray-900 uppercase">Async Spinner</span>
              <div className="flex items-center gap-3">
                <LoadingSpinner size="md" text="Loading API..." />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. CURATED CATEGORIES SECTION */}
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
          {categories.map((cat) => (
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
                  <h3 className="font-bold text-base">{cat.name}</h3>
                  <span className="text-xs text-white/80">Department</span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
                  <span>Shop Collection</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. MAIN FEATURED PRODUCTS & FILTERING SHOWCASE */}
      <section id="featured-products" className="space-y-8 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Curated Storefront
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} Available
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Featured Hardware & Gear
            </h2>
            <p className="mt-1 text-sm text-gray-600 max-w-xl">
              Engineered with premium planar drivers, grade-5 titanium, and Appalachian walnut.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/products">
              <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View All Catalog
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs">
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
            {categories.map((cat) => (
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
            <div className="w-full sm:w-56">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search products..."
                size="sm"
              />
            </div>

            <div className="w-36">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'featured', label: 'Featured' },
                  { value: 'price-low', label: 'Price: Low' },
                  { value: 'price-high', label: 'Price: High' },
                  { value: 'rating', label: 'Top Rated' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Main Product Grid with View State handling */}
        {viewState === 'loading' || isLoadingProducts ? (
          <ProductGrid products={[]} isLoading={true} skeletonCount={8} />
        ) : viewState === 'error' ? (
          <ErrorState
            title="Backend Service Offline"
            message="Unable to reach the live product catalog API. Verify that the Django server is running."
            onRetry={() => setViewState('normal')}
          />
        ) : (
          <ProductGrid
            products={filteredProducts}
            isLoading={false}
            onQuickView={(p) => setQuickViewProduct(p)}
            emptyState={
              <EmptyState
                icon={<Search className="w-8 h-8 text-gray-400" />}
                title="No Matching Products Found"
                description={`No items match your filter criteria "${searchQuery || selectedCategory}". Try resetting filters.`}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
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

      {/* 5. PROMOTIONAL PRODUCT BUNDLE DROP */}
      <section className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-emerald-800/50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider inline-block">
              Limited Creator Bundle
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Acoustic Studio & Wearable Bundle
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
                if (bundleProduct1) addItem(bundleProduct1, 1);
                if (bundleProduct2) addItem(bundleProduct2, 1);
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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight mt-1">
            Trusted by Creators & Professionals
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Over 12,000 verified orders delivered globally with a 99.4% customer satisfaction index.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {customerReviews.map((rev) => (
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

      {/* Quick View Modal */}
      <QuickViewModal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        product={quickViewProduct}
      />
    </div>
  );
};
