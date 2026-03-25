import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, RefreshCw, Copy, Check, Share2, CreditCard, Smartphone, Info, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

const FundWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUserData, createPaymentPointAccounts } = useAuthStore();
  const [selectedProvider, setSelectedProvider] = useState<'palmpay' | 'opay' | 'flutterwave'>('palmpay');
  const [expandedSection, setExpandedSection] = useState<'bank' | null>('bank');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const hasAttemptedCreationRef = useRef(false);
  const [fundingCharges, setFundingCharges] = useState({ enabled: false, type: 'percentage', value: 0, displayText: '' });

  useEffect(() => {
    fetchFundingCharges();
  }, []);

  // Auto-create accounts if missing (same pattern as DashboardPage)
  useEffect(() => {
    const trigger = async () => {
      if (!user?.id || isCreatingAccount) return;
      const hasAny = user.palmpayAccountNumber || user.opayAccountNumber;
      if (!hasAny && !hasAttemptedCreationRef.current) {
        hasAttemptedCreationRef.current = true;
        setIsCreatingAccount(true);
        try {
          await createPaymentPointAccounts(user.id);
          await refreshUserData();
        } catch (e) {
          console.error('Account creation error:', e);
        } finally {
          setIsCreatingAccount(false);
        }
      }
    };
    trigger();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.palmpayAccountNumber, user?.opayAccountNumber]);

  const fetchFundingCharges = async () => {
    try {
      const { data } = await supabase.from('admin_settings').select('key, value')
        .in('key', ['funding_charge_enabled', 'funding_charge_type', 'funding_charge_value', 'funding_charge_display_text']);
      const s: Record<string, string> = {};
      data?.forEach(d => { s[d.key] = d.value; });
      setFundingCharges({
        enabled: s.funding_charge_enabled === 'true',
        type: s.funding_charge_type || 'percentage',
        value: parseFloat(s.funding_charge_value || '0'),
        displayText: s.funding_charge_display_text || '',
      });
    } catch (e) { /* silent */ }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUserData();
    setIsRefreshing(false);
  };

  const providers = {
    palmpay:     { label: 'PalmPay',     accountNumber: user?.palmpayAccountNumber || '', accountName: user?.name || '' },
    opay:        { label: 'OPay',        accountNumber: user?.opayAccountNumber || '',    accountName: user?.name || '' },
    flutterwave: { label: 'Flutterwave', accountNumber: user?.virtualAccountNumber || '', accountName: user?.name || '' },
  };

  const current = providers[selectedProvider];
  const hasAccount = !!current.accountNumber;

  const copyNumber = () => {
    if (!current.accountNumber) return;
    navigator.clipboard.writeText(current.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const shareDetails = () => {
    const text = `${providers[selectedProvider].label} Account\nAccount Number: ${current.accountNumber}\nAccount Name: ${current.accountName}`;
    if (navigator.share) {
      navigator.share({ title: 'My Virtual Account', text });
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-3"
        >
          <ArrowLeft size={22} className="text-gray-800 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">Add Money</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className={`text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 space-y-3 pb-10">

        {/* Bank Transfer Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Row header */}
          <button
            className="w-full flex items-center p-4 text-left"
            onClick={() => setExpandedSection(expandedSection === 'bank' ? null : 'bank')}
          >
            <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
              <Building2 size={22} className="text-[#0F9D58]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Bank Transfer</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add money via mobile or internet banking</p>
            </div>
            <ChevronRight
              size={18}
              className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${expandedSection === 'bank' ? 'rotate-90' : ''}`}
            />
          </button>

          {/* Expanded content */}
          {expandedSection === 'bank' && (
            <div className="px-4 pb-5 border-t border-gray-100 dark:border-gray-700">
              {/* Provider selector */}
              <div className="flex gap-2 mt-4 mb-5">
                {(Object.keys(providers) as Array<keyof typeof providers>).map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedProvider(key)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      selectedProvider === key
                        ? 'bg-[#0F9D58] text-white border-[#0F9D58]'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#0F9D58]'
                    }`}
                  >
                    {providers[key].label}
                  </button>
                ))}
              </div>

              {/* Account number display */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {providers[selectedProvider].label} Account Number
              </p>

              {isCreatingAccount && !hasAccount ? (
                <div className="flex items-center gap-2 my-3">
                  <span className="w-2 h-2 bg-[#0F9D58] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-[#0F9D58] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-[#0F9D58] rounded-full animate-bounce" />
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">Setting up your account…</span>
                </div>
              ) : (
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-wide my-3">
                  {hasAccount
                    ? current.accountNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')
                    : '—'}
                </p>
              )}

              {hasAccount && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  Account name: <span className="font-medium text-gray-700 dark:text-gray-300">{current.accountName}</span>
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={copyNumber}
                  disabled={!hasAccount}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
                    hasAccount
                      ? 'bg-[#0F9D58]/10 text-[#0F9D58] hover:bg-[#0F9D58]/20 active:scale-95'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Number'}
                </button>
                <button
                  onClick={shareDetails}
                  disabled={!hasAccount}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
                    hasAccount
                      ? 'bg-[#0F9D58] text-white hover:bg-[#0d8a4f] active:scale-95'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Share2 size={16} />
                  Share Details
                </button>
              </div>

              {/* Charge info */}
              {fundingCharges.enabled && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <Info size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {fundingCharges.displayText ||
                      `A ${fundingCharges.type === 'percentage' ? fundingCharges.value + '%' : '₦' + fundingCharges.value} service charge applies to wallet funding.`}
                  </p>
                </div>
              )}

              {/* Auto-credit note */}
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
                Transfer any amount to this account and your wallet will be credited automatically
              </p>
            </div>
          )}
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">OR</span>
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            className="w-full flex items-center p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            onClick={() => navigate('/transactions')}
          >
            <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
              <CreditCard size={22} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Transaction History</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">View all your past deposits and spending</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
          </button>
        </div>

        {/* Contact Support */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            className="w-full flex items-center p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            onClick={() => navigate('/support')}
          >
            <div className="w-11 h-11 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
              <Smartphone size={22} className="text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Contact Support</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Get help with your wallet or transactions</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
          </button>
        </div>

        {/* Current Balance pill */}
        <div className="flex justify-center pt-2">
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-full px-6 py-2.5 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Current Balance:</span>
            <span className="text-sm font-bold text-[#0F9D58]">{formatCurrency(user?.walletBalance || 0)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FundWalletPage;