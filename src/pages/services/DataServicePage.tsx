import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, CheckCircle, XCircle, User, Search, Filter, Star, Download, Info, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { serviceAPI } from '../../lib/serviceApi';
import { formatCurrency } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import TransactionPinModal from '../../components/ui/TransactionPinModal';
import SetPinModal from '../../components/ui/SetPinModal';

type Beneficiary = {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  network: string;
  type: 'airtime' | 'data';
  created_at: string;
};

const networkProviders = [
  { 
    value: 'MTN', 
    label: 'MTN',
    color: 'bg-yellow-500',
    imageUrl: 'https://i.ibb.co/350xQ0HH/mtn.png'
  },
  { 
    value: 'AIRTEL', 
    label: 'Airtel',
    color: 'bg-red-500',
    imageUrl: 'https://i.ibb.co/LzNyT4v4/airtel.png'
  },
  { 
    value: 'GLO', 
    label: 'Glo',
    color: 'bg-green-500',
    imageUrl: 'https://i.ibb.co/NnZLfCHC/glo.jpg'
  },
  { 
    value: '9MOBILE', 
    label: '9mobile',
    color: 'bg-teal-500',
    imageUrl: 'https://i.ibb.co/zW7WwvnL/9-mobile.webp'
  },
];

type DataPlan = {
  id: string;
  external_id: number;
  network: string;
  plan_type: string;
  size: string;
  validity: string;
  cost_price: number;
  selling_price: number;
  profit_margin: number;
  description: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  discount_percentage: number;
  show_discount_badge: boolean;
};

type DataPlanCategory = {
  id: string;
  network: string;
  plan_type: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

const DataServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateWalletBalance } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [serviceType, setServiceType] = useState('local');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [transaction, setTransaction] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  
  // Data plans state
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  const [categories, setCategories] = useState<DataPlanCategory[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Beneficiaries state
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);

  useEffect(() => {
    fetchDataPlans();
    fetchCategories();
    if (user) {
      fetchBeneficiaries();
    }
  }, [user]);

  const fetchDataPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .eq('is_active', true)
        .order('network')
        .order('sort_order');

      if (error) throw error;
      setDataPlans(data || []);
    } catch (error) {
      console.error('Error fetching data plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('data_plan_categories')
        .select('*')
        .eq('is_active', true)
        .order('network')
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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
        .eq('type', 'data')
        .order('created_at', { ascending: false });
        
      if (error) {
        // If there's an error, we'll use transaction history to extract beneficiaries
        console.error('Error fetching beneficiaries:', error);
        
        // Get data transactions
        const { data: transactionData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'data')
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
              type: 'data',
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

  const filteredPlans = dataPlans.filter(plan => {
    const matchesNetwork = !selectedNetwork || plan.network === selectedNetwork;
    const matchesCategory = !selectedCategory || plan.plan_type === selectedCategory;
    const matchesSearch = !searchQuery || 
      plan.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.validity.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesNetwork && matchesCategory && matchesSearch;
  });

  const availableCategories = categories.filter(cat => 
    !selectedNetwork || cat.network === selectedNetwork
  );

  const popularPlans = filteredPlans.filter(plan => plan.is_popular).slice(0, 3);
  
  const selectBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedNetwork(beneficiary.network);
    setPhoneNumber(beneficiary.phone_number);
    setBeneficiaryName(beneficiary.name);
    setShowBeneficiaries(false);
  };

  const handleContinue = () => {
    if (!selectedNetwork || !selectedPlan || !phoneNumber) {
      return;
    }
    
    // Check if user has PIN set
    if (user && !user.hasPin) {
      setShowSetPinModal(true);
      return;
    }
    
    setStep(2);
  };

  const handlePayment = async () => {
    if (!user || !selectedPlan) {
      navigate('/login');
      return;
    }

    // Check if user has PIN set
    if (user.hasPin) {
      setShowPinModal(true);
      return;
    }

    // If no PIN is set, proceed with payment
    await processPayment();
  };

  const processPayment = async () => {
    if (!user || !selectedPlan) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const amount = selectedPlan.selling_price;
      
      if (user.walletBalance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      // Process the data transaction using external_id
      const result = await serviceAPI.processDataTransaction(user.id, {
        network: selectedNetwork.toLowerCase(),
        plan: selectedPlan.external_id.toString(),
        phoneNumber: phoneNumber,
        amount: amount,
      });
      
      // Deduct from wallet after successful transaction
      const newBalance = user.walletBalance - amount;
      await updateWalletBalance(newBalance);
      
      setTransaction(result);
      setIsSuccess(true);
      
      // Save beneficiary if requested
      if (saveAsBeneficiary && beneficiaryName) {
        await saveBeneficiary();
      }
      
      setStep(3);
    } catch (error: any) {
      console.error('Data purchase error:', error);
      setErrorMessage(error.message || 'Failed to purchase data. Please try again.');
      setIsSuccess(false);
      setStep(3);
    } finally {
      setIsLoading(false);
      setShowPinModal(false);
    }
  };
  
  const saveBeneficiary = async () => {
    if (!user || !selectedNetwork || !phoneNumber || !beneficiaryName) return;
    
    try {
      // Insert the beneficiary directly
      const { error } = await supabase
        .from('beneficiaries')
        .insert([{
          user_id: user.id,
          name: beneficiaryName,
          phone_number: phoneNumber,
          network: selectedNetwork,
          type: 'data'
        }]);
        
      if (error) {
        console.error('Error saving beneficiary:', error);
        return;
      }
      
      // Refresh beneficiaries list
      await fetchBeneficiaries();
    } catch (error) {
      console.error('Error saving beneficiary:', error);
    }
  };

  const downloadReceipt = () => {
    if (!transaction || !selectedPlan) return;
    
    const doc = new jsPDF();
    
    // Add logo (using text as placeholder)
    doc.setFontSize(24);
    doc.setTextColor(15, 157, 88); // Primary color #0F9D58
    doc.text('HAAMAN NETWORK', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Digital Services & E-commerce Platform', 105, 30, { align: 'center' });
    
    // Add line separator
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);
    
    // Transaction details
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('DATA BUNDLE PURCHASE RECEIPT', 105, 45, { align: 'center' });
    
    doc.setFontSize(10);
    const startY = 60;
    const lineHeight = 7;
    
    // Details grid
    const details = [
      ['Date:', new Date().toLocaleString()],
      ['Reference:', transaction.reference],
      ['Network:', networkProviders.find(n => n.value === selectedNetwork)?.label || selectedNetwork],
      ['Data Plan:', selectedPlan.description],
      ['Size:', `${selectedPlan.size} (${selectedPlan.validity})`],
      ['Phone Number:', phoneNumber],
      ['Amount:', formatCurrency(selectedPlan.selling_price)],
      ['Status:', 'SUCCESSFUL'],
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
    doc.text('Thank you for choosing Haaman Network!', 105, 120, { align: 'center' });
    
    // Save the PDF
    doc.save(`data-receipt-${transaction.reference}.pdf`);
  };

  const renderComingSoon = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Data Bundle</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Service Type Toggle */}
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setServiceType('local')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              serviceType === 'local'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Local
          </button>
          <button
            onClick={() => setServiceType('international')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              serviceType === 'international'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            International
          </button>
        </div>

        {/* Coming Soon Message */}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-[#0F9D58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Coming Soon</h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-sm">
            International data bundle services will be available soon. Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  );

  const renderStepOne = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Data Bundle</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Service Type Toggle */}
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setServiceType('local')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              serviceType === 'local'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Local
          </button>
          <button
            onClick={() => setServiceType('international')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              serviceType === 'international'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            International
          </button>
        </div>

        {/* Beneficiaries Section */}
        {beneficiaries.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Beneficiaries
              </h2>
              <button
                onClick={() => setShowBeneficiaries(!showBeneficiaries)}
                className="text-[#0F9D58] text-sm font-medium"
              >
                {showBeneficiaries ? 'Hide' : 'View All'}
              </button>
            </div>
            
            {showBeneficiaries ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-4">
                {loadingBeneficiaries ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0F9D58]"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beneficiaries.map((beneficiary) => (
                      <button
                        key={beneficiary.id}
                        onClick={() => selectBeneficiary(beneficiary)}
                        className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          beneficiary.network === 'MTN' ? 'bg-yellow-100 text-yellow-600' :
                          beneficiary.network === 'AIRTEL' ? 'bg-red-100 text-red-600' :
                          beneficiary.network === 'GLO' ? 'bg-green-100 text-green-600' :
                          beneficiary.network === '9MOBILE' ? 'bg-teal-100 text-teal-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <User size={18} />
                        </div>
                        
                        <div className="ml-3 text-left">
                          <p className="font-medium text-gray-900 dark:text-white">{beneficiary.name}</p>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <span>{beneficiary.phone_number}</span>
                            <span className="mx-1">•</span>
                            <span className="capitalize">{beneficiary.network}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex space-x-3 pb-2 flex-nowrap">
                  {beneficiaries.map((beneficiary) => (
                    <button
                      key={beneficiary.id}
                      onClick={() => selectBeneficiary(beneficiary)}
                      className="flex-shrink-0 flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#0F9D58] transition-colors"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        beneficiary.network === 'MTN' ? 'bg-yellow-100 text-yellow-600' :
                        beneficiary.network === 'AIRTEL' ? 'bg-red-100 text-red-600' :
                        beneficiary.network === 'GLO' ? 'bg-green-100 text-green-600' :
                        beneficiary.network === '9MOBILE' ? 'bg-teal-100 text-teal-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <User size={20} />
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{beneficiary.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{beneficiary.phone_number}</p>
                    </button>
                  ))}
                  
                  {/* Add New Beneficiary Button */}
                  <button
                    onClick={() => {
                      setSelectedNetwork('');
                      setPhoneNumber('');
                      setBeneficiaryName('');
                      setSaveAsBeneficiary(true);
                    }}
                    className="flex-shrink-0 flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 hover:border-[#0F9D58] transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-gray-100 dark:bg-gray-700 text-[#0F9D58]">
                      <Plus size={20} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Add New</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Beneficiary</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Network Provider Selection */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Network Provider
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {networkProviders.map((provider) => (
              <button
                key={provider.value}
                onClick={() => {
                  setSelectedNetwork(provider.value);
                  setSelectedCategory(''); // Reset category when network changes
                  setSelectedPlan(null); // Reset plan when network changes
                }}
                className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                  selectedNetwork === provider.value
                    ? 'border-[#0F9D58] bg-[#0F9D58]/5'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 overflow-hidden bg-white">
                  <img
                    src={provider.imageUrl}
                    alt={provider.label}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {provider.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        {selectedNetwork && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search data plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Filter size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Category Filter */}
            {showFilters && availableCategories.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Plan Type</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      !selectedCategory
                        ? 'bg-[#0F9D58] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    All Plans
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.plan_type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === category.plan_type
                          ? 'bg-[#0F9D58] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {category.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Popular Plans */}
        {selectedNetwork && popularPlans.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Popular Plans</h3>
            <div className="space-y-3">
              {popularPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-[#0F9D58] bg-[#0F9D58]/5'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#0F9D58]/10 flex items-center justify-center mr-3">
                      <Zap size={16} className="text-[#0F9D58]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{plan.size}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{plan.validity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end">
                      {plan.show_discount_badge && plan.discount_percentage > 0 && (
                        <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white mb-1">
                          -{plan.discount_percentage}% OFF
                        </span>
                      )}
                      <p className="font-bold text-[#0F9D58]">{formatCurrency(plan.selling_price)}</p>
                    </div>
                    <div className="flex items-center mt-1">
                      <Star size={12} className="text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Popular</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Data Plans */}
        {selectedNetwork && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {selectedCategory ? 
                categories.find(c => c.plan_type === selectedCategory)?.display_name || 'Data Plans' : 
                'All Data Plans'}
            </h3>
            
            {loadingPlans ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
              </div>
            ) : filteredPlans.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {filteredPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-[#0F9D58] bg-[#0F9D58]/5'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center">
                        <p className="font-medium text-gray-900 dark:text-white">{plan.size}</p>
                        {plan.is_popular && (
                          <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">Popular</Badge>
                        )}
                        {plan.show_discount_badge && plan.discount_percentage > 0 && (
                          <Badge className="ml-2 bg-red-500 text-white text-xs font-bold">
                            -{plan.discount_percentage}% OFF
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{plan.validity}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex flex-col items-end">
                        {plan.show_discount_badge && plan.discount_percentage > 0 && (
                          <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white mb-1">
                            -{plan.discount_percentage}% OFF
                          </span>
                        )}
                        <p className="font-bold text-[#0F9D58]">{formatCurrency(plan.selling_price)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">No data plans found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Phone Number Input */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Phone Number
          </label>
          <div className="relative">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-4 py-4 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <User size={20} className="text-[#0F9D58]" />
            </div>
          </div>
        </div>

        {/* Data Balance Check Codes */}
        <Card className="p-4">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center">
                <Info size={16} className="text-[#0F9D58] mr-2" />
                <span className="font-medium text-gray-900 dark:text-white">Codes for Data Balance Check</span>
              </div>
              <div className="transition-transform group-open:rotate-180">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="mt-3 pl-6 text-sm text-gray-600 dark:text-gray-400">
              <ul className="space-y-2">
                <li>• MTN [SME]: *461*4#</li>
                <li>• MTN [Gifting]: *131*4# or *460*260#</li>
                <li>• 9mobile [Gifting]: *228#</li>
                <li>• Airtel: *140#</li>
                <li>• Glo: *127*0#</li>
              </ul>
            </div>
          </details>
        </Card>

        {/* Selected Plan Summary */}
        {selectedPlan && (
          <div className="bg-[#0F9D58]/10 rounded-xl p-4 border border-[#0F9D58]/20">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Selected Plan</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedPlan.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPlan.size} for {selectedPlan.validity}</p>
              </div>
              <div className="flex flex-col items-end">
                {selectedPlan.show_discount_badge && selectedPlan.discount_percentage > 0 && (
                  <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white mb-1">
                    -{selectedPlan.discount_percentage}% OFF
                  </span>
                )}
                <p className="font-bold text-[#0F9D58] text-lg">{formatCurrency(selectedPlan.selling_price)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Save as Beneficiary Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Save as Beneficiary
            </span>
            <button
              onClick={() => setSaveAsBeneficiary(!saveAsBeneficiary)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                saveAsBeneficiary ? 'bg-[#0F9D58]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  saveAsBeneficiary ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {saveAsBeneficiary && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Beneficiary Name
              </label>
              <input
                type="text"
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="Enter a name for this beneficiary"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Continue Button */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleContinue}
            disabled={!selectedNetwork || !selectedPlan || !phoneNumber || (saveAsBeneficiary && !beneficiaryName)}
            className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStepTwo = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setStep(1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Confirm Purchase</h1>
      </div>

      <div className="p-4">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Confirm Data Purchase</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Network</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {networkProviders.find(n => n.value === selectedNetwork)?.label}
              </span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Data Plan</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedPlan?.description}
              </span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Data Size</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedPlan?.size} ({selectedPlan?.validity})
              </span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Phone Number</span>
              <span className="font-medium text-gray-900 dark:text-white">{phoneNumber}</span>
            </div>
            
            {saveAsBeneficiary && (
              <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Save as Beneficiary</span>
                <span className="font-medium text-gray-900 dark:text-white">{beneficiaryName}</span>
              </div>
            )}
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <div className="flex flex-col items-end">
                {selectedPlan?.show_discount_badge && selectedPlan?.discount_percentage > 0 && (
                  <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white mb-1">
                    -{selectedPlan.discount_percentage}% OFF
                  </span>
                )}
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(selectedPlan?.selling_price || 0)}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between py-3">
              <span className="text-gray-600 dark:text-gray-400">Wallet Balance</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(user?.walletBalance || 0)}</span>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1 py-3"
            >
              Back
            </Button>
            
            <Button
              onClick={handlePayment}
              isLoading={isLoading}
              className="flex-1 bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-3"
            >
              Pay Now
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderStepThree = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        {isSuccess ? (
          <>
            <div className="w-16 h-16 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-[#0F9D58]" size={32} />
            </div>
            
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Purchase Successful!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your data bundle has been activated successfully.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Transaction ID</span>
                <span className="font-medium text-gray-900 dark:text-white">{transaction?.reference}</span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Phone Number</span>
                <span className="font-medium text-gray-900 dark:text-white">{phoneNumber}</span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Data Plan</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedPlan?.description}
                </span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <div className="flex flex-col items-end">
                  {selectedPlan?.show_discount_badge && selectedPlan?.discount_percentage > 0 && (
                    <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white mb-1">
                      -{selectedPlan.discount_percentage}% OFF
                    </span>
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(selectedPlan?.selling_price || 0)}
                  </span>
                </div>
              </div>
              
              {saveAsBeneficiary && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Saved Beneficiary</span>
                  <span className="font-medium text-gray-900 dark:text-white">{beneficiaryName}</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mb-4">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1"
              >
                Back to Home
              </Button>
              
              <Button
                onClick={() => {
                  setStep(1);
                  setSelectedPlan(null);
                  setPhoneNumber('');
                  setSaveAsBeneficiary(false);
                  setBeneficiaryName('');
                  setIsSuccess(null);
                  setTransaction(null);
                  setErrorMessage('');
                }}
                className="flex-1 bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
              >
                Buy Again
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={downloadReceipt}
              className="w-full flex items-center justify-center"
              icon={<Download size={16} />}
            >
              Download Receipt
            </Button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="text-red-500" size={32} />
            </div>
            
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Purchase Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage || 'Your data bundle purchase could not be completed. Please try again.'}
            </p>
            
            <Button
              onClick={() => {
                setStep(1);
                setIsSuccess(null);
                setErrorMessage('');
              }}
              className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
            >
              Try Again
            </Button>
          </>
        )}
      </Card>
    </div>
  );

  // Show coming soon for international service
  if (serviceType === 'international') {
    return renderComingSoon();
  }

  return (
    <>
      {step === 1 && renderStepOne()}
      {step === 2 && renderStepTwo()}
      {step === 3 && renderStepThree()}

      {/* Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={processPayment}
      />

      {/* Set PIN Modal */}
      <SetPinModal
        isOpen={showSetPinModal}
        onClose={() => setShowSetPinModal(false)}
        onSuccess={() => setStep(2)}
      />
    </>
  );
};

export default DataServicePage;