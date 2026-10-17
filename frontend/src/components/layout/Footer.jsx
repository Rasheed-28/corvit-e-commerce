import React, { useState } from 'react';
import { Truck, RotateCcw, ShieldCheck, Headphones, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useNotification } from '../../contexts/NotificationContext';

/**
 * Premium Storefront Footer with value proposition badges, newsletter subscription, and sitemap.
 */
export const Footer = () => {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { notify } = useNotification();

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      notify.error('Please enter a valid email address.', 'Invalid Email');
      return;
    }

    setIsSubscribing(true);
    setTimeout(() => {
      setIsSubscribing(false);
      setIsSubscribed(true);
      notify.success('Thank you for subscribing! Check your inbox for 10% off.', 'Subscribed');
      setEmail('');
    }, 600);
  };

  const trustGuarantees = [
    {
      icon: <Truck className="w-6 h-6 text-emerald-600" />,
      title: 'Free Express Shipping',
      description: 'On all orders above $50. Tracked courier doorstep delivery.',
    },
    {
      icon: <RotateCcw className="w-6 h-6 text-emerald-600" />,
      title: '30-Day Hassle-Free Returns',
      description: 'Love your gear or send it back for an immediate full refund.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      title: '256-Bit Encrypted Payments',
      description: 'Bank-grade PCI-DSS compliant checkout with Apple Pay & cards.',
    },
    {
      icon: <Headphones className="w-6 h-6 text-emerald-600" />,
      title: '24/7 Dedicated Support',
      description: 'Expert customer care via direct phone, chat, and email.',
    },
  ];

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      {/* Trust Guarantees Section */}
      <div className="border-b border-gray-100 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustGuarantees.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-xs border border-gray-200/80 flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Navigation & Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info & Newsletter */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-xl font-black text-gray-950">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                🛒
              </span>
              <span>Nova<span className="text-emerald-600">Store</span></span>
            </div>

            <p className="text-sm text-gray-600 max-w-sm leading-relaxed">
              Curated everyday essentials, acoustic audio systems, and modern workspace design pieces built to stand the test of time.
            </p>

            {/* Newsletter Form */}
            <div className="pt-2">
              <h5 className="text-sm font-semibold text-gray-900 mb-1.5">
                Join the Nova Insider Club
              </h5>
              <p className="text-xs text-gray-500 mb-3">
                Receive secret sale drops, product updates, and 10% off your initial order.
              </p>

              {isSubscribed ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>You are subscribed! Welcome to the club.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="Enter your email address..."
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-gray-50 text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSubscribing}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Join
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Column 1: Shop */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-4">
              Shop Collections
            </h5>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><a href="#products" className="hover:text-emerald-600 transition-colors">Audio & Acoustics</a></li>
              <li><a href="#products" className="hover:text-emerald-600 transition-colors">Smart Wearables</a></li>
              <li><a href="#products" className="hover:text-emerald-600 transition-colors">Lifestyle & Everyday</a></li>
              <li><a href="#products" className="hover:text-emerald-600 transition-colors">Workspace Design</a></li>
              <li><a href="#products" className="hover:text-emerald-600 transition-colors">New Releases</a></li>
            </ul>
          </div>

          {/* Column 2: Customer Care */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-4">
              Customer Care
            </h5>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Order Tracking</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Shipping & Delivery</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Easy Returns & Exchanges</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Warranty & Repairs</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Help Center & FAQ</a></li>
            </ul>
          </div>

          {/* Column 3: Company & Trust */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-4">
              Company
            </h5>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li><a href="#" className="hover:text-emerald-600 transition-colors">About Our Craft</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Sustainability Promise</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Press & Media</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-emerald-600 transition-colors">Store Locator</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 mt-12 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} NovaStore E-Commerce Inc. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Cookie Settings</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
