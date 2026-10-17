import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Accessible Pagination controls.
 */
export const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`flex items-center justify-center gap-1.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
        className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPageNumbers().map((pageNum) => {
        const isCurrent = pageNum === currentPage;
        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={`Go to page ${pageNum}`}
            className={`min-w-[38px] h-9 px-3 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              isCurrent
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {pageNum}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};
