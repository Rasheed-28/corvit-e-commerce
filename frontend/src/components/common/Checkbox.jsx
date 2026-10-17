import React from 'react';
import { Check } from 'lucide-react';

/**
 * Accessible Checkbox component with custom checkmark, label, and description.
 */
export const Checkbox = ({
  id,
  name,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  error,
  className = '',
  ...props
}) => {
  const generatedId = id || `chk-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="flex items-center h-5">
        <div className="relative">
          <input
            id={generatedId}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={generatedId}
            className={`
              flex items-center justify-center w-5 h-5 rounded border transition-all cursor-pointer select-none
              peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2
              ${
                checked
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
              ${error ? 'border-red-500' : ''}
            `}
          >
            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </label>
        </div>
      </div>

      {(label || description) && (
        <div className="text-sm">
          {label && (
            <label
              htmlFor={generatedId}
              className={`font-medium cursor-pointer select-none ${
                disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900'
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-gray-500 leading-normal">{description}</p>
          )}
          {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
        </div>
      )}
    </div>
  );
};
