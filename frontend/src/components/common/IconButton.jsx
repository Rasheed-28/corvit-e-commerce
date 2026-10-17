import React from 'react';

/**
 * Accessible Icon-only button with aria-label, tooltip/title, and focus styling.
 */
export const IconButton = ({
  icon,
  'aria-label': ariaLabel,
  title,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-95';

  const variantClasses = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm',
    secondary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200',
    subtle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200',
    danger: 'text-red-600 hover:bg-red-50 active:bg-red-100',
  };

  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5 text-xs',
    md: 'w-10 h-10 p-2 text-sm',
    lg: 'w-12 h-12 p-2.5 text-base',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel || title}
      title={title || ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`
        ${baseClasses}
        ${variantClasses[variant] || variantClasses.ghost}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
      {...props}
    >
      {icon}
    </button>
  );
};
