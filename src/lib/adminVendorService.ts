/**
 * Admin Vendor Service
 * Handles admin operations for vendor management
 * Requirements: 5.1, 6.1, 7.1, 8.1
 */

import { supabase } from './supabase';
import type { 
  VendorShop, 
  MarketplaceSettings, 
  VendorAuditLog, 
  ShopStatus,
  AuditLogFilters 
} from '../types/vendor';

/**
 * Fetches all vendor shops with optional search
 * Requirements: 5.1, 5.2, 5.3
 */
export async function fetchAllShops(searchTerm?: string): Promise<VendorShop[]> {
  let query = supabase
    .from('vendor_shops')
    .select(`
      *,
      profiles!vendor_shops_user_id_fkey (name)
    `)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching shops:', error);
    return [];
  }

  // Map the joined data and apply search filter
  let shops = (data || []).map((shop: any) => ({
    ...shop,
    vendor_name: shop.profiles?.name || 'Unknown',
  }));

  // Apply search filter if provided
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    shops = shops.filter(
      (shop: VendorShop) =>
        shop.name.toLowerCase().includes(term) ||
        (shop.vendor_name && shop.vendor_name.toLowerCase().includes(term))
    );
  }

  return shops;
}

/**
 * Gets a single shop by ID with full details
 * Requirements: 5.4
 */
export async function getShopDetails(shopId: string): Promise<VendorShop | null> {
  const { data, error } = await supabase
    .from('vendor_shops')
    .select(`
      *,
      profiles!vendor_shops_user_id_fkey (name)
    `)
    .eq('id', shopId)
    .single();

  if (error) {
    console.error('Error fetching shop details:', error);
    return null;
  }

  // Get product count
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId);

  return {
    ...data,
    vendor_name: data.profiles?.name || 'Unknown',
    product_count: count || 0,
  };
}

/**
 * Updates shop status with admin override
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export async function updateShopStatus(
  shopId: string,
  adminId: string,
  status: ShopStatus,
  reason?: string
): Promise<boolean> {
  const adminOverride = status === 'admin_disabled';

  const { error: updateError } = await supabase
    .from('vendor_shops')
    .update({
      status,
      admin_override: adminOverride,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId);

  if (updateError) {
    console.error('Error updating shop status:', updateError);
    return false;
  }

  // Log the action
  const { error: logError } = await supabase
    .from('vendor_audit_logs')
    .insert({
      admin_id: adminId,
      action: 'status_override',
      target_shop_id: shopId,
      details: {
        new_value: status,
        reason: reason || 'No reason provided',
      },
    });

  if (logError) {
    console.error('Error logging status change:', logError);
  }

  return true;
}

/**
 * Toggles shop verification status
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export async function toggleVerification(
  shopId: string,
  adminId: string,
  verified: boolean
): Promise<boolean> {
  // Get current status for logging
  const { data: currentShop } = await supabase
    .from('vendor_shops')
    .select('is_verified')
    .eq('id', shopId)
    .single();

  const { error: updateError } = await supabase
    .from('vendor_shops')
    .update({
      is_verified: verified,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId);

  if (updateError) {
    console.error('Error updating verification status:', updateError);
    return false;
  }

  // Log the action
  const { error: logError } = await supabase
    .from('vendor_audit_logs')
    .insert({
      admin_id: adminId,
      action: 'verification_change',
      target_shop_id: shopId,
      details: {
        previous_value: currentShop?.is_verified,
        new_value: verified,
      },
    });

  if (logError) {
    console.error('Error logging verification change:', logError);
  }

  return true;
}

/**
 * Gets marketplace settings
 * Requirements: 6.1
 */
export async function getMarketplaceSettings(): Promise<MarketplaceSettings | null> {
  const { data, error } = await supabase
    .from('marketplace_settings')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching marketplace settings:', error);
    return null;
  }

  return data;
}

/**
 * Updates subscription fee
 * Requirements: 6.2, 6.3
 */
export async function updateSubscriptionFee(
  adminId: string,
  newFee: number
): Promise<boolean> {
  // Get current fee for logging
  const currentSettings = await getMarketplaceSettings();
  if (!currentSettings) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('marketplace_settings')
    .update({
      monthly_subscription_fee: newFee,
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentSettings.id);

  if (updateError) {
    console.error('Error updating subscription fee:', updateError);
    return false;
  }

  // Log the action
  const { error: logError } = await supabase
    .from('vendor_audit_logs')
    .insert({
      admin_id: adminId,
      action: 'fee_change',
      target_shop_id: null,
      details: {
        previous_value: currentSettings.monthly_subscription_fee,
        new_value: newFee,
      },
    });

  if (logError) {
    console.error('Error logging fee change:', logError);
  }

  return true;
}

/**
 * Updates setup fee
 * Requirements: 6.2, 6.3
 */
export async function updateSetupFee(
  adminId: string,
  newFee: number
): Promise<boolean> {
  const currentSettings = await getMarketplaceSettings();
  if (!currentSettings) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('marketplace_settings')
    .update({
      setup_fee: newFee,
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentSettings.id);

  if (updateError) {
    console.error('Error updating setup fee:', updateError);
    return false;
  }

  // Log the action
  const { error: logError } = await supabase
    .from('vendor_audit_logs')
    .insert({
      admin_id: adminId,
      action: 'fee_change',
      target_shop_id: null,
      details: {
        fee_type: 'setup',
        previous_value: currentSettings.setup_fee,
        new_value: newFee,
      },
    });

  if (logError) {
    console.error('Error logging fee change:', logError);
  }

  return true;
}

/**
 * Fetches audit logs with optional filters
 * Requirements: 9.4
 */
export async function fetchAuditLogs(filters?: AuditLogFilters): Promise<VendorAuditLog[]> {
  let query = supabase
    .from('vendor_audit_logs')
    .select(`
      *,
      profiles!vendor_audit_logs_admin_id_fkey (name),
      vendor_shops!vendor_audit_logs_target_shop_id_fkey (name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.shopId) {
    query = query.eq('target_shop_id', filters.shopId);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }

  return (data || []).map((log: any) => ({
    ...log,
    admin_name: log.profiles?.name || 'Unknown',
    shop_name: log.vendor_shops?.name || null,
  }));
}

// Export for testing
export const adminVendorService = {
  fetchAllShops,
  getShopDetails,
  updateShopStatus,
  toggleVerification,
  getMarketplaceSettings,
  updateSubscriptionFee,
  updateSetupFee,
  fetchAuditLogs,
};
