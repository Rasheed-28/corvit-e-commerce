import React from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

/**
 * Accessible Select component with custom dropdown chevron and error handling.
 */
export const Select = ({
  label,
  options = [],
  value,
  onChange,
  error,
  helperText,
  id,
  required = false,
  disabled = false,
  className = '',
  placeholder,
  ...props
}) => {
  const generatedId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${generatedId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={generatedId}
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          {label} {required && <span className="text-red-500 font-semibold" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={generatedId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full appearance-none rounded-lg text-sm text-gray-900 bg-white border pl-3.5 pr-10 py-2.5 transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
            disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed
            ${
              error
                ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-400'
                : 'border-gray-300 hover:border-gray-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-500'
            }
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
};
