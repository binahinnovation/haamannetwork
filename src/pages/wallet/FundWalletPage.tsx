import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Clock, Copy, RefreshCw, CreditCard, Wallet, Ban as Bank, CheckCircle, Info } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

const FundWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuthStore();
  const { siteName, footerEmail } = useAppSettingsStore();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fundingCharges, setFundingCharges] = useState({
    enabled: false,
    type: 'percentage',
    value: 0,
    minDeposit: 0,
    maxDeposit: 0,
    displayText: ''
  });
  const [amount, setAmount] = useState('');
  const [calculatedCharge, setCalculatedCharge] = useState(0);
  const [amountToReceive, setAmountToReceive] = useState(0);
  const [loadingCharges, setLoadingCharges] = useState(false);

  useEffect(() => {
    if (user && !user.virtualAccountNumber) {
      refreshUserData();
    }
    fetchFundingCharges();
  }, [user, refreshUserData]);

  const fetchFundingCharges = async () => {
    setLoadingCharges(true);
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'funding_charge_enabled',
          'funding_charge_type',
          'funding_charge_value',
          'funding_charge_min_deposit',
          'funding_charge_max_deposit',
          'funding_charge_display_text'
        ]);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach(setting => {
        settings[setting.key] = setting.value;
      });

      setFundingCharges({
        enabled: settings.funding_charge_enabled === 'true',
        type: settings.funding_charge_type || 'percentage',
        value: parseFloat(settings.funding_charge_value || '0'),
        minDeposit: parseFloat(settings.funding_charge_min_deposit || '0'),
        maxDeposit: parseFloat(settings.funding_charge_max_deposit || '0'),
        displayText: settings.funding_charge_display_text || ''
      });
    } catch (error) {
      console.error('Error fetching funding charges:', error);
    } finally {
      setLoadingCharges(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUserData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const copyAccountNumber = () => {
    if (user?.virtualAccountNumber) {
      navigator.clipboard.writeText(user.virtualAccountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const calculateCharge = (inputAmount: string) => {
    const depositAmount = parseFloat(inputAmount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setCalculatedCharge(0);
      setAmountToReceive(0);
      return;
    }

    // If charges are not enabled or amount is outside min/max range, no charge applies
    if (!fundingCharges.enabled || 
        (fundingCharges.minDeposit > 0 && depositAmount < fundingCharges.minDeposit) ||
        (fundingCharges.maxDeposit > 0 && depositAmount > fundingCharges.maxDeposit)) {
      setCalculatedCharge(0);
      setAmountToReceive(depositAmount);
      return;
    }

    let charge = 0;
    if (fundingCharges.type === 'percentage') {
      charge = depositAmount * (fundingCharges.value / 100);
    } else { // fixed
      charge = fundingCharges.value;
    }

    setCalculatedCharge(charge);
    setAmountToReceive(depositAmount - charge);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    calculateCharge(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Fund Wallet</h1>
      </div>

      <div className="p-4 space-y-8">
        {user?.virtualAccountNumber ? (
          <>
            {/* Virtual Account Details */}
            <Card className="p-6 bg-gradient-to-br from-[#0F9D58]/10 to-[#0d8a4f]/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Virtual Account</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Transfer to this account to fund your wallet
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  isLoading={refreshing}
                  icon={<RefreshCw size={16} />}
                >
                  Refresh
                </Button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Bank className="text-[#0F9D58] mr-3" size={24} />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Bank Name</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{user.virtualAccountBankName}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-[#0F9D58] rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">H</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Number</p>
                  <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="font-bold text-xl text-gray-900 dark:text-white tracking-wider">
                      {user.virtualAccountNumber}
                    </p>
                    <button
                      onClick={copyAccountNumber}
                      className={`p-2 rounded-lg transition-colors ${
                        copied 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                      }`}
                    >
                      {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {siteName} - {user.name}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Balance</p>
                  <p className="font-bold text-xl text-[#0F9D58]">
                    {formatCurrency(user.walletBalance)}
                  </p>
                </div>
              </div>

              {/* Funding Charges Info */}
              {loadingCharges ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0F9D58]"></div>
                </div>
              ) : fundingCharges.enabled && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
                  <div className="flex items-start mb-4">
                    <Info className="text-[#0F9D58] mr-3 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Funding Charges</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {fundingCharges.displayText || 
                          `A ${fundingCharges.type === 'percentage' ? 
                            fundingCharges.value + '% charge' : 
                            formatCurrency(fundingCharges.value) + ' fee'} 
                          applies to wallet funding.`}
                      </p>
                    </div>
                  </div>

                  {/* Deposit Amount Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Enter Deposit Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₦</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                      />
                    </div>
                  </div>

                  {/* Charge Calculation */}
                  {amount && parseFloat(amount) > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Amount to Deposit:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(parseFloat(amount))}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Service Charge:</span>
                        <span className="font-medium text-red-500">{formatCurrency(calculatedCharge)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">You'll Receive:</span>
                        <span className="font-bold text-[#0F9D58]">{formatCurrency(amountToReceive)}</span>
                      </div>
                    </div>
                  )}

                  {/* Min/Max Info */}
                  {(fundingCharges.minDeposit > 0 || fundingCharges.maxDeposit > 0) && (
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      {fundingCharges.minDeposit > 0 && (
                        <p>Minimum deposit for charges: {formatCurrency(fundingCharges.minDeposit)}</p>
                      )}
                      {fundingCharges.maxDeposit > 0 && (
                        <p>Maximum deposit for charges: {formatCurrency(fundingCharges.maxDeposit)}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start">
                  <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
                  <div className="ml-3">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Important Information</h4>
                    <ul className="mt-1 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• Transfers to this account are processed instantly</li>
                      <li>• Minimum deposit amount: ₦100</li>
                      {fundingCharges.enabled && (
                        <li>• Service charges apply as shown above</li>
                      )}
                      <li>• For issues with transfers, contact support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* How to Fund */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How to Fund Your Wallet</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Copy your account number</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click the copy button next to your account number above
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Open your banking app</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Log in to your mobile banking app or internet banking
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Make a transfer</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Transfer any amount to the account number using {user.virtualAccountBankName} as the destination bank
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Your wallet is funded instantly</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your wallet balance will be updated automatically once the transfer is complete
                      {fundingCharges.enabled && ' (service charges may apply)'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Transaction History Link */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/transactions')}
                icon={<CreditCard size={16} />}
              >
                View Transaction History
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* No Virtual Account Yet */}
            <Card className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="text-yellow-600 dark:text-yellow-400" size={28} />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Virtual Account Setup</h2>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You don't have a virtual account set up yet. To fund your wallet via bank transfer, you'll need to create a virtual account.
              </p>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start">
                  <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
                  <div className="ml-3">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Important Information</h4>
                    <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                      Creating a virtual account requires your BVN (Bank Verification Number). This is a requirement from our payment partner, Flutterwave, for KYC compliance.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => navigate('/profile')}
                className="bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
              >
                Update Profile to Create Virtual Account
              </Button>
            </Card>

            {/* Alternative Methods */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Alternative Funding Methods
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Contact Support</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please contact our support team to arrange a manual wallet funding.
                  </p>
                  <p className="text-sm font-medium text-[#0F9D58] mt-2">
                    {footerEmail}
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Support Contact */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Need Help?
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            If you have any questions about funding your wallet, please contact our support team.
          </p>
          <p className="text-sm text-[#0F9D58] font-medium mt-1">
            {footerEmail}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FundWalletPage;