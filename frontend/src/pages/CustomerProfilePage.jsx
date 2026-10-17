import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Package,
  LogOut,
  Shield,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { mockAccountApi } from '../api/mockAdapter';

export const CustomerProfilePage = () => {
  const { user, logout } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    firstName: 'Alex',
    lastName: 'Reynolds',
    email: 'alex.reynolds@example.com',
    phone: '+1 (555) 234-5678',
    memberSince: 'March 2024',
    orderCount: 12,
    rewardPoints: 480,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...profile });
  const [isSaving, setIsSaving] = useState(false);

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    mockAccountApi.getProfile().then((res) => {
      if (res?.success) {
        setProfile(res.data);
        setFormData(res.data);
      }
    });
  }, []);

  const handleProfileSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    mockAccountApi.updateProfile({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
    })
      .then((res) => {
        setProfile(res.data);
        setIsEditing(false);
        notify.success('Profile details updated successfully.', 'Profile Saved');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      notify.error('New passwords do not match.', 'Password Error');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      notify.error('Password must be at least 8 characters.', 'Password Error');
      return;
    }

    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      notify.success('Password changed successfully.', 'Security Updated');
    }, 400);
  };

  const handleLogout = async () => {
    await logout();
    notify.info('You have been signed out.', 'Signed Out');
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'My Account' }]} />

      {/* Header */}
      <div className="border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
            {profile.firstName?.charAt(0) || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
                {profile.firstName} {profile.lastName}
              </h1>
              <Badge variant="success" size="sm" dot>Active Member</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Member since {profile.memberSince} · {profile.email}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="text-gray-600 hover:text-red-600 self-start sm:self-auto"
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out
        </Button>
      </div>

      {/* Account Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <Link
          to="/account"
          className="pb-3 text-emerald-700 border-b-2 border-emerald-600 flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          <span>Profile Info</span>
        </Link>
        <Link
          to="/account/addresses"
          className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Orders</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{profile.orderCount}</p>
          <Link to="/account/orders" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
            View order history →
          </Link>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Nova Rewards</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{profile.rewardPoints} pts</p>
          <span className="text-xs text-gray-500 mt-2 block">Available for checkout credits</span>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Security Status</span>
          <p className="text-base font-bold text-gray-900 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Protected
          </p>
          <span className="text-xs text-gray-500 mt-2 block">Two-factor auth enabled</span>
        </div>
      </div>

      {/* Profile Details & Password Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Profile Details Card */}
        <div className="p-6 sm:p-8 bg-white rounded-3xl border border-gray-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
            <Button
              variant={isEditing ? 'ghost' : 'outline'}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit Info'}
            </Button>
          </div>

          {isEditing ? (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-sm divide-y divide-gray-100">
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Full Name</span>
                <span className="font-semibold text-gray-900">{profile.firstName} {profile.lastName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Email Address</span>
                <span className="font-semibold text-gray-900">{profile.email}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Phone Number</span>
                <span className="font-semibold text-gray-900">{profile.phone}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Account Type</span>
                <span className="font-semibold text-gray-900">Retail Verified Customer</span>
              </div>
            </div>
          )}
        </div>

        {/* Change Password Card */}
        <div className="p-6 sm:p-8 bg-white rounded-3xl border border-gray-200 shadow-xs space-y-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" />
            <span>Security & Password</span>
          </h3>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••••••"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
            />

            <Input
              label="New Password"
              type="password"
              placeholder="At least 8 characters"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              required
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              value={passwordData.confirmNewPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmNewPassword: e.target.value })}
              required
            />

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" isLoading={isUpdatingPassword}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
