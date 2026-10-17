import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ProductCard } from '../components/product/ProductCard';
import { QuickViewModal } from '../components/product/QuickViewModal';
import { useWishlist } from '../contexts/WishlistContext';

export const WishlistPage = () => {
  const { wishlist, totalWishlistItems, clearWishlist } = useWishlist();
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Saved Wishlist' }]} />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Personal Collection
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="text-xs text-gray-500">
              {totalWishlistItems} {totalWishlistItems === 1 ? 'Item' : 'Items'} Saved
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
            My Saved Wishlist
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Keep track of the pieces you love and easily add them to your shopping bag.
          </p>
        </div>

        {totalWishlistItems > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearWishlist}
            className="text-gray-500 hover:text-red-600 self-start sm:self-auto"
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Clear Wishlist
          </Button>
        )}
      </div>

      {/* Wishlist Items Grid or Empty State */}
      {totalWishlistItems === 0 ? (
        <EmptyState
          icon={<Heart className="w-8 h-8 text-rose-500" />}
          title="Your Wishlist is Empty"
          description="You haven't saved any items to your wishlist yet. Tap the heart icon on any product to save it here for later."
          action={
            <Link to="/products">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Explore Catalog
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlist.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={(p) => setQuickViewProduct(p)}
            />
          ))}
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        product={quickViewProduct}
      />
    </div>
  );
};
