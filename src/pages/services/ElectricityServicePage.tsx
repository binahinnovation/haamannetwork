import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, CheckCircle, XCircle, Download } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { serviceAPI } from '../../lib/serviceApi';
import { formatCurrency } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import TransactionPinModal from '../../components/ui/TransactionPinModal';
import SetPinModal from '../../components/ui/SetPinModal';

const discos = [
  { value: 'ikeja', label: 'Ikeja Electric' },
  { value: 'eko', label: 'Eko Electric' },
  { value: 'ibadan', label: 'Ibadan Electric' },
  { value: 'abuja', label: 'Abuja Electric' },
  { value: 'kano', label: 'Kano Electric' },
  { value: 'enugu', label: 'Enugu Electric' },
  { value: 'portharcourt', label: 'Port Harcourt Electric' },
  { value: 'kaduna', label: 'Kaduna Electric' },
  { value: 'jos', label: 'Jos Electric' },
  { value: 'benin', label: 'Benin Electric' },
  { value: 'yola', label: 'Yola Electric' },
];

const meterTypes = [
  { value: 'prepaid', label: 'Prepaid Meter' },
  { value: 'postpaid', label: 'Postpaid Meter' },
];

const ElectricityServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, processSecurePurchase, processSecureRefund } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    disco: '',
    meterType: '',
    meterNumber: '',
    amount: '',
  });
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [transaction, setTransaction] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContinue = () => {
    if (!formData.disco || !formData.meterType || !formData.meterNumber || !formData.amount) {
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

    // Prevent multiple clicks by checking if already loading
    if (isLoading) {
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
    // Prevent multiple calls if already processing
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const amount = Number(formData.amount);
      
      // SECURE: Process purchase with atomic balance validation and transaction locking
      const purchaseResult = await processSecurePurchase(
        amount,
        'electricity_payment',
        {
          disco: formData.disco,
          meterNumber: formData.meterNumber,
          meterType: formData.meterType,
          amount: amount
        }
      );

      let transactionId = '';
      try {
        // Process the electricity transaction
        const result = await serviceAPI.processElectricityTransaction(user.id, {
          disco: formData.disco,
          amount: amount,
          meterNumber: formData.meterNumber,
          meterType: formData.meterType,
        });
        
        transactionId = result.reference || result.id || '';
        setTransaction(result);
        setIsSuccess(true);
        setStep(3);
      } catch (apiError: any) {
        // If external API fails, refund the user
        if (transactionId) {
          await processSecureRefund(
            amount,
            transactionId,
            'External API failure',
            { error: apiError.message, disco: formData.disco }
          );
        }
        throw apiError;
      }
    } catch (error: any) {
      console.error('Electricity payment error:', error);
      
      // Handle specific error messages for better UX
      let userErrorMessage = 'Failed to pay electricity bill. Please try again.';
      
      if (error.message === 'Transaction already in progress') {
        userErrorMessage = 'A transaction is already in progress. Please wait a moment and try again.';
      } else if (error.message === 'Insufficient balance') {
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

  const downloadReceipt = () => {
    if (!transaction) return;
    
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
    doc.text('ELECTRICITY BILL PAYMENT RECEIPT', 105, 45, { align: 'center' });
    
    doc.setFontSize(10);
    const startY = 60;
    const lineHeight = 7;
    
    // Details grid
    const details = [
      ['Date:', new Date().toLocaleString()],
      ['Reference:', transaction.reference],
      ['Disco:', discos.find(d => d.value === formData.disco)?.label || formData.disco],
      ['Meter Number:', formData.meterNumber],
      ['Meter Type:', formData.meterType === 'prepaid' ? 'Prepaid' : 'Postpaid'],
      ['Amount:', formatCurrency(Number(formData.amount))],
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
    doc.text('Thank you for choosing ArabNetwork!', 105, 120, { align: 'center' });
    
    // Save the PDF
    doc.save(`electricity-receipt-${transaction.reference}.pdf`);
  };

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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Electricity Bill</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Distribution Company Selection */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Select Distribution Company
          </label>
          <div className="relative">
            <Zap className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#0F9D58]" size={20} />
            <select
              name="disco"
              value={formData.disco}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
            >
              <option value="">Select DISCO</option>
              {discos.map((disco) => (
                <option key={disco.value} value={disco.value}>
                  {disco.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Meter Type Selection */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Meter Type
          </label>
          <select
            name="meterType"
            value={formData.meterType}
            onChange={handleChange}
            className="w-full px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
          >
            <option value="">Select meter type</option>
            {meterTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Meter Number Input */}
        <div>
          <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Meter Number
          </label>
          <input
            type="text"
            name="meterNumber"
            value={formData.meterNumber}
            onChange={handleChange}
            placeholder="Enter meter number"
            className="w-full px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
          />
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
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              min="1000"
              max="100000"
              className="w-full pl-8 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F9D58] focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum: ₦1,000, Maximum: ₦100,000
          </p>
        </div>

        {/* Continue Button */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleContinue}
            disabled={!formData.disco || !formData.meterType || !formData.meterNumber || !formData.amount || Number(formData.amount) < 1000}
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Confirm Payment</h1>
      </div>

      <div className="p-4">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Confirm Bill Payment</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Distribution Company</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {discos.find(d => d.value === formData.disco)?.label}
              </span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Meter Type</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {meterTypes.find(t => t.value === formData.meterType)?.label}
              </span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Meter Number</span>
              <span className="font-medium text-gray-900 dark:text-white">{formData.meterNumber}</span>
            </div>
            
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(formData.amount))}</span>
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
              disabled={isLoading}
              className="flex-1 bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Pay Now'}
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
            
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Payment Successful!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your electricity bill payment was successful.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Transaction ID</span>
                <span className="font-medium text-gray-900 dark:text-white">{transaction?.reference}</span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Meter Number</span>
                <span className="font-medium text-gray-900 dark:text-white">{formData.meterNumber}</span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(formData.amount))}</span>
              </div>
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
                  setFormData({
                    disco: '',
                    meterType: '',
                    meterNumber: '',
                    amount: '',
                  });
                  setIsSuccess(null);
                  setTransaction(null);
                  setErrorMessage('');
                }}
                className="flex-1 bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
              >
                Pay Another Bill
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
            
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Payment Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage || 'Your electricity bill payment could not be completed. Please try again.'}
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

export default ElectricityServicePage;