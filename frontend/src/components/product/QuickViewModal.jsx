import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { PriceDisplay } from '../common/PriceDisplay';
import { RatingStars } from '../common/RatingStars';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { QuantityPicker } from '../common/QuantityPicker';
import { useCart } from '../../contexts/CartContext';
import { ShoppingBag, Check, ShieldCheck, Truck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Interactive Quick View modal for detailed product preview.
 */
export const QuickViewModal = ({
  isOpen,
  onClose,
  product,
}) => {
  if (!product) return null;

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.name || null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const { addItem } = useCart();

  useEffect(() => {
    if (product) {
      setSelectedImageIndex(0);
      setSelectedColor(product.colors?.[0]?.name || null);
      setQuantity(1);
      setAdded(false);
    }
  }, [product]);

  const images = product.images && product.images.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'];

  const currentImage = images[selectedImageIndex] || images[0];
  const isOutOfStock = product.stock === 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAdding(true);

    setTimeout(() => {
      addItem(product, quantity, selectedColor);
      setIsAdding(false);
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        onClose();
      }, 1000);
    }, 300);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Product Quick Preview"
      description={`SKU: ${product.sku || 'N/A'}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-2">
        {/* Gallery / Images Column */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
            <img
              src={currentImage}
              alt={product.title}
              className="w-full h-full object-cover object-center"
            />
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="absolute top-3 left-3">
                <Badge variant="discount" size="sm">
                  Sale -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                </Badge>
              </div>
            )}
          </div>

          {/* Thumbnail row */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImageIndex === idx
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Column */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {product.category}
                </span>
                {product.stock > 0 ? (
                  <Badge variant="success" size="sm" dot>
                    {product.stock <= 5 ? `Only ${product.stock} left` : 'In Stock'}
                  </Badge>
                ) : (
                  <Badge variant="danger" size="sm">
                    Out of Stock
                  </Badge>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-gray-950 tracking-tight leading-snug">
                {product.title}
              </h2>

              <div className="mt-2.5 flex items-center gap-3">
                <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="sm" />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <PriceDisplay
                price={product.price}
                originalPrice={product.originalPrice}
                size="lg"
              />
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>

            {/* Color Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-900 block">
                  Colorway: <span className="font-normal text-gray-600">{selectedColor}</span>
                </span>
                <div className="flex items-center gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      title={c.name}
                      className={`w-7 h-7 rounded-full border-2 transition-all p-0.5 ${
                        selectedColor === c.name
                          ? 'border-emerald-600 ring-2 ring-emerald-500/30 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
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

            {/* Feature highlights */}
            {product.features && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-gray-900 block mb-2">Key Highlights</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600">
                  {product.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Cart Action Area */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500 block">Quantity</span>
                <QuantityPicker
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={product.stock || 10}
                  disabled={isOutOfStock}
                />
              </div>

              <div className="flex-1 pt-5">
                <Button
                  variant={added ? 'subtle' : 'primary'}
                  size="lg"
                  fullWidth
                  disabled={isOutOfStock}
                  isLoading={isAdding}
                  onClick={handleAddToCart}
                  leftIcon={
                    added ? (
                      <Check className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ShoppingBag className="w-5 h-5" />
                    )
                  }
                >
                  {added ? 'Added to Cart' : isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                </Button>
              </div>
            </div>

            {/* Trust Assurance */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Free 2-day delivery on $50+</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>2-Year Authentic Warranty</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
