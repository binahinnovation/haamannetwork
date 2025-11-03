import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  DollarSign,
  Clock,
  Lock,
  Eye,
  Settings,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../lib/utils';

type SpendingOverview = {
  user_id: string;
  name: string;
  email: string;
  account_age_days: number;
  spending_date: string;
  total_spent: number;
  transaction_count: number;
  limit_info: {
    daily_limit: number;
    limit_type: string;
  };
};

type SecurityStats = {
  total_users: number;
  new_accounts: number;
  established_accounts: number;
  total_daily_spending: number;
  blocked_transactions: number;
  active_locks: number;
};

const SecurityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [spendingData, setSpendingData] = useState<SpendingOverview[]>([]);
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'new' | 'established' | 'high_usage'>('all');

  useEffect(() => {
    if (user?.isAdmin) {
      fetchSecurityData();
    }
  }, [user, selectedDate, filterType]);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      
      // Fetch spending overview
      const { data: spendingOverview, error: spendingError } = await supabase
        .from('admin_spending_limits_overview')
        .select('*');

      if (spendingError) throw spendingError;

      // Fetch security statistics
      const { data: stats, error: statsError } = await supabase.rpc('get_security_dashboard_stats');
      
      if (statsError) {
        console.error('Stats error:', statsError);
        // Continue without stats if the function doesn't exist yet
      }

      setSpendingData(spendingOverview || []);
      setSecurityStats(stats || null);
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = spendingData.filter(item => {
    switch (filterType) {
      case 'new':
        return item.account_age_days < 7;
      case 'established':
        return item.account_age_days >= 7;
      case 'high_usage':
        return item.total_spent > (item.limit_info?.daily_limit * 0.8);
      default:
        return true;
    }
  });

  const getUsagePercentage = (spent: number, limit: number) => {
    return limit > 0 ? (spent / limit) * 100 : 0;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const exportData = () => {
    const csvContent = [
      ['Name', 'Email', 'Account Age (Days)', 'Daily Limit', 'Spent Today', 'Usage %', 'Transactions', 'Status'].join(','),
      ...filteredData.map(item => [
        item.name,
        item.email,
        item.account_age_days,
        item.limit_info?.daily_limit || 0,
        item.total_spent || 0,
        getUsagePercentage(item.total_spent || 0, item.limit_info?.daily_limit || 0).toFixed(1) + '%',
        item.transaction_count || 0,
        item.limit_info?.limit_type || 'unknown'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-dashboard-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-6 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-2"
          >
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center">
            <Shield className="text-[#0F9D58] mr-3" size={24} />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Security Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={fetchSecurityData}
            variant="outline"
            icon={<RefreshCw size={16} />}
            className="text-sm"
          >
            Refresh
          </Button>
          <Button
            onClick={exportData}
            variant="outline"
            icon={<Download size={16} />}
            className="text-sm"
          >
            Export
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Security Statistics */}
        {securityStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{securityStats.total_users}</p>
                </div>
                <Users className="text-blue-500" size={24} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New Accounts</p>
                  <p className="text-2xl font-bold text-yellow-600">{securityStats.new_accounts}</p>
                </div>
                <Clock className="text-yellow-500" size={24} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Daily Volume</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(securityStats.total_daily_spending)}</p>
                </div>
                <DollarSign className="text-green-500" size={24} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Locks</p>
                  <p className="text-2xl font-bold text-red-600">{securityStats.active_locks}</p>
                </div>
                <Lock className="text-red-500" size={24} />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Filter className="text-gray-500 mr-2" size={16} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
              </div>
              <div className="flex space-x-2">
                {[
                  { key: 'all', label: 'All Users' },
                  { key: 'new', label: 'New Accounts' },
                  { key: 'established', label: 'Established' },
                  { key: 'high_usage', label: 'High Usage' }
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterType(filter.key as any)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filterType === filter.key
                        ? 'bg-[#0F9D58] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Spending Overview Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Spending Overview</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredData.length} users
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">User</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Account Age</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Daily Limit</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Spent Today</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Usage</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Transactions</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => {
                    const usagePercentage = getUsagePercentage(item.total_spent || 0, item.limit_info?.daily_limit || 0);
                    const statusColor = getStatusColor(usagePercentage);
                    
                    return (
                      <tr key={item.user_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center">
                            {item.account_age_days < 7 ? (
                              <Clock size={14} className="text-yellow-500 mr-1" />
                            ) : (
                              <TrendingUp size={14} className="text-green-500 mr-1" />
                            )}
                            <span className="text-gray-900 dark:text-white">
                              {item.account_age_days} {item.account_age_days === 1 ? 'day' : 'days'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(item.limit_info?.daily_limit || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(item.total_spent || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  usagePercentage >= 90 ? 'bg-red-500' :
                                  usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {usagePercentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-gray-900 dark:text-white">
                            {item.transaction_count || 0}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                            {item.limit_info?.limit_type === 'new_account' ? 'New' : 'Established'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredData.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No users found matching the selected filters.</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Spending Limits</h3>
              <Settings className="text-gray-500" size={16} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Configure daily spending limits for different account types.
            </p>
            <Button
              onClick={() => navigate('/admin/spending-limits')}
              variant="outline"
              className="w-full text-sm"
            >
              Manage Limits
            </Button>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Transaction Audit</h3>
              <Eye className="text-gray-500" size={16} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              View detailed audit logs of all transactions and security events.
            </p>
            <Button
              onClick={() => navigate('/admin/audit-logs')}
              variant="outline"
              className="w-full text-sm"
            >
              View Audit Logs
            </Button>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Security Alerts</h3>
              <AlertTriangle className="text-gray-500" size={16} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Monitor and respond to security alerts and suspicious activities.
            </p>
            <Button
              onClick={() => navigate('/admin/security-alerts')}
              variant="outline"
              className="w-full text-sm"
            >
              View Alerts
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;