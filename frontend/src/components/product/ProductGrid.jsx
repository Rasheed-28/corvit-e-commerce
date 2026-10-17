import React from 'react';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import { EmptyState } from '../common/EmptyState';

/**
 * Responsive Product Grid supporting loading skeletons, empty states, and custom column layouts.
 */
export const ProductGrid = ({
  products = [],
  isLoading = false,
  skeletonCount = 8,
  onQuickView,
  emptyState,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
        aria-busy="true"
        aria-label="Loading products"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      emptyState || (
        <EmptyState
          title="No products matched your criteria"
          description="Try broadening your search keywords, clearing your active filters, or check back soon for restocks."
        />
      )
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
      role="region"
      aria-label="Product list"
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onQuickView={onQuickView}
        />
      ))}
    </div>
  );
};
