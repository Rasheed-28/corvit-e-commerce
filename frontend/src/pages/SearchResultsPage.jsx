import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { SearchInput } from '../components/common/SearchInput';
import { ProductGrid } from '../components/product/ProductGrid';
import { QuickViewModal } from '../components/product/QuickViewModal';
import { Select } from '../components/common/Select';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { AlertBanner } from '../components/common/AlertBanner';
import { catalogApi } from '../api/catalogApi';

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const sortBy = searchParams.get('sort') || 'featured';

  const [inputVal, setInputVal] = useState(query);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  useEffect(() => {
    setInputVal(query);
  }, [query]);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    catalogApi
      .getProducts({
        search: query,
        sort: sortBy,
        page_size: 24,
      })
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setProducts(res.data);
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.error('Failed to search products:', err);
        setErrorMessage(err.message || 'Error occurred while querying search catalog.');
        setProducts([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [query, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ q: inputVal.trim(), sort: sortBy });
    }
  };

  const handlePopularClick = (term) => {
    setInputVal(term);
    setSearchParams({ q: term, sort: sortBy });
  };

  const popularSearches = ['Headphones', 'Titanium', 'Backpack', 'Keyboard', 'Walnut', 'Wireless'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Search Results' }]} />

      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-10 shadow-xs space-y-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Catalog Search
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">
              {products.length} {products.length === 1 ? 'Result' : 'Results'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight">
            {query ? (
              <span>
                Search results for <span className="text-emerald-700">"{query}"</span>
              </span>
            ) : (
              'Search NovaStore Catalog'
            )}
          </h1>
        </div>

        {/* Search Field & Sort Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-lg">
            <SearchInput
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onClear={() => {
                setInputVal('');
                setSearchParams({});
              }}
              placeholder="Search by product name, category, or features..."
              size="md"
            />
          </form>

          <div className="w-full sm:w-48 self-end sm:self-auto">
            <Select
              value={sortBy}
              onChange={(e) => setSearchParams({ q: query, sort: e.target.value })}
              options={[
                { value: 'featured', label: 'Sort: Relevant' },
                { value: 'price-low', label: 'Price: Low to High' },
                { value: 'price-high', label: 'Price: High to Low' },
                { value: 'newest', label: 'Newest Releases' },
              ]}
            />
          </div>
        </div>

        {/* Popular Search Suggestions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          <span className="text-gray-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            Suggested:
          </span>
          {popularSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => handlePopularClick(term)}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 font-medium transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <AlertBanner variant="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </AlertBanner>
      )}

      {/* Results Grid */}
      <ProductGrid
        products={products}
        isLoading={isLoading}
        skeletonCount={8}
        onQuickView={(p) => setQuickViewProduct(p)}
        emptyState={
          <EmptyState
            icon={<Search className="w-8 h-8 text-gray-400" />}
            title={`No products found for "${query}"`}
            description="We couldn't find any products matching your search terms. Check your spelling or try broader keywords."
            action={
              <Link to="/products">
                <Button variant="primary" size="md">
                  View All Products
                </Button>
              </Link>
            }
          />
        }
      />

      {/* Quick View Modal */}
      <QuickViewModal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        product={quickViewProduct}
      />
    </div>
  );
};
