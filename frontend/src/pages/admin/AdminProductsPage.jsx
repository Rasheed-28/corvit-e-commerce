import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Upload,
  Star,
  ExternalLink,
} from 'lucide-react';

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add / Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    sku: '',
    category: '',
    base_price: '',
    description: '',
    is_active: true,
    is_featured: false,
    initial_stock: 20,
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal
  const [deleteProductTarget, setDeleteProductTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Product Image Management Modal
  const [imageModalProduct, setImageModalProduct] = useState(null);
  const [productImages, setProductImages] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImageAlt, setNewImageAlt] = useState('');
  const [newImagePrimary, setNewImagePrimary] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories();
      if (res?.success) {
        setCategories(res.data || []);
      }
    } catch {
      // categories fallback
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter !== '') params.is_active = statusFilter;

      const res = await adminApi.getProducts(params);
      if (res?.success) {
        const results = res.data?.results || res.data || [];
        setProducts(results);
        setTotalCount(res.data?.count || results.length);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Open Add Product
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      title: '',
      slug: '',
      sku: '',
      category: categories[0]?.id || '',
      base_price: '',
      description: '',
      is_active: true,
      is_featured: false,
      initial_stock: 20,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Product
  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setFormData({
      title: prod.title || '',
      slug: prod.slug || '',
      sku: prod.sku || '',
      category: prod.category || '',
      base_price: prod.base_price || '',
      description: prod.description || '',
      is_active: prod.is_active,
      is_featured: !!prod.is_featured,
      initial_stock: prod.total_stock || 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        base_price: parseFloat(formData.base_price),
      };
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, payload);
      } else {
        await adminApi.createProduct(payload);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      const backendErrors = err?.response?.data?.error?.details || err?.response?.data;
      if (typeof backendErrors === 'object' && backendErrors !== null) {
        setFormErrors(backendErrors);
      } else {
        setFormErrors({ non_field_errors: err.message || 'Failed to save product.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    setIsDeleting(true);
    try {
      const res = await adminApi.deleteProduct(deleteProductTarget.id);
      alert(res?.message || 'Product action completed.');
      setDeleteProductTarget(null);
      fetchProducts();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  // Product Image Modal Handling
  const handleOpenImages = async (prod) => {
    setImageModalProduct(prod);
    setIsLoadingImages(true);
    try {
      const res = await adminApi.getProductImages(prod.id);
      if (res?.success) {
        setProductImages(res.data || []);
      }
    } catch {
      setProductImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!newImageFile || !imageModalProduct) return;
    setIsUploadingImage(true);
    try {
      const form = new FormData();
      form.append('image', newImageFile);
      form.append('alt_text', newImageAlt);
      form.append('is_primary', newImagePrimary ? 'true' : 'false');

      await adminApi.uploadProductImage(imageModalProduct.id, form);
      // Refresh image list
      const res = await adminApi.getProductImages(imageModalProduct.id);
      if (res?.success) {
        setProductImages(res.data || []);
      }
      setNewImageFile(null);
      setNewImageAlt('');
      setNewImagePrimary(false);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to upload product image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSetPrimaryImage = async (img) => {
    try {
      await adminApi.updateProductImage(imageModalProduct.id, img.id, { is_primary: true });
      const res = await adminApi.getProductImages(imageModalProduct.id);
      if (res?.success) {
        setProductImages(res.data || []);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to set primary image');
    }
  };

  const handleDeleteImage = async (imgId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    try {
      await adminApi.deleteProductImage(imageModalProduct.id, imgId);
      setProductImages(productImages.filter((i) => i.id !== imgId));
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete image');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Product Catalog Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create, inspect, update prices, inventory tracking, and manage media galleries.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
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
            placeholder="Search by title or SKU..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by category"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading catalog items...</p>
        </div>
      ) : error ? (
        <ErrorState title="Error Loading Products" message={error} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Products Found"
          message="No products matched your search or filters. Click Add Product to create your first item."
          actionLabel="Add Product"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Base Price</th>
                  <th className="py-3.5 px-3">Stock Level</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                          {prod.images && prod.images.length > 0 ? (
                            <img
                              src={prod.images[0].image}
                              alt={prod.images[0].alt_text || prod.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                            {prod.title}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            SKU: {prod.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {prod.category_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-gray-900 dark:text-white">
                      ${parseFloat(prod.base_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        (prod.total_stock || 0) <= 5
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {prod.total_stock || 0} units
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <Badge variant={prod.is_active ? 'success' : 'neutral'} size="sm">
                        {prod.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenImages(prod)}
                          title="Manage Product Images"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(prod)}
                          title="Edit Product"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteProductTarget(prod)}
                          title="Delete Product"
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

          {/* Pagination */}
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? `Edit Product: ${editingProduct.title}` : 'Add New Product'}
        >
          <form onSubmit={handleSaveProduct} className="space-y-4">
            {formErrors.non_field_errors && (
              <div className="p-3 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 rounded-lg text-xs font-medium">
                {formErrors.non_field_errors}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Product Title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Wireless Noise-Cancelling Headphones"
                error={formErrors.title?.[0]}
              />

              <Input
                label="SKU"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. HEAD-ANC-01"
                error={formErrors.sku?.[0]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <p className="text-[10px] text-red-500 mt-1">{formErrors.category[0]}</p>
                )}
              </div>

              <Input
                label="Base Price ($)"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="99.99"
                error={formErrors.base_price?.[0]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed specifications, features, and warranty..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              {formErrors.description && (
                <p className="text-[10px] text-red-500 mt-1">{formErrors.description[0]}</p>
              )}
            </div>

            {!editingProduct && (
              <Input
                label="Initial Inventory Quantity"
                type="number"
                min="0"
                required
                value={formData.initial_stock}
                onChange={(e) => setFormData({ ...formData, initial_stock: parseInt(e.target.value, 10) || 0 })}
                placeholder="20"
                helperText="Standard variant initial physical stock."
              />
            )}

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Active (Available on Storefront)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Featured Product
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteProductTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteProductTarget(null)}
          title="Confirm Product Deletion"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Catalog Integrity Guard</p>
                <p className="mt-0.5 text-[11px]">
                  If <strong>{deleteProductTarget.title}</strong> is referenced in existing customer orders, the backend will safely deactivate it rather than hard deleting it to preserve order history.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to proceed with deleting or deactivating this product?
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteProductTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isDeleting}
                onClick={handleDeleteProduct}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Product Image Gallery Management Modal */}
      {imageModalProduct && (
        <Modal
          isOpen={true}
          onClose={() => setImageModalProduct(null)}
          title={`Product Gallery: ${imageModalProduct.title}`}
        >
          <div className="space-y-6">
            {/* Existing Images */}
            {isLoadingImages ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : productImages.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                No images uploaded yet. Upload your first product photograph below.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
                  >
                    <img
                      src={img.image}
                      alt={img.alt_text || 'Product image'}
                      className="w-full h-28 object-cover"
                    />
                    {img.is_primary && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                        <Star className="w-2.5 h-2.5 fill-current" /> Primary
                      </span>
                    )}
                    <div className="p-2 flex items-center justify-between text-xs bg-white dark:bg-gray-800">
                      {!img.is_primary ? (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(img)}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                          Set Primary
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium">Default</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload New Image Form */}
            <form onSubmit={handleUploadImage} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-indigo-600" /> Upload New Photo
              </h4>

              <div>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setNewImageFile(e.target.files[0])}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                />
              </div>

              <Input
                label="Alt Text (Accessibility & SEO)"
                value={newImageAlt}
                onChange={(e) => setNewImageAlt(e.target.value)}
                placeholder="e.g. Side profile showing audio jack"
              />

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={newImagePrimary}
                  onChange={(e) => setNewImagePrimary(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Set as Primary Image
              </label>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUploadingImage}
                  disabled={!newImageFile}
                >
                  Upload Image
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminProductsPage;
