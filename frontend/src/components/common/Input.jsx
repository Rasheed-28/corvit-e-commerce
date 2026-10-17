import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Accessible Input field with label, error, helper text, and icon support.
 */
export const Input = ({
  label,
  error,
  helperText,
  id,
  type = 'text',
  leftIcon,
  rightIcon,
  className = '',
  required = false,
  disabled = false,
  ...props
}) => {
  const generatedId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${generatedId}-error`;
  const helperId = `${generatedId}-helper`;

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

      <div className="relative rounded-lg shadow-xs">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {leftIcon}
          </div>
        )}

        <input
          id={generatedId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`
            w-full rounded-lg text-sm text-gray-900 bg-white border transition-colors duration-150
            placeholder:text-gray-400
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
            disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed
            ${leftIcon ? 'pl-10' : 'pl-3.5'}
            ${rightIcon ? 'pr-10' : 'pr-3.5'}
            py-2.5
            ${
              error
                ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-400'
                : 'border-gray-300 hover:border-gray-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-500'
            }
            ${className}
          `}
          {...props}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1.5 text-xs text-gray-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
