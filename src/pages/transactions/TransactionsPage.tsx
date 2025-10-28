import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Download, Search, Filter, BarChart2, Trophy, Users, Calendar, ChevronDown, ChevronUp, Crown, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import TransactionDetailModal from '../../components/transactions/TransactionDetailModal';

type Transaction = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  reference: string;
  details: any;
  created_at: string;
};

type TransactionStats = {
  totalSpent: number;
  dailyAverage: number;
  weeklyAverage: number;
  monthlyAverage: number;
  networkBreakdown: {
    [key: string]: {
      count: number;
      amount: number;
      percentage: number;
    }
  };
  timeBreakdown: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  mostUsedService: {
    type: string;
    count: number;
    amount: number;
  };
};

type LeaderboardEntry = {
  user_id: string;
  name: string;
  network: string;
  total_amount: number;
  rank: number;
  is_current_user: boolean;
};

type ReferralLeaderboardEntry = {
  user_id: string;
  name: string;
  total_referrals: number;
  referral_earnings: number;
  rank: number;
  is_current_user: boolean;
};

type Beneficiary = {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  network: string;
  type: 'airtime' | 'data';
  created_at: string;
};

const transactionTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'wallet_funding', label: 'Wallet Funding' },
  { value: 'airtime', label: 'Airtime' },
  { value: 'data', label: 'Data' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'waec', label: 'WAEC' },
  { value: 'product_purchase', label: 'Product Purchase' },
  { value: 'referral_reward', label: 'Referral Reward' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const timeRangeOptions = [
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];

const networkOptions = [
  { value: 'all', label: 'All Networks' },
  { value: 'mtn', label: 'MTN' },
  { value: 'airtel', label: 'Airtel' },
  { value: 'glo', label: 'Glo' },
  { value: '9mobile', label: '9mobile' },
];

const getTransactionLabel = (type: string, details: any) => {
  switch (type) {
    case 'airtime':
      return `${details.network} Airtime - ${details.phone}`;
    case 'data':
      return `${details.network} ${details.plan} - ${details.phone}`;
    case 'electricity':
      return `${details.disco} - ${details.meterNumber}`;
    case 'waec':
      return 'WAEC Card';
    case 'wallet_funding':
      // Check if this is a bank transfer with originator info
      if (details.flutterwave_data?.meta_data?.originatorname) {
        return `Wallet Funding from ${details.flutterwave_data.meta_data.originatorname} (${details.payment_method || 'bank_transfer'})`;
      }
      return `Wallet Funding (${details.method || details.payment_method || 'wallet'})`;
    case 'product_purchase':
      return `Product Purchase - ${details.product_name || 'Product'}`;
    case 'referral_reward':
      return `Referral Reward - ${details.reward_type || 'Bonus'}`;
    default:
      return 'Transaction';
  }
};

const isDebit = (type: string) => {
  return ['airtime', 'data', 'electricity', 'waec', 'product_purchase'].includes(type);
};

const downloadReceipt = (transaction: any) => {
  const doc = new jsPDF();
  
  // Add logo (using text as placeholder)
  doc.setFontSize(24);
  doc.setTextColor(15, 157, 88); // Primary color #0F9D58
  doc.text('ARABNETWORK', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('Digital Services & E-commerce Platform', 105, 30, { align: 'center' });
  
  // Add line separator
  doc.setDrawColor(200);
  doc.line(20, 35, 190, 35);
  
  // Transaction details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('TRANSACTION RECEIPT', 105, 45, { align: 'center' });
  
  doc.setFontSize(10);
  const startY = 60;
  const lineHeight = 7;
  
  // Details grid
  const details = [
    ['Date:', formatDateTime(transaction.created_at)],
    ['Reference:', transaction.reference || transaction.id],
    ['Type:', transaction.type.toUpperCase()],
    ['Description:', getTransactionLabel(transaction.type, transaction.details)],
    ['Amount:', formatCurrency(transaction.amount)],
    ['Status:', transaction.status.toUpperCase()],
  ];
  
  details.forEach(([label, value], index) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 40, startY + (lineHeight * index));
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 80, startY + (lineHeight * index));
  });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Thank you for choosing ArabNetwork!', 105, 120, { align: 'center' });
  
  // Save the PDF
  doc.save(`receipt-${transaction.reference || transaction.id}.pdf`);
};

const TransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('30days');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [transactionStats, setTransactionStats] = useState<TransactionStats>({
    totalSpent: 0,
    dailyAverage: 0,
    weeklyAverage: 0,
    monthlyAverage: 0,
    networkBreakdown: {},
    timeBreakdown: {
      daily: 0,
      weekly: 0,
      monthly: 0
    },
    mostUsedService: {
      type: '',
      count: 0,
      amount: 0
    }
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [referralLeaderboard, setReferralLeaderboard] = useState<ReferralLeaderboardEntry[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingReferralLeaderboard, setLoadingReferralLeaderboard] = useState(false);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState<'data_usage' | 'referral_earners'>('data_usage');
  
  // Transaction detail modal state
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchTransactions();
      fetchBeneficiaries();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (showLeaderboard) {
      if (leaderboardType === 'data_usage' && !leaderboard.length) {
        fetchLeaderboard();
      } else if (leaderboardType === 'referral_earners' && !referralLeaderboard.length) {
        fetchReferralLeaderboard();
      }
    }
  }, [showLeaderboard, leaderboardType]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedStatus, timeRange, selectedNetwork]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      // First get the total count for pagination
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalTransactions(count || 0);

      // Then fetch the transactions for the current page
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTransactions(data || []);
      
      // Calculate stats after fetching transactions
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchBeneficiaries = async () => {
    if (!user) return;
    
    setLoadingBeneficiaries(true);
    try {
      // Fetch beneficiaries from the database
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        // If there's an error, we'll use transaction history to extract beneficiaries
        console.error('Error fetching beneficiaries:', error);
        
        // Get data and airtime transactions
        const { data: transactionData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .in('type', ['airtime', 'data'])
          .eq('status', 'success')
          .order('created_at', { ascending: false });
          
        if (txError) throw txError;
        
        // Extract unique beneficiaries from transaction history
        const beneficiaryMap = new Map<string, Beneficiary>();
        
        transactionData?.forEach(transaction => {
          const phone = transaction.details?.phone;
          const network = transaction.details?.network;
          
          if (phone && network && !beneficiaryMap.has(phone)) {
            // Ensure network is uppercase to match networkProviders
            const formattedNetwork = network.toUpperCase();
            beneficiaryMap.set(phone, {
              id: transaction.id,
              user_id: user.id,
              name: `Beneficiary (${formattedNetwork})`,
              phone_number: phone,
              network: formattedNetwork,
              type: transaction.type as 'airtime' | 'data',
              created_at: transaction.created_at
            });
          }
        });
        
        setBeneficiaries(Array.from(beneficiaryMap.values()));
      } else {
        setBeneficiaries(data || []);
      }
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
    } finally {
      setLoadingBeneficiaries(false);
    }
  };
  
  const calculateStats = (transactionData: Transaction[]) => {
    if (!transactionData.length) return;
    
    // Filter only successful transactions
    const successfulTransactions = transactionData.filter(t => t.status === 'success');
    
    // Calculate total spent on services (excluding wallet funding)
    const serviceTransactions = successfulTransactions.filter(t => isDebit(t.type));
    const totalSpent = serviceTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Network breakdown
    const networkBreakdown: {[key: string]: {count: number, amount: number, percentage: number}} = {};
    
    serviceTransactions.forEach(t => {
      const network = t.details?.network?.toLowerCase() || 'unknown';
      if (!networkBreakdown[network]) {
        networkBreakdown[network] = { count: 0, amount: 0, percentage: 0 };
      }
      networkBreakdown[network].count += 1;
      networkBreakdown[network].amount += Number(t.amount);
    });
    
    // Calculate percentages
    Object.keys(networkBreakdown).forEach(network => {
      networkBreakdown[network].percentage = totalSpent > 0 
        ? (networkBreakdown[network].amount / totalSpent) * 100 
        : 0;
    });
    
    // Time-based calculations
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyTransactions = serviceTransactions.filter(t => new Date(t.created_at) >= oneDayAgo);
    const weeklyTransactions = serviceTransactions.filter(t => new Date(t.created_at) >= oneWeekAgo);
    const monthlyTransactions = serviceTransactions.filter(t => new Date(t.created_at) >= oneMonthAgo);
    
    const dailyTotal = dailyTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const weeklyTotal = weeklyTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyTotal = monthlyTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Calculate averages
    const dailyAverage = dailyTransactions.length > 0 ? dailyTotal / dailyTransactions.length : 0;
    const weeklyAverage = weeklyTransactions.length > 0 ? weeklyTotal / 7 : 0;
    const monthlyAverage = monthlyTransactions.length > 0 ? monthlyTotal / 30 : 0;
    
    // Find most used service
    const serviceTypeCounts: {[key: string]: {count: number, amount: number}} = {};
    serviceTransactions.forEach(t => {
      if (!serviceTypeCounts[t.type]) {
        serviceTypeCounts[t.type] = { count: 0, amount: 0 };
      }
      serviceTypeCounts[t.type].count += 1;
      serviceTypeCounts[t.type].amount += Number(t.amount);
    });
    
    let mostUsedService = { type: '', count: 0, amount: 0 };
    Object.entries(serviceTypeCounts).forEach(([type, data]) => {
      if (data.count > mostUsedService.count) {
        mostUsedService = { type, count: data.count, amount: data.amount };
      }
    });
    
    setTransactionStats({
      totalSpent,
      dailyAverage,
      weeklyAverage,
      monthlyAverage,
      networkBreakdown,
      timeBreakdown: {
        daily: dailyTotal,
        weekly: weeklyTotal,
        monthly: monthlyTotal
      },
      mostUsedService
    });
  };
  
  const fetchLeaderboard = async () => {
    if (!user) return;
    
    setLoadingLeaderboard(true);
    try {
      // Create a custom SQL query to get the leaderboard data
      const { data, error } = await supabase.rpc('get_data_usage_leaderboard', {
        network_filter: selectedNetwork === 'all' ? null : selectedNetwork,
        current_user_id: user.id
      });
      
      if (error) throw error;
      
      // Set the leaderboard data
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      
      // Fallback method if RPC function fails
      try {
        // Fetch all users with their transaction data
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .order('created_at', { ascending: false })
          .limit(50);  // Limit to a reasonable number
          
        if (profilesError) throw profilesError;
        
        // For each user, calculate their total data spending
        const leaderboardData: LeaderboardEntry[] = [];
        
        for (const profile of profiles || []) {
          // Get data transactions for this user
          const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('amount, details')
            .eq('user_id', profile.id)
            .eq('type', 'data')
            .eq('status', 'success');
            
          if (txError) continue; // Skip this user if there's an error
          
          // Calculate total amount spent on data
          const totalAmount = transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
          
          // Only include users who have spent money on data
          if (totalAmount > 0) {
            // Determine the most used network
            const networkCounts: {[key: string]: number} = {};
            transactions?.forEach(tx => {
              const network = tx.details?.network?.toLowerCase() || 'unknown';
              networkCounts[network] = (networkCounts[network] || 0) + 1;
            });
            
            let mostUsedNetwork = 'unknown';
            let maxCount = 0;
            Object.entries(networkCounts).forEach(([network, count]) => {
              if (count > maxCount) {
                mostUsedNetwork = network;
                maxCount = count;
              }
            });
            
            // Add to leaderboard
            leaderboardData.push({
              user_id: profile.id,
              // Mask the name for privacy, except for current user
              name: profile.id === user.id 
                ? `${profile.name} (You)` 
                : `${profile.name.split(' ')[0]} ${profile.name.split(' ')[1]?.charAt(0) || ''}`,
              network: mostUsedNetwork,
              total_amount: totalAmount,
              rank: 0, // Will be set after sorting
              is_current_user: profile.id === user.id
            });
          }
        }
        
        // Sort by total amount and assign ranks
        leaderboardData.sort((a, b) => b.total_amount - a.total_amount);
        leaderboardData.forEach((entry, index) => {
          entry.rank = index + 1;
        });
        
        // Take top 10
        setLeaderboard(leaderboardData.slice(0, 10));
      } catch (fallbackError) {
        console.error('Error with fallback leaderboard method:', fallbackError);
      }
    } finally {
      setLoadingLeaderboard(false);
    }
  };
  
  const fetchReferralLeaderboard = async () => {
    if (!user) return;
    
    setLoadingReferralLeaderboard(true);
    try {
      // Fetch profiles ordered by referral_earnings
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, total_referrals, referral_earnings')
        .order('referral_earnings', { ascending: false })
        .limit(50);  // Limit to a reasonable number
        
      if (profilesError) throw profilesError;
      
      // Format the data for the leaderboard
      const leaderboardData: ReferralLeaderboardEntry[] = [];
      
      profiles?.forEach((profile, index) => {
        // Only include users with referrals
        if (profile.total_referrals > 0 || profile.referral_earnings > 0) {
          leaderboardData.push({
            user_id: profile.id,
            // Mask the name for privacy, except for current user
            name: profile.id === user.id 
              ? `${profile.name} (You)` 
              : `${profile.name.split(' ')[0]} ${profile.name.split(' ')[1]?.charAt(0) || ''}`,
            total_referrals: profile.total_referrals || 0,
            referral_earnings: profile.referral_earnings || 0,
            rank: index + 1,
            is_current_user: profile.id === user.id
          });
        }
      });
      
      // Take top 10
      setReferralLeaderboard(leaderboardData.slice(0, 10));
    } catch (error) {
      console.error('Error fetching referral leaderboard:', error);
    } finally {
      setLoadingReferralLeaderboard(false);
    }
  };
  
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = getTransactionLabel(transaction.type, transaction.details)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || transaction.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || transaction.status === selectedStatus;
    
    // Filter by network if applicable
    const matchesNetwork = selectedNetwork === 'all' || 
      (transaction.details?.network?.toLowerCase() === selectedNetwork);
    
    // Filter by time range
    let matchesTimeRange = true;
    if (timeRange !== 'all') {
      const transactionDate = new Date(transaction.created_at);
      const now = new Date();
      
      if (timeRange === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesTimeRange = transactionDate >= sevenDaysAgo;
      } else if (timeRange === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesTimeRange = transactionDate >= thirtyDaysAgo;
      } else if (timeRange === '90days') {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        matchesTimeRange = transactionDate >= ninetyDaysAgo;
      }
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesNetwork && matchesTimeRange;
  });

  // Calculate total pages
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Get current page transactions
  const currentTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleStats = () => {
    setShowStats(!showStats);
    if (!showStats && !loadingStats) {
      setLoadingStats(true);
      // Simulate loading stats
      setTimeout(() => {
        setLoadingStats(false);
      }, 800);
    }
  };
  
  const toggleLeaderboard = () => {
    setShowLeaderboard(!showLeaderboard);
    if (!showLeaderboard) {
      if (leaderboardType === 'data_usage' && !leaderboard.length) {
        fetchLeaderboard();
      } else if (leaderboardType === 'referral_earners' && !referralLeaderboard.length) {
        fetchReferralLeaderboard();
      }
    }
  };
  
  const toggleBeneficiaries = () => {
    setShowBeneficiaries(!showBeneficiaries);
  };
  
  const handleViewTransactionDetail = (transaction: Transaction) => {
    setSelectedTransactionDetail(transaction);
    setShowDetailModal(true);
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-6 animate-fade-in max-w-md mx-auto px-4">
        <Card className="text-center p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-4">Login Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            Please login to view your transactions.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Login
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 animate-fade-in max-w-4xl mx-auto px-4 pb-20">
      <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Transaction History</h1>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Button 
          variant={showStats ? "primary" : "outline"} 
          onClick={toggleStats}
          icon={<BarChart2 size={16} />}
          className="text-sm"
        >
          Statistics
        </Button>
        
        <Button 
          variant={showLeaderboard ? "primary" : "outline"} 
          onClick={toggleLeaderboard}
          icon={<Trophy size={16} />}
          className="text-sm"
        >
          Leaderboard
        </Button>
        
        <Button 
          variant={showBeneficiaries ? "primary" : "outline"} 
          onClick={toggleBeneficiaries}
          icon={<Users size={16} />}
          className="text-sm"
        >
          Beneficiaries
        </Button>
      </div>
      
      {/* Statistics Section */}
      {showStats && (
        <Card className="mb-6 p-4 sm:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <BarChart2 className="mr-2 text-[#0F9D58]" size={20} />
              Transaction Statistics
            </h2>
            <Select
              options={timeRangeOptions}
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-40"
            />
          </div>
          
          {loadingStats ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
                  <p className="text-lg font-bold text-[#0F9D58]">{formatCurrency(transactionStats.totalSpent)}</p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Daily Avg</p>
                  <p className="text-lg font-bold text-[#0F9D58]">{formatCurrency(transactionStats.dailyAverage)}</p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Weekly Avg</p>
                  <p className="text-lg font-bold text-[#0F9D58]">{formatCurrency(transactionStats.weeklyAverage)}</p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Avg</p>
                  <p className="text-lg font-bold text-[#0F9D58]">{formatCurrency(transactionStats.monthlyAverage)}</p>
                </div>
              </div>
              
              {/* Network Breakdown */}
              <h3 className="text-md font-semibold mb-3">Network Breakdown</h3>
              <div className="space-y-3 mb-6">
                {Object.entries(transactionStats.networkBreakdown).map(([network, data]) => (
                  <div key={network} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          network === 'mtn' ? 'bg-yellow-500' :
                          network === 'airtel' ? 'bg-red-500' :
                          network === 'glo' ? 'bg-green-500' :
                          network === '9mobile' ? 'bg-teal-500' :
                          'bg-gray-500'
                        } mr-2`}></div>
                        <span className="font-medium capitalize">{network}</span>
                      </div>
                      <span className="text-sm">{data.count} transactions</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          network === 'mtn' ? 'bg-yellow-500' :
                          network === 'airtel' ? 'bg-red-500' :
                          network === 'glo' ? 'bg-green-500' :
                          network === '9mobile' ? 'bg-teal-500' :
                          'bg-gray-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, data.percentage)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {data.percentage.toFixed(1)}% of total
                      </span>
                      <span className="text-sm font-medium">{formatCurrency(data.amount)}</span>
                    </div>
                  </div>
                ))}
                
                {Object.keys(transactionStats.networkBreakdown).length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No network data available for the selected time period.
                  </div>
                )}
              </div>
              
              {/* Most Frequent Transactions */}
              {transactionStats.mostUsedService.type && (
                <div>
                  <h3 className="text-md font-semibold mb-3">Most Frequent Transactions</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">
                        {transactionStats.mostUsedService.type.replace('_', ' ')}
                      </span>
                      <Badge variant="success">Most Used</Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      You use {transactionStats.mostUsedService.type.replace('_', ' ')} more frequently than any other service.
                    </p>
                    <div className="flex justify-between mt-2">
                      <p className="text-sm">
                        <span className="font-medium">{transactionStats.mostUsedService.count}</span> transactions
                      </p>
                      <p className="text-sm font-medium text-[#0F9D58]">
                        {formatCurrency(transactionStats.mostUsedService.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
      
      {/* Leaderboard Section */}
      {showLeaderboard && (
        <Card className="mb-6 p-4 sm:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Trophy className="mr-2 text-[#0F9D58]" size={20} />
              Leaderboard
            </h2>
            
            {/* Leaderboard Type Selector */}
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setLeaderboardType('data_usage')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  leaderboardType === 'data_usage'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Data Usage
              </button>
              <button
                onClick={() => setLeaderboardType('referral_earners')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  leaderboardType === 'referral_earners'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Referral Earners
              </button>
            </div>
          </div>
          
          {/* Network Filter - Only show for data usage leaderboard */}
          {leaderboardType === 'data_usage' && (
            <div className="mb-4">
              <Select
                options={networkOptions}
                value={selectedNetwork}
                onChange={(e) => {
                  setSelectedNetwork(e.target.value);
                  // Refresh leaderboard when network filter changes
                  if (showLeaderboard && leaderboardType === 'data_usage') {
                    fetchLeaderboard();
                  }
                }}
                className="w-full"
              />
            </div>
          )}
          
          {/* Data Usage Leaderboard */}
          {leaderboardType === 'data_usage' && (
            <>
              {loadingLeaderboard ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div 
                      key={entry.user_id} 
                      className={`relative rounded-lg p-4 ${
                        index === 0 
                          ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800' 
                          : index === 1
                          ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border border-gray-200 dark:border-gray-700'
                          : index === 2
                          ? 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800'
                          : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {/* Crown for top user */}
                      {index === 0 && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Crown className="text-yellow-500" size={24} />
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-amber-600' : 
                          'bg-gray-500'
                        }`}>
                          {entry.rank}
                        </div>
                        
                        <div className="ml-3 flex-1">
                          <div className="flex items-center">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {entry.name}
                            </p>
                            {entry.is_current_user && (
                              <Badge variant="success" className="ml-2 text-xs">You</Badge>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <div className={`w-2 h-2 rounded-full ${
                              entry.network === 'mtn' ? 'bg-yellow-500' :
                              entry.network === 'airtel' ? 'bg-red-500' :
                              entry.network === 'glo' ? 'bg-green-500' :
                              entry.network === '9mobile' ? 'bg-teal-500' :
                              'bg-gray-500'
                            } mr-1`}></div>
                            <span className="capitalize">{entry.network}</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-[#0F9D58]">{formatCurrency(entry.total_amount)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">total spent</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {leaderboard.length === 0 && (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      No leaderboard data available for the selected network.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          
          {/* Referral Earners Leaderboard */}
          {leaderboardType === 'referral_earners' && (
            <>
              {loadingReferralLeaderboard ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {referralLeaderboard.map((entry, index) => (
                    <div 
                      key={entry.user_id} 
                      className={`relative rounded-lg p-4 ${
                        index === 0 
                          ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800' 
                          : index === 1
                          ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border border-gray-200 dark:border-gray-700'
                          : index === 2
                          ? 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800'
                          : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {/* Crown for top user */}
                      {index === 0 && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Crown className="text-yellow-500" size={24} />
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-amber-600' : 
                          'bg-gray-500'
                        }`}>
                          {entry.rank}
                        </div>
                        
                        <div className="ml-3 flex-1">
                          <div className="flex items-center">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {entry.name}
                            </p>
                            {entry.is_current_user && (
                              <Badge variant="success" className="ml-2 text-xs">You</Badge>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <span>{entry.total_referrals} referrals</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-[#0F9D58]">{formatCurrency(entry.referral_earnings)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">total earned</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {referralLeaderboard.length === 0 && (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      No referral leaderboard data available yet.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mt-4">
            <div className="flex items-start">
              <Trophy className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="ml-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {leaderboardType === 'data_usage' 
                    ? 'The leaderboard shows the top 10 users based on their total spending on data bundles.'
                    : 'The leaderboard shows the top 10 users based on their referral earnings.'}
                  {' '}Privacy is important to us, so only partial names are displayed.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Beneficiaries Section */}
      {showBeneficiaries && (
        <Card className="mb-6 p-4 sm:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Users className="mr-2 text-[#0F9D58]" size={20} />
              Saved Beneficiaries
            </h2>
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs"
              onClick={() => navigate('/services/airtime')}
              icon={<Calendar size={14} />}
            >
              Add New
            </Button>
          </div>
          
          {loadingBeneficiaries ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : beneficiaries.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                {beneficiaries.map((beneficiary) => (
                  <div key={beneficiary.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between mb-3 w-full">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        beneficiary.network.toLowerCase() === 'mtn' ? 'bg-yellow-100 text-yellow-600' :
                        beneficiary.network.toLowerCase() === 'airtel' ? 'bg-red-100 text-red-600' :
                        beneficiary.network.toLowerCase() === 'glo' ? 'bg-green-100 text-green-600' :
                        beneficiary.network.toLowerCase() === '9mobile' ? 'bg-teal-100 text-teal-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Users size={18} />
                      </div>
                      
                      <div className="ml-3">
                        <p className="font-medium text-gray-900 dark:text-white">{beneficiary.name}</p>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <span>{beneficiary.phone_number}</span>
                          <span className="mx-1">•</span>
                          <span className="capitalize">{beneficiary.network}</span>
                          <Badge 
                            variant={beneficiary.type === 'airtime' ? 'warning' : 'success'} 
                            className="ml-2 text-xs"
                          >
                            {beneficiary.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs px-2 py-1"
                        onClick={() => {
                          if (beneficiary.type === 'airtime') {
                            navigate('/services/airtime');
                          } else {
                            navigate('/services/data');
                          }
                        }}
                      >
                        Use
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs px-2 py-1 text-red-500 border-red-200">
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No beneficiaries yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Save your frequent contacts for quick transactions
              </p>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => navigate('/services/airtime')}
              >
                Add Beneficiary
              </Button>
            </div>
          )}
        </Card>
      )}
      
      <Card className="mb-4 sm:mb-6 p-4">
        <div className="space-y-4">
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
            className="w-full"
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              options={transactionTypes}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              leftIcon={<Filter size={16} />}
            />
            
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            />
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        {currentTransactions.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {currentTransactions.map((transaction) => (
              <li key={transaction.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start sm:items-center">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isDebit(transaction.type) ? 'bg-error-500 bg-opacity-10' : 'bg-success-500 bg-opacity-10'
                  }`}>
                    {isDebit(transaction.type) ? (
                      <ArrowUpRight className={isDebit(transaction.type) ? 'text-error-500' : 'text-success-500'} size={20} />
                    ) : (
                      <ArrowDownRight className="text-success-500" size={20} />
                    )}
                  </div>
                  
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">
                      {getTransactionLabel(transaction.type, transaction.details)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(transaction.created_at)}
                    </p>
                  </div>
                  
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className={`text-sm font-medium ${
                      isDebit(transaction.type) ? 'text-error-500' : 'text-success-500'
                    }`}>
                      {isDebit(transaction.type) ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={getStatusColor(transaction.status) as any} className="text-xs">
                        {transaction.status}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1"
                          onClick={() => handleViewTransactionDetail(transaction)}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1"
                          onClick={() => downloadReceipt(transaction)}
                          title="Download Receipt"
                        >
                          <Download size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              {transactions.length === 0 
                ? "You haven't made any transactions yet."
                : "No transactions found matching your filters."
              }
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredTransactions.length > 0 && (
          <div className="flex items-center justify-between mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              {/* Page numbers */}
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Show first page, current page, and last page
                  let pageToShow: number;
                  if (totalPages <= 5) {
                    // If 5 or fewer pages, show all
                    pageToShow = i + 1;
                  } else if (currentPage <= 3) {
                    // If on first 3 pages, show pages 1-5
                    pageToShow = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // If on last 3 pages, show last 5 pages
                    pageToShow = totalPages - 4 + i;
                  } else {
                    // Otherwise show current page and neighbors
                    pageToShow = currentPage - 2 + i;
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
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="w-8 h-8 flex items-center justify-center">...</span>
                )}
                
                {/* Always show last page if there are more than 5 pages and we're not near the end */}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    {totalPages}
                  </button>
                )}
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>
      
      {/* Transaction Detail Modal */}
      {showDetailModal && (
        <TransactionDetailModal
          transaction={selectedTransactionDetail}
          onClose={() => setShowDetailModal(false)}
          onDownload={downloadReceipt}
        />
      )}
    </div>
  );
};

export default TransactionsPage;