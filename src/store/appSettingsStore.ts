import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AppSettingsState = {
  siteName: string;
  siteLogoUrl: string;
  appBaseUrl: string;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  siteName: 'Haaman Network', // Default fallback value
  siteLogoUrl: 'https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg', // Default fallback value
  appBaseUrl: 'https://haamannetwork.com', // Default fallback value
  isLoading: false,
  error: null,
  
  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['site_name', 'site_logo_url', 'app_base_url']);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach(setting => {
        settings[setting.key] = setting.value;
      });

      set({
        siteName: settings.site_name || 'Haaman Network',
        siteLogoUrl: settings.site_logo_url || 'https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg',
        appBaseUrl: settings.app_base_url || 'https://haamannetwork.com',
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