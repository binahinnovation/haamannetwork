import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, LogOut, Edit2, CreditCard, Shield, AlertTriangle, Lock, Key, Store, CheckCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useVendorStore } from '../../store/vendorStore';
import SetPinModal from '../../components/ui/SetPinModal';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser, createVirtualAccount } = useAuthStore();
  const { shop, loading: vendorLoading, fetchShop } = useVendorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bvn: user?.bvn || '',
  });
  const [isCreatingVirtualAccount, setIsCreatingVirtualAccount] = useState(false);
  const [virtualAccountError, setVirtualAccountError] = useState('');
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Fetch vendor shop status
  useEffect(() => {
    if (user?.id) {
      fetchShop(user.id);
    }
  }, [user?.id, fetchShop]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(formData);
    setIsEditing(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateVirtualAccount = async () => {
    if (!formData.bvn || !/^\d{11}$/.test(formData.bvn)) {
      setVirtualAccountError('Please enter a valid 11-digit BVN');
      return;
    }

    setIsCreatingVirtualAccount(true);
    setVirtualAccountError('');

    try {
      // Split name into first and last name with proper fallbacks
      const userName = user.name?.trim() || 'User';
      const nameParts = userName.split(' ').filter(part => part.length > 0);
      
      let firstName: string;
      let lastName: string;
      
      if (nameParts.length === 0) {
        // Fallback if name is empty or only whitespace
        firstName = 'User';
        lastName = 'User';
      } else if (nameParts.length === 1) {
        // Single name - use it for both first and last name
        firstName = nameParts[0];
        lastName = nameParts[0];
      } else {
        // Multiple names - use first and last
        firstName = nameParts[0];
        lastName = nameParts[nameParts.length - 1];
      }

      await createVirtualAccount(
        user.id,
        user.email,
        firstName,
        lastName,
        user.phone,
        formData.bvn
      );

      // Update user profile with BVN
      await updateUser({ bvn: formData.bvn });
      
      // Navigate to wallet page to show the new virtual account
      navigate('/wallet/fund');
    } catch (error: any) {
      console.error('Error creating virtual account:', error);
      setVirtualAccountError(error.message || 'Failed to create virtual account. Please try again.');
    } finally {
      setIsCreatingVirtualAccount(false);
    }
  };

  const handleSetPin = () => {
    setIsChangingPin(user.hasPin);
    setShowSetPinModal(true);
  };

  return (
    <div className="py-6 animate-fade-in">
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Profile Information</h2>
          <Button
            variant="ghost"
            icon={isEditing ? <LogOut size={16} /> : <Edit2 size={16} />}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                leftIcon={<User size={16} />}
                required
              />
              
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                leftIcon={<Mail size={16} />}
                required
              />
              
              <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                leftIcon={<Phone size={16} />}
                required
              />
            </div>
            
            <Button
              type="submit"
              variant="primary"
              className="mt-6"
              fullWidth
            >
              Save Changes
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center py-2">
              <User size={20} className="text-gray-500" />
              <div className="ml-3">
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
            </div>
            
            <div className="flex items-center py-2">
              <Mail size={20} className="text-gray-500" />
              <div className="ml-3">
                <p className="text-sm text-gray-500">Email Address</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center py-2">
              <Phone size={20} className="text-gray-500" />
              <div className="ml-3">
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="font-medium">{user.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Vendor Status Section */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center">
            <Store size={18} className="mr-2 text-[#0F9D58]" />
            Vendor Status
          </h2>
        </div>

        {vendorLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        ) : shop ? (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircle size={14} className="mr-1" />
                Vendor
              </span>
              {shop.is_verified && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <CheckCircle size={14} className="mr-1" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You have a vendor shop: <span className="font-medium">{shop.name}</span>
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/vendor/dashboard')}
              className="w-full"
              icon={<Store size={16} />}
            >
              Go to Vendor Dashboard
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Start selling on our marketplace by becoming a vendor. Create your own shop and list products for customers to purchase.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/vendor/onboard')}
              className="w-full"
              icon={<Store size={16} />}
            >
              Become a Vendor
            </Button>
          </div>
        )}
      </Card>

      {/* Transaction PIN Section */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center">
            <Lock size={18} className="mr-2 text-[#0F9D58]" />
            Transaction PIN
          </h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {user.hasPin 
            ? 'Your transaction PIN is used to authorize purchases and payments.' 
            : 'Set up a 4-digit PIN to secure your transactions. This PIN will be required for all purchases and payments.'}
        </p>

        <div className="flex space-x-3">
          <Button
            variant="primary"
            onClick={handleSetPin}
            className="flex-1"
            icon={<Key size={16} />}
          >
            {user.hasPin ? 'Change PIN' : 'Set PIN'}
          </Button>
        </div>
      </Card>

      {/* Virtual Account Section */}
      {!user.virtualAccountNumber && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <CreditCard size={18} className="mr-2 text-[#0F9D58]" />
              Virtual Account Setup
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Set up a virtual account to fund your wallet directly via bank transfer from any Nigerian bank.
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4">
            <div className="flex items-start">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="ml-3">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">BVN Required</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  To create a virtual account, you need to provide your Bank Verification Number (BVN). This is a requirement from our payment partner for KYC compliance.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <Input
              label="Bank Verification Number (BVN)"
              name="bvn"
              value={formData.bvn}
              onChange={handleChange}
              leftIcon={<Shield size={16} />}
              placeholder="Enter your 11-digit BVN"
              maxLength={11}
              error={virtualAccountError}
              hint="Your BVN is securely stored and will not be shared with third parties."
            />
          </div>

          <Button
            variant="primary"
            onClick={handleCreateVirtualAccount}
            isLoading={isCreatingVirtualAccount}
            disabled={!formData.bvn || formData.bvn.length !== 11 || isCreatingVirtualAccount}
            fullWidth
          >
            Create Virtual Account
          </Button>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold mb-4">Account Settings</h3>
        
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full justify-start text-error-500"
            icon={<LogOut size={16} />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </Card>

      {/* Set PIN Modal */}
      <SetPinModal
        isOpen={showSetPinModal}
        onClose={() => setShowSetPinModal(false)}
        isChangingPin={isChangingPin}
      />
    </div>
  );
};

export default ProfilePage;