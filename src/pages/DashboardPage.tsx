import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, 
  Wifi, 
  Zap, 
  Tv, 
  Gift, 
  Users, 
  MoreHorizontal,
  Eye,
  EyeOff,
  ShoppingBag,
  Moon,
  Sun,
  Package,
  MessageCircle,
  RefreshCw,
  Store
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useServiceConfigStore } from '../store/serviceConfigStore';
import { useVendorStore } from '../store/vendorStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ProductSlideshow from '../components/home/ProductSlideshow';
import { formatCurrency } from '../lib/utils';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUserData, createPaymentPointAccounts } = useAuthStore();
  const { config: serviceConfig, fetchConfig } = useServiceConfigStore();
  const { shop, fetchShop } = useVendorStore();
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'flutterwave' | 'opay' | 'palmpay'>('palmpay');
  const [hasAttemptedCreation, setHasAttemptedCreation] = useState<Record<string, boolean>>({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Fetch vendor shop status
  useEffect(() => {
    if (user?.id) {
      fetchShop(user.id);
    }
  }, [user?.id, fetchShop]);

  const isVendor = !!shop;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    try {
      await refreshUserData();
    } catch (error) {
      console.error('Error refreshing balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Debug function to test wallet update (only for development)
  const testWalletUpdate = async () => {
    if (!user) return;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/test-wallet-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id,
          amount: 100 // Test with 100 naira
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Test wallet update successful:', result);
        alert('Test wallet update successful! Check console for details.');
      } else {
        console.error('Test wallet update failed:', result);
        alert('Test wallet update failed: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error testing wallet update:', error);
      alert('Error testing wallet update: ' + (error?.message || 'Unknown error'));
    }
  };

  // Debug function to diagnose wallet issues
  const debugWalletIssue = async () => {
    if (!user) return;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/debug-wallet-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Wallet diagnostics:', result.diagnostics);
        
        const diagnostics = result.diagnostics;
        let message = `Wallet Diagnostics for ${diagnostics.user.name}:\n\n`;
        message += `Current Balance: ₦${diagnostics.user.current_balance}\n`;
        message += `Expected Balance: ₦${diagnostics.balance_analysis.calculated_balance_all_transactions}\n`;
        message += `Discrepancy: ₦${diagnostics.balance_analysis.discrepancy}\n\n`;
        
        if (diagnostics.recommendations.length > 0) {
          message += `Recommendations:\n${diagnostics.recommendations.join('\n')}\n\n`;
        }
        
        message += 'Check browser console for detailed diagnostics.';
        alert(message);
      } else {
        console.error('Wallet diagnostics failed:', result);
        alert('Wallet diagnostics failed: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error running wallet diagnostics:', error);
      alert('Error running wallet diagnostics: ' + (error?.message || 'Unknown error'));
    }
  };

  // Function to fix wallet balance based on transaction history
  const fixWalletBalance = async () => {
    if (!user) return;
    
    if (!confirm('This will recalculate your wallet balance based on transaction history. Continue?')) {
      return;
    }
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/fix-wallet-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id,
          action: 'calculate_correct_balance'
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Wallet balance fixed:', result.data);
        alert(`Wallet balance corrected!\nPrevious: ₦${result.data.previous_balance}\nCorrected: ₦${result.data.corrected_balance}\nDifference: ₦${result.data.correction_amount}`);
        
        // Refresh user data to show updated balance
        await refreshUserData();
      } else {
        console.error('Wallet balance fix failed:', result);
        alert('Wallet balance fix failed: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error fixing wallet balance:', error);
      alert('Error fixing wallet balance: ' + (error?.message || 'Unknown error'));
    }
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Virtual Account Providers
  const virtualAccountProviders = {
    palmpay: {
      name: 'PalmPay',
      bankName: user?.palmpayAccountName || 'PalmPay Limited',
      accountNumber: user?.palmpayAccountNumber || '',
      available: true,
      isMissing: !user?.palmpayAccountNumber && !isCreatingAccount
    },
    opay: {
      name: 'OPay',
      bankName: user?.opayAccountName || 'OPay Digital Services Limited',
      accountNumber: user?.opayAccountNumber || '',
      available: true,
      isMissing: !user?.opayAccountNumber && !isCreatingAccount
    },
    flutterwave: {
      name: 'Flutterwave',
      bankName: user?.virtualAccountBankName || 'WEMA BANK',
      accountNumber: user?.virtualAccountNumber || '',
      available: !!user?.virtualAccountNumber
    }
  };

  const currentProvider = virtualAccountProviders[selectedProvider];

  useEffect(() => {
    const triggerGlobalAccountCreation = async () => {
      if (!user?.id || isCreatingAccount) return;
      
      // Auto-create only if BOTH are missing (stops loop if OPay is unavailable at provider level)
      const hasAnyPaymentPointAccount = user.palmpayAccountNumber || user.opayAccountNumber;
      
      if (!hasAnyPaymentPointAccount && !hasAttemptedCreation['global']) {
        console.log("Auto-triggering virtual account generation on login...");
        setIsCreatingAccount(true);
        setHasAttemptedCreation(prev => ({ ...prev, global: true }));
        
        try {
          await createPaymentPointAccounts(user.id);
          // Wait longer for DB consistency
          setTimeout(async () => {
            await refreshUserData();
          }, 3000);
        } catch (error) {
          console.error("Global account creation error:", error);
        } finally {
          setIsCreatingAccount(false);
        }
      }
    };

    triggerGlobalAccountCreation();
  }, [user?.id, user?.opayAccountNumber, user?.palmpayAccountNumber, createPaymentPointAccounts, refreshUserData, hasAttemptedCreation]);

  const handleComingSoonNavigation = (serviceName: string, serviceDescription: string) => {
    navigate('/coming-soon', { 
      state: { 
        serviceName, 
        serviceDescription 
      } 
    });
  };

  const getServiceStatus = (serviceId: string) => {
    return serviceConfig[serviceId] || 'active';
  };

  const allServices = [
    {
      title: 'Airtime',
      icon: <Phone size={20} />,
      path: '/services/airtime',
      color: 'bg-green-100 text-green-600',
      id: 'airtime',
      featured: true
    },
    {
      title: 'Data',
      icon: <Wifi size={20} />,
      path: '/services/data',
      color: 'bg-green-100 text-green-600',
      id: 'data',
      featured: true
    },
    {
      title: 'Electricity',
      icon: <Zap size={20} />,
      path: '/services/electricity',
      color: 'bg-green-100 text-green-600',
      id: 'electricity',
      featured: false
    },
    {
      title: 'TV',
      icon: <Tv size={20} />,
      path: '/services/tv',
      color: 'bg-green-100 text-green-600',
      id: 'tv',
      description: 'Pay for your TV subscriptions including DSTV, GOTV, and Startimes',
      featured: false
    },
    {
      title: 'Redeem Voucher',
      icon: <Gift size={20} />,
      path: '/voucher',
      color: 'bg-green-100 text-green-600',
      id: 'voucher',
      description: 'Redeem your vouchers and gift cards for amazing rewards and discounts',
      featured: false
    },
    {
      title: 'Support',
      icon: <MessageCircle size={20} />,
      path: '/support',
      color: 'bg-green-100 text-green-600',
      id: 'support',
      featured: false
    },
    {
      title: 'Refer & Earn',
      icon: <Users size={20} />,
      path: '/refer',
      color: 'bg-green-100 text-green-600',
      id: 'refer',
      featured: false
    },
  ];

  const promotionalBanners = [
    {
      id: 2,
      title: 'Shop with Confidence',
      subtitle: 'Discover amazing deals on electronics and gadgets',
      image: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg',
      buttonText: 'Shop Now',
      bgColor: 'bg-gradient-to-r from-blue-500 to-purple-500',
    },
  ];

  // Filter services based on their status
  const filteredServices = allServices.filter(service => {
    const status = getServiceStatus(service.id);
    return status !== 'disabled';
  }).map(service => {
    const status = getServiceStatus(service.id);
    return {
      ...service,
      comingSoon: status === 'coming_soon'
    };
  });

  // Get featured services (Airtime and Data only)
  const featuredServices = filteredServices.filter(service => service.featured);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 sm:w-12 h-10 sm:h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm sm:text-lg">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {getGreeting()}
              </p>
              <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {user?.name?.split(' ')[0] || 'User'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
          >
            {isDarkMode ? (
              <Sun size={18} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <Moon size={18} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm opacity-90">Available Balance</span>
              <button 
                onClick={toggleBalanceVisibility}
                className="opacity-75 hover:opacity-100 transition-opacity"
              >
                {showBalance ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
              </button>
              <button 
                onClick={handleRefreshBalance}
                disabled={isRefreshing}
                className="opacity-75 hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <button 
              onClick={() => navigate('/transactions')}
              className="text-xs sm:text-sm opacity-90 hover:opacity-100 transition-opacity whitespace-nowrap"
            >
              History →
            </button>
          </div>
          
          <div className="flex flex-col space-y-4">
            {/* Balance Amount */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex-1 min-w-0">
                <p className="text-xl sm:text-3xl font-bold truncate">
                  {showBalance ? formatCurrency(user?.walletBalance || 0) : '****'}
                </p>
              </div>
              
              <div className="w-full sm:w-auto flex-shrink-0 flex gap-2">
                <Button
                  onClick={() => navigate('/wallet/fund')}
                  className="flex-1 sm:flex-none bg-white text-green-600 hover:bg-gray-100 px-3 sm:px-6 py-2 rounded-full font-medium text-xs sm:text-sm"
                >
                  Add Money
                </Button>
                {/* Debug buttons - only show for admin users */}
                {user?.isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      onClick={testWalletUpdate}
                      className="bg-yellow-500 text-white hover:bg-yellow-600 px-2 py-2 rounded-full font-medium text-xs"
                      title="Test wallet update (Admin only)"
                    >
                      Test
                    </Button>
                    <Button
                      onClick={debugWalletIssue}
                      className="bg-red-500 text-white hover:bg-red-600 px-2 py-2 rounded-full font-medium text-xs"
                      title="Debug wallet issue (Admin only)"
                    >
                      Debug
                    </Button>
                    <Button
                      onClick={fixWalletBalance}
                      className="bg-blue-500 text-white hover:bg-blue-600 px-2 py-2 rounded-full font-medium text-xs"
                      title="Fix wallet balance (Admin only)"
                    >
                      Fix
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Virtual Account Details */}
            {user?.virtualAccountNumber && user?.virtualAccountBankName && (
              <div className="pt-4 border-t border-white border-opacity-30">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs sm:text-sm opacity-90 font-medium">💳 Fund Wallet</p>
                  
                  {/* Provider Switcher */}
                  <div className="flex items-center space-x-1 bg-white bg-opacity-20 rounded-lg p-1">
                    {Object.entries(virtualAccountProviders).map(([key, provider]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedProvider(key as 'flutterwave' | 'opay' | 'palmpay')}
                        disabled={!provider.available}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          selectedProvider === key
                            ? 'bg-white text-green-600 shadow-sm'
                            : provider.available
                            ? 'text-white opacity-70 hover:opacity-100'
                            : 'text-white opacity-40 cursor-not-allowed'
                        }`}
                        title={!provider.available ? 'Coming soon' : provider.name}
                      >
                        {provider.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-xl p-4 space-y-3">
                  {isCreatingAccount ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm font-medium">Generating Account...</p>
                      <p className="text-xs opacity-75">Please wait while we set up your {currentProvider.name} account</p>
                    </div>
                  ) : currentProvider.available && currentProvider.accountNumber ? (
                    <>
                      {/* Bank Name */}
                      <div>
                        <p className="text-xs opacity-75 mb-1">Bank Name</p>
                        <p className="text-lg sm:text-xl font-bold tracking-wide">{currentProvider.bankName}</p>
                      </div>
                      
                      {/* Account Number */}
                      <div>
                        <p className="text-xs opacity-75 mb-1">Account Number</p>
                        <div className="flex items-center justify-between bg-white bg-opacity-20 rounded-lg p-3">
                          <span className="text-xl sm:text-2xl font-bold font-mono tracking-wider">{currentProvider.accountNumber}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(currentProvider.accountNumber || '');
                              // Show a better feedback
                              const btn = document.activeElement as HTMLButtonElement;
                              const originalText = btn.innerHTML;
                              btn.innerHTML = '✓';
                              setTimeout(() => {
                                btn.innerHTML = originalText;
                              }, 1000);
                            }}
                            className="ml-3 p-2 bg-white bg-opacity-30 hover:bg-opacity-40 rounded-lg transition-all active:scale-95"
                            title="Copy account number"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Info Text */}
                      <div className="flex items-start space-x-2 bg-white bg-opacity-10 rounded-lg p-2.5">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs opacity-90 leading-relaxed">
                          Transfer any amount to this account and your wallet will be credited automatically
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                      <p className="text-sm font-medium mb-1">Account Generation Pending</p>
                      <p className="text-xs opacity-75">Click to retry or wait a moment</p>
                      <Button 
                        onClick={() => refreshUserData()} 
                        className="mt-3 bg-white text-green-600 hover:bg-gray-100 py-1 px-4 text-xs h-8"
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Services Grid */}
      <div className="px-3 sm:px-4 py-4 sm:py-6">
        {/* Services */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
          {featuredServices.map((service, index) => (
            <button
              key={index}
              onClick={() => {
                if (service.comingSoon) {
                  handleComingSoonNavigation(service.title, service.description || '');
                } else {
                  navigate(service.path);
                }
              }}
              className="flex flex-col items-center justify-center space-y-2 sm:space-y-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow relative min-h-[100px] sm:min-h-[110px]"
            >
              {service.comingSoon && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                  Soon
                </div>
              )}
              <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center ${service.color} flex-shrink-0`}>
                {React.cloneElement(service.icon as React.ReactElement, { 
                  size: 20,
                  className: 'sm:w-6 sm:h-6'
                })}
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
                {service.title}
              </span>
            </button>
          ))}

          {/* More Button - Navigate to Services Page */}
          <button
            onClick={() => navigate('/services')}
            className="flex flex-col items-center justify-center space-y-2 sm:space-y-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-sm hover:shadow-md transition-shadow relative min-h-[100px] sm:min-h-[110px]"
          >
            <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center bg-white bg-opacity-20 flex-shrink-0">
              <MoreHorizontal size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-white text-center leading-tight">
              More
            </span>
          </button>
        </div>

        {/* Product Slideshow Section */}
        {getServiceStatus('store') !== 'disabled' && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Latest Products</h2>
              <a href="/store" className="text-[#0F9D58] text-sm font-medium">View All</a>
            </div>
            
            <ProductSlideshow />
          </div>
        )}

        {/* Promotional Banners */}
        {getServiceStatus('store') !== 'disabled' && (
          <div className="space-y-4 mb-6 sm:mb-8">
            {promotionalBanners.map((banner) => (
              <Card key={banner.id} className={`${banner.bgColor} text-white p-3 sm:p-4 md:p-6 overflow-hidden relative`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-2 sm:pr-4 min-w-0">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold mb-1 sm:mb-2 line-clamp-1">{banner.title}</h3>
                    <p className="text-xs sm:text-sm opacity-90 mb-3 sm:mb-4 leading-relaxed line-clamp-2">
                      {banner.subtitle}
                    </p>
                    
                    <div className="flex space-x-2 sm:space-x-3">
                      <button 
                        onClick={() => navigate('/store')}
                        className="bg-white bg-opacity-20 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium hover:bg-opacity-30 transition-all whitespace-nowrap"
                      >
                        📱 {banner.buttonText}
                      </button>
                    </div>
                  </div>
                  
                  <div className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0">
                    <img
                      src={banner.image}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {getServiceStatus('store') !== 'disabled' && (
            <Card 
              className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/store')}
            >
              <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={14} className="text-green-600 sm:w-4 sm:h-4" />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">Shop</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">Browse products</p>
                </div>
              </div>
            </Card>
          )}

          {/* Explore Marketplace - Always visible */}
          <Card 
            className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/store?view=shops')}
          >
            <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
              <div className="w-8 sm:w-10 h-8 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Store size={14} className="text-indigo-600 sm:w-4 sm:h-4" />
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">Marketplace</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">Explore shops</p>
              </div>
            </div>
          </Card>

          {getServiceStatus('store') !== 'disabled' && (
            <Card 
              className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/store/orders')}
            >
              <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-blue-600 sm:w-4 sm:h-4" />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">Orders</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">Track orders</p>
                </div>
              </div>
            </Card>
          )}

          {getServiceStatus('support') !== 'disabled' && (
            <Card 
              className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/support')}
            >
              <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={14} className="text-orange-600 sm:w-4 sm:h-4" />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">Support</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">Get help</p>
                </div>
              </div>
            </Card>
          )}

          {/* Become a Vendor - Always visible, navigates to onboard or dashboard based on status */}
          <Card 
            className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(isVendor ? '/vendor/dashboard' : '/vendor/onboard')}
          >
            <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
              <div className="w-8 sm:w-10 h-8 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Store size={14} className="text-purple-600 sm:w-4 sm:h-4" />
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                  {isVendor ? 'My Shop' : 'Become Vendor'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                  {isVendor ? 'Manage shop' : 'Sell products'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;