import React from 'react';
import { Skeleton } from '../common/Skeleton';

/**
 * Loading skeleton component precisely matching ProductCard layout.
 */
export const ProductCardSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col h-full">
      {/* Image Skeleton */}
      <div className="aspect-[4/5] w-full skeleton-shimmer bg-gray-200 relative" />

      {/* Content Skeleton */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Category */}
          <Skeleton className="h-3 w-20" />
          {/* Title */}
          <Skeleton className="h-4.5 w-full" />
          <Skeleton className="h-4.5 w-3/4" />
          {/* Rating */}
          <div className="pt-1 flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          {/* Price */}
          <Skeleton className="h-6 w-24" />
          {/* Button */}
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
