/**
 * Vendor Dashboard Page
 * Displays shop info, status, and quick links for vendors
 * Requirements: 4.2
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Package, Settings, AlertCircle, CheckCircle, Clock, ShoppingBag, AlertTriangle, XCircle, Wallet } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useVendorStore } from '../../store/vendorStore';
import { useVendorProductStore } from '../../store/vendorProductStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../lib/utils';

const VendorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { shop, loading, fetchShop } = useVendorStore();
  const { products, fetchVendorProducts } = useVendorProductStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch shop data
  useEffect(() => {
    if (user?.id) {
      fetchShop(user.id);
    }
  }, [user?.id, fetchShop]);

  // Fetch vendor products for count
  useEffect(() => {
    if (user?.id && shop) {
      fetchVendorProducts(user.id);
    }
  }, [user?.id, shop, fetchVendorProducts]);

  // Redirect if user doesn't have a shop
  useEffect(() => {
    if (!loading && !shop) {
      navigate('/vendor/onboard');
    }
  }, [shop, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!shop) {
    return null;
  }

  const getStatusBadge = () => {
    switch (shop.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle size={14} className="mr-1" />
            Active
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <AlertCircle size={14} className="mr-1" />
            Disabled
          </span>
        );
      case 'admin_disabled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <AlertCircle size={14} className="mr-1" />
            Admin Disabled
          </span>
        );
      default:
        return null;
    }
  };

  const subscriptionDueDate = shop.subscription_due_date 
    ? new Date(shop.subscription_due_date) 
    : null;
  const isSubscriptionDueSoon = subscriptionDueDate 
    ? (subscriptionDueDate.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 
    : false;
  const isSubscriptionOverdue = subscriptionDueDate 
    ? subscriptionDueDate.getTime() < Date.now() 
    : false;
  const isShopDisabled = shop.status === 'disabled' || shop.status === 'admin_disabled';
  const daysUntilDue = subscriptionDueDate 
    ? Math.ceil((subscriptionDueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vendor Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your shop and products
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/vendor/products')}
            icon={<Package size={18} />}
            disabled={isShopDisabled}
          >
            Manage Products
          </Button>
        </div>

        {/* Shop Disabled Alert - Requirements 3.3, 3.4 */}
        {shop.status === 'disabled' && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start">
              <XCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="ml-3 flex-1">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  Shop Disabled - Subscription Payment Failed
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Your shop has been disabled due to insufficient wallet balance for the subscription fee. 
                  Your products are currently hidden from the store.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/wallet/fund')}
                    icon={<Wallet size={16} />}
                  >
                    Fund Wallet
                  </Button>
                  <span className="text-sm text-red-600 dark:text-red-400 self-center">
                    Your shop will be automatically reactivated once you fund your wallet with sufficient balance.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Disabled Alert */}
        {shop.status === 'admin_disabled' && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start">
              <XCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="ml-3">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  Shop Disabled by Administrator
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Your shop has been disabled by an administrator. Your products are currently hidden from the store.
                  Please contact support for more information.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Due Soon Warning - Requirements 3.3, 3.4 */}
        {!isShopDisabled && isSubscriptionDueSoon && !isSubscriptionOverdue && daysUntilDue !== null && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="ml-3 flex-1">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Subscription Due {daysUntilDue <= 0 ? 'Today' : `in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Your monthly subscription fee of {formatCurrency(500)} will be automatically deducted from your wallet.
                  Ensure you have sufficient balance to avoid shop deactivation.
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/wallet/fund')}
                    icon={<Wallet size={16} />}
                  >
                    Fund Wallet
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shop Info Card */}
        <Card className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Store className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {shop.name}
                  </h2>
                  {shop.is_verified && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <CheckCircle size={12} className="mr-1" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {shop.description}
                </p>
                <div className="mt-2 flex items-center space-x-3">
                  {getStatusBadge()}
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    <ShoppingBag size={14} className="mr-1" />
                    {products.length} {products.length === 1 ? 'Product' : 'Products'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Subscription Status */}
        <Card className={`mb-6 ${isShopDisabled ? 'border-2 border-red-400' : isSubscriptionDueSoon ? 'border-2 border-yellow-400' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isShopDisabled ? 'bg-red-100' : isSubscriptionDueSoon ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                <Clock className={`w-5 h-5 ${
                  isShopDisabled ? 'text-red-600' : isSubscriptionDueSoon ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isShopDisabled ? 'Subscription Status' : 'Next Subscription Due'}
                </p>
                <p className={`font-semibold ${
                  isShopDisabled ? 'text-red-600' : 'text-gray-900 dark:text-white'
                }`}>
                  {isShopDisabled 
                    ? 'Payment Required'
                    : subscriptionDueDate 
                      ? subscriptionDueDate.toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : 'N/A'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Fee</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(shop.pending_subscription_fee || 500)}
              </p>
            </div>
          </div>
          {isSubscriptionDueSoon && !isShopDisabled && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <AlertCircle size={14} className="inline mr-1" />
                Your subscription is due soon. Ensure you have sufficient wallet balance.
              </p>
            </div>
          )}
          {isShopDisabled && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                <AlertCircle size={14} className="inline mr-1" />
                {shop.status === 'admin_disabled' 
                  ? 'Your shop has been disabled by an administrator.'
                  : 'Your subscription payment failed. Fund your wallet to reactivate your shop.'}
              </p>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/vendor/products')}
          >
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Products</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage your products</p>
            </div>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/shop/${shop.id}`)}
          >
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Store className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">View Shop</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">See your public profile</p>
            </div>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow opacity-50"
          >
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Settings className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Coming soon</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
