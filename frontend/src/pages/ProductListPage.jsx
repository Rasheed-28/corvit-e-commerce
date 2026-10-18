import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, ArrowUpDown, X, Check, Filter } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { ProductGrid } from '../components/product/ProductGrid';
import { QuickViewModal } from '../components/product/QuickViewModal';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Checkbox } from '../components/common/Checkbox';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Drawer } from '../components/common/Drawer';
import { Pagination } from '../components/common/Pagination';
import { AlertBanner } from '../components/common/AlertBanner';
import { catalogApi } from '../api/catalogApi';

export const ProductListPage = () => {
  const { slug } = useParams(); // For /categories/:slug
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_count: 0 });
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Filters
  const selectedCategory = slug || searchParams.get('category') || 'all';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const inStockOnly = searchParams.get('in_stock') === 'true';
  const sortBy = searchParams.get('sort') || 'featured';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Load Categories once
  useEffect(() => {
    catalogApi.getCategories().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    });
  }, []);

  // Sync current category info
  useEffect(() => {
    if (slug) {
      catalogApi.getCategory(slug)
        .then((res) => {
          if (res?.success) setCurrentCategory(res.data);
        })
        .catch(() => setCurrentCategory(null));
    } else {
      setCurrentCategory(null);
    }
  }, [slug]);

  // Fetch Products based on current filters and page from Django REST API
  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    catalogApi.getProducts({
      category: selectedCategory,
      min_price: minPrice,
      max_price: maxPrice,
      in_stock: inStockOnly,
      sort: sortBy,
      page: currentPage,
      page_size: 12,
    })
      .then((res) => {
        if (res?.success) {
          setProducts(res.data || []);
          if (res.meta?.pagination) {
            setPagination(res.meta.pagination);
          }
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
        setErrorMessage(err.message || 'Failed to load products from server.');
        setProducts([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedCategory, minPrice, maxPrice, inStockOnly, sortBy, currentPage]);

  const updateFilters = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        updated.delete(key);
      } else {
        updated.set(key, val);
      }
    });
    // Reset to page 1 when filters change
    if (!newParams.page) {
      updated.set('page', '1');
    }
    setSearchParams(updated);
  };

  const clearAllFilters = () => {
    setSearchParams({});
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (inStockOnly) count++;
    return count;
  }, [minPrice, maxPrice, inStockOnly]);

  const pageTitle = currentCategory ? currentCategory.name : 'All Products';
  const pageDescription = currentCategory
    ? currentCategory.description
    : 'Discover our comprehensive catalog of acoustic audio gear, titanium wearables, and elevated workspace essentials.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={
          currentCategory
            ? [{ label: 'Catalog', to: '/products' }, { label: currentCategory.name }]
            : [{ label: 'Catalog' }]
        }
      />

      {/* Page Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              NovaStore Catalog
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">
              {pagination.total_count} {pagination.total_count === 1 ? 'Product' : 'Products'} Available
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
            {pageTitle}
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
            {pageDescription}
          </p>
        </div>

        {/* Mobile Filter Toggle & Sort Dropdown */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            className="lg:hidden flex items-center gap-2"
            onClick={() => setIsMobileFilterOpen(true)}
            leftIcon={<SlidersHorizontal className="w-4 h-4" />}
          >
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <div className="w-48">
            <Select
              value={sortBy}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              options={[
                { value: 'featured', label: 'Featured First' },
                { value: 'newest', label: 'Newest Arrivals' },
                { value: 'price-low', label: 'Price: Low to High' },
                { value: 'price-high', label: 'Price: High to Low' },
              ]}
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <AlertBanner variant="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </AlertBanner>
      )}

      {/* Main Layout Grid (Desktop Sidebar + Product Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 bg-white p-6 rounded-3xl border border-gray-200/90 shadow-xs space-y-6 sticky top-24">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Filters</span>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Reset All ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Department Categories List */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Department
            </span>
            <div className="space-y-1">
              <Link
                to="/products"
                className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All Departments
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    selectedCategory === cat.slug
                      ? 'bg-emerald-50 text-emerald-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Price Range ($)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => updateFilters({ min_price: e.target.value })}
                className="text-xs"
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => updateFilters({ max_price: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          {/* Availability Checkbox */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Availability
            </span>
            <Checkbox
              id="instock-filter"
              label="In Stock Only"
              checked={inStockOnly}
              onChange={(e) => updateFilters({ in_stock: e.target.checked ? 'true' : null })}
            />
          </div>
        </aside>

        {/* Product Grid & Pagination Area */}
        <main className="lg:col-span-3 space-y-8">
          <ProductGrid
            products={products}
            isLoading={isLoading}
            skeletonCount={6}
            onQuickView={(p) => setQuickViewProduct(p)}
          />

          {/* Pagination Controls */}
          {!isLoading && pagination.total_pages > 1 && (
            <div className="pt-6 border-t border-gray-200">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.total_pages}
                onPageChange={(newPage) => updateFilters({ page: newPage.toString() })}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filters Drawer */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Filter Products"
        position="right"
      >
        <div className="space-y-6 p-4">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Department
            </span>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  updateFilters({ category: null });
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-700'
                }`}
              >
                All Departments
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    updateFilters({ category: cat.slug });
                    setIsMobileFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                    selectedCategory === cat.slug
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Price Bounds ($)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => updateFilters({ min_price: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => updateFilters({ max_price: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Checkbox
              id="mobile-instock"
              label="In Stock Only"
              checked={inStockOnly}
              onChange={(e) => updateFilters({ in_stock: e.target.checked ? 'true' : null })}
            />
          </div>

          <div className="pt-6 flex gap-3">
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                clearAllFilters();
                setIsMobileFilterOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => setIsMobileFilterOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Quick View Modal */}
      <QuickViewModal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        product={quickViewProduct}
      />
    </div>
  );
};
