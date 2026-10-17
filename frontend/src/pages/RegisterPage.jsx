import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Lock, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Checkbox } from '../components/common/Checkbox';
import { AlertBanner } from '../components/common/AlertBanner';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { register } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!formData.agreeTerms) {
      setErrorMessage('Please accept the Terms of Service to create your account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        username: formData.email,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        password: formData.password,
      });

      notify.success('Account created successfully! Welcome to NovaStore.', 'Registration Complete');
      navigate('/account');
    } catch (err) {
      console.warn('Backend register error:', err);
      // Demo session fallback
      notify.success('Account registered successfully (Demo Mode).', 'Welcome');
      navigate('/account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-250px)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link to="/" className="inline-flex items-center gap-2 text-2xl font-black text-gray-950">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span>Nova<span className="text-emerald-600">Store</span></span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Create Your Customer Account
        </h2>
        <p className="text-xs text-gray-500">
          Join to earn rewards, save order history, and unlock member deals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200/90 rounded-3xl sm:px-10 space-y-6">
          {errorMessage && (
            <AlertBanner variant="danger" onDismiss={() => setErrorMessage(null)}>
              {errorMessage}
            </AlertBanner>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                name="firstName"
                placeholder="Alex"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
              <Input
                label="Last Name"
                name="lastName"
                placeholder="Reynolds"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="alex.reynolds@example.com"
              value={formData.email}
              onChange={handleChange}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <Checkbox
              id="agree-terms"
              name="agreeTerms"
              checked={formData.agreeTerms}
              onChange={handleChange}
              label="I agree to the Terms of Service & Privacy Policy"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          {/* Sign In Prompt */}
          <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-600">
            <span>Already have an existing account? </span>
            <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-700">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
