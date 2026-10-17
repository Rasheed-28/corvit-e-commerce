import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Enhanced Search input with clear button, shortcut indicator, and responsive styles.
 */
export const SearchInput = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search products, brands, and categories...',
  shortcutHint = '⌘K',
  className = '',
  size = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'py-1.5 pl-8 pr-8 text-xs',
    md: 'py-2 pl-9 pr-9 text-sm',
    lg: 'py-3 pl-11 pr-11 text-base',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-5 h-5 left-3.5',
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`absolute inset-y-0 flex items-center pointer-events-none text-gray-400 ${
          iconSizes[size] || iconSizes.md
        }`}
      >
        <Search className="w-full h-full" />
      </div>

      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label="Search catalog"
        className={`
          w-full bg-gray-50/80 hover:bg-white text-gray-900 border border-gray-200 rounded-xl
          placeholder:text-gray-400
          transition-all duration-150
          focus:outline-none focus:bg-white focus:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500
          ${sizeClasses[size] || sizeClasses.md}
        `}
        {...props}
      />

      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md focus-visible:ring-1 focus-visible:ring-emerald-500"
            aria-label="Clear search query"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {shortcutHint && !value && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded shadow-xs">
            {shortcutHint}
          </kbd>
        )}
      </div>
    </div>
  );
};
