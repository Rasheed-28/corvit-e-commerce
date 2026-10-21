import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import {
  FolderTree,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  Layers,
} from 'lucide-react';

export const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add / Edit Category Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parent: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Category Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getCategories({ search: search.trim() });
      if (res?.success) {
        setCategories(res.data || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      parent: '',
      description: '',
      is_active: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      parent: cat.parent || '',
      description: cat.description || '',
      is_active: cat.is_active,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || undefined,
        parent: formData.parent ? formData.parent : null,
        description: formData.description,
        is_active: formData.is_active,
      };

      if (editingCategory) {
        await adminApi.updateCategory(editingCategory.id, payload);
      } else {
        await adminApi.createCategory(payload);
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      const backendErrors = err?.response?.data?.error?.details || err?.response?.data;
      if (typeof backendErrors === 'object' && backendErrors !== null) {
        setFormErrors(backendErrors);
      } else {
        setFormErrors({ non_field_errors: err.message || 'Failed to save category.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      alert(err?.response?.data?.message || 'Cannot delete category with associated products.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Category Taxonomy Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Organize catalog hierarchy, manage parent-child nesting, and storefront visibility.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {/* Search Input */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name or slug..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
          {categories.length} categories defined
        </span>
      </div>

      {/* Categories Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading taxonomy...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Categories" message={error} onRetry={fetchCategories} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No Categories Found"
          message="Create categories to help customers navigate your store."
          actionLabel="Add Category"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Category Name</th>
                  <th className="py-3.5 px-3">Slug</th>
                  <th className="py-3.5 px-3">Parent Hierarchy</th>
                  <th className="py-3.5 px-3">Products Assigned</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>{cat.name}</span>
                      </div>
                      {cat.description && (
                        <p className="text-[10px] text-gray-400 font-normal truncate max-w-[260px] ml-6">
                          {cat.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-gray-500 dark:text-gray-400">
                      {cat.slug}
                    </td>
                    <td className="py-3.5 px-3">
                      {cat.parent_name ? (
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 font-medium">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          {cat.parent_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Root Category</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {cat.products_count || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <Badge variant={cat.is_active ? 'success' : 'neutral'} size="sm">
                        {cat.is_active ? 'Active' : 'Hidden'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          title="Edit Category"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          title="Delete Category"
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
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Category'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {formErrors.non_field_errors && (
              <div className="p-3 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 rounded-lg text-xs font-medium">
                {formErrors.non_field_errors}
              </div>
            )}

            <Input
              label="Category Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Smart Wearables"
              error={formErrors.name?.[0]}
            />

            <Input
              label="URL Slug (Optional)"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g. smart-wearables"
              helperText="Leave empty to automatically generate from name."
              error={formErrors.slug?.[0]}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Parent Category (Optional Nesting)
              </label>
              <select
                value={formData.parent}
                onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">None (Top-Level Root Category)</option>
                {categories
                  .filter((c) => !editingCategory || c.id !== editingCategory.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Category summary for navigation headers..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Active (Visible in Storefront Navigation)
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Category Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Confirm Category Deletion"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Safety Notice</p>
                <p className="mt-0.5 text-[11px]">
                  Deleting <strong>{deleteTarget.name}</strong> will fail if any active products are currently assigned to it, or if it has nested child categories.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete this category?
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" isLoading={isDeleting} onClick={handleDelete}>
                Delete Category
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
