import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../lib/utils';

type SpendingLimitInfoProps = {
  className?: string;
  showDetails?: boolean;
};

const SpendingLimitInfo: React.FC<SpendingLimitInfoProps> = ({ 
  className = '', 
  showDetails = true 
}) => {
  const { getSpendingLimitInfo, getDailySpending } = useAuthStore();
  const [limitInfo, setLimitInfo] = useState<any>(null);
  const [spendingInfo, setSpendingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpendingData();
  }, []);

  const fetchSpendingData = async () => {
    try {
      setLoading(true);
      const [limitData, spendingData] = await Promise.all([
        getSpendingLimitInfo(),
        getDailySpending()
      ]);
      
      setLimitInfo(limitData);
      setSpendingInfo(spendingData);
    } catch (error) {
      console.error('Error fetching spending data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (!limitInfo || !spendingInfo) {
    return null;
  }

  const dailyLimit = limitInfo.daily_limit;
  const totalSpent = spendingInfo.total_spent;
  const remainingLimit = dailyLimit - totalSpent;
  const usagePercentage = (totalSpent / dailyLimit) * 100;
  const isNewAccount = limitInfo.limit_type === 'new_account';
  const accountAgeDays = limitInfo.account_age_days;

  const getStatusColor = () => {
    if (usagePercentage >= 90) return 'text-red-600 dark:text-red-400';
    if (usagePercentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusIcon = () => {
    if (usagePercentage >= 90) return <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />;
    if (usagePercentage >= 70) return <Clock size={16} className="text-yellow-600 dark:text-yellow-400" />;
    return <CheckCircle size={16} className="text-green-600 dark:text-green-400" />;
  };

  const getProgressBarColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Shield size={18} className="text-[#0F9D58] mr-2" />
          <h3 className="font-medium text-gray-900 dark:text-white">Daily Spending Limit</h3>
        </div>
        {getStatusIcon()}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>Used: {formatCurrency(totalSpent)}</span>
          <span>Limit: {formatCurrency(dailyLimit)}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{usagePercentage.toFixed(1)}% used</span>
          <span className={getStatusColor()}>
            {remainingLimit > 0 ? `${formatCurrency(remainingLimit)} remaining` : 'Limit reached'}
          </span>
        </div>
      </div>

      {/* Account Status */}
      {showDetails && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Account Status:</span>
            <div className="flex items-center">
              {isNewAccount ? (
                <>
                  <Clock size={14} className="text-yellow-500 mr-1" />
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">New Account</span>
                </>
              ) : (
                <>
                  <TrendingUp size={14} className="text-green-500 mr-1" />
                  <span className="text-green-600 dark:text-green-400 font-medium">Established</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Account Age:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {accountAgeDays} {accountAgeDays === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Transactions Today:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {spendingInfo.transaction_count}
            </span>
          </div>

          {/* Upgrade Notice for New Accounts */}
          {isNewAccount && accountAgeDays < 7 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mt-3">
              <div className="flex items-start">
                <TrendingUp size={16} className="text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Limit Upgrade Available
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Your daily limit will increase to {formatCurrency(10000)} in {7 - accountAgeDays} {7 - accountAgeDays === 1 ? 'day' : 'days'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for High Usage */}
          {usagePercentage >= 80 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mt-3">
              <div className="flex items-start">
                <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Approaching Daily Limit
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    You have {formatCurrency(remainingLimit)} remaining for today
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpendingLimitInfo;