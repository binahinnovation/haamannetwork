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
  BookOpen,
  Moon,
  Sun,
  Package,
  MessageCircle,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useServiceConfigStore } from '../store/serviceConfigStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ProductSlideshow from '../components/home/ProductSlideshow';
import { formatCurrency } from '../lib/utils';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuthStore();
  const { config: serviceConfig, fetchConfig } = useServiceConfigStore();
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

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

  const mainServices = [
    {
      title: 'Airtime',
      icon: <Phone size={20} />,
      path: '/services/airtime',
      color: 'bg-green-100 text-green-600',
      id: 'airtime'
    },
    {
      title: 'Data',
      icon: <Wifi size={20} />,
      path: '/services/data',
      color: 'bg-green-100 text-green-600',
      id: 'data'
    },
    {
      title: 'Electricity',
      icon: <Zap size={20} />,
      path: '/services/electricity',
      color: 'bg-green-100 text-green-600',
      id: 'electricity'
    },
    {
      title: 'TV',
      icon: <Tv size={20} />,
      path: '/services/tv',
      color: 'bg-green-100 text-green-600',
      id: 'tv',
      description: 'Pay for your TV subscriptions including DSTV, GOTV, and Startimes'
    },
  ];

  const secondaryServices = [
    {
      title: 'Redeem Voucher',
      icon: <Gift size={20} />,
      path: '/voucher',
      color: 'bg-green-100 text-green-600',
      id: 'voucher',
      description: 'Redeem your vouchers and gift cards for amazing rewards and discounts'
    },
    {
      title: 'Support',
      icon: <MessageCircle size={20} />,
      path: '/support',
      color: 'bg-green-100 text-green-600',
      id: 'support'
    },
    {
      title: 'Refer & Earn',
      icon: <Users size={20} />,
      path: '/refer',
      color: 'bg-green-100 text-green-600',
      id: 'refer'
    },
    {
      title: 'More',
      icon: <MoreHorizontal size={20} />,
      path: '/services',
      color: 'bg-green-100 text-green-600',
      id: 'more'
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
  const filteredMainServices = mainServices.filter(service => {
    const status = getServiceStatus(service.id);
    return status !== 'disabled';
  }).map(service => {
    const status = getServiceStatus(service.id);
    return {
      ...service,
      comingSoon: status === 'coming_soon'
    };
  });

  const filteredSecondaryServices = secondaryServices.filter(service => {
    if (service.id === 'more') return true; // Always show "More" option
    const status = getServiceStatus(service.id);
    return status !== 'disabled';
  }).map(service => {
    if (service.id === 'more') return { ...service, comingSoon: false }; // Don't modify "More" option
    const status = getServiceStatus(service.id);
    return {
      ...service,
      comingSoon: status === 'coming_soon'
    };
  });

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
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-3xl font-bold truncate">
                {showBalance ? formatCurrency(user?.walletBalance || 0) : '****'}
              </p>
            </div>
            
            <div className="flex-shrink-0 flex gap-2">
              <Button
                onClick={() => navigate('/wallet/fund')}
                className="bg-white text-green-600 hover:bg-gray-100 px-3 sm:px-6 py-2 rounded-full font-medium text-xs sm:text-sm"
              >
                Add Money
              </Button>
              {/* Debug buttons - only show in development */}
              {import.meta.env.DEV && (
                <div className="flex gap-1">
                  <Button
                    onClick={testWalletUpdate}
                    className="bg-yellow-500 text-white hover:bg-yellow-600 px-2 py-2 rounded-full font-medium text-xs"
                    title="Test wallet update (Dev only)"
                  >
                    Test
                  </Button>
                  <Button
                    onClick={debugWalletIssue}
                    className="bg-red-500 text-white hover:bg-red-600 px-2 py-2 rounded-full font-medium text-xs"
                    title="Debug wallet issue (Dev only)"
                  >
                    Debug
                  </Button>
                  <Button
                    onClick={fixWalletBalance}
                    className="bg-blue-500 text-white hover:bg-blue-600 px-2 py-2 rounded-full font-medium text-xs"
                    title="Fix wallet balance (Dev only)"
                  >
                    Fix
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Services Grid */}
      <div className="px-3 sm:px-4 py-4 sm:py-6">
        {/* Main Services */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
          {filteredMainServices.map((service, index) => (
            <button
              key={index}
              onClick={() => {
                if (service.comingSoon) {
                  handleComingSoonNavigation(service.title, service.description || '');
                } else {
                  navigate(service.path);
                }
              }}
              className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3 p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow relative min-h-[80px] sm:min-h-[90px] md:min-h-[100px]"
            >
              {service.comingSoon && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                  Soon
                </div>
              )}
              <div className={`w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full flex items-center justify-center ${service.color} flex-shrink-0`}>
                <div className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6">
                  {service.icon}
                </div>
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center leading-tight px-1 line-clamp-2">
                {service.title}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Services */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
          {filteredSecondaryServices.map((service, index) => (
            <button
              key={index}
              onClick={() => {
                if (service.comingSoon) {
                  handleComingSoonNavigation(service.title, service.description || '');
                } else {
                  navigate(service.path);
                }
              }}
              className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3 p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow relative min-h-[80px] sm:min-h-[90px] md:min-h-[100px]"
            >
              {service.comingSoon && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                  Soon
                </div>
              )}
              <div className={`w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full flex items-center justify-center ${service.color} flex-shrink-0`}>
                <div className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6">
                  {service.icon}
                </div>
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight px-1 line-clamp-2">
                {service.title}
              </span>
            </button>
          ))}
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

          {getServiceStatus('waec') === 'coming_soon' && (
            <Card 
              className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow relative"
              onClick={() => handleComingSoonNavigation('Education Services', 'Access educational services, course payments, and academic resources')}
            >
              <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                Soon
              </div>
              <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-3">
                <div className="w-8 sm:w-10 h-8 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <BookOpen size={14} className="text-purple-600 sm:w-4 sm:h-4" />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">Education</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">WAEC & more</p>
                </div>
              </div>
            </Card>
          )}

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
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;