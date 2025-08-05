import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AppSettingsState {
  siteName: string;
  siteLogoUrl: string;
  appBaseUrl: string;
  footerPhone: string;
  footerEmail: string;
  footerAddress: string;
  footerCompanyName: string;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  siteName: 'Haaman Network',
  siteLogoUrl: '',
  appBaseUrl: 'https://haamannetwork.com',
  footerPhone: '',
  footerEmail: '',
  footerAddress: '',
  footerCompanyName: '',
  isLoading: false,

  fetchSettings: async () => {
    try {
      set({ isLoading: true });
      
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'site_name',
          'site_logo_url',
          'app_base_url',
          'footer_phone',
          'footer_email',
          'footer_address',
          'footer_company_name'
        ]);

      if (error) {
        console.error('Error fetching app settings:', error);
        return;
      }

      const settings: Record<string, string> = {};
      data?.forEach((setting) => {
        settings[setting.key] = setting.value;
      });

      set({
        siteName: settings.site_name || 'Haaman Network',
        siteLogoUrl: settings.site_logo_url || '',
        appBaseUrl: settings.app_base_url || 'https://haamannetwork.com',
        footerPhone: settings.footer_phone || '',
        footerEmail: settings.footer_email || '',
        footerAddress: settings.footer_address || '',
        footerCompanyName: settings.footer_company_name || '',
        isLoading: false,
      });
    } catch (error) {
      console.error('Error in fetchSettings:', error);
      set({ isLoading: false });
    }
  },
}));