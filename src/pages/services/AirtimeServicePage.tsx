import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, CheckCircle, XCircle, User, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { serviceAPI } from '../../lib/serviceApi';
import { formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
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
    value: 'mtn', 
    label: 'MTN',
    color: 'bg-yellow-500',
    imageUrl: 'https://i.ibb.co/350xQ0HH/mtn.png'
  },
  { 
    value: 'airtel', 
    label: 'Airtel',
    color: 'bg-red-500',
    imageUrl: 'https://i.ibb.co/LzNyT4v4/airtel.png'
  },
  { 
    value: 'glo', 
    label: 'Glo',
    color: 'bg-green-500',
    imageUrl: 'https://i.ibb.co/NnZLfCHC/glo.jpg'
  },
  { 
    value: '9mobile', 
    label: '9mobile',
    color: 'bg-teal-500',
    imageUrl: 'https://i.ibb.co/zW7WwvnL/9-mobile.webp'
  },
];

const AirtimeServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateWalletBalance } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [serviceType, setServiceType] = useState('local');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [transaction, setTransaction] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBeneficiaries();
    }
  }, [user]);

  const fetchBeneficiaries = async () => {
    if (!user) return;
    
    setLoadingBeneficiaries(true);
    try {
      // Fetch beneficiaries from the database
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'airtime')
        .order('created_at', { ascending: false });
        
      if (error) {
        // If there's an error, we'll use transaction history to extract beneficiaries
        console.error('Error fetching beneficiaries:', error);
        
        // Get airtime transactions
        const { data: transactionData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'airtime')
          .eq('status', 'success')
          .order('created_at', { ascending: false });
          
        if (txError) throw txError;
        
        // Extract unique beneficiaries from transaction history
        const beneficiaryMap = new Map<string, Beneficiary>();
        
        transactionData?.forEach(transaction => {
          const phone = transaction.details?.phone;
          const network = transaction.details?.network;
          
          if (phone && network && !beneficiaryMap.has(phone)) {
            beneficiaryMap.set(phone, {
              id: transaction.id,
              user_id: user.id,
              name: `Beneficiary (${network})`,
              phone_number: phone,
              network: network.toLowerCase(), // Ensure network is lowercase to match networkProviders
              type: 'airtime',
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

  const handleContinue = () => {
    if (!selectedNetwork || !phoneNumber || !amount) {
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
    if (!user) {
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
    setIsLoading(true);
    setErrorMessage('');

    try {
      const numAmount = Number(amount);
      
      if (user.walletBalance < numAmount) {
        throw new Error('Insufficient wallet balance');
      }

      // Process the airtime transaction first (before deducting wallet)
      const result = await serviceAPI.processAirtimeTransaction(user.id, {
        network: selectedNetwork,
        amount: numAmount,
        phoneNumber: phoneNumber,
      });
      
      // Only deduct from wallet if transaction was successful
      const newBalance = user.walletBalance - numAmount;
      await updateWalletBalance(newBalance);
      
      setTransaction(result);
      setIsSuccess(true);
      
      // Save beneficiary if requested
      if (saveAsBeneficiary && beneficiaryName) {
        await saveBeneficiary();
      }
      
      setStep(3);
    } catch (error: any) {
      console.error('Airtime purchase error:', error);
      
      // Set user-friendly error message
      let userErrorMessage = 'Failed to purchase airtime. Please try again.';
      
      if (error.message === 'Insufficient wallet balance') {
        userErrorMessage = 'Insufficient wallet balance. Please fund your wallet and try again.';
      } else if (error.message.includes('Unable to connect') || 
                 error.message.includes('internet connection')) {
        userErrorMessage = 'Unable to connect to payment service. Please check your internet connection and try again.';
      } else if (error.message.includes('Service temporarily unavailable') || 
                 error.message.includes('contact support')) {
        userErrorMessage = 'Payment service temporarily unavailable. Please try again later or contact support.';
      } else if (error.message.includes('timeout')) {
        userErrorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.message) {
        userErrorMessage = error.message;
      }
      
      setErrorMessage(userErrorMessage);
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
          type: 'airtime'
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

  const selectBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedNetwork(beneficiary.network);
    setPhoneNumber(beneficiary.phone_number);
    setBeneficiaryName(beneficiary.name);
    setShowBeneficiaries(false);
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Airtime</h1>
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
            International airtime services will be available soon. Stay tuned for updates!
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Airtime</h1>
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
                          beneficiary.network === 'mtn' ? 'bg-yellow-100 text-yellow-600' :
                          beneficiary.network === 'airtel' ? 'bg-red-100 text-red-600' :
                          beneficiary.network === 'glo' ? 'bg-green-100 text-green-600' :
                          beneficiary.network === '9mobile' ? 'bg-teal-100 text-teal-600' :
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
                        beneficiary.network === 'mtn' ? 'bg-yellow-100 text-yellow-600' :
                        beneficiary.network === 'airtel' ? 'bg-red-100 text-red-600' :
                        beneficiary.network === 'glo' ? 'bg-green-100 text-green-600' :
                        beneficiary.network === '9mobile' ? 'bg-teal-100 text-teal-600' :
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
            Select Service Provider
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {networkProviders.map((provider) => (
              <button
                key={provider.value}
                onClick={() => setSelectedNetwork(provider.value)}
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

        {/* Amount Input */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
              ₦
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="100"
              max="50000"
              className="w-full pl-8 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum: ₦100, Maximum: ₦50,000
          </p>
        </div>

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
            disabled={!selectedNetwork || !phoneNumber || !amount || Number(amount) < 100 || (saveAsBeneficiary && !beneficiaryName)}
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
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Confirm Airtime Purchase</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Network</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {networkProviders.find(n => n.value === selectedNetwork)?.label}
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
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(amount))}</span>
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
              Your airtime purchase of {formatCurrency(Number(amount))} was successful.
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
                <span className="text-gray-600 dark:text-gray-400">Network</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {networkProviders.find(n => n.value === selectedNetwork)?.label}
                </span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(amount))}</span>
              </div>
              
              {saveAsBeneficiary && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">Saved Beneficiary</span>
                  <span className="font-medium text-gray-900 dark:text-white">{beneficiaryName}</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3">
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
                  setSelectedNetwork('');
                  setPhoneNumber('');
                  setAmount('');
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
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="text-red-500" size={32} />
            </div>
            
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Purchase Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage || 'Your airtime purchase could not be completed. Please try again.'}
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

export default AirtimeServicePage;