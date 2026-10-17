import React from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Accessible Price Display component supporting current price, original price,
 * discount percentages, and sizes.
 */
export const PriceDisplay = ({
  price,
  originalPrice,
  currency = 'USD',
  size = 'md',
  showBadge = true,
  className = '',
}) => {
  const isDiscounted = originalPrice && originalPrice > price;
  const discountPercent = isDiscounted
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const sizeClasses = {
    xs: {
      current: 'text-sm font-semibold text-gray-900',
      original: 'text-xs text-gray-400 line-through',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    sm: {
      current: 'text-base font-bold text-gray-900',
      original: 'text-xs text-gray-400 line-through',
      badge: 'text-[11px] px-1.5 py-0.5',
    },
    md: {
      current: 'text-lg font-bold text-gray-900',
      original: 'text-sm text-gray-400 line-through',
      badge: 'text-xs px-2 py-0.5',
    },
    lg: {
      current: 'text-2xl font-extrabold text-gray-950 tracking-tight',
      original: 'text-base text-gray-400 line-through font-normal',
      badge: 'text-xs px-2.5 py-1',
    },
    xl: {
      current: 'text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight',
      original: 'text-lg sm:text-xl text-gray-400 line-through font-normal',
      badge: 'text-sm px-3 py-1',
    },
  }[size] || {
    current: 'text-lg font-bold text-gray-900',
    original: 'text-sm text-gray-400 line-through',
    badge: 'text-xs px-2 py-0.5',
  };

  const formattedCurrent = formatCurrency(price, currency);
  const formattedOriginal = isDiscounted ? formatCurrency(originalPrice, currency) : null;

  return (
    <div
      className={`inline-flex items-baseline flex-wrap gap-x-2 gap-y-1 ${className}`}
      aria-label={
        isDiscounted
          ? `Current price ${formattedCurrent}, regular price was ${formattedOriginal}, save ${discountPercent} percent`
          : `Price: ${formattedCurrent}`
      }
    >
      <span className={sizeClasses.current}>{formattedCurrent}</span>

      {isDiscounted && (
        <>
          <span className={sizeClasses.original} aria-hidden="true">
            {formattedOriginal}
          </span>
          {showBadge && (
            <span
              className={`font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 inline-flex items-center ${sizeClasses.badge}`}
              aria-hidden="true"
            >
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  );
};
