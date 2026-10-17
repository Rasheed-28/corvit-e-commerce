import React from 'react';
import { PackageOpen } from 'lucide-react';

/**
 * Clean Empty State component for missing products, empty carts, or search zero-states.
 */
export const EmptyState = ({
  icon,
  title = 'No items found',
  description = 'Try adjusting your filters or search terms to find what you are looking for.',
  action,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`text-center py-12 px-4 sm:px-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/60 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
        {icon || <PackageOpen className="w-8 h-8 stroke-[1.5]" />}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
