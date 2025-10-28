import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Phone, Wifi, Zap, BookOpen, Shield, Clock, Gift, Download, QrCode, ChevronDown, ShoppingBag, Tv, MessageCircle, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useServiceConfigStore } from '../store/serviceConfigStore';
import { useAppSettingsStore } from '../store/appSettingsStore';
import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ProductSlideshow from '../components/home/ProductSlideshow';
import { formatCurrency } from '../lib/utils';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { config: serviceConfig, fetchConfig } = useServiceConfigStore();
  const { siteName, siteLogoUrl, footerPhone, footerEmail, footerAddress, footerCompanyName } = useAppSettingsStore();
  const [bannerSettings, setBannerSettings] = useState({
    hero_banner_image: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg',
    hero_banner_image_alt: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg',
    steps_banner_image: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg',
    hero_title: 'The Ultimate Digital Services & E-commerce Platform.',
    hero_subtitle: 'Pay bills, shop online, and manage your digital life all in one secure platform.',
    steps_title: `3 Simple Steps to Enjoy ${siteName}.`,
    download_app_url: 'https://play.google.com/store/apps',
    download_app_enabled: 'true',
  });


  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    const initializeSettings = async () => {
      setIsLoading(true);
      setFetchError(null);
      
      try {
        await fetchBannerSettings();
      } catch (error) {
        console.error('Error initializing settings:', error);
        setFetchError('Unable to load some settings. Using default values.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, [fetchConfig, siteName]);

  const fetchBannerSettings = async () => {
    try {
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.warn('Supabase environment variables not configured. Using default banner settings.');
        return;
      }

      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'hero_banner_image',
          'hero_banner_image_alt', 
          'steps_banner_image',
          'hero_title',
          'hero_subtitle',
          'steps_title',
          'download_app_url',
          'download_app_enabled'
        ]);

      if (error) {
        console.warn('Error fetching banner settings:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const settings: Record<string, string> = {};
        data.forEach(setting => {
          settings[setting.key] = setting.value;
        });

        setBannerSettings(prev => ({ 
          ...prev, 
          ...settings,
          steps_title: settings.steps_title?.replace('ArabNetwork', siteName) || `3 Simple Steps to Enjoy ${siteName}.`
        }));
      }
    } catch (error) {
      console.warn('Network error fetching banner settings:', error);
      // Keep using default values - no need to throw
    }
  };


  const getServiceStatus = (serviceId: string) => {
    return serviceConfig[serviceId] || 'active';
  };

  const handleServiceClick = (path: string, state?: any) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (state) {
      navigate(path, { state });
    } else {
      navigate(path);
    }
  };

  const services = [
    {
      title: 'Airtime Recharge',
      description: 'Buy airtime for any network instantly',
      icon: <Phone size={24} />,
      path: '/services/airtime',
      id: 'airtime'
    },
    {
      title: 'Data Bundles',
      description: 'Purchase data plans for any network',
      icon: <Wifi size={24} />,
      path: '/services/data',
      id: 'data'
    },
    {
      title: 'Electricity Bills',
      description: 'Pay electricity bills for any DISCO',
      icon: <Zap size={24} />,
      path: '/services/electricity',
      id: 'electricity'
    },
    {
      title: 'TV Subscriptions',
      description: 'Pay for DSTV, GOTV, and Startimes',
      icon: <Tv size={24} />,
      path: '/services/tv',
      id: 'tv'
    },
    {
      title: 'WAEC Scratch Cards',
      description: 'Purchase WAEC scratch cards instantly',
      icon: <BookOpen size={24} />,
      path: '/services/waec',
      id: 'waec'
    },
    {
      title: 'E-commerce Store',
      description: 'Shop from our wide range of electronics and gadgets',
      icon: <ShoppingBag size={24} />,
      path: '/store',
      id: 'store'
    },
    {
      title: 'Support',
      description: 'Get help with any issues',
      icon: <MessageCircle size={24} />,
      path: '/support',
      id: 'support'
    },
    {
      title: 'Refer & Earn',
      description: 'Invite friends and earn rewards',
      icon: <Users size={24} />,
      path: '/refer',
      id: 'refer'
    },
  ];

  // Filter services based on their status
  const filteredServices = services.filter(service => {
    const status = getServiceStatus(service.id);
    return status !== 'disabled';
  }).map(service => {
    const status = getServiceStatus(service.id);
    return {
      ...service,
      path: status === 'coming_soon' ? '/coming-soon' : service.path,
      state: status === 'coming_soon' ? { 
        serviceName: service.title, 
        serviceDescription: service.description 
      } : undefined,
      comingSoon: status === 'coming_soon'
    };
  });

  const features = [
    {
      title: `Simplify Your Payments with ${siteName}`,
      description: `With ${siteName}, you can enjoy a hassle-free payment experience for all your essential bills and services. We offer a simple, fast, and secure way to pay your utility bills and shop online all in one place.`,
      icon: <Shield size={32} />,
    },
    {
      title: 'Save Time and Effort',
      description: 'Say goodbye to the tedious task of paying bills and shopping from multiple platforms. Our platform streamlines the process, allowing you to make payments and purchases with just a few clicks. Plus, our platform is available 24/7.',
      icon: <Clock size={32} />,
    },
    {
      title: 'Secure and Reliable',
      description: `Your security is our top priority at ${siteName}. We use the latest technology to ensure that your personal and financial information is always safe and protected. Our platform is also reliable, with a seamless payment process.`,
      icon: <Shield size={32} />,
    },
    {
      title: 'Earn Rewards',
      description: `With ${siteName}, you can earn rewards for every successful referral you make. Simply share your referral code with friends and family, and when they sign up and make their first deposit, you'll both receive a bonus.`,
      icon: <Gift size={32} />,
    },
  ];

  const steps = [
    {
      number: '1',
      title: 'Download and Install the App',
      description: `Visit your app store, search for "${siteName}" and download and install the app on your mobile device.`,
    },
    {
      number: '2',
      title: `Sign Up on ${siteName} for free`,
      description: 'Open the app and follow the quick and easy sign-up process. All you need is your basic personal information.',
    },
    {
      number: '3',
      title: 'Add Funds and Start Using Services',
      description: 'Once you\'re signed in, you can add funds to your account and start paying bills or shopping from our store. It\'s that simple!',
    },
  ];

  const faqs = [
    { question: `Why Should I use ${siteName}`, answer: `${siteName} provides a secure, fast, and convenient way to pay all your bills and shop online in one place.` },
    { question: `How Can I Pay For Utility On ${siteName}`, answer: 'You can pay for utilities by funding your wallet and selecting the utility service you want to pay for.' },
    { question: `How do I Pay Or deposit on ${siteName}?`, answer: 'You can deposit funds using your debit/credit card or bank transfer through our secure payment gateway.' },
    { question: 'What Happen If my card doesn\'t work?', answer: 'If your card doesn\'t work, please contact our support team or try using a different payment method.' },
    { question: 'I was debited for a failed transaction', answer: 'If you were debited for a failed transaction, please contact our support team with your transaction reference for immediate resolution.' },
    { question: `What is ${siteName}?`, answer: `${siteName} is a leading digital services and e-commerce platform that enables users to easily and securely pay for various bills, subscriptions, and shop online.` },
    { question: `Is ${siteName} safe and secure to use?`, answer: `Yes, ${siteName} uses advanced security measures to protect your personal and financial information.` },
    { question: `How do I add money to my ${siteName} wallet?`, answer: 'You can add money to your wallet using debit/credit cards or bank transfers through our secure payment system.' },
  ];

  // Get current year for copyright
  const currentYear = new Date().getFullYear();

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#0F9D58] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Error Banner */}
      {fetchError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{fetchError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0F9D58] via-[#0d8a4f] to-[#0b7746] py-20 sm:py-32 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Floating Shapes */}
        <div className="absolute top-20 right-20 w-16 sm:w-20 h-16 sm:h-20 bg-white bg-opacity-10 rounded-full"></div>
        <div className="absolute top-40 right-40 w-8 sm:w-12 h-8 sm:h-12 bg-white bg-opacity-20 rotate-45"></div>
        <div className="absolute bottom-40 left-20 w-12 sm:w-16 h-12 sm:h-16 bg-white bg-opacity-15 rounded-full"></div>
        <div className="absolute bottom-20 left-40 w-6 sm:w-8 h-6 sm:h-8 bg-white bg-opacity-25 rotate-45"></div>

        <div className="container-pad relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="space-y-6 sm:space-y-8">
              {/* New Badge */}
              <div className="inline-flex items-center bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-4 py-2 text-white">
                <span className="bg-white text-[#0F9D58] px-2 py-1 rounded-full text-xs font-bold mr-3">New</span>
                <span className="text-sm">Delivering Excellence Across Nigeria And beyond</span>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight text-white">
                  {bannerSettings.hero_title}
                </h1>
                
                <div className="w-20 sm:w-24 h-1 bg-white rounded-full"></div>
                
                <p className="text-lg sm:text-xl text-white opacity-90 leading-relaxed">
                  {bannerSettings.hero_subtitle}
                </p>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                  <Button
                    variant="outline"
                    className="bg-white text-[#0F9D58] border-white hover:bg-gray-100 px-6 py-3 rounded-lg"
                    onClick={() => navigate('/signup')}
                  >
                    Get Started
                  </Button>
                  
                  {/* Download App Button */}
                  {bannerSettings.download_app_enabled === 'true' && (
                    <Button
                      variant="outline"
                      className="bg-transparent border-white text-white hover:bg-white hover:text-[#0F9D58] px-6 py-3 rounded-lg"
                      icon={<Download size={20} />}
                      onClick={() => window.open(bannerSettings.download_app_url, '_blank')}
                    >
                      Download App
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="relative mt-8 lg:mt-0">
              <div className="relative z-10 flex justify-center items-center">
                {/* 3D Geometric Shapes */}
                <div className="absolute -top-10 -left-10 w-16 sm:w-20 h-16 sm:h-20 bg-purple-500 rounded-full opacity-80"></div>
                <div className="absolute top-20 -right-10 w-12 sm:w-16 h-12 sm:h-16 bg-blue-500 opacity-70" style={{clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'}}></div>
                <div className="absolute -bottom-10 left-10 w-8 sm:w-12 h-8 sm:h-12 bg-pink-500 rotate-45 opacity-75"></div>
                <div className="absolute bottom-20 -right-5 w-20 sm:w-24 h-20 sm:h-24 bg-cyan-500 rounded-full opacity-60"></div>

                <div className="relative">
                  <img
                    src={bannerSettings.hero_banner_image}
                    alt="Mobile App Preview"
                    className="w-48 sm:w-64 h-auto rounded-3xl shadow-2xl transform rotate-12"
                  />
                  <img
                    src={bannerSettings.hero_banner_image_alt}
                    alt="Mobile App Preview 2"
                    className="absolute -right-12 sm:-right-16 top-16 w-40 sm:w-56 h-auto rounded-3xl shadow-2xl transform -rotate-6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Slideshow Section */}
      {getServiceStatus('store') !== 'disabled' && (
        <section className="py-12 sm:py-20 bg-white dark:bg-gray-900">
          <div className="container-pad">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Latest Products</h2>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Discover our newest arrivals and trending products with amazing deals and fast delivery.
              </p>
            </div>
            
            <ProductSlideshow />
            
            <div className="text-center mt-6 sm:mt-8">
              <Button
                onClick={() => navigate('/store')}
                className="bg-[#0F9D58] hover:bg-[#0d8a4f] text-white px-6 sm:px-8 py-3 rounded-full font-semibold"
              >
                View All Products
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Services Section */}
      {filteredServices.length > 0 && (
        <section className="py-12 sm:py-20 bg-gray-50 dark:bg-gray-800">
          <div className="container-pad">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Services</h2>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                From bill payments to online shopping, experience our comprehensive range of digital services and e-commerce solutions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredServices.map((service, index) => (
                <Card
                  key={index}
                  className="p-6 sm:p-8 hover:shadow-xl transition-all duration-300 cursor-pointer group"
                  onClick={() => {
                    if (service.id === 'store') {
                      // Allow viewing store without login
                      navigate(service.path, { state: service.state });
                    } else if (service.comingSoon) {
                      navigate('/coming-soon', { state: service.state });
                    } else {
                      // Require login for other services
                      if (!isAuthenticated) {
                        navigate('/login');
                      } else {
                        navigate(service.path);
                      }
                    }
                  }}
                >
                  <div className="w-12 sm:w-16 h-12 sm:h-16 bg-[#0F9D58] bg-opacity-10 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-[#0F9D58] transition-colors duration-300 relative">
                    <div className="text-[#0F9D58] group-hover:text-white transition-colors duration-300">
                      {service.icon}
                    </div>
                    {service.comingSoon && (
                      <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        Soon
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">{service.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
                    {service.description}
                  </p>
                  {service.id !== 'store' && !service.comingSoon && !isAuthenticated && (
                    <div className="mt-3 text-sm text-[#0F9D58] font-medium">
                      Login required to use this service
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Section */}
      <section className="py-12 sm:py-20 bg-white dark:bg-gray-900">
        <div className="container-pad">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why choose <span className="text-[#0F9D58]">{siteName}</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Experience seamless digital services and e-commerce with our comprehensive platform designed for your convenience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 sm:p-8 bg-white dark:bg-gray-800">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-[#0F9D58] bg-opacity-10 rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                  <div className="text-[#0F9D58]">{feature.icon}</div>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-12 sm:py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container-pad">
          <div className="grid lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute inset-0 bg-[#0F9D58] bg-opacity-5 rounded-full"></div>
              <div className="relative z-10 flex justify-center">
                <img
                  src={bannerSettings.steps_banner_image}
                  alt="App Screenshots"
                  className="w-64 sm:w-80 h-auto rounded-3xl shadow-2xl"
                />
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 order-1 lg:order-2">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  {bannerSettings.steps_title}
                </h2>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0 w-10 sm:w-12 h-10 sm:h-12 bg-[#0F9D58] text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {step.number}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="primary"
                className="bg-[#0F9D58] hover:bg-[#0d8a4f] px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-full"
                onClick={() => navigate('/signup')}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 sm:py-20 bg-white dark:bg-gray-900">
        <div className="container-pad">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Checkout our <span className="text-[#0F9D58]">FAQs</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Have a question about our services? Our FAQ section has got you covered with helpful information on all of our offerings.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12">
            <div className="bg-[#0F9D58] rounded-3xl p-6 sm:p-8 text-white">
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white bg-opacity-20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                    <ChevronDown size={16} />
                  </div>
                  <span className="font-medium text-sm sm:text-base">General Questions</span>
                </div>
                
                <div className="bg-white bg-opacity-20 rounded-2xl p-4 flex items-center gap-3">
                  <Wifi size={20} />
                  <span className="font-medium text-sm sm:text-base">Data Bundle Questions</span>
                </div>
                
                <div className="bg-white bg-opacity-20 rounded-2xl p-4 flex items-center gap-3">
                  <Phone size={20} />
                  <span className="font-medium text-sm sm:text-base">Airtime Topup Questions</span>
                </div>
                
                <div className="bg-white bg-opacity-20 rounded-2xl p-4 flex items-center gap-3">
                  <Zap size={20} />
                  <span className="font-medium text-sm sm:text-base">Utility Bills Questions</span>
                </div>
                
                <div className="bg-white bg-opacity-20 rounded-2xl p-4 flex items-center gap-3">
                  <ShoppingBag size={20} />
                  <span className="font-medium text-sm sm:text-base">E-commerce Questions</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full bg-transparent border-white text-white hover:bg-white hover:text-[#0F9D58] mt-6 sm:mt-8 text-sm sm:text-base"
                >
                  Still have questions? Contact us →
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details key={index} className="group">
                  <summary className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <span className="font-medium text-sm sm:text-base pr-4">{faq.question}</span>
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-b-xl">
                    <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 sm:py-16">
        <div className="container-pad">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#0F9D58] rounded-lg flex items-center justify-center">
                  {siteLogoUrl ? (
                    <img src={siteLogoUrl} alt={siteName} className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
                  )}
                </div>
                <span className="text-lg sm:text-xl font-bold">{footerCompanyName}</span>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed text-sm sm:text-base">
                {footerCompanyName} is a leading digital services and e-commerce provider that enables users to easily and securely pay for various bills, subscriptions, and shop online for quality products.
              </p>
              <p className="text-gray-400 text-sm sm:text-base">
                <strong>Address:</strong> {footerAddress}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">Digital Services</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/services/data" className="hover:text-white transition-colors">Data bundle purchases</a></li>
                <li><a href="/services/airtime" className="hover:text-white transition-colors">Mobile airtime top-ups</a></li>
                <li><a href="/services/waec" className="hover:text-white transition-colors">Education bill payments</a></li>
                <li><a href="/services/electricity" className="hover:text-white transition-colors">Utility Payment</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">E-commerce</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/store" className="hover:text-white transition-colors">Electronics</a></li>
                <li><a href="/store" className="hover:text-white transition-colors">Gadgets & Accessories</a></li>
                <li><a href="/store" className="hover:text-white transition-colors">Fast Delivery</a></li>
                <li><a href="/store" className="hover:text-white transition-colors">Secure Shopping</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-sm sm:text-base">Company</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Use</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
              <div className="mt-6">
                <h4 className="font-semibold mb-3 text-sm sm:text-base">Contact Info</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li>{footerPhone}</li>
                  <li className="break-all">{footerEmail}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© {currentYear} {footerCompanyName} All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy policy</a>
              <a href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of use</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;