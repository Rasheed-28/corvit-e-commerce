import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { ShieldAlert } from 'lucide-react';

/**
 * Route guard component that restricts access strictly to authenticated
 * administrative staff users. Non-staff authenticated users are shown
 * a forbidden banner, while unauthenticated visitors are redirected to login.
 */
export const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/50 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Access Restricted
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Your account ({user?.email}) does not possess administrative staff privileges.
            If you believe this is an error, please contact your store administrator.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" to="/">
              Return to Storefront
            </Button>
            <Button variant="outline" to="/account">
              My Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
};

export default AdminRoute;
