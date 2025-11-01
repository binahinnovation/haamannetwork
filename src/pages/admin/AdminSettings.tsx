import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save,
  Settings,
  Percent,
  Globe,
  Mail,
  Phone,
  Clock,
  Gift,
  Download,
  QrCode,
  Smartphone,
  MapPin,
  Building,
  Key,
  Eye,
  EyeOff,
  CreditCard,
  Lock,
  Users,
  ToggleRight,
  DollarSign,
  Wifi,
  Zap,
  Tv,
  BookOpen,
  ShoppingBag,
  MessageCircle,
  Link
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServiceConfigStore, ServiceStatus } from '../../store/serviceConfigStore';

type AdminSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
};

const AdminSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { config: serviceConfig, fetchConfig, updateServiceStatus } = useServiceConfigStore();
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showApiToken, setShowApiToken] = useState(false);
  const [showFlutterwaveEncryptionKey, setShowFlutterwaveEncryptionKey] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [savingService, setSavingService] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchSettings();
    fetchConfig();
  }, [user, navigate, fetchConfig]);

  const fetchSettings = async () => {
    try {
      // Fetch admin settings
      const { data: adminSettings, error: adminError } = await supabase
        .from('admin_settings')
        .select('*')
        .order('key');

      if (adminError) throw adminError;

      // Fetch API settings
      const { data: apiSettings, error: apiError } = await supabase
        .from('api_settings')
        .select('*')
        .order('key_name');

      if (apiError) throw apiError;

      // Combine both settings
      const allSettings = [
        ...(adminSettings || []),
        ...(apiSettings || []).map(setting => ({
          id: setting.id,
          key: setting.key_name,
          value: setting.key_value,
          description: setting.description || '',
        }))
      ];

      setSettings(allSettings);
      
      // Initialize form data
      const initialFormData: Record<string, string> = {};
      allSettings.forEach(setting => {
        initialFormData[setting.key] = setting.value;
      });
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if we need to add new settings
  const ensureRequiredSettings = async () => {
    const requiredSettings = [
      {
        key: 'airtime_provider',
        value: 'smeplug',
        description: 'Default airtime provider (smeplug). SME Plug is now the default for all airtime purchases.'
      },
      {
        key: 'referral_reward_enabled',
        value: 'true',
        description: 'Enable or disable the data reward for referrals'
      },
      {
        key: 'referral_reward_count',
        value: '5',
        description: 'Number of referrals required to earn the data reward'
      },
      {
        key: 'referral_reward_data_size',
        value: '1GB',
        description: 'Size of the data reward (e.g., 1GB, 2GB)'
      },
      {
        key: 'referral_reward_type',
        value: 'data_bundle',
        description: 'Type of reward for referrals (data_bundle, airtime, wallet_credit)'
      },
      {
        key: 'referral_reward_airtime_amount',
        value: '1000',
        description: 'Amount of airtime to reward (in local currency)'
      },
      {
        key: 'referral_reward_cash_amount',
        value: '1000',
        description: 'Amount of cash to reward (in local currency)'
      },
      {
        key: 'funding_charge_enabled',
        value: 'false',
        description: 'Enable or disable charges for wallet funding'
      },
      {
        key: 'funding_charge_type',
        value: 'percentage',
        description: 'Type of charge for wallet funding (percentage or fixed)'
      },
      {
        key: 'funding_charge_value',
        value: '1.5',
        description: 'Value of the charge (percentage or fixed amount)'
      },
      {
        key: 'funding_charge_min_deposit',
        value: '1000',
        description: 'Minimum deposit amount for charges to apply (0 for no minimum)'
      },
      {
        key: 'funding_charge_max_deposit',
        value: '0',
        description: 'Maximum deposit amount for charges to apply (0 for no maximum)'
      },
      {
        key: 'funding_charge_display_text',
        value: 'A service charge applies to wallet funding transactions.',
        description: 'Custom text to display to users about funding charges'
      },
      {
        key: 'referral_invite_limit',
        value: '5',
        description: 'Maximum number of referrals a user can make before needing to claim a reward'
      },
      // Service status settings
      {
        key: 'service_airtime_status',
        value: 'active',
        description: 'Status for airtime service: active, disabled, or coming_soon'
      },
      {
        key: 'service_data_status',
        value: 'active',
        description: 'Status for data service: active, disabled, or coming_soon'
      },
      {
        key: 'service_electricity_status',
        value: 'active',
        description: 'Status for electricity service: active, disabled, or coming_soon'
      },
      {
        key: 'service_tv_status',
        value: 'coming_soon',
        description: 'Status for TV service: active, disabled, or coming_soon'
      },
      {
        key: 'service_waec_status',
        value: 'coming_soon',
        description: 'Status for WAEC service: active, disabled, or coming_soon'
      },
      {
        key: 'service_voucher_status',
        value: 'coming_soon',
        description: 'Status for voucher redemption service: active, disabled, or coming_soon'
      },
      {
        key: 'service_support_status',
        value: 'active',
        description: 'Status for support ticket service: active, disabled, or coming_soon'
      },
      {
        key: 'service_refer_status',
        value: 'active',
        description: 'Status for refer & earn service: active, disabled, or coming_soon'
      },
      {
        key: 'service_store_status',
        value: 'active',
        description: 'Status for e-commerce store: active, disabled, or coming_soon'
      },
      // App base URL setting
      {
        key: 'app_base_url',
        value: 'https://haamannetwork.com',
        description: 'Base URL for the application (used for referral links and other external URLs)'
      }
    ];

    try {
      // MASKAWA API settings commented out but kept for future use
      // const requiredApiSettings = [
      //   {
      //     key_name: 'maskawa_token',
      //     key_value: 'YOUR_MASKAWA_TOKEN_HERE',
      //     description: 'MASKAWA API token used by maskawa-proxy edge function'
      //   },
      //   {
      //     key_name: 'maskawa_base_url',
      //     key_value: 'https://maskawasubapi.com',
      //     description: 'MASKAWA API base URL'
      //   }
      // ];

      // For now, no additional API settings needed since we're using SME Plug
      const requiredApiSettings: any[] = [];

      const { error: apiEnsureError } = await supabase
        .from('api_settings')
        .upsert(
          requiredApiSettings.map(s => ({
            key_name: s.key_name,
            key_value: s.key_value,
            description: s.description,
            updated_by: user?.id
          })),
          { onConflict: 'key_name', ignoreDuplicates: false }
        );

      if (apiEnsureError) {
        console.error('Error ensuring API settings:', apiEnsureError);
      }

      // Use upsert to insert or update settings without causing conflicts
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          requiredSettings.map(setting => ({
            key: setting.key,
            value: setting.value,
            description: setting.description,
            updated_by: user?.id
          })),
          { 
            onConflict: 'key',
            ignoreDuplicates: false 
          }
        );

      if (error) {
        console.error('Error upserting settings:', error);
        return;
      }

      // Refresh settings after ensuring they exist
      fetchSettings();
    } catch (error) {
      console.error('Error in ensureRequiredSettings:', error);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      ensureRequiredSettings();
    }
  }, [user?.isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update admin settings
      for (const [key, value] of Object.entries(formData)) {
        const setting = settings.find(s => s.key === key);
        if (!setting) continue;

        // Check if it's an API setting
        if (key.includes('maskawa') || key.includes('api') || key.includes('flutterwave')) {
          await supabase
            .from('api_settings')
            .update({ 
              key_value: value, 
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            })
            .eq('key_name', key);
        } else {
          await supabase
            .from('admin_settings')
            .update({ 
              value, 
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            })
            .eq('key', key);
        }
      }

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'update_settings',
        details: { updated_settings: Object.keys(formData) },
      }]);

      alert('Settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleServiceStatusChange = async (service: string, status: ServiceStatus) => {
    setSavingService(service);
    try {
      await updateServiceStatus(service, status);
      
      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'update_service_status',
        details: { 
          service,
          status,
          previous_status: serviceConfig[service] || 'active'
        },
      }]);
    } catch (error) {
      console.error(`Error updating ${service} status:`, error);
      alert(`Error updating ${service} status. Please try again.`);
    } finally {
      setSavingService(null);
    }
  };

  const getSettingIcon = (key: string) => {
    switch (key) {
      case 'referral_bonus_percentage':
        return <Percent className="text-green-500" size={20} />;
      case 'referral_reward_enabled':
        return <ToggleRight className="text-green-500" size={20} />;
      case 'referral_reward_count':
        return <Users className="text-green-500" size={20} />;
      case 'referral_reward_data_size':
        return <Gift className="text-green-500" size={20} />;
      case 'referral_reward_type':
        return <Gift className="text-green-500" size={20} />;
      case 'referral_reward_airtime_amount':
        return <Phone className="text-green-500" size={20} />;
      case 'referral_reward_cash_amount':
        return <CreditCard className="text-green-500" size={20} />;
      case 'referral_invite_limit':
        return <Users className="text-green-500" size={20} />;
      case 'funding_charge_enabled':
        return <ToggleRight className="text-blue-500" size={20} />;
      case 'funding_charge_type':
        return <CreditCard className="text-blue-500" size={20} />;
      case 'funding_charge_value':
        return <Percent className="text-blue-500" size={20} />;
      case 'funding_charge_min_deposit':
        return <DollarSign className="text-blue-500" size={20} />;
      case 'funding_charge_max_deposit':
        return <DollarSign className="text-blue-500" size={20} />;
      case 'funding_charge_display_text':
        return <Mail className="text-blue-500" size={20} />;
      case 'site_name':
        return <Globe className="text-blue-500" size={20} />;
      case 'site_logo_url':
        return <QrCode className="text-blue-500" size={20} />;
      case 'app_base_url':
        return <Link className="text-blue-500" size={20} />;
      case 'support_email':
      case 'footer_email':
        return <Mail className="text-purple-500" size={20} />;
      case 'support_phone':
      case 'footer_phone':
        return <Phone className="text-orange-500" size={20} />;
      case 'footer_address':
        return <MapPin className="text-red-500" size={20} />;
      case 'footer_company_name':
        return <Building className="text-indigo-500" size={20} />;
      case 'maintenance_mode':
        return <Clock className="text-red-500" size={20} />;
      case 'max_wallet_balance':
      case 'min_transaction_amount':
      case 'max_transaction_amount':
        return <CreditCard className="text-green-500" size={20} />;
      case 'hero_banner_image':
      case 'hero_banner_image_alt':
      case 'steps_banner_image':
        return <QrCode className="text-blue-500" size={20} />;
      case 'hero_title':
      case 'hero_subtitle':
      case 'steps_title':
        return <Settings className="text-purple-500" size={20} />;
      case 'download_app_url':
        return <Download className="text-indigo-500" size={20} />;
      case 'download_app_enabled':
        return <Smartphone className="text-indigo-500" size={20} />;
      case 'maskawa_token':
      case 'maskawa_base_url':
        return <Key className="text-red-500" size={20} />;
      case 'flutterwave_public_key':
        return <CreditCard className="text-purple-500" size={20} />;
      case 'flutterwave_encryption_key':
        return <Lock className="text-red-500" size={20} />;
      default:
        return <Settings className="text-gray-500" size={20} />;
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'airtime':
        return <Phone size={20} className="text-blue-500" />;
      case 'data':
        return <Wifi size={20} className="text-green-500" />;
      case 'electricity':
        return <Zap size={20} className="text-yellow-500" />;
      case 'tv':
        return <Tv size={20} className="text-purple-500" />;
      case 'waec':
        return <BookOpen size={20} className="text-orange-500" />;
      case 'voucher':
        return <Gift size={20} className="text-pink-500" />;
      case 'support':
        return <MessageCircle size={20} className="text-red-500" />;
      case 'refer':
        return <Users size={20} className="text-indigo-500" />;
      case 'store':
        return <ShoppingBag size={20} className="text-[#0F9D58]" />;
      default:
        return <Settings size={20} className="text-gray-500" />;
    }
  };

  const settingCategories = {
    'API Configuration': [/* 'maskawa_token', 'maskawa_base_url', */ 'flutterwave_public_key', 'flutterwave_encryption_key'],
    'Service Providers': ['airtime_provider'],
    'SME Plug Configuration': [], // SME Plug token is configured in Supabase Edge Function secrets
    'General': ['site_name', 'site_logo_url', 'app_base_url', 'support_email', 'support_phone'],
    'Footer Information': ['footer_company_name', 'footer_email', 'footer_phone', 'footer_address'],
    'Homepage Banners': ['hero_banner_image', 'hero_banner_image_alt', 'steps_banner_image'],
    'Homepage Content': ['hero_title', 'hero_subtitle', 'steps_title'],
    'Download App': ['download_app_enabled', 'download_app_url'],
    'Referral System': ['referral_bonus_percentage', 'referral_reward_enabled', 'referral_reward_count', 'referral_reward_type', 'referral_reward_data_size', 'referral_reward_airtime_amount', 'referral_reward_cash_amount', 'referral_invite_limit'],
    'Funding Charges': ['funding_charge_enabled', 'funding_charge_type', 'funding_charge_value', 'funding_charge_min_deposit', 'funding_charge_max_deposit', 'funding_charge_display_text'],
    'Transaction Limits': ['min_transaction_amount', 'max_transaction_amount', 'max_wallet_balance'],
    'System': ['maintenance_mode'],
  };

  // Services configuration
  const services = [
    { id: 'airtime', name: 'Airtime Recharge', description: 'Buy airtime for any network instantly' },
    { id: 'data', name: 'Data Bundles', description: 'Purchase data plans for any network' },
    { id: 'electricity', name: 'Electricity Bills', description: 'Pay electricity bills for any DISCO' },
    { id: 'tv', name: 'TV Subscriptions', description: 'Pay for DSTV, GOTV, and Startimes' },
    { id: 'waec', name: 'WAEC Scratch Cards', description: 'Purchase WAEC scratch cards instantly' },
    { id: 'voucher', name: 'Redeem Voucher', description: 'Redeem vouchers and gift cards' },
    { id: 'support', name: 'Support Tickets', description: 'Customer support ticket system' },
    { id: 'refer', name: 'Refer & Earn', description: 'Referral program for users' },
    { id: 'store', name: 'E-commerce Store', description: 'Online shopping for products' },
  ];

  // Function to determine if a setting should be shown based on dependencies
  const shouldShowSetting = (key: string): boolean => {
    if (key === 'referral_reward_data_size') {
      return formData['referral_reward_type'] === 'data_bundle';
    }
    if (key === 'referral_reward_airtime_amount') {
      return formData['referral_reward_type'] === 'airtime';
    }
    if (key === 'referral_reward_cash_amount') {
      return formData['referral_reward_type'] === 'wallet_credit';
    }
    if (key === 'funding_charge_type' || 
        key === 'funding_charge_value' || 
        key === 'funding_charge_min_deposit' || 
        key === 'funding_charge_max_deposit' || 
        key === 'funding_charge_display_text') {
      return formData['funding_charge_enabled'] === 'true';
    }
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure application settings, API tokens, and homepage content</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors disabled:opacity-50"
            >
              <Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Management Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Service Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Control which services are available to users. You can set services as active, disabled, or coming soon.
            </p>
          </div>
          
          <div className="p-6 space-y-6">
            {loadingServices ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
              </div>
            ) : (
              <div className="grid gap-6">
                {services.map((service) => (
                  <div key={service.id} className="flex items-start space-x-4 pb-6 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                    <div className="flex-shrink-0 mt-1">
                      {getServiceIcon(service.id)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{service.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
                        </div>
                        
                        <div className="min-w-[180px]">
                          <select
                            value={serviceConfig[service.id] || 'active'}
                            onChange={(e) => handleServiceStatusChange(service.id, e.target.value as ServiceStatus)}
                            disabled={savingService === service.id}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          >
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                            <option value="coming_soon">Coming Soon</option>
                          </select>
                          {savingService === service.id && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Saving...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Settings Categories */}
        <div className="space-y-8">
          {Object.entries(settingCategories).map(([category, settingKeys]) => (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{category}</h2>
                {category === 'API Configuration' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure SME Plug and Flutterwave integration settings for services
                  </p>
                )}
                {category === 'General' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure site name, logo, and base URL for the application
                  </p>
                )}
                {category === 'Footer Information' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage contact information and company details displayed in the website footer
                  </p>
                )}
                {category === 'Referral System' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure referral bonus percentages and data rewards for user referrals
                  </p>
                )}
                {category === 'Funding Charges' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure charges applied to wallet funding transactions
                  </p>
                )}
                {category === 'Service Providers' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure which service providers to use for different services. Currently using SME Plug for airtime and data.
                  </p>
                )}
                {category === 'SME Plug Configuration' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 dark:text-green-100 text-sm mb-2">
                      SME Plug API Configuration
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      SME Plug API token is configured in Supabase Edge Function environment variables. 
                      Contact your developer to update the <code className="bg-green-100 dark:bg-green-800 px-1 rounded">VITE_SME_PLUG_TOKEN</code> secret.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                {settingKeys.map(key => {
                  const setting = settings.find(s => s.key === key);
                  if (!setting || !shouldShowSetting(key)) return null;

                  return (
                    <div key={key} className="flex items-start space-x-4">
                      <div className="flex-shrink-0 mt-1">
                        {getSettingIcon(key)}
                      </div>
                      
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {setting.description}
                        </p>
                        
                        {setting.key === 'airtime_provider' ? (
                          <div className="space-y-2">
                            <select
                              value={formData[key] || setting.value}
                              onChange={(e) => handleChange(key, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                            >
                              <option value="smeplug">SME Plug (Default)</option>
                              {/* MASKAWA option hidden but kept for future use */}
                              {/* <option value="maskawa">MASKAWA</option> */}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Currently using SME Plug for all airtime purchases
                            </p>
                          </div>
                        ) : setting.key === 'maintenance_mode' || 
                          setting.key === 'download_app_enabled' || 
                          setting.key === 'referral_reward_enabled' ||
                          setting.key === 'funding_charge_enabled' ? (
                          <select
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          >
                            <option value="false">Disabled</option>
                            <option value="true">Enabled</option>
                          </select>
                        ) : setting.key === 'referral_reward_type' ? (
                          <select
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          >
                            <option value="data_bundle">Data Bundle</option>
                            <option value="airtime">Airtime</option>
                            <option value="wallet_credit">Wallet Credit</option>
                          </select>
                        ) : setting.key === 'funding_charge_type' ? (
                          <select
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          >
                            <option value="percentage">Percentage</option>
                            <option value="fixed">Fixed Amount</option>
                          </select>
                        ) : setting.key === 'maskawa_token' || setting.key === 'flutterwave_encryption_key' ? (
                          <div className="relative">
                            <input
                              type={setting.key === 'maskawa_token' ? (showApiToken ? 'text' : 'password') : (showFlutterwaveEncryptionKey ? 'text' : 'password')}
                              value={formData[key] || setting.value}
                              onChange={(e) => handleChange(key, e.target.value)}
                              placeholder={setting.key === 'maskawa_token' ? "Enter MASKAWA API token" : "Enter Flutterwave encryption key"}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                            />
                            <button
                              type="button"
                              onClick={() => setting.key === 'maskawa_token' ? setShowApiToken(!showApiToken) : setShowFlutterwaveEncryptionKey(!showFlutterwaveEncryptionKey)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              {setting.key === 'maskawa_token' ? (
                                showApiToken ? (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-400" />
                                )
                              ) : (
                                showFlutterwaveEncryptionKey ? (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-400" />
                                )
                              )}
                            </button>
                          </div>
                        ) : setting.key.includes('image') || setting.key === 'site_logo_url' ? (
                          <div className="space-y-3">
                            <input
                              type="url"
                              value={formData[key] || setting.value}
                              onChange={(e) => handleChange(key, e.target.value)}
                              placeholder="Enter image URL (e.g., https://images.pexels.com/...)"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                            />
                            {(formData[key] || setting.value) && (
                              <div className="relative">
                                <img
                                  src={formData[key] || setting.value}
                                  alt="Banner preview"
                                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                  Preview
                                </div>
                              </div>
                            )}
                          </div>
                        ) : setting.key.includes('title') || setting.key.includes('subtitle') || setting.key.includes('address') || setting.key === 'funding_charge_display_text' ? (
                          <textarea
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            rows={setting.key.includes('subtitle') || setting.key.includes('address') || setting.key === 'funding_charge_display_text' ? 3 : 2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          />
                        ) : setting.key.includes('url') || setting.key === 'app_base_url' ? (
                          <input
                            type="url"
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            placeholder="Enter URL"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          />
                        ) : setting.key.includes('percentage') || setting.key.includes('amount') || setting.key.includes('balance') || setting.key === 'referral_reward_count' || setting.key === 'referral_invite_limit' || setting.key === 'funding_charge_value' || setting.key === 'funding_charge_min_deposit' || setting.key === 'funding_charge_max_deposit' ? (
                          <input
                            type="number"
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                            min="0"
                            step={setting.key.includes('percentage') || setting.key === 'funding_charge_value' && formData['funding_charge_type'] === 'percentage' ? '0.1' : '1'}
                          />
                        ) : setting.key.includes('email') ? (
                          <input
                            type="email"
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          />
                        ) : setting.key.includes('phone') ? (
                          <input
                            type="tel"
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData[key] || setting.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                          />
                        )}
                        
                        {setting.key === 'maskawa_token' && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                            ⚠️ Keep this token secure. It's used for all service transactions.
                          </p>
                        )}
                        
                        {setting.key === 'maskawa_base_url' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Base URL for MASKAWASUBAPI (usually https://maskawasubapi.com)
                          </p>
                        )}

                        {setting.key === 'flutterwave_public_key' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Flutterwave public key for client-side integration (starts with FLWPUBK-)
                          </p>
                        )}

                        {setting.key === 'flutterwave_encryption_key' && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                            ⚠️ Keep this encryption key secure. It's used to encrypt sensitive payment data.
                          </p>
                        )}

                        {setting.key === 'app_base_url' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Base URL for the application, used for referral links and other external URLs (e.g., https://example.com)
                          </p>
                        )}

                        {setting.key === 'site_name' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            The name of your application, displayed throughout the site
                          </p>
                        )}

                        {setting.key === 'site_logo_url' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            URL to your site logo image (recommended size: 512x512px)
                          </p>
                        )}

                        {setting.key === 'footer_company_name' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Company name displayed in the footer and legal documents
                          </p>
                        )}

                        {setting.key === 'footer_email' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Contact email address displayed in footer and support pages
                          </p>
                        )}

                        {setting.key === 'footer_phone' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Contact phone number displayed in footer
                          </p>
                        )}

                        {setting.key === 'footer_address' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Business address displayed in footer
                          </p>
                        )}
                        {setting.key === 'referral_reward_enabled' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enable or disable the data reward for users who refer others
                          </p>
                        )}

                        {setting.key === 'referral_reward_count' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Number of referrals required to earn the data reward
                          </p>
                        )}

                        {setting.key === 'referral_invite_limit' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Maximum number of referrals a user can make before needing to claim a reward
                          </p>
                        )}

                        {setting.key === 'referral_reward_type' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Type of reward to give users for referring others
                          </p>
                        )}

                        {setting.key === 'referral_reward_data_size' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Size of the data reward (e.g., 1GB, 2GB, 5GB)
                          </p>
                        )}

                        {setting.key === 'referral_reward_airtime_amount' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Amount of airtime to reward (in local currency)
                          </p>
                        )}

                        {setting.key === 'referral_reward_cash_amount' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Amount of cash to credit to user's wallet
                          </p>
                        )}

                        {setting.key === 'funding_charge_enabled' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enable or disable service charges for wallet funding
                          </p>
                        )}

                        {setting.key === 'funding_charge_type' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Choose between percentage-based or fixed amount charges
                          </p>
                        )}

                        {setting.key === 'funding_charge_value' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formData['funding_charge_type'] === 'percentage' 
                              ? 'Percentage value (e.g., 1.5 for 1.5%)' 
                              : 'Fixed amount in local currency'}
                          </p>
                        )}

                        {setting.key === 'funding_charge_min_deposit' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Minimum deposit amount for charges to apply (0 for no minimum)
                          </p>
                        )}

                        {setting.key === 'funding_charge_max_deposit' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Maximum deposit amount for charges to apply (0 for no maximum)
                          </p>
                        )}

                        {setting.key === 'funding_charge_display_text' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Custom message to display to users about funding charges
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* API Integration Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            API Integration Information
          </h3>
          <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
            <p>• <strong>SME Plug API:</strong> Used for airtime and data bundle purchases</p>
            <p>• <strong>MASKAWA API:</strong> Used only for electricity bill payments (SME Plug doesn't support electricity)</p>
            <p>• <strong>Flutterwave Keys:</strong> Required for virtual account creation and payment processing</p>
            <p>• <strong>Security:</strong> API tokens are stored securely in Supabase Edge Function environment variables</p>
            <p>• <strong>Important Note:</strong> SME Plug and Flutterwave tokens must be set in your Supabase Edge Function secrets</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;