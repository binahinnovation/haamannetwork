import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Store,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Shield,
  ShieldOff,
  Calendar,
  Package,
  X,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAdminVendorStore } from '../../store/adminVendorStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { VendorShop, ShopStatus, SubscriptionHistory } from '../../types/vendor';
import { supabase } from '../../lib/supabase';

const AdminVendorManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    shops,
    loading,
    error,
    fetchAllShops,
    updateShopStatus,
    toggleVerification,
  } = useAdminVendorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<VendorShop | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<'enable' | 'disable'>('disable');
  const [statusReason, setStatusReason] = useState('');
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchAllShops();
  }, [user, navigate, fetchAllShops]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllShops(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchAllShops]);

  const handleViewShop = async (shop: VendorShop) => {
    setSelectedShop(shop);
    setShowDetailModal(true);
    
    // Fetch subscription history
    const { data } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    setSubscriptionHistory(data || []);
  };

  const handleOpenStatusModal = (shop: VendorShop, action: 'enable' | 'disable') => {
    setSelectedShop(shop);
    setStatusAction(action);
    setStatusReason('');
    setShowStatusModal(true);
  };

  const handleStatusChange = async () => {
    if (!selectedShop || !user) return;
    
    setIsUpdating(true);
    const newStatus: ShopStatus = statusAction === 'disable' ? 'admin_disabled' : 'active';
    
    const success = await updateShopStatus(
      selectedShop.id,
      user.id,
      newStatus,
      statusReason || undefined
    );

    if (success) {
      setShowStatusModal(false);
      setShowDetailModal(false);
      setSelectedShop(null);
    }
    setIsUpdating(false);
  };

  const handleVerificationToggle = async (shop: VendorShop) => {
    if (!user) return;
    
    setIsUpdating(true);
    await toggleVerification(shop.id, user.id, !shop.is_verified);
    setIsUpdating(false);
  };

  const getStatusBadge = (status: ShopStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle size={12} className="mr-1" />
            Active
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <AlertTriangle size={12} className="mr-1" />
            Disabled
          </span>
        );
      case 'admin_disabled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle size={12} className="mr-1" />
            Admin Disabled
          </span>
        );
    }
  };

  const getSubscriptionStatus = (shop: VendorShop) => {
    if (!shop.subscription_due_date) {
      return (
        <span className="text-gray-500 dark:text-gray-400 text-sm">No subscription</span>
      );
    }
    
    const dueDate = new Date(shop.subscription_due_date);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) {
      return (
        <span className="text-red-500 text-sm">Overdue by {Math.abs(daysUntilDue)} days</span>
      );
    } else if (daysUntilDue <= 7) {
      return (
        <span className="text-yellow-500 text-sm">Due in {daysUntilDue} days</span>
      );
    } else {
      return (
        <span className="text-green-500 text-sm">Due in {daysUntilDue} days</span>
      );
    }
  };

  if (loading && shops.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-4"
              >
                <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{shops.length} vendor shops</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Shops</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{shops.length}</p>
              </div>
              <Store className="text-blue-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Shops</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {shops.filter(s => s.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Verified Shops</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {shops.filter(s => s.is_verified).length}
                </p>
              </div>
              <Shield className="text-purple-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Disabled Shops</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {shops.filter(s => s.status !== 'active').length}
                </p>
              </div>
              <XCircle className="text-red-500" size={24} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by shop name or vendor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Shops Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Verification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {shops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No vendor shops found
                    </td>
                  </tr>
                ) : (
                  shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#0F9D58] to-[#0d8a4f] rounded-full flex items-center justify-center">
                            <Store className="text-white" size={18} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {shop.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {shop.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {shop.vendor_name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(shop.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {shop.is_verified ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                            <Shield size={12} className="mr-1" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                            <ShieldOff size={12} className="mr-1" />
                            Not Verified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getSubscriptionStatus(shop)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleViewShop(shop)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleVerificationToggle(shop)}
                          disabled={isUpdating}
                          className={`${
                            shop.is_verified
                              ? 'text-yellow-600 hover:text-yellow-900 dark:text-yellow-400'
                              : 'text-purple-600 hover:text-purple-900 dark:text-purple-400'
                          } disabled:opacity-50`}
                          title={shop.is_verified ? 'Remove Verification' : 'Verify Shop'}
                        >
                          {shop.is_verified ? <ShieldOff size={16} /> : <Shield size={16} />}
                        </button>
                        {shop.status === 'active' ? (
                          <button
                            onClick={() => handleOpenStatusModal(shop, 'disable')}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Disable Shop"
                          >
                            <XCircle size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenStatusModal(shop, 'enable')}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Enable Shop"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Shop Detail Modal */}
      {showDetailModal && selectedShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shop Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Shop Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Shop Name</label>
                  <p className="text-gray-900 dark:text-white">{selectedShop.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Vendor</label>
                  <p className="text-gray-900 dark:text-white">{selectedShop.vendor_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedShop.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Verification</label>
                  <div className="mt-1">
                    {selectedShop.is_verified ? (
                      <span className="inline-flex items-center text-purple-600 dark:text-purple-400">
                        <Shield size={16} className="mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="text-gray-500">Not Verified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                  <p className="text-gray-900 dark:text-white flex items-center">
                    <Calendar size={14} className="mr-1" />
                    {formatDate(selectedShop.created_at)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Products</label>
                  <p className="text-gray-900 dark:text-white flex items-center">
                    <Package size={14} className="mr-1" />
                    {selectedShop.product_count || 0} products
                  </p>
                </div>
              </div>

              {selectedShop.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <p className="text-gray-900 dark:text-white mt-1">{selectedShop.description}</p>
                </div>
              )}

              {/* Subscription Info */}
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Subscription Status</label>
                <div className="mt-1">{getSubscriptionStatus(selectedShop)}</div>
                {selectedShop.subscription_due_date && (
                  <p className="text-sm text-gray-500 mt-1">
                    Due: {formatDate(selectedShop.subscription_due_date)}
                  </p>
                )}
              </div>

              {/* Subscription History */}
              {subscriptionHistory.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                    Subscription History
                  </label>
                  <div className="space-y-2">
                    {subscriptionHistory.map((history) => (
                      <div
                        key={history.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center">
                          <Clock size={14} className="text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 dark:text-white">
                            {formatDate(history.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {formatCurrency(history.amount)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            history.status === 'success'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {history.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleVerificationToggle(selectedShop)}
                  disabled={isUpdating}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    selectedShop.is_verified
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}
                >
                  {selectedShop.is_verified ? 'Remove Verification' : 'Verify Shop'}
                </button>
                {selectedShop.status === 'active' ? (
                  <button
                    onClick={() => handleOpenStatusModal(selectedShop, 'disable')}
                    className="flex-1 py-2 px-4 bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-lg font-medium transition-colors"
                  >
                    Disable Shop
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenStatusModal(selectedShop, 'enable')}
                    className="flex-1 py-2 px-4 bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 rounded-lg font-medium transition-colors"
                  >
                    Enable Shop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && selectedShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {statusAction === 'disable' ? 'Disable Shop' : 'Enable Shop'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                {statusAction === 'disable'
                  ? `Are you sure you want to disable "${selectedShop.name}"? This will hide all products from the store.`
                  : `Are you sure you want to enable "${selectedShop.name}"? This will restore product visibility if the subscription is current.`}
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  rows={3}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={isUpdating}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    statusAction === 'disable'
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {isUpdating ? 'Processing...' : statusAction === 'disable' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVendorManagement;
