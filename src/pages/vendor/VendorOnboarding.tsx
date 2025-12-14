/**
 * Vendor Onboarding Page
 * Allows users to create their own shop on the marketplace
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, AlertCircle, CheckCircle, Wallet, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useVendorStore } from '../../store/vendorStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { formatCurrency } from '../../lib/utils';

const VendorOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUserData } = useAuthStore();
  const { shop, loading, setupFee, error, fetchShop, createShop, clearError } = useVendorStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch shop data and check if user already has a shop
  useEffect(() => {
    if (user?.id) {
      fetchShop(user.id);
    }
  }, [user?.id, fetchShop]);

  // Redirect if user already has a shop
  useEffect(() => {
    if (shop && !loading) {
      navigate('/vendor/dashboard');
    }
  }, [shop, loading, navigate]);


  const walletBalance = user?.walletBalance ?? 0;
  const hasInsufficientBalance = walletBalance < setupFee;

  const validateForm = (): boolean => {
    const errors: { name?: string; description?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Shop name is required';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Shop name must be at least 3 characters';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Shop name must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Shop description is required';
    } else if (formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;
    if (!user?.id) return;

    setIsSubmitting(true);

    try {
      const result = await createShop(user.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      if (result.success) {
        setShowSuccess(true);
        // Refresh user data to update wallet balance
        await refreshUserData();
        // Redirect after showing success
        setTimeout(() => {
          navigate('/vendor/dashboard');
        }, 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Shop Created Successfully!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your shop "{formData.name}" is now active. Redirecting to your dashboard...
          </p>
          <div className="animate-pulse text-green-600">
            Setting up your vendor dashboard...
          </div>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Become a Vendor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create your own shop and start selling products on our marketplace
          </p>
        </div>

        {/* Fee Information Card */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Setup Fee
              </h3>
              <p className="text-2xl font-bold text-green-600 mb-1">
                {formatCurrency(setupFee)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                One-time fee to create your shop. Monthly subscription of {formatCurrency(500)} applies after the first month.
              </p>
            </div>
          </div>
        </Card>

        {/* Wallet Balance Card */}
        <Card className={`mb-6 ${hasInsufficientBalance ? 'border-2 border-red-300 dark:border-red-700' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Your Wallet Balance</p>
              <p className={`text-xl font-bold ${hasInsufficientBalance ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {formatCurrency(walletBalance)}
              </p>
            </div>
            {hasInsufficientBalance && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/wallet/fund')}
              >
                Fund Wallet
              </Button>
            )}
          </div>
        </Card>

        {/* Insufficient Balance Warning */}
        {hasInsufficientBalance && (
          <Card className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  Insufficient Balance
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  You need at least {formatCurrency(setupFee)} in your wallet to create a shop. 
                  Please fund your wallet with {formatCurrency(setupFee - walletBalance)} more.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          </Card>
        )}


        {/* Shop Creation Form */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                label="Shop Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your shop name"
                error={formErrors.name}
                disabled={isSubmitting || hasInsufficientBalance}
                maxLength={100}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.name.length}/100 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shop Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your shop and what you sell..."
                rows={4}
                disabled={isSubmitting || hasInsufficientBalance}
                className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200 resize-none ${
                  formErrors.description
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-700'
                } ${(isSubmitting || hasInsufficientBalance) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {formErrors.description && (
                <p className="mt-1 text-sm text-red-500">{formErrors.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Minimum 10 characters
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400">Setup Fee</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(setupFee)}
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isSubmitting}
                disabled={hasInsufficientBalance || isSubmitting}
              >
                {hasInsufficientBalance
                  ? 'Insufficient Balance'
                  : isSubmitting
                  ? 'Creating Shop...'
                  : `Create Shop & Pay ${formatCurrency(setupFee)}`}
              </Button>
            </div>
          </form>
        </Card>

        {/* Info Section */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-2">By creating a shop, you agree to our vendor terms and conditions.</p>
          <p>Your shop will be active immediately after payment.</p>
        </div>
      </div>
    </div>
  );
};

export default VendorOnboarding;
