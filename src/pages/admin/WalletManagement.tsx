import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  Wallet, 
  User, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { formatCurrency } from '../../lib/utils';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  wallet_balance: number;
  created_at: string;
};

const WalletManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setSearchedUser(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail.trim().toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setMessage({ type: 'error', text: 'User not found with this email address' });
        } else {
          throw error;
        }
        return;
      }

      setSearchedUser(data);
      setMessage({ type: 'success', text: 'User found successfully' });
    } catch (error) {
      console.error('Error searching user:', error);
      setMessage({ type: 'error', text: 'Error searching for user. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFundWallet = async () => {
    if (!searchedUser || !fundAmount.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid positive amount' });
      return;
    }

    // Prevent multiple clicks by checking if already processing
    if (funding) {
      return;
    }

    setFunding(true);
    setMessage(null);

    try {
      // SECURE: Use the secure deposit function instead of direct balance update
      const { data, error } = await supabase.rpc('process_secure_deposit', {
        p_user_id: searchedUser.id,
        p_amount: amount,
        p_deposit_details: {
          method: 'admin_credit',
          admin_id: user?.id,
          admin_name: user?.name,
          note: 'Wallet funded by admin'
        },
        p_external_transaction_id: `ADMIN-${Date.now()}`
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to fund wallet');
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: searchedUser.id,
          type: 'wallet_funding',
          amount: amount,
          status: 'success',
          reference: `ADMIN-${Date.now()}`,
          details: {
            method: 'admin_credit',
            admin_id: user?.id,
            admin_name: user?.name,
            note: 'Wallet funded by admin'
          }
        }]);

      if (transactionError) throw transactionError;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'fund_user_wallet',
        details: { 
          user_id: searchedUser.id,
          user_email: searchedUser.email,
          amount: amount,
          previous_balance: data.balance_before,
          new_balance: data.balance_after
        },
      }]);

      // Update local user data with the new balance from the secure function
      setSearchedUser(prev => prev ? { ...prev, wallet_balance: data.balance_after } : null);
      setFundAmount('');
      setMessage({ 
        type: 'success', 
        text: `Successfully funded ${searchedUser.name}'s wallet with ${formatCurrency(amount)}` 
      });

    } catch (error: any) {
      console.error('Error funding wallet:', error);
      
      // Handle specific error messages for better UX
      let userErrorMessage = 'Error funding wallet. Please try again.';
      
      if (error.message === 'Transaction already in progress') {
        userErrorMessage = 'A funding transaction is already in progress. Please wait a moment and try again.';
      } else if (error.message.includes('User not found')) {
        userErrorMessage = 'User not found. Please refresh and try again.';
      } else if (error.message) {
        userErrorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: userErrorMessage });
    } finally {
      setFunding(false);
    }
  };

  const clearSearch = () => {
    setSearchEmail('');
    setSearchedUser(null);
    setFundAmount('');
    setMessage(null);
  };

  if (!user?.isAdmin) {
    navigate('/admin/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-4"
              >
                <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fund user wallets and manage balances</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Search className="mr-2 text-[#0F9D58]" size={20} />
            Search User by Email
          </h2>
          
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Enter user email address"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                leftIcon={<User size={16} />}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
              />
            </div>
            <Button
              onClick={handleSearchUser}
              isLoading={loading}
              className="bg-[#0F9D58] hover:bg-[#0d8a4f] text-white px-6"
            >
              Search
            </Button>
            {(searchedUser || searchEmail) && (
              <Button
                variant="outline"
                onClick={clearSearch}
                className="px-4"
              >
                Clear
              </Button>
            )}
          </div>
        </Card>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="text-green-500" size={20} />
            ) : (
              <AlertCircle className="text-red-500" size={20} />
            )}
            <span className={`text-sm ${
              message.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {message.text}
            </span>
          </div>
        )}

        {/* User Details & Funding Section */}
        {searchedUser && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* User Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <User className="mr-2 text-[#0F9D58]" size={20} />
                User Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <p className="text-gray-900 dark:text-white font-medium">{searchedUser.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <p className="text-gray-900 dark:text-white">{searchedUser.email}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                  <p className="text-gray-900 dark:text-white">{searchedUser.phone || 'Not provided'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Wallet Balance</label>
                  <p className="text-2xl font-bold text-[#0F9D58]">
                    {formatCurrency(searchedUser.wallet_balance)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(searchedUser.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Fund Wallet */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Wallet className="mr-2 text-[#0F9D58]" size={20} />
                Fund Wallet
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount to Fund (₦)
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    leftIcon={<DollarSign size={16} />}
                    min="1"
                    step="0.01"
                  />
                </div>
                
                {fundAmount && !isNaN(parseFloat(fundAmount)) && parseFloat(fundAmount) > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Transaction Preview</h4>
                    <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                      <p>Current Balance: {formatCurrency(searchedUser.wallet_balance)}</p>
                      <p>Amount to Add: {formatCurrency(parseFloat(fundAmount))}</p>
                      <p className="font-semibold">New Balance: {formatCurrency(searchedUser.wallet_balance + parseFloat(fundAmount))}</p>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleFundWallet}
                  isLoading={funding}
                  disabled={funding || !fundAmount || isNaN(parseFloat(fundAmount)) || parseFloat(fundAmount) <= 0}
                  className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  icon={<Plus size={16} />}
                >
                  {funding ? 'Processing...' : 'Fund Wallet'}
                </Button>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start">
                    <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                    <div className="ml-2">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Important:</strong> This action will immediately credit the user's wallet and create a transaction record. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Instructions */}
        {!searchedUser && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How to Use Wallet Management</h3>
            <div className="space-y-3 text-gray-600 dark:text-gray-400">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</div>
                <p>Enter the user's email address in the search field above</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</div>
                <p>Click "Search" to find the user's account and view their current wallet balance</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</div>
                <p>Enter the amount you want to add to their wallet</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-[#0F9D58] text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</div>
                <p>Click "Fund Wallet" to complete the transaction</p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Security Notes</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• All wallet funding actions are logged for audit purposes</li>
                <li>• Users will see the credit as "Admin Credit" in their transaction history</li>
                <li>• Transaction records include admin details for accountability</li>
                <li>• Wallet funding is immediate and cannot be reversed</li>
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WalletManagement;