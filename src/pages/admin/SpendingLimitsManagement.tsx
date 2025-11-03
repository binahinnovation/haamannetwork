import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Settings, 
  Save, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { formatCurrency } from '../../lib/utils';

type SpendingLimit = {
  id: string;
  limit_type: string;
  daily_limit: number;
  account_age_days: number;
  description: string;
  is_active: boolean;
};

const SpendingLimitsManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchSpendingLimits();
    }
  }, [user]);

  const fetchSpendingLimits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spending_limits_config')
        .select('*')
        .order('account_age_days');

      if (error) throw error;
      setLimits(data || []);
    } catch (error) {
      console.error('Error fetching spending limits:', error);
      setMessage({ type: 'error', text: 'Failed to load spending limits' });
    } finally {
      setLoading(false);
    }
  };

  const updateLimit = async (limitType: string, newLimit: number) => {
    if (!user?.isAdmin) return;

    try {
      setSaving(true);
      const { data, error } = await supabase.rpc('update_spending_limit', {
        p_limit_type: limitType,
        p_new_daily_limit: newLimit,
        p_admin_user_id: user.id
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      setMessage({ 
        type: 'success', 
        text: `Successfully updated ${limitType} limit to ${formatCurrency(newLimit)}` 
      });
      
      // Refresh the limits
      await fetchSpendingLimits();
    } catch (error: any) {
      console.error('Error updating limit:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update limit' });
    } finally {
      setSaving(false);
    }
  };

  const handleLimitChange = (index: number, newValue: string) => {
    const newLimits = [...limits];
    newLimits[index].daily_limit = parseFloat(newValue) || 0;
    setLimits(newLimits);
  };

  const handleSave = async (limit: SpendingLimit) => {
    await updateLimit(limit.limit_type, limit.daily_limit);
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
            onClick={() => navigate('/admin/security')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-2"
          >
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center">
            <Settings className="text-[#0F9D58] mr-3" size={24} />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Spending Limits Management</h1>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Success/Error Message */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle size={20} className="mr-2" />
            ) : (
              <AlertTriangle size={20} className="mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">New Account Limit</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(limits.find(l => l.limit_type === 'new_account')?.daily_limit || 3000)}
                </p>
              </div>
              <Clock className="text-yellow-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Established Limit</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(limits.find(l => l.limit_type === 'established_account')?.daily_limit || 10000)}
                </p>
              </div>
              <TrendingUp className="text-green-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Limit Types</p>
                <p className="text-2xl font-bold text-blue-600">{limits.length}</p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>
          </Card>
        </div>

        {/* Spending Limits Configuration */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configure Spending Limits</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {limits.map((limit, index) => (
                <div key={limit.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white capitalize">
                        {limit.limit_type.replace('_', ' ')} Accounts
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{limit.description}</p>
                    </div>
                    <div className="flex items-center">
                      {limit.limit_type === 'new_account' ? (
                        <Clock size={20} className="text-yellow-500 mr-2" />
                      ) : (
                        <TrendingUp size={20} className="text-green-500 mr-2" />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        limit.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
                      }`}>
                        {limit.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Daily Limit (₦)
                      </label>
                      <Input
                        type="number"
                        value={limit.daily_limit}
                        onChange={(e) => handleLimitChange(index, e.target.value)}
                        className="w-full"
                        min="0"
                        step="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Account Age Requirement
                      </label>
                      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                        {limit.account_age_days === 0 ? 'New accounts' : `${limit.account_age_days}+ days`}
                      </div>
                    </div>

                    <div>
                      <Button
                        onClick={() => handleSave(limit)}
                        isLoading={saving}
                        disabled={saving}
                        className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
                        icon={<Save size={16} />}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Information Panel */}
        <Card className="p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Important Information</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>• Changes to spending limits take effect immediately for all users</p>
            <p>• New accounts are automatically upgraded to established limits after 7 days</p>
            <p>• All limit changes are logged for audit purposes</p>
            <p>• Users will see their updated limits in real-time</p>
            <p>• Consider the impact on user experience when adjusting limits</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SpendingLimitsManagement;