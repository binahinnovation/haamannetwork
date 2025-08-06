import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Copy, Share2, Users, Gift, TrendingUp, Award, ArrowLeft, CheckCircle, User, AlertCircle, Wifi, Phone, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SuccessModal from '../../components/ui/SuccessModal';

type Referral = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

const ReferEarnPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { appBaseUrl, siteName, footerEmail } = useAppSettingsStore();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRewardStats, setLoadingRewardStats] = useState(false);
  const [referralStats, setReferralStats] = useState({
    // Remove totalReferrals and referralEarnings from here as they'll come from user object
    bonusPercentage: 6,
    dataRewardEligible: false,
    dataRewardClaimed: false,
    rewardEnabled: true,
    requiredReferrals: 5,
    rewardDataSize: '1GB',
    rewardType: 'data_bundle',
    airtimeAmount: 1000,
    cashAmount: 1000
  });
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{valid: boolean, message: string} | null>(null);
  const [claimingReward, setClaimingReward] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  
  // Pagination for referrals
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const itemsPerPage = 5;
  
  // Get referral code from user
  const referralCode = user ? user.referralCode : 'HN-XXXXXXXX';
  const referralLink = `${appBaseUrl}/signup?ref=${referralCode}`;

  useEffect(() => {
    if (user) {
      fetchReferrals();
      fetchReferralStats();
    }
  }, [user?.id, user?.totalReferrals, user?.referralEarnings]); // Add dependencies to re-fetch when these values change

  const fetchReferrals = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get total count first for pagination
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', user.id);
      
      if (countError) throw countError;
      
      setTotalReferrals(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
      // Get users who were referred by the current user with pagination
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, created_at')
        .eq('referred_by', user.id)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
      
      if (error) throw error;
      setReferrals(data || []);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralStats = async () => {
    if (!user) return;
    
    setLoadingRewardStats(true);
    try {
      // Get referral settings from admin settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'referral_bonus_percentage', 
          'referral_reward_enabled', 
          'referral_reward_count', 
          'referral_reward_data_size',
          'referral_reward_type',
          'referral_reward_airtime_amount',
          'referral_reward_cash_amount',
          'referral_invite_limit'
        ]);
      
      if (settingsError) {
        console.error('Error fetching referral settings:', settingsError);
      } else if (settingsData) {
        const settings: Record<string, string> = {};
        settingsData.forEach(setting => {
          settings[setting.key] = setting.value;
        });

        // Check if user has claimed the reward
        const { data: rewardData, error: rewardError } = await supabase
          .from('referral_rewards')
          .select('*')
          .eq('user_id', user.id)
          .eq('reward_type', settings.referral_reward_type || 'data_bundle')
          .maybeSingle();
          
        if (rewardError) {
          console.error('Error fetching reward status:', rewardError);
        }
        
        // Use user.totalReferrals directly from the authStore
        const totalReferrals = user.totalReferrals || 0;
        const requiredReferrals = parseInt(settings.referral_reward_count || '5');
        
        // Update referral stats
        setReferralStats({
          bonusPercentage: parseFloat(settings.referral_bonus_percentage || '6'),
          dataRewardEligible: totalReferrals >= requiredReferrals,
          dataRewardClaimed: !!rewardData,
          rewardEnabled: settings.referral_reward_enabled === 'true',
          requiredReferrals: requiredReferrals,
          rewardDataSize: settings.referral_reward_data_size || '1GB',
          rewardType: settings.referral_reward_type || 'data_bundle',
          airtimeAmount: parseInt(settings.referral_reward_airtime_amount || '1000'),
          cashAmount: parseInt(settings.referral_reward_cash_amount || '1000')
        });
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoadingRewardStats(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralCode = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join ${siteName}`,
        text: `Join me on ${siteName} and get amazing rewards! Use my referral code: ${referralCode}`,
        url: referralLink
      }).catch(err => {
        console.error('Error sharing:', err);
        copyReferralCode();
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      copyReferralCode();
    }
  };

  // Function to verify a referral code
  const verifyReferralCode = async () => {
    if (!verifyCodeInput.trim()) {
      setReferralCodeError("Please enter a referral code");
      return;
    }
    
    setIsVerifying(true);
    setVerificationResult(null);
    setReferralCodeError(null);
    
    try {
      // Query the database directly to check if the code exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('referral_code', verifyCodeInput.trim())
        .maybeSingle();
        
      if (error) throw error;
      
      if (data) {
        setVerificationResult({
          valid: true,
          message: "Valid referral code! You can use this code when signing up."
        });
      } else {
        setVerificationResult({
          valid: false,
          message: "Invalid referral code. Please check and try again."
        });
      }
    } catch (error) {
      console.error('Error verifying referral code:', error);
      setVerificationResult({
        valid: false,
        message: "An unexpected error occurred. Please try again."
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  const claimReferralReward = async () => {
    if (!user) return;
    
    if (!referralStats.dataRewardEligible || referralStats.dataRewardClaimed || !referralStats.rewardEnabled) {
      return;
    }
    
    setClaimingReward(true);
    
    try {
      let rewardAmount = 0;
      let rewardDetails = {};
      
      switch (referralStats.rewardType) {
        case 'data_bundle':
          // Find a matching data plan to determine the value
          const { data: dataPlans, error: plansError } = await supabase
            .from('data_plans')
            .select('*')
            .eq('network', 'MTN')
            .eq('is_active', true)
            .ilike('size', referralStats.rewardDataSize)
            .order('selling_price', { ascending: true })
            .limit(1);
            
          if (plansError) throw plansError;
          
          if (!dataPlans || dataPlans.length === 0) {
            throw new Error(`No matching data plan found for size ${referralStats.rewardDataSize}`);
          }
          
          const dataPlan = dataPlans[0];
          rewardAmount = dataPlan.selling_price;
          
          rewardDetails = {
            reward_type: 'data_bundle',
            data_size: referralStats.rewardDataSize,
            network: 'MTN',
            plan_id: dataPlan.id,
            plan_name: dataPlan.description || `${dataPlan.size} Data`
          };
          break;
          
        case 'airtime':
          rewardAmount = referralStats.airtimeAmount;
          rewardDetails = {
            reward_type: 'airtime',
            network: 'MTN',
            amount: rewardAmount
          };
          break;
          
        case 'wallet_credit':
          rewardAmount = referralStats.cashAmount;
          rewardDetails = {
            reward_type: 'wallet_credit',
            amount: rewardAmount
          };
          break;
          
        default:
          throw new Error(`Unknown reward type: ${referralStats.rewardType}`);
      }
      
      // Update user's wallet balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance, referral_earnings')
        .eq('id', user.id)
        .single();
        
      if (profileError) throw profileError;
      
      const newBalance = profile.wallet_balance + rewardAmount;
      const newReferralEarnings = (profile.referral_earnings || 0) + rewardAmount;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          referral_earnings: newReferralEarnings
        })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      // Create a transaction for the reward
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: user.id,
          type: 'referral_reward',
          amount: rewardAmount,
          status: 'success',
          reference: `REF-REWARD-${Date.now()}`,
          details: {
            ...rewardDetails,
            note: `Reward for referring ${referralStats.requiredReferrals} users`
          }
        }]);
        
      if (transactionError) throw transactionError;
      
      // Record the reward claim
      const { error: rewardError } = await supabase
        .from('referral_rewards')
        .insert([{
          user_id: user.id,
          reward_type: referralStats.rewardType,
          reward_details: rewardDetails,
          status: 'claimed'
        }]);
        
      if (rewardError) throw rewardError;
      
      // Update the local state
      setReferralStats(prev => ({
        ...prev,
        dataRewardClaimed: true
      }));
      
      // Update the auth store with the new wallet balance and referral earnings
      const authStore = useAuthStore.getState();
      authStore.updateUser({
        walletBalance: newBalance,
        referralEarnings: newReferralEarnings
      });
      
      // Show success message based on reward type
      let successMessage = '';
      switch (referralStats.rewardType) {
        case 'data_bundle':
          successMessage = `Congratulations! Your ${referralStats.rewardDataSize} data reward (${formatCurrency(rewardAmount)}) has been credited to your wallet. You can now use it to purchase data.`;
          break;
        case 'airtime':
          successMessage = `Congratulations! Your airtime reward of ${formatCurrency(rewardAmount)} has been credited to your wallet. You can now use it to purchase airtime.`;
          break;
        case 'wallet_credit':
          successMessage = `Congratulations! Your cash reward of ${formatCurrency(rewardAmount)} has been credited to your wallet.`;
          break;
      }
      
      // Show success modal instead of alert
      setSuccessModalMessage(successMessage);
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Failed to claim reward. Please try again or contact support.');
    } finally {
      setClaimingReward(false);
    }
  };

  // Get the appropriate icon for the reward type
  const getRewardIcon = () => {
    switch (referralStats.rewardType) {
      case 'data_bundle':
        return <Wifi size={16} className="text-[#0F9D58]" />;
      case 'airtime':
        return <Phone size={16} className="text-[#0F9D58]" />;
      case 'wallet_credit':
        return <CreditCard size={16} className="text-[#0F9D58]" />;
      default:
        return <Gift size={16} className="text-[#0F9D58]" />;
    }
  };

  // Get the reward description based on type
  const getRewardDescription = () => {
    switch (referralStats.rewardType) {
      case 'data_bundle':
        return `${referralStats.rewardDataSize} Data Bundle Reward`;
      case 'airtime':
        return `${formatCurrency(referralStats.airtimeAmount)} Airtime Reward`;
      case 'wallet_credit':
        return `${formatCurrency(referralStats.cashAmount)} Cash Reward`;
      default:
        return 'Referral Reward';
    }
  };

  // Get the reward details text
  const getRewardDetailsText = () => {
    switch (referralStats.rewardType) {
      case 'data_bundle':
        return `Refer ${referralStats.requiredReferrals} friends and get ${referralStats.rewardDataSize} data bundle for free`;
      case 'airtime':
        return `Refer ${referralStats.requiredReferrals} friends and get ${formatCurrency(referralStats.airtimeAmount)} airtime for free`;
      case 'wallet_credit':
        return `Refer ${referralStats.requiredReferrals} friends and get ${formatCurrency(referralStats.cashAmount)} credited to your wallet`;
      default:
        return `Refer ${referralStats.requiredReferrals} friends to earn your reward`;
    }
  };

  // Get the claim button text
  const getClaimButtonText = () => {
    if (referralStats.dataRewardClaimed) {
      return 'Reward Claimed';
    }
    
    if (referralStats.dataRewardEligible) {
      switch (referralStats.rewardType) {
        case 'data_bundle':
          return `Claim ${referralStats.rewardDataSize} Data Reward`;
        case 'airtime':
          return `Claim ${formatCurrency(referralStats.airtimeAmount)} Airtime`;
        case 'wallet_credit':
          return `Claim ${formatCurrency(referralStats.cashAmount)} Cash Reward`;
        default:
          return 'Claim Reward';
      }
    }
    
    // Calculate remaining referrals needed
    const remainingReferrals = referralStats.requiredReferrals - (user?.totalReferrals || 0);
    return `Refer ${remainingReferrals} more friend${remainingReferrals !== 1 ? 's' : ''}`;
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Effect to refetch referrals when page changes
  useEffect(() => {
    if (user) {
      fetchReferrals();
    }
  }, [currentPage]);

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
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white ml-4">Refer & Earn</h1>
      </div>

      <div className="p-4 space-y-6 w-full max-w-md mx-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#0F9D58] to-[#0d8a4f] rounded-2xl p-6 text-white relative overflow-hidden w-full">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-16 h-16 border-2 border-white rounded-full"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-2 border-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white rounded-full"></div>
          </div>
          
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift size={32} className="text-white" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Invite friends to {siteName}
            </h2>
            <p className="text-base sm:text-lg opacity-90 mb-4">
              Earn rewards for every successful referral!
            </p>
            
            {/* Bonus Badge */}
            <div className="inline-block bg-white text-[#0F9D58] px-6 py-3 rounded-2xl font-bold text-xl">
              {referralStats.bonusPercentage}% Bonus
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="text-[#0F9D58]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">{user?.totalReferrals || 0}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Referrals</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award size={24} className="text-[#0F9D58]" />
            </div>
            <div className="text-lg sm:text-2xl font-bold text-[#0F9D58] mb-1">{formatCurrency(user?.referralEarnings || 0)}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Earned</div>
          </div>
        </div>

        {/* Reward Card */}
        {referralStats.rewardEnabled && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            {loadingRewardStats ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    {referralStats.rewardType === 'data_bundle' && <Wifi className="text-[#0F9D58] mr-2" size={20} />}
                    {referralStats.rewardType === 'airtime' && <Phone className="text-[#0F9D58] mr-2" size={20} />}
                    {referralStats.rewardType === 'wallet_credit' && <CreditCard className="text-[#0F9D58] mr-2" size={20} />}
                    {referralStats.rewardType === 'data_bundle' ? 'Data Reward' : 
                     referralStats.rewardType === 'airtime' ? 'Airtime Reward' : 'Cash Reward'}
                  </h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                    referralStats.dataRewardClaimed 
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' 
                      : referralStats.dataRewardEligible 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {referralStats.dataRewardClaimed 
                      ? 'Claimed' 
                      : referralStats.dataRewardEligible 
                      ? 'Ready to Claim' 
                      : 'In Progress'}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Refer {referralStats.requiredReferrals} friends
                    </span>
                    <span className="text-sm font-bold text-[#0F9D58]">
                      {user?.totalReferrals || 0}/{referralStats.requiredReferrals} completed
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mb-3">
                    <div 
                      className="h-2.5 rounded-full bg-[#0F9D58]"
                      style={{ width: `${Math.min(100, ((user?.totalReferrals || 0) / referralStats.requiredReferrals) * 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mr-3">
                      {getRewardIcon()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getRewardDescription()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getRewardDetailsText()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={claimReferralReward}
                  disabled={!referralStats.dataRewardEligible || referralStats.dataRewardClaimed || claimingReward}
                  className={`w-full ${
                    referralStats.dataRewardEligible && !referralStats.dataRewardClaimed
                      ? 'bg-[#0F9D58] hover:bg-[#0d8a4f] text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                  isLoading={claimingReward}
                >
                  {getClaimButtonText()}
                </Button>
              </>
            )}
          </div>
        )}

        {/* How it Works */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="text-[#0F9D58] mr-2" size={20} />
            How it Works
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Share your referral code</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Send your unique code to friends and family
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">They sign up and deposit</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Your friend creates an account and makes their first deposit of ₦1,000+
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">You both earn rewards</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Get {referralStats.bonusPercentage}% bonus on their first deposit, credited instantly to your wallet
                </p>
              </div>
            </div>
            
            {referralStats.rewardEnabled && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Earn special rewards</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {referralStats.rewardType === 'data_bundle' && 
                      `Refer ${referralStats.requiredReferrals} friends and get a free ${referralStats.rewardDataSize} data bundle`}
                    {referralStats.rewardType === 'airtime' && 
                      `Refer ${referralStats.requiredReferrals} friends and get ${formatCurrency(referralStats.airtimeAmount)} airtime for free`}
                    {referralStats.rewardType === 'wallet_credit' && 
                      `Refer ${referralStats.requiredReferrals} friends and get ${formatCurrency(referralStats.cashAmount)} credited to your wallet`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Referral Actions */}
        <div className="space-y-4">
          {/* Share Button */}
          <button
            onClick={shareReferralCode}
            className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-4 rounded-2xl font-semibold text-base sm:text-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Share2 size={20} />
            <span>Refer a Friend</span>
          </button>

          {/* Referral Code Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Your Referral Code
            </h3>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-[#0F9D58]/10 rounded-xl px-3 sm:px-4 py-3 border border-[#0F9D58]/20 min-w-0">
                <span className="text-[#0F9D58] font-bold text-sm sm:text-lg break-all">
                  {referralCode}
                </span>
              </div>
              
              <button
                onClick={copyReferralCode}
                className={`px-4 sm:px-6 py-3 rounded-xl font-medium transition-all flex items-center space-x-2 flex-shrink-0 ${
                  copied 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-[#FF6B35] hover:bg-[#e55a2b] text-white'
                }`}
              >
                <Copy size={16} />
                <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
          
          {/* Referral Link Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Your Referral Link
            </h3>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 sm:px-4 py-3 min-w-0">
                <span className="text-gray-700 dark:text-gray-300 text-sm break-all">
                  {referralLink}
                </span>
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-4 py-3 rounded-xl font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-all flex-shrink-0"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Verify Referral Code Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">
            Verify a Referral Code
          </h3>
          
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter referral code to verify"
                value={verifyCodeInput}
                onChange={(e) => {
                  setVerifyCodeInput(e.target.value);
                  // Clear previous results when input changes
                  setVerificationResult(null);
                  setReferralCodeError(null);
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
              />
            </div>
            
            {referralCodeError && (
              <div className="flex items-start space-x-2 text-red-500">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{referralCodeError}</p>
              </div>
            )}
            
            {verificationResult && (
              <div className={`flex items-start space-x-2 ${verificationResult.valid ? 'text-green-500' : 'text-red-500'}`}>
                {verificationResult.valid ? (
                  <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{verificationResult.message}</p>
              </div>
            )}
            
            <button
              onClick={verifyReferralCode}
              disabled={isVerifying || !verifyCodeInput.trim()}
              className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </div>

        {/* Referral History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">
            Recent Referrals
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <Card key={referral.id} className="p-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mr-3">
                      <User size={18} className="text-[#0F9D58]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{referral.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{referral.email}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              ))}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalReferrals)} of {totalReferrals}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                        // Show first page, current page, and last page
                        let pageToShow: number;
                        if (totalPages <= 3) {
                          // If 3 or fewer pages, show all
                          pageToShow = i + 1;
                        } else if (currentPage === 1 || currentPage === 2) {
                          // If on first or second page, show 1, 2, 3
                          pageToShow = i + 1;
                        } else if (currentPage === totalPages || currentPage === totalPages - 1) {
                          // If on last or second-to-last page, show last 3 pages
                          pageToShow = totalPages - 2 + i;
                        } else {
                          // Otherwise show current page and neighbors
                          pageToShow = currentPage - 1 + i;
                        }
                        
                        return (
                          <button
                            key={pageToShow}
                            onClick={() => handlePageChange(pageToShow)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                              currentPage === pageToShow
                                ? 'bg-[#0F9D58] text-white'
                                : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {pageToShow}
                          </button>
                        );
                      })}
                      
                      {/* Show ellipsis if needed */}
                      {totalPages > 3 && currentPage < totalPages - 1 && (
                        <span className="w-8 h-8 flex items-center justify-center">...</span>
                      )}
                      
                      {/* Always show last page if there are more than 3 pages and we're not near the end */}
                      {totalPages > 3 && currentPage < totalPages - 1 && (
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {totalPages}
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No referrals yet. Start sharing your code to earn rewards!
              </p>
            </div>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center text-sm sm:text-base">
            <Gift size={16} className="mr-2" />
            Terms & Conditions
          </h4>
          <ul className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Referral bonus is paid only on the first deposit of ₦1,000 or more</li>
            <li>• Bonus is credited within 24 hours of successful deposit</li>
            <li>• Referred user must complete account verification</li>
            <li>• Self-referrals and fake accounts are strictly prohibited</li>
            {referralStats.rewardEnabled && (
              <li>• {referralStats.rewardType === 'data_bundle' ? `Data reward (${referralStats.rewardDataSize})` : 
                  referralStats.rewardType === 'airtime' ? `Airtime reward (${formatCurrency(referralStats.airtimeAmount)})` :
                  `Cash reward (${formatCurrency(referralStats.cashAmount)})`} is given after referring {referralStats.requiredReferrals} users</li>
            )}
            <li>• {siteName} reserves the right to modify terms at any time</li>
          </ul>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        show={showSuccessModal}
        title="Reward Claimed!"
        message={successModalMessage}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
};

export default ReferEarnPage;