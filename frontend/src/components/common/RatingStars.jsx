import React from 'react';
import { Star } from 'lucide-react';

/**
 * Accessible Star Rating visualizer with review count and score indicator.
 */
export const RatingStars = ({
  rating = 0,
  reviewCount,
  size = 'sm',
  showScore = true,
  className = '',
}) => {
  const sizeMap = {
    xs: { star: 'w-3 h-3', text: 'text-[11px]' },
    sm: { star: 'w-3.5 h-3.5', text: 'text-xs' },
    md: { star: 'w-4 h-4', text: 'text-sm' },
    lg: { star: 'w-5 h-5', text: 'text-base' },
  };

  const { star: starSize, text: textSize } = sizeMap[size] || sizeMap.sm;

  // Round rating to 1 decimal place
  const roundedRating = Math.round(rating * 10) / 10;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      aria-label={`${roundedRating} out of 5 stars${reviewCount !== undefined ? ` based on ${reviewCount} reviews` : ''}`}
    >
      <div className="flex items-center text-amber-400" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => {
          const filled = rating >= index;
          const half = !filled && rating >= index - 0.5;

          return (
            <span key={index} className="relative inline-block">
              {half ? (
                <div className="relative">
                  {/* Empty base star */}
                  <Star className={`${starSize} text-gray-200 fill-gray-200`} />
                  {/* Half overlay */}
                  <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
                    <Star className={`${starSize} text-amber-400 fill-amber-400`} />
                  </div>
                </div>
              ) : (
                <Star
                  className={`${starSize} ${
                    filled
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-200 fill-gray-200'
                  }`}
                />
              )}
            </span>
          );
        })}
      </div>

      {showScore && (
        <span className={`font-semibold text-gray-800 ${textSize}`}>
          {roundedRating.toFixed(1)}
        </span>
      )}

      {reviewCount !== undefined && (
        <span className={`text-gray-500 font-normal ${textSize}`}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
};
