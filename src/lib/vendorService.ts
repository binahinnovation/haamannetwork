/**
 * Vendor Service
 * Handles shop creation and management operations
 * Requirements: 1.3, 1.4, 1.5, 1.6
 */

import { supabase } from './supabase';
import { generateTransactionReference } from './utils';
import type { 
  VendorShop, 
  CreateShopData, 
  CreateShopResult, 
  UpdateShopData,
  MarketplaceSettings,
  SubscriptionResult,
  SubscriptionHistory
} from '../types/vendor';

/**
 * Gets the current marketplace settings
 * @returns The marketplace settings or null if not found
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
 * Gets the user's wallet balance
 * @param userId - The user ID
 * @returns The wallet balance or null if not found
 */
export async function getUserWalletBalance(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching wallet balance:', error);
    return null;
  }

  return data?.wallet_balance ?? null;
}

/**
 * Gets a vendor shop by user ID
 * @param userId - The user ID
 * @returns The vendor shop or null if not found
 */
export async function getShopByUserId(userId: string): Promise<VendorShop | null> {
  const { data, error } = await supabase
    .from('vendor_shops')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user doesn't have a shop
      return null;
    }
    console.error('Error fetching shop:', error);
    return null;
  }

  return data;
}

/**
 * Creates a new vendor shop
 * Requirements: 1.3, 1.4, 1.5, 1.6
 * 
 * @param userId - The user ID creating the shop
 * @param shopData - The shop data (name, description)
 * @returns CreateShopResult with success status and shop or error
 */
export async function createShop(
  userId: string,
  shopData: CreateShopData
): Promise<CreateShopResult> {
  // Check if user already has a shop
  const existingShop = await getShopByUserId(userId);
  if (existingShop) {
    return { success: false, error: 'already_vendor' };
  }

  // Get marketplace settings for setup fee
  const settings = await getMarketplaceSettings();
  if (!settings) {
    return { success: false, error: 'creation_failed' };
  }

  const setupFee = settings.setup_fee;

  // Check wallet balance (Requirement 1.3)
  const walletBalance = await getUserWalletBalance(userId);
  if (walletBalance === null) {
    return { success: false, error: 'creation_failed' };
  }

  // Verify sufficient balance (Requirement 1.4)
  if (walletBalance < setupFee) {
    return { success: false, error: 'insufficient_balance' };
  }

  // Start transaction - deduct fee and create shop
  const reference = generateTransactionReference();
  const subscriptionDueDate = new Date();
  subscriptionDueDate.setMonth(subscriptionDueDate.getMonth() + 1);

  try {
    // Deduct setup fee from wallet (Requirement 1.5)
    const { error: walletError } = await supabase
      .from('profiles')
      .update({ wallet_balance: walletBalance - setupFee })
      .eq('id', userId);

    if (walletError) {
      console.error('Error deducting setup fee:', walletError);
      return { success: false, error: 'creation_failed' };
    }

    // Create the shop
    const { data: shop, error: shopError } = await supabase
      .from('vendor_shops')
      .insert({
        user_id: userId,
        name: shopData.name,
        description: shopData.description,
        status: 'active',
        subscription_due_date: subscriptionDueDate.toISOString(),
        last_subscription_paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (shopError) {
      // Rollback wallet deduction
      await supabase
        .from('profiles')
        .update({ wallet_balance: walletBalance })
        .eq('id', userId);
      
      console.error('Error creating shop:', shopError);
      return { success: false, error: 'creation_failed' };
    }

    // Record transaction (Requirement 1.6)
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'shop_setup_fee',
        amount: setupFee,
        status: 'success',
        reference,
        details: {
          shop_id: shop.id,
          shop_name: shopData.name,
          fee_type: 'setup',
        },
      });

    if (txError) {
      console.error('Error recording transaction:', txError);
      // Don't fail the operation, shop was created successfully
    }

    return { success: true, shop };
  } catch (error) {
    console.error('Shop creation exception:', error);
    return { success: false, error: 'creation_failed' };
  }
}

/**
 * Updates an existing vendor shop
 * @param shopId - The shop ID to update
 * @param userId - The user ID (for ownership verification)
 * @param updateData - The data to update
 * @returns The updated shop or null if failed
 */
export async function updateShop(
  shopId: string,
  userId: string,
  updateData: UpdateShopData
): Promise<VendorShop | null> {
  // Verify ownership
  const existingShop = await getShopByUserId(userId);
  if (!existingShop || existingShop.id !== shopId) {
    console.error('Shop not found or user does not own this shop');
    return null;
  }

  const { data, error } = await supabase
    .from('vendor_shops')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating shop:', error);
    return null;
  }

  return data;
}

/**
 * Gets a shop by ID (for public viewing)
 * @param shopId - The shop ID
 * @returns The shop or null if not found
 */
export async function getShopById(shopId: string): Promise<VendorShop | null> {
  const { data, error } = await supabase
    .from('vendor_shops')
    .select('*')
    .eq('id', shopId)
    .single();

  if (error) {
    console.error('Error fetching shop by ID:', error);
    return null;
  }

  return data;
}

/**
 * Gets shops that are due for subscription billing
 * @returns Array of shops due for billing
 */
export async function getShopsDueForBilling(): Promise<VendorShop[]> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('vendor_shops')
    .select('*')
    .eq('status', 'active')
    .eq('admin_override', false)
    .lte('subscription_due_date', now);

  if (error) {
    console.error('Error fetching shops due for billing:', error);
    return [];
  }

  return data || [];
}

/**
 * Process subscription billing for a single shop
 * Requirements: 3.1, 3.2, 3.3, 6.4
 * 
 * @param shopId - The shop ID to process billing for
 * @returns SubscriptionResult with success status
 */
export async function processSubscription(shopId: string): Promise<SubscriptionResult> {
  // Get the shop
  const { data: shop, error: shopError } = await supabase
    .from('vendor_shops')
    .select('*, profiles!vendor_shops_user_id_fkey(wallet_balance)')
    .eq('id', shopId)
    .single();

  if (shopError || !shop) {
    console.error('Error fetching shop for billing:', shopError);
    return { success: false, shop_id: shopId, error: 'shop_not_found' };
  }

  // Skip if admin override is set (Requirement 8.4)
  if (shop.admin_override) {
    return { success: true, shop_id: shopId };
  }

  // Get marketplace settings for subscription fee
  const settings = await getMarketplaceSettings();
  if (!settings) {
    return { success: false, shop_id: shopId, error: 'processing_failed' };
  }

  // Use pending fee if set, otherwise use current fee (Requirement 6.4)
  // This ensures fee changes don't affect pending renewals
  const subscriptionFee = shop.pending_subscription_fee ?? settings.monthly_subscription_fee;
  const walletBalance = shop.profiles?.wallet_balance ?? 0;

  // Calculate billing period
  const billingPeriodStart = new Date(shop.subscription_due_date || new Date());
  const billingPeriodEnd = new Date(billingPeriodStart);
  billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

  // Check if wallet has sufficient balance (Requirement 3.1)
  if (walletBalance < subscriptionFee) {
    // Insufficient balance - disable shop (Requirement 3.3)
    const { error: updateError } = await supabase
      .from('vendor_shops')
      .update({ 
        status: 'disabled',
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId);

    if (updateError) {
      console.error('Error disabling shop:', updateError);
    }

    // Record failed subscription in history
    await supabase
      .from('subscription_history')
      .insert({
        shop_id: shopId,
        amount: subscriptionFee,
        status: 'failed',
        billing_period_start: billingPeriodStart.toISOString(),
        billing_period_end: billingPeriodEnd.toISOString(),
      });

    return { 
      success: false, 
      shop_id: shopId, 
      amount: subscriptionFee,
      error: 'insufficient_balance' 
    };
  }

  // Deduct subscription fee from wallet
  const reference = generateTransactionReference();
  const newBalance = walletBalance - subscriptionFee;

  try {
    // Update wallet balance
    const { error: walletError } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', shop.user_id);

    if (walletError) {
      console.error('Error deducting subscription fee:', walletError);
      return { success: false, shop_id: shopId, error: 'processing_failed' };
    }

    // Create transaction record (Requirement 3.2)
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: shop.user_id,
        type: 'shop_subscription',
        amount: subscriptionFee,
        status: 'success',
        reference,
        details: {
          shop_id: shopId,
          shop_name: shop.name,
          fee_type: 'subscription',
          billing_period_start: billingPeriodStart.toISOString(),
          billing_period_end: billingPeriodEnd.toISOString(),
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('Error recording transaction:', txError);
    }

    // Update shop subscription dates and lock in current fee for next cycle (Requirement 6.4)
    const { error: shopUpdateError } = await supabase
      .from('vendor_shops')
      .update({
        subscription_due_date: billingPeriodEnd.toISOString(),
        last_subscription_paid_at: new Date().toISOString(),
        pending_subscription_fee: settings.monthly_subscription_fee, // Lock in current fee for next cycle
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId);

    if (shopUpdateError) {
      console.error('Error updating shop subscription dates:', shopUpdateError);
    }

    // Record successful subscription in history (Requirement 3.2)
    await supabase
      .from('subscription_history')
      .insert({
        shop_id: shopId,
        amount: subscriptionFee,
        status: 'success',
        transaction_id: transaction?.id || null,
        billing_period_start: billingPeriodStart.toISOString(),
        billing_period_end: billingPeriodEnd.toISOString(),
      });

    return { 
      success: true, 
      shop_id: shopId, 
      amount: subscriptionFee 
    };
  } catch (error) {
    console.error('Subscription processing exception:', error);
    return { success: false, shop_id: shopId, error: 'processing_failed' };
  }
}

/**
 * Process billing for all shops due
 * @returns Array of subscription results
 */
export async function processAllDueSubscriptions(): Promise<SubscriptionResult[]> {
  const shopsDue = await getShopsDueForBilling();
  const results: SubscriptionResult[] = [];

  for (const shop of shopsDue) {
    const result = await processSubscription(shop.id);
    results.push(result);
  }

  return results;
}

/**
 * Attempt to reactivate a disabled shop by collecting outstanding fee
 * Requirements: 3.5, 3.6, 6.4
 * 
 * @param userId - The user ID whose shop to reactivate
 * @returns SubscriptionResult with success status
 */
export async function attemptShopReactivation(userId: string): Promise<SubscriptionResult | null> {
  // Get the user's disabled shop
  const { data: shop, error: shopError } = await supabase
    .from('vendor_shops')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'disabled')
    .eq('admin_override', false)
    .single();

  if (shopError || !shop) {
    // No disabled shop found or shop is admin-disabled
    return null;
  }

  // Get wallet balance
  const walletBalance = await getUserWalletBalance(userId);
  if (walletBalance === null) {
    return { success: false, shop_id: shop.id, error: 'processing_failed' };
  }

  // Get subscription fee - use pending fee if set (Requirement 6.4)
  const settings = await getMarketplaceSettings();
  if (!settings) {
    return { success: false, shop_id: shop.id, error: 'processing_failed' };
  }

  const subscriptionFee = shop.pending_subscription_fee ?? settings.monthly_subscription_fee;

  // Check if wallet has sufficient balance (Requirement 3.5)
  if (walletBalance < subscriptionFee) {
    return { 
      success: false, 
      shop_id: shop.id, 
      amount: subscriptionFee,
      error: 'insufficient_balance' 
    };
  }

  // Process the subscription payment
  const result = await processSubscription(shop.id);
  
  if (result.success) {
    // Reactivate the shop (Requirement 3.6)
    const { error: reactivateError } = await supabase
      .from('vendor_shops')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', shop.id);

    if (reactivateError) {
      console.error('Error reactivating shop:', reactivateError);
      return { success: false, shop_id: shop.id, error: 'processing_failed' };
    }
  }

  return result;
}

/**
 * Get subscription history for a shop
 * @param shopId - The shop ID
 * @returns Array of subscription history records
 */
export async function getSubscriptionHistory(shopId: string): Promise<SubscriptionHistory[]> {
  const { data, error } = await supabase
    .from('subscription_history')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscription history:', error);
    return [];
  }

  return data || [];
}

// Export for testing
export const vendorService = {
  getMarketplaceSettings,
  getUserWalletBalance,
  getShopByUserId,
  createShop,
  updateShop,
  getShopById,
  getShopsDueForBilling,
  processSubscription,
  processAllDueSubscriptions,
  attemptShopReactivation,
  getSubscriptionHistory,
};
