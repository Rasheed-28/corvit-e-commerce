import React from 'react';

/**
 * Versatile Badge / Tag component for product statuses, discounts, and inventory flags.
 */
export const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  dotColor,
  icon,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full select-none tracking-wide';

  const variantClasses = {
    primary: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    success: 'bg-green-50 text-green-700 border border-green-200/60',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/70',
    danger: 'bg-red-50 text-red-700 border border-red-200/60',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/60',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
    discount: 'bg-rose-600 text-white font-bold shadow-xs',
    dark: 'bg-slate-900 text-white',
    outline: 'bg-transparent text-gray-700 border border-gray-300',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const defaultDotColor = {
    primary: 'bg-emerald-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-400',
    discount: 'bg-white',
    dark: 'bg-emerald-400',
    outline: 'bg-gray-400',
  }[variant] || 'bg-gray-400';

  return (
    <span
      className={`
        ${baseClasses}
        ${variantClasses[variant] || variantClasses.neutral}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor || defaultDotColor} flex-shrink-0`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
