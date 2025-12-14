/**
 * Admin Marketplace Settings Page
 * Allows admins to configure marketplace fees and view audit logs
 * Requirements: 6.1, 6.2, 9.4
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  DollarSign,
  Save,
  History,
  Filter,
  Calendar,
  User,
  Store,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAdminVendorStore } from '../../store/adminVendorStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { VendorAuditLog, AuditLogFilters } from '../../types/vendor';

const AdminMarketplaceSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    settings,
    auditLogs,
    loading,
    error,
    fetchSettings,
    updateSubscriptionFee,
    updateSetupFee,
    fetchAuditLogs,
    clearError,
  } = useAdminVendorStore();

  // Form state
  const [setupFee, setSetupFee] = useState<string>('');
  const [subscriptionFee, setSubscriptionFee] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Audit log filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchSettings();
    fetchAuditLogs();
  }, [user, navigate, fetchSettings, fetchAuditLogs]);

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setSetupFee(settings.setup_fee.toString());
      setSubscriptionFee(settings.monthly_subscription_fee.toString());
    }
  }, [settings]);


  const handleUpdateSetupFee = async () => {
    if (!user) return;
    
    const fee = parseFloat(setupFee);
    if (isNaN(fee) || fee < 0) {
      return;
    }

    setIsUpdating(true);
    clearError();
    
    const success = await updateSetupFee(user.id, fee);
    
    if (success) {
      setSuccessMessage('Setup fee updated successfully');
      fetchAuditLogs(); // Refresh audit logs
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    
    setIsUpdating(false);
  };

  const handleUpdateSubscriptionFee = async () => {
    if (!user) return;
    
    const fee = parseFloat(subscriptionFee);
    if (isNaN(fee) || fee < 0) {
      return;
    }

    setIsUpdating(true);
    clearError();
    
    const success = await updateSubscriptionFee(user.id, fee);
    
    if (success) {
      setSuccessMessage('Subscription fee updated successfully');
      fetchAuditLogs(); // Refresh audit logs
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    
    setIsUpdating(false);
  };

  const handleFilterAuditLogs = () => {
    const filters: AuditLogFilters = {};
    
    if (actionFilter) {
      filters.action = actionFilter as VendorAuditLog['action'];
    }
    if (startDate) {
      filters.startDate = new Date(startDate).toISOString();
    }
    if (endDate) {
      // Set end date to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filters.endDate = end.toISOString();
    }
    
    fetchAuditLogs(Object.keys(filters).length > 0 ? filters : undefined);
  };

  const clearFilters = () => {
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    fetchAuditLogs();
  };

  const getActionBadge = (action: VendorAuditLog['action']) => {
    switch (action) {
      case 'fee_change':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <DollarSign size={12} className="mr-1" />
            Fee Change
          </span>
        );
      case 'verification_change':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            <CheckCircle size={12} className="mr-1" />
            Verification
          </span>
        );
      case 'status_override':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            <AlertCircle size={12} className="mr-1" />
            Status Override
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
            {action}
          </span>
        );
    }
  };

  const formatLogDetails = (log: VendorAuditLog) => {
    const { details } = log;
    
    if (log.action === 'fee_change') {
      const feeType = details.fee_type === 'setup' ? 'Setup fee' : 'Subscription fee';
      return `${feeType}: ${formatCurrency(details.previous_value as number)} → ${formatCurrency(details.new_value as number)}`;
    }
    
    if (log.action === 'verification_change') {
      return `Verification: ${details.previous_value ? 'Verified' : 'Not Verified'} → ${details.new_value ? 'Verified' : 'Not Verified'}`;
    }
    
    if (log.action === 'status_override') {
      return `Status: ${details.new_value}${details.reason ? ` - ${details.reason}` : ''}`;
    }
    
    return JSON.stringify(details);
  };

  if (loading && !settings) {
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketplace Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure fees and view audit logs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="text-green-500 mr-2" size={20} />
              <p className="text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="text-red-500 mr-2" size={20} />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fee Settings */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Settings className="text-[#0F9D58] mr-3" size={24} />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fee Configuration</h2>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Setup Fee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Shop Setup Fee (One-time)
                  </label>
                  <div className="flex space-x-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                      <input
                        type="number"
                        value={setupFee}
                        onChange={(e) => setSetupFee(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                      />
                    </div>
                    <button
                      onClick={handleUpdateSetupFee}
                      disabled={isUpdating || setupFee === settings?.setup_fee.toString()}
                      className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Save size={16} className="mr-2" />
                      Save
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Current: {settings ? formatCurrency(settings.setup_fee) : 'Loading...'}
                  </p>
                </div>

                {/* Subscription Fee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monthly Subscription Fee
                  </label>
                  <div className="flex space-x-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                      <input
                        type="number"
                        value={subscriptionFee}
                        onChange={(e) => setSubscriptionFee(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                      />
                    </div>
                    <button
                      onClick={handleUpdateSubscriptionFee}
                      disabled={isUpdating || subscriptionFee === settings?.monthly_subscription_fee.toString()}
                      className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Save size={16} className="mr-2" />
                      Save
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Current: {settings ? formatCurrency(settings.monthly_subscription_fee) : 'Loading...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Fee Information</h3>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
                <li>• Setup fee is charged once when a vendor creates their shop</li>
                <li>• Subscription fee is charged monthly to maintain shop visibility</li>
                <li>• Fee changes apply to future charges only</li>
                <li>• All fee changes are recorded in the audit log</li>
              </ul>
            </div>
          </div>


          {/* Audit Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <History className="text-[#0F9D58] mr-3" size={24} />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Audit Log</h2>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {auditLogs.length} entries
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Action Type
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  >
                    <option value="">All Actions</option>
                    <option value="fee_change">Fee Changes</option>
                    <option value="verification_change">Verification Changes</option>
                    <option value="status_override">Status Overrides</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleFilterAuditLogs}
                    className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors flex items-center text-sm"
                  >
                    <Filter size={14} className="mr-1" />
                    Filter
                  </button>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Log Entries */}
            <div className="max-h-[500px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No audit log entries found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {getActionBadge(log.action)}
                            {log.shop_name && (
                              <span className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Store size={14} className="mr-1" />
                                {log.shop_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatLogDetails(log)}
                          </p>
                          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400 space-x-4">
                            <span className="flex items-center">
                              <User size={12} className="mr-1" />
                              {log.admin_name || 'Unknown Admin'}
                            </span>
                            <span className="flex items-center">
                              <Calendar size={12} className="mr-1" />
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketplaceSettings;
