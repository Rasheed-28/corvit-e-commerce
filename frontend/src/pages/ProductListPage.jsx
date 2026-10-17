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
import { mockCatalogApi } from '../api/mockAdapter';

export const ProductListPage = () => {
  const { slug } = useParams(); // For /categories/:slug
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
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
    mockCatalogApi.getCategories().then((res) => {
      if (res?.success) setCategories(res.data);
    });
  }, []);

  // Sync current category info
  useEffect(() => {
    if (slug) {
      mockCatalogApi.getCategory(slug)
        .then((res) => {
          if (res?.success) setCurrentCategory(res.data);
        })
        .catch(() => setCurrentCategory(null));
    } else {
      setCurrentCategory(null);
    }
  }, [slug]);

  // Fetch Products based on current filters and page
  useEffect(() => {
    setIsLoading(true);
    mockCatalogApi.getProducts({
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
          setProducts(res.data);
          setPagination(res.meta.pagination);
        }
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
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
    setSearchParams(slug ? {} : {});
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
                { value: 'rating', label: 'Highest Rated' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Grid & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>Filters</span>
            </h3>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Department
            </h4>
            <div className="space-y-1">
              <Link
                to="/products"
                className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  !slug && selectedCategory === 'all'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Departments
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/categories/${c.slug}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    slug === c.slug
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-gray-400 font-normal">{c.itemCount}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Availability
            </h4>
            <Checkbox
              id="instock-checkbox"
              label="In Stock Only"
              description="Hide out of stock items"
              checked={inStockOnly}
              onChange={(e) => updateFilters({ in_stock: e.target.checked ? 'true' : '' })}
            />
          </div>

          {/* Price Filter */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Price Range ($)
            </h4>
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
        </aside>

        {/* Product Grid Area */}
        <div className="lg:col-span-3 space-y-8">
          <ProductGrid
            products={products}
            isLoading={isLoading}
            skeletonCount={6}
            onQuickView={(p) => setQuickViewProduct(p)}
          />

          {/* Pagination */}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.total_pages}
            onPageChange={(p) => updateFilters({ page: p })}
          />
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Filter Catalog"
        placement="left"
        size="sm"
        footer={
          <div className="flex gap-2">
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
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Departments
            </h4>
            <div className="space-y-1">
              <Link
                to="/products"
                onClick={() => setIsMobileFilterOpen(false)}
                className={`block p-2 rounded-lg text-xs font-semibold ${
                  !slug ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700'
                }`}
              >
                All Departments
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/categories/${c.slug}`}
                  onClick={() => setIsMobileFilterOpen(false)}
                  className={`block p-2 rounded-lg text-xs font-semibold ${
                    slug === c.slug ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700'
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Checkbox
              id="instock-checkbox-mobile"
              label="In Stock Only"
              checked={inStockOnly}
              onChange={(e) => updateFilters({ in_stock: e.target.checked ? 'true' : '' })}
            />
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Price Range ($)
            </h4>
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
