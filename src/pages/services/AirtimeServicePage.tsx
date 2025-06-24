import React, { useState } from 'react';
import { ArrowLeft, Phone, CheckCircle, XCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { serviceAPI } from '../../lib/serviceApi';
import { formatCurrency } from '../../lib/utils';

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
  const [serviceType, setServiceType] = useState('local');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [transaction, setTransaction] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleContinue = () => {
    if (!selectedNetwork || !phoneNumber || !amount) {
      return;
    }
    setStep(2);
  };

  const handlePayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

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
    }
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

        {/* Continue Button */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleContinue}
            disabled={!selectedNetwork || !phoneNumber || !amount || Number(amount) < 100}
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
    </>
  );
};

export default AirtimeServicePage;