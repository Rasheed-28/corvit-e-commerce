import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Accessible Breadcrumb navigation component.
 */
export const Breadcrumbs = ({ items = [], className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`text-xs text-gray-500 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 hover:text-emerald-700 transition-colors"
            title="Return to Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {isLast || !item.to ? (
                <span
                  className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="hover:text-emerald-700 transition-colors truncate max-w-[150px] sm:max-w-xs"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
