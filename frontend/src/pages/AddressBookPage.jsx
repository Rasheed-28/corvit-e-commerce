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
import { useNotification } from '../contexts/NotificationContext';
import { mockAccountApi } from '../api/mockAdapter';

export const AddressBookPage = () => {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    mockAccountApi.getAddresses()
      .then((res) => {
        if (res?.success) setAddresses(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    mockAccountApi.addAddress(formData)
      .then(() => {
        notify.success('New delivery address saved.', 'Address Added');
        setIsModalOpen(false);
        setFormData(initialForm);
        fetchAddresses();
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = (id) => {
    mockAccountApi.deleteAddress(id).then(() => {
      notify.info('Address removed from your book.', 'Address Deleted');
      fetchAddresses();
    });
  };

  const handleSetDefault = (id) => {
    mockAccountApi.setDefaultAddress(id).then(() => {
      notify.success('Primary delivery address updated.', 'Default Address');
      fetchAddresses();
    });
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
            Manage your delivery and billing locations for accelerated checkout
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
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

      {/* Addresses Grid */}
      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-8 h-8 text-gray-400" />}
          title="No Addresses Saved"
          description="You don't have any shipping addresses on file. Add your primary home or office address to speed up checkout."
          action={
            <Button variant="primary" size="md" onClick={() => setIsModalOpen(true)}>
              Add Address
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-6 bg-white rounded-3xl border shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                addr.isDefault ? 'border-emerald-600 ring-2 ring-emerald-500/10' : 'border-gray-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-gray-100 text-gray-700">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">{addr.label}</h3>
                  </div>

                  {addr.isDefault && (
                    <Badge variant="success" size="sm" dot>Default</Badge>
                  )}
                </div>

                <div className="text-xs text-gray-600 space-y-1 leading-relaxed">
                  <p className="font-bold text-gray-900 text-sm">{addr.recipientName}</p>
                  <p>{addr.streetAddress}</p>
                  <p>{addr.city}, {addr.state} {addr.postalCode}</p>
                  <p>{addr.country}</p>
                  <p className="pt-1 text-gray-400 font-mono">Phone: {addr.phone}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    className="font-semibold text-emerald-600 hover:text-emerald-800"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Primary
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                  title="Delete address"
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
        title="Add New Delivery Address"
        description="Enter recipient and destination details"
        size="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Address Label"
              placeholder="e.g. Home, Studio, Vacation"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
            />
            <Input
              label="Recipient Full Name"
              placeholder="e.g. Alex Reynolds"
              value={formData.recipientName}
              onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
              required
            />
          </div>

          <Input
            label="Street Address"
            placeholder="e.g. 742 Evergreen Terrace, Suite 4B"
            value={formData.streetAddress}
            onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              placeholder="Seattle"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
            <Input
              label="State / Province"
              placeholder="WA"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
            <Input
              label="Postal / ZIP Code"
              placeholder="98101"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              placeholder="+1 (555) 234-5678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <Checkbox
            id="default-addr-chk"
            label="Set as default shipping address"
            checked={formData.isDefault}
            onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="md" onClick={() => setIsModalOpen(false)}>
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
