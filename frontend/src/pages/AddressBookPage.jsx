import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  User,
  Package,
  Home,
  Building,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Checkbox } from '../components/common/Checkbox';
import { EmptyState } from '../components/common/EmptyState';
import { AlertBanner } from '../components/common/AlertBanner';
import { useNotification } from '../contexts/NotificationContext';
import authApi from '../api/authApi';

export const AddressBookPage = () => {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const { notify } = useNotification();

  const initialForm = {
    label: 'Home',
    recipientName: '',
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    isDefault: false,
  };

  const [formData, setFormData] = useState(initialForm);

  const fetchAddresses = () => {
    setIsLoading(true);
    setErrorMessage(null);
    authApi
      .getAddresses()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setAddresses(res.data);
        } else {
          setAddresses([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load addresses:', err);
        setErrorMessage(err.message || 'Unable to retrieve your saved addresses.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await authApi.addAddress(formData);
      notify.success('New delivery address saved.', 'Address Added');
      setIsModalOpen(false);
      setFormData(initialForm);
      fetchAddresses();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save address. Please check required fields.');
      notify.error(err.message || 'Failed to save address.', 'Address Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await authApi.deleteAddress(id);
      notify.info('Address removed from your book.', 'Address Deleted');
      fetchAddresses();
    } catch (err) {
      notify.error(err.message || 'Could not delete address.', 'Error');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await authApi.setDefaultAddress(id);
      notify.success('Primary delivery address updated.', 'Default Address');
      fetchAddresses();
    } catch (err) {
      notify.error(err.message || 'Could not update default address.', 'Error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'My Account', to: '/account' },
          { label: 'Address Book' },
        ]}
      />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
            Address Book
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage your verified shipping destinations and billing defaults
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData(initialForm);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New Address
        </Button>
      </div>

      {/* Account Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <Link
          to="/account"
          className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <User className="w-4 h-4" />
          <span>Profile Info</span>
        </Link>
        <Link
          to="/account/addresses"
          className="pb-3 text-emerald-700 border-b-2 border-emerald-600 flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          <span>Address Book</span>
        </Link>
        <Link
          to="/account/orders"
          className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <Package className="w-4 h-4" />
          <span>Order History</span>
        </Link>
      </div>

      {errorMessage && (
        <AlertBanner variant="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </AlertBanner>
      )}

      {/* Address Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 skeleton-shimmer bg-gray-100 rounded-3xl" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-10 h-10 text-gray-400" />}
          title="No addresses on file"
          description="You haven't saved any delivery destinations yet. Add one below to expedite checkout."
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add First Address
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-6 rounded-3xl border transition-all relative flex flex-col justify-between ${
                addr.isDefault
                  ? 'border-emerald-500 bg-emerald-50/20 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {addr.label === 'Home' ? (
                      <Home className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Building className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="font-bold text-gray-900 text-sm">{addr.label}</span>
                  </div>
                  {addr.isDefault && (
                    <Badge variant="success" size="sm">
                      Default
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-900 text-sm">{addr.recipientName}</p>
                  <p>{addr.streetAddress}</p>
                  {addr.streetAddress2 && <p>{addr.streetAddress2}</p>}
                  <p>
                    {addr.city}, {addr.state} {addr.postalCode}
                  </p>
                  <p>{addr.country}</p>
                  {addr.phone && <p className="text-gray-500 pt-1">Tel: {addr.phone}</p>}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Set as default
                  </button>
                ) : (
                  <span className="text-gray-400 font-medium">Primary address</span>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  aria-label="Delete address"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Address"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Address Label"
              placeholder="e.g. Home, Office"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
            />
            <Input
              label="Recipient Name"
              placeholder="Full legal name"
              value={formData.recipientName}
              onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
              required
            />
          </div>

          <Input
            label="Street Address"
            placeholder="123 Market St, Suite 400"
            value={formData.streetAddress}
            onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              placeholder="San Francisco"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="State / Province"
              placeholder="CA"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postal / ZIP Code"
              placeholder="94105"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <Checkbox
            id="make-default"
            label="Set as default delivery address"
            checked={formData.isDefault}
            onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          />

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
