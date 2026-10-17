import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Eye, ShoppingBag, Check } from 'lucide-react';
import { Badge } from '../common/Badge';
import { PriceDisplay } from '../common/PriceDisplay';
import { RatingStars } from '../common/RatingStars';
import { Button } from '../common/Button';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';

/**
 * Premium, accessible Product Card component.
 */
export const ProductCard = ({
  product,
  onQuickView,
  className = '',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const isWishlisted = isInWishlist(product.id);
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';
  const productUrl = `/products/${product.slug || product.id}`;

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    setIsAdding(true);
    setTimeout(() => {
      addItem(product, 1, product.colors?.[0]?.name || null);
      setIsAdding(false);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    }, 300);
  };

  const handleQuickViewClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    }
  };

  return (
    <div
      className={`
        group relative flex flex-col bg-white rounded-2xl border border-gray-200/90
        shadow-xs hover:shadow-card-hover transition-all duration-300 overflow-hidden h-full
        ${className}
      `}
    >
      {/* Product Image Media Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100">
        <Link to={productUrl} className="block w-full h-full">
          <img
            src={mainImage}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        </Link>

        {/* Top Badges Stack */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start pointer-events-none">
          {product.originalPrice && product.originalPrice > product.price && (
            <Badge variant="discount" size="sm">
              Sale -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
            </Badge>
          )}
          {product.isNew && (
            <Badge variant="primary" size="sm">
              New
            </Badge>
          )}
          {product.isBestseller && (
            <Badge variant="dark" size="sm">
              Bestseller
            </Badge>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isWishlisted ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          aria-pressed={isWishlisted}
          className={`
            absolute top-3 right-3 z-10 p-2 rounded-full shadow-md backdrop-blur-md transition-all duration-200
            focus-visible:ring-2 focus-visible:ring-emerald-500
            ${
              isWishlisted
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-white/90 text-gray-600 hover:text-rose-600 hover:bg-white'
            }
          `}
        >
          <Heart
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isWishlisted ? 'fill-rose-500 text-rose-500' : ''
            }`}
          />
        </button>

        {/* Quick View Floating Action Overlay */}
        <div className="absolute inset-x-0 bottom-3 px-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="pointer-events-auto w-full max-w-[200px] py-2 px-3 bg-white/95 backdrop-blur-md text-gray-800 text-xs font-semibold rounded-xl shadow-lg border border-gray-200/80 hover:bg-white hover:text-emerald-700 flex items-center justify-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Eye className="w-3.5 h-3.5" />
            Quick View
          </button>
        </div>

        {/* Out of Stock Backdrop Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <span className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Product Content Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Inventory Status */}
          <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
            <span className="text-gray-500 font-medium truncate uppercase tracking-wider text-[11px]">
              {product.category}
            </span>

            {isLowStock ? (
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Only {product.stock} left
              </span>
            ) : !isOutOfStock ? (
              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                In Stock
              </span>
            ) : null}
          </div>

          {/* Product Title */}
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-emerald-700 transition-colors">
            <Link to={productUrl}>{product.title}</Link>
          </h3>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="xs" />
          </div>

          {/* Color Options Preview */}
          {product.colors && product.colors.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5" aria-label="Available color options">
              {product.colors.map((c, i) => (
                <span
                  key={i}
                  title={c.name}
                  className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-2xs"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <span className="text-[10px] text-gray-400 ml-1">
                {product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'}
              </span>
            </div>
          )}
        </div>

        {/* Price & Action Bottom Row */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <PriceDisplay
            price={product.price}
            originalPrice={product.originalPrice}
            size="sm"
            showBadge={false}
          />

          <Button
            size="sm"
            variant={justAdded ? 'subtle' : isOutOfStock ? 'outline' : 'primary'}
            disabled={isOutOfStock}
            isLoading={isAdding}
            onClick={handleAddToCart}
            leftIcon={
              justAdded ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5" />
              )
            }
            className="flex-shrink-0"
            aria-label={`Add ${product.title} to shopping cart`}
          >
            {justAdded ? 'Added' : isOutOfStock ? 'Sold Out' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
};
