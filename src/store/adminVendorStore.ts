/**
 * Admin Vendor Store
 * Manages admin vendor management state and operations
 * Requirements: 5.1, 6.1, 7.1, 8.1
 */

import { create } from 'zustand';
import type { 
  VendorShop, 
  MarketplaceSettings, 
  VendorAuditLog, 
  ShopStatus,
  AuditLogFilters 
} from '../types/vendor';
import {
  fetchAllShops as fetchAllShopsService,
  getShopDetails as getShopDetailsService,
  updateShopStatus as updateShopStatusService,
  toggleVerification as toggleVerificationService,
  getMarketplaceSettings as getMarketplaceSettingsService,
  updateSubscriptionFee as updateSubscriptionFeeService,
  updateSetupFee as updateSetupFeeService,
  fetchAuditLogs as fetchAuditLogsService,
} from '../lib/adminVendorService';

type AdminVendorState = {
  shops: VendorShop[];
  selectedShop: VendorShop | null;
  settings: MarketplaceSettings | null;
  auditLogs: VendorAuditLog[];
  loading: boolean;
  error: string | null;
  
  // Shop management
  fetchAllShops: (searchTerm?: string) => Promise<void>;
  getShopDetails: (shopId: string) => Promise<VendorShop | null>;
  updateShopStatus: (shopId: string, adminId: string, status: ShopStatus, reason?: string) => Promise<boolean>;
  toggleVerification: (shopId: string, adminId: string, verified: boolean) => Promise<boolean>;
  
  // Settings management
  fetchSettings: () => Promise<void>;
  updateSubscriptionFee: (adminId: string, newFee: number) => Promise<boolean>;
  updateSetupFee: (adminId: string, newFee: number) => Promise<boolean>;
  
  // Audit logs
  fetchAuditLogs: (filters?: AuditLogFilters) => Promise<void>;
  
  // Utility
  clearError: () => void;
  reset: () => void;
};

export const useAdminVendorStore = create<AdminVendorState>((set) => ({
  shops: [],
  selectedShop: null,
  settings: null,
  auditLogs: [],
  loading: false,
  error: null,

  fetchAllShops: async (searchTerm?: string) => {
    set({ loading: true, error: null });
    try {
      const shops = await fetchAllShopsService(searchTerm);
      set({ shops, loading: false });
    } catch (error) {
      console.error('Error fetching shops:', error);
      set({ loading: false, error: 'Failed to fetch shops' });
    }
  },

  getShopDetails: async (shopId: string): Promise<VendorShop | null> => {
    set({ loading: true, error: null });
    try {
      const shop = await getShopDetailsService(shopId);
      set({ selectedShop: shop, loading: false });
      return shop;
    } catch (error) {
      console.error('Error fetching shop details:', error);
      set({ loading: false, error: 'Failed to fetch shop details' });
      return null;
    }
  },

  updateShopStatus: async (
    shopId: string, 
    adminId: string, 
    status: ShopStatus, 
    reason?: string
  ): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const success = await updateShopStatusService(shopId, adminId, status, reason);
      
      if (success) {
        // Update local state
        set((state) => ({
          shops: state.shops.map((shop) =>
            shop.id === shopId 
              ? { ...shop, status, admin_override: status === 'admin_disabled' }
              : shop
          ),
          selectedShop: state.selectedShop?.id === shopId
            ? { ...state.selectedShop, status, admin_override: status === 'admin_disabled' }
            : state.selectedShop,
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to update shop status' });
        return false;
      }
    } catch (error) {
      console.error('Error updating shop status:', error);
      set({ loading: false, error: 'Failed to update shop status' });
      return false;
    }
  },

  toggleVerification: async (
    shopId: string, 
    adminId: string, 
    verified: boolean
  ): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const success = await toggleVerificationService(shopId, adminId, verified);
      
      if (success) {
        // Update local state
        set((state) => ({
          shops: state.shops.map((shop) =>
            shop.id === shopId ? { ...shop, is_verified: verified } : shop
          ),
          selectedShop: state.selectedShop?.id === shopId
            ? { ...state.selectedShop, is_verified: verified }
            : state.selectedShop,
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to update verification status' });
        return false;
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      set({ loading: false, error: 'Failed to update verification status' });
      return false;
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await getMarketplaceSettingsService();
      set({ settings, loading: false });
    } catch (error) {
      console.error('Error fetching settings:', error);
      set({ loading: false, error: 'Failed to fetch marketplace settings' });
    }
  },

  updateSubscriptionFee: async (adminId: string, newFee: number): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const success = await updateSubscriptionFeeService(adminId, newFee);
      
      if (success) {
        set((state) => ({
          settings: state.settings 
            ? { ...state.settings, monthly_subscription_fee: newFee }
            : null,
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to update subscription fee' });
        return false;
      }
    } catch (error) {
      console.error('Error updating subscription fee:', error);
      set({ loading: false, error: 'Failed to update subscription fee' });
      return false;
    }
  },

  updateSetupFee: async (adminId: string, newFee: number): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const success = await updateSetupFeeService(adminId, newFee);
      
      if (success) {
        set((state) => ({
          settings: state.settings 
            ? { ...state.settings, setup_fee: newFee }
            : null,
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to update setup fee' });
        return false;
      }
    } catch (error) {
      console.error('Error updating setup fee:', error);
      set({ loading: false, error: 'Failed to update setup fee' });
      return false;
    }
  },

  fetchAuditLogs: async (filters?: AuditLogFilters) => {
    set({ loading: true, error: null });
    try {
      const auditLogs = await fetchAuditLogsService(filters);
      set({ auditLogs, loading: false });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      set({ loading: false, error: 'Failed to fetch audit logs' });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ 
    shops: [], 
    selectedShop: null, 
    settings: null, 
    auditLogs: [], 
    loading: false, 
    error: null 
  }),
}));
