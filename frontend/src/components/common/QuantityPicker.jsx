import React from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Accessible Quantity Picker with boundary constraints and keyboard support.
 */
export const QuantityPicker = ({
  value = 1,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1);
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  const buttonSize = {
    sm: 'w-7 h-full',
    md: 'w-9 h-full',
    lg: 'w-11 h-full',
  }[size] || 'w-9 h-full';

  return (
    <div
      role="group"
      aria-label="Item quantity selector"
      className={`inline-flex items-center rounded-lg border border-gray-300 bg-white shadow-xs overflow-hidden ${
        sizeClasses[size] || sizeClasses.md
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={`flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${buttonSize} focus-visible:ring-1 focus-visible:ring-emerald-500`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <span
        aria-live="polite"
        className="w-10 text-center font-semibold text-gray-900 select-none"
      >
        {value}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={`flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${buttonSize} focus-visible:ring-1 focus-visible:ring-emerald-500`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
