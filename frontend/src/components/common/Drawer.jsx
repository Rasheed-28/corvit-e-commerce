import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * Slide-over Drawer component with accessibility features, backdrop dismiss, and smooth animation.
 */
export const Drawer = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  placement = 'right',
  size = 'md',
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  const isRight = placement === 'right';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Drawer'}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`fixed inset-y-0 ${isRight ? 'right-0' : 'left-0'} flex max-w-full`}>
        <div
          className={`
            relative w-screen bg-white shadow-2xl flex flex-col
            ${isRight ? 'animate-slide-in-right' : 'animate-fade-in'}
            ${sizeClasses[size] || sizeClasses.md}
            ${className}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div>
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
            {children}
          </div>

          {/* Optional Sticky Footer */}
          {footer && (
            <div className="border-t border-gray-100 bg-white px-6 py-4 shadow-xs">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
