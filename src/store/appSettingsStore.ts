import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AppSettingsState = {
  siteName: string;
  siteLogoUrl: string;
  appBaseUrl: string;
  footerPhone: string;
  footerEmail: string;
  footerAddress: string;
  footerCompanyName: string;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  siteName: 'Haaman Network', // Default fallback value
  siteLogoUrl: '/logos/arab_network.png', // Default fallback value (served from public)
  appBaseUrl: 'https://haamannetwork.com', // Default fallback value
  footerPhone: '+234 907 599 2464', // Default fallback value
  footerEmail: 'support@haamannetwork.com', // Default fallback value
  footerAddress: 'Lagos, Nigeria', // Default fallback value
  footerCompanyName: 'Haaman Network', // Default fallback value
  isLoading: false,
  error: null,
  
  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['site_name', 'site_logo_url', 'app_base_url', 'footer_phone', 'footer_email', 'footer_address', 'footer_company_name']);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach(setting => {
        settings[setting.key] = setting.value;
      });

      set({
        siteName: settings.site_name || 'Haaman Network',
        siteLogoUrl: settings.site_logo_url || '/logos/arab_network.png',
        appBaseUrl: settings.app_base_url || 'https://haamannetwork.com',
        footerPhone: settings.footer_phone || '+234 907 599 2464',
        footerEmail: settings.footer_email || 'support@haamannetwork.com',
        footerAddress: settings.footer_address || 'Lagos, Nigeria',
        footerCompanyName: settings.footer_company_name || 'Haaman Network',
        isLoading: false
      });
      
      // Update document title
      document.title = settings.site_name || 'Haaman Network';
    } catch (error) {
      console.error('Error fetching app settings:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch app settings',
        isLoading: false
      });
    }
  }
}));