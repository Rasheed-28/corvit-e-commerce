import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

/**
 * Accessible Error State component for API failures or network problems.
 */
export const ErrorState = ({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error while loading this content. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`text-center py-12 px-6 flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 stroke-[1.75]" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="md"
            onClick={onRetry}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
