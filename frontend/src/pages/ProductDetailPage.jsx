import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Heart,
  ShoppingBag,
  Check,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Star,
  MessageSquarePlus,
  Package,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { PriceDisplay } from '../components/common/PriceDisplay';
import { RatingStars } from '../components/common/RatingStars';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { QuantityPicker } from '../components/common/QuantityPicker';
import { ProductGrid } from '../components/product/ProductGrid';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { AlertBanner } from '../components/common/AlertBanner';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../hooks/useAuth';
import { catalogApi } from '../api/catalogApi';

export const ProductDetailPage = () => {
  const { slug } = useParams();
  const { addItem, openCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { notify } = useNotification();
  const { isAuthenticated, user } = useAuth();

  // Component State
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Review Form Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewsList, setReviewsList] = useState([]);

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);
    setSelectedImageIndex(0);
    setQuantity(1);
    setJustAdded(false);

    catalogApi
      .getProduct(slug)
      .then((res) => {
        if (res?.success && res.data) {
          const prod = res.data;
          setProduct(prod);
          setSelectedColor(prod.colors?.[0]?.name || null);

          // Populate real reviews from product model
          const mappedReviews = (prod.reviews || []).map((r) => ({
            id: r.id,
            author: r.user
              ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() || r.user.username
              : 'Verified Customer',
            rating: r.rating,
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent',
            title: r.title,
            comment: r.comment,
          }));
          setReviewsList(mappedReviews);

          // Fetch related products from backend
          return catalogApi.getRelatedProducts(prod.slug, prod.categorySlug, 4);
        } else {
          setNotFound(true);
        }
      })
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setRelatedProducts(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load product detail:', err);
        setNotFound(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square skeleton-shimmer bg-gray-200 rounded-3xl" />
          <div className="space-y-6">
            <div className="h-4 w-32 skeleton-shimmer bg-gray-200 rounded" />
            <div className="h-8 w-3/4 skeleton-shimmer bg-gray-200 rounded" />
            <div className="h-6 w-24 skeleton-shimmer bg-gray-200 rounded" />
            <div className="h-24 w-full skeleton-shimmer bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <EmptyState
          icon={<Package className="w-10 h-10 text-gray-400" />}
          title="Product Not Found"
          description={`The product "${slug}" could not be located or may have been discontinued.`}
          action={
            <Link to="/products">
              <Button variant="primary" size="md">
                Browse All Products
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isWishlisted = isInWishlist(product.id);
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const images = product.images?.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'];
  const activeImage = images[selectedImageIndex] || images[0];

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAdding(true);
    setTimeout(() => {
      addItem(product, quantity, selectedColor);
      setIsAdding(false);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
      openCart();
    }, 250);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError(null);

    if (!isAuthenticated) {
      setReviewError('You must be signed in to submit a product review.');
      notify.error('Please sign in to write a review.', 'Authentication Required');
      return;
    }

    if (!reviewTitle.trim() || !reviewComment.trim()) {
      setReviewError('Please provide a title and comment for your review.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await catalogApi.addReview(product.slug, {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
      });

      if (res?.success) {
        notify.success('Thank you for submitting your review!', 'Review Published');
        setIsReviewModalOpen(false);
        setReviewTitle('');
        setReviewComment('');

        // Refresh reviews list
        const updated = await catalogApi.getProduct(product.slug);
        if (updated?.data?.reviews) {
          const mappedReviews = updated.data.reviews.map((r) => ({
            id: r.id,
            author: r.user
              ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() || r.user.username
              : 'Verified Customer',
            rating: r.rating,
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent',
            title: r.title,
            comment: r.comment,
          }));
          setReviewsList(mappedReviews);
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to submit review. Each customer can review a product once.';
      setReviewError(msg);
      notify.error(msg, 'Review Submission Failed');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-16">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Catalog', to: '/products' },
          { label: product.category, to: `/categories/${product.categorySlug}` },
          { label: product.title },
        ]}
      />

      {/* Main Product Showcase Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Gallery / Image Column (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-gray-100 border border-gray-200/80 shadow-xs">
            <img
              src={activeImage}
              alt={product.title}
              className="w-full h-full object-cover object-center transition-all duration-300"
            />

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.originalPrice && product.originalPrice > product.price && (
                <Badge variant="discount" size="md">
                  Sale -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                </Badge>
              )}
              {product.isNew && <Badge variant="primary" size="md">New Arrival</Badge>}
              {product.isBestseller && <Badge variant="dark" size="md">Bestseller</Badge>}
            </div>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={() => toggleWishlist(product)}
              className={`absolute top-4 right-4 p-3 rounded-full shadow-lg backdrop-blur-md transition-all ${
                isWishlisted
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-white/90 text-gray-700 hover:text-rose-600 hover:bg-white'
              }`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImageIndex === idx
                      ? 'border-emerald-600 ring-4 ring-emerald-500/20'
                      : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Controls (5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                {product.category}
              </span>
              <span className="text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight leading-snug">
              {product.title}
            </h1>

            {/* Rating row */}
            <div className="mt-3 flex items-center gap-3">
              <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="sm" />
              <a href="#reviews" className="text-xs font-semibold text-emerald-600 hover:underline">
                Read all reviews ({reviewsList.length})
              </a>
            </div>
          </div>

          {/* Price */}
          <div className="py-4 border-y border-gray-100">
            <PriceDisplay
              price={product.price}
              originalPrice={product.originalPrice}
              size="xl"
            />
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {product.description}
          </p>

          {/* Colorway Swatches */}
          {product.colors && product.colors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-900">Colorway</span>
                <span className="text-gray-500 font-medium">{selectedColor}</span>
              </div>
              <div className="flex items-center gap-2.5">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(c.name)}
                    className={`w-9 h-9 rounded-full border-2 transition-all p-0.5 flex items-center justify-center ${
                      selectedColor === c.name
                        ? 'border-emerald-600 ring-4 ring-emerald-500/20 scale-105'
                        : 'border-transparent hover:scale-105'
                    }`}
                    title={c.name}
                  >
                    <span
                      className="w-full h-full rounded-full block border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Status Alert */}
          <div>
            {isOutOfStock ? (
              <Badge variant="danger" size="md">Out of Stock</Badge>
            ) : isLowStock ? (
              <Badge variant="warning" size="md" dot>Only {product.stock} units remaining!</Badge>
            ) : (
              <Badge variant="success" size="md" dot>In Stock & Ready to Ship</Badge>
            )}
          </div>

          {/* Quantity & Add to Cart Controls */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-semibold text-gray-700 block mb-1">Quantity</span>
                <QuantityPicker
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={product.stock || 10}
                  disabled={isOutOfStock}
                  size="md"
                />
              </div>

              <div className="flex-1 pt-5">
                <Button
                  variant={justAdded ? 'subtle' : 'primary'}
                  size="lg"
                  fullWidth
                  disabled={isOutOfStock}
                  isLoading={isAdding}
                  onClick={handleAddToCart}
                  leftIcon={
                    justAdded ? <Check className="w-5 h-5 text-emerald-600" /> : <ShoppingBag className="w-5 h-5" />
                  }
                >
                  {justAdded ? 'Added to Bag!' : isOutOfStock ? 'Sold Out' : 'Add to Bag'}
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => toggleWishlist(product)}
              leftIcon={<Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />}
            >
              {isWishlisted ? 'Saved in Wishlist' : 'Add to Saved Wishlist'}
            </Button>
          </div>

          {/* Trust Guarantees */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3 text-xs text-gray-600">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Free express courier shipping on orders over $50</span>
            </div>
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>30-day risk-free return trial policy</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>2-year manufacturer hardware warranty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section id="reviews" className="space-y-6 pt-6 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-950 tracking-tight">
              Customer Feedback & Reviews
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verified community experiences with this piece ({reviewsList.length} reviews)
            </p>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setReviewError(null);
              setIsReviewModalOpen(true);
            }}
            leftIcon={<MessageSquarePlus className="w-4 h-4" />}
          >
            Write a Review
          </Button>
        </div>

        {/* Reviews List */}
        {reviewsList.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-700">No reviews yet for this product.</p>
            <p className="text-xs text-gray-500">Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsList.map((rev) => (
              <div
                key={rev.id}
                className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <RatingStars rating={rev.rating} size="xs" showScore={false} />
                    <span className="text-[11px] text-gray-400">{rev.date}</span>
                  </div>
                  {rev.title && <h4 className="text-xs font-bold text-gray-900 mb-1">{rev.title}</h4>}
                  <p className="text-xs text-gray-700 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                  <span className="font-bold text-gray-900">{rev.author}</span>
                  <Badge variant="success" size="sm" dot>Verified Owner</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Related Products Grid */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-950 tracking-tight">
              Related Pieces You May Like
            </h3>
            <Link to="/products" className="text-xs font-semibold text-emerald-600 hover:underline">
              View All
            </Link>
          </div>
          <ProductGrid products={relatedProducts} skeletonCount={4} />
        </section>
      )}

      {/* Review Submission Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Share Your Experience"
        description={`Reviewing ${product.title}`}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          {reviewError && (
            <AlertBanner variant="danger" onDismiss={() => setReviewError(null)}>
              {reviewError}
            </AlertBanner>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Your Rating (1 to 5 Stars)
            </label>
            <div className="flex gap-2 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Review Headline"
            placeholder="e.g. Exceptional sound and comfort"
            value={reviewTitle}
            onChange={(e) => setReviewTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Your Review
            </label>
            <textarea
              rows={4}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="What did you love about the acoustic fidelity, materials, or daily use?"
              required
              className="w-full rounded-xl border border-gray-300 p-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setIsReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmittingReview}>
              Post Review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
