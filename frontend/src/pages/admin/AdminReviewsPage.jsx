import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import {
  Star,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from 'lucide-react';

export const AdminReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (approvalFilter !== '') params.is_approved = approvalFilter;
      if (ratingFilter) params.rating = ratingFilter;

      const res = await adminApi.getReviews(params);
      if (res?.results || res?.data) {
        const results = res.results || res.data || [];
        setReviews(results);
        setTotalCount(res.count || results.length);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, search, approvalFilter, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleToggleApproval = async (review) => {
    try {
      await adminApi.moderateReview(review.id, {
        is_approved: !review.is_approved,
      });
      // Optimistic update
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, is_approved: !r.is_approved } : r))
      );
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to moderate review');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteReview(deleteTarget.id);
      setDeleteTarget(null);
      fetchReviews();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Customer Review Moderation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Moderate community feedback, approve verified testimonials, and remove spam or abusive content.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search reviews by comment, product, author..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={approvalFilter}
            onChange={(e) => {
              setApprovalFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by approval status"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Review Statuses</option>
            <option value="true">Approved Reviews</option>
            <option value="false">Pending Moderation</option>
          </select>

          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by rating stars"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Star Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading reviews...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Reviews" message={error} onRetry={fetchReviews} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No Reviews Found"
          message="No customer reviews matched the selected filter criteria."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-3">Reviewer</th>
                  <th className="py-3.5 px-3">Rating</th>
                  <th className="py-3.5 px-4">Feedback Content</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3">Moderation</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <p className="truncate max-w-[150px]">{rev.product_title}</p>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">
                        {rev.user_name || 'Customer'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{rev.user_email}</p>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {rev.title && (
                        <p className="font-bold text-gray-900 dark:text-white text-xs mb-0.5">
                          {rev.title}
                        </p>
                      )}
                      <p className="text-gray-600 dark:text-gray-300 line-clamp-2 text-xs">
                        {rev.comment}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-gray-500 whitespace-nowrap text-[10px]">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <Badge variant={rev.is_approved ? 'success' : 'warning'} size="sm">
                        {rev.is_approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(rev)}
                          title={rev.is_approved ? 'Unapprove Review' : 'Approve Review'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rev.is_approved
                              ? 'text-gray-500 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                              : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {rev.is_approved ? <ThumbsDown className="w-4 h-4" /> : <ThumbsUp className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rev)}
                          title="Delete Review"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalCount > pageSize && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Review"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to delete this review by <strong>{deleteTarget.user_name || deleteTarget.user_email}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" isLoading={isDeleting} onClick={handleDelete}>
                Delete Review
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminReviewsPage;
