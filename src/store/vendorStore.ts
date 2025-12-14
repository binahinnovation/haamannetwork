/**
 * Vendor Store
 * Manages vendor shop state and operations
 * Requirements: 1.2, 1.5
 */

import { create } from 'zustand';
import type { VendorShop, CreateShopData, CreateShopResult, UpdateShopData } from '../types/vendor';
import { 
  getShopByUserId, 
  createShop as createShopService, 
  updateShop as updateShopService,
  getMarketplaceSettings
} from '../lib/vendorService';

type VendorState = {
  shop: VendorShop | null;
  loading: boolean;
  setupFee: number;
  error: string | null;
  fetchShop: (userId: string) => Promise<void>;
  createShop: (userId: string, data: CreateShopData) => Promise<CreateShopResult>;
  updateShop: (shopId: string, userId: string, data: UpdateShopData) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
};

export const useVendorStore = create<VendorState>((set, get) => ({
  shop: null,
  loading: false,
  setupFee: 500, // Default, will be fetched from settings
  error: null,

  fetchShop: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch shop and marketplace settings in parallel
      const [shop, settings] = await Promise.all([
        getShopByUserId(userId),
        getMarketplaceSettings()
      ]);

      set({ 
        shop, 
        setupFee: settings?.setup_fee ?? 500,
        loading: false 
      });
    } catch (error) {
      console.error('Error fetching shop:', error);
      set({ loading: false, error: 'Failed to fetch shop data' });
    }
  },

  createShop: async (userId: string, data: CreateShopData): Promise<CreateShopResult> => {
    set({ loading: true, error: null });
    try {
      const result = await createShopService(userId, data);
      
      if (result.success && result.shop) {
        set({ shop: result.shop, loading: false });
      } else {
        set({ loading: false });
        if (result.error === 'insufficient_balance') {
          set({ error: 'Insufficient wallet balance to create shop' });
        } else if (result.error === 'already_vendor') {
          set({ error: 'You already have a shop' });
        } else {
          set({ error: 'Failed to create shop' });
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error creating shop:', error);
      set({ loading: false, error: 'Failed to create shop' });
      return { success: false, error: 'creation_failed' };
    }
  },

  updateShop: async (shopId: string, userId: string, data: UpdateShopData): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const updatedShop = await updateShopService(shopId, userId, data);
      
      if (updatedShop) {
        set({ shop: updatedShop, loading: false });
        return true;
      } else {
        set({ loading: false, error: 'Failed to update shop' });
        return false;
      }
    } catch (error) {
      console.error('Error updating shop:', error);
      set({ loading: false, error: 'Failed to update shop' });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ shop: null, loading: false, setupFee: 500, error: null }),
}));
