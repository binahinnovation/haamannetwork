/**
 * Vendor Marketplace Types
 * Types for the multi-vendor marketplace feature
 */

/**
 * Vendor Shop - represents a vendor's storefront
 */
export type VendorShop = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_verified: boolean;
  status: 'active' | 'disabled' | 'admin_disabled';
  admin_override: boolean;
  subscription_due_date: string | null;
  last_subscription_paid_at: string | null;
  pending_subscription_fee: number | null; // Fee locked at billing cycle start (Requirement 6.4)
  created_at: string;
  updated_at: string;
  // Joined fields from queries
  vendor_name?: string;
  product_count?: number;
};

/**
 * Marketplace Settings - singleton configuration for the marketplace
 */
export type MarketplaceSettings = {
  id: string;
  setup_fee: number;
  monthly_subscription_fee: number;
  updated_at: string;
};

/**
 * Vendor Audit Log - tracks admin actions on vendor shops
 */
export type VendorAuditLog = {
  id: string;
  admin_id: string;
  action: 'fee_change' | 'verification_change' | 'status_override';
  target_shop_id: string | null;
  details: {
    previous_value?: unknown;
    new_value?: unknown;
    reason?: string;
    fee_type?: 'setup' | 'subscription';
  };
  created_at: string;
  // Joined fields from queries
  admin_name?: string;
  shop_name?: string;
};

/**
 * Subscription History - tracks subscription billing attempts
 */
export type SubscriptionHistory = {
  id: string;
  shop_id: string;
  amount: number;
  status: 'success' | 'failed';
  transaction_id: string | null;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
};

/**
 * Data required to create a new shop
 */
export type CreateShopData = {
  name: string;
  description: string;
};

/**
 * Result of shop creation attempt
 */
export type CreateShopResult = {
  success: boolean;
  shop?: VendorShop;
  error?: 'insufficient_balance' | 'already_vendor' | 'creation_failed';
};

/**
 * Data for updating an existing shop
 */
export type UpdateShopData = {
  name?: string;
  description?: string;
};

/**
 * Shop status type for admin operations
 */
export type ShopStatus = 'active' | 'disabled' | 'admin_disabled';

/**
 * Filters for querying audit logs
 */
export type AuditLogFilters = {
  action?: VendorAuditLog['action'];
  startDate?: string;
  endDate?: string;
  shopId?: string;
};

/**
 * Result of subscription processing
 */
export type SubscriptionResult = {
  success: boolean;
  shop_id: string;
  amount?: number;
  error?: 'insufficient_balance' | 'shop_not_found' | 'processing_failed';
};
