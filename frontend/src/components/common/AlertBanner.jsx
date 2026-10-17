import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

/**
 * Inline Alert Banner with dismiss option and semantic status variants.
 */
export const AlertBanner = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  className = '',
}) => {
  const configs = {
    info: {
      wrapper: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
      closeBtn: 'text-blue-500 hover:text-blue-800',
    },
    success: {
      wrapper: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
      closeBtn: 'text-emerald-500 hover:text-emerald-800',
    },
    warning: {
      wrapper: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
      closeBtn: 'text-amber-500 hover:text-amber-800',
    },
    danger: {
      wrapper: 'bg-red-50 border-red-200 text-red-900',
      icon: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
      closeBtn: 'text-red-500 hover:text-red-800',
    },
  };

  const current = configs[variant] || configs.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all ${current.wrapper} ${className}`}
    >
      {current.icon}
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <div className="text-xs sm:text-sm leading-relaxed opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`p-1 rounded-md transition-colors ${current.closeBtn} focus-visible:ring-1 focus-visible:ring-current`}
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
