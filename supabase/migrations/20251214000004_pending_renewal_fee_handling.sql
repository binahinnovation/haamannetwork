/*
  # Pending Renewal Fee Handling

  1. Schema Changes
    - Add `pending_subscription_fee` column to vendor_shops table
    - This stores the fee at the time of billing cycle start

  2. Function Updates
    - Update process_shop_subscription to use pending fee if set
    - Add function to set pending fee when billing cycle starts

  3. Requirements Coverage
    - Requirements 6.4: Retain previous fee for pending subscription renewals
*/

-- ============================================
-- Add pending_subscription_fee column to vendor_shops
-- Requirements: 6.4
-- ============================================
ALTER TABLE vendor_shops 
ADD COLUMN IF NOT EXISTS pending_subscription_fee decimal(10,2) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN vendor_shops.pending_subscription_fee IS 
  'Stores the subscription fee at the time the billing cycle started. Used to ensure fee changes do not affect pending renewals.';

-- ============================================
-- Function to set pending fee when billing cycle starts
-- Requirements: 6.4
-- ============================================
CREATE OR REPLACE FUNCTION set_pending_subscription_fee(shop_uuid uuid)
RETURNS void AS $$
DECLARE
  settings_record RECORD;
BEGIN
  -- Get current subscription fee
  SELECT * INTO settings_record FROM marketplace_settings LIMIT 1;
  
  -- Set the pending fee for this shop
  UPDATE vendor_shops 
  SET pending_subscription_fee = settings_record.monthly_subscription_fee
  WHERE id = shop_uuid 
    AND pending_subscription_fee IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Update process_shop_subscription to use pending fee
-- Requirements: 6.4
-- ============================================
CREATE OR REPLACE FUNCTION process_shop_subscription(shop_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  shop_record RECORD;
  settings_record RECORD;
  wallet_balance_val decimal(10,2);
  subscription_fee decimal(10,2);
  new_balance decimal(10,2);
  billing_start timestamptz;
  billing_end timestamptz;
  tx_reference text;
  tx_id uuid;
  result jsonb;
BEGIN
  -- Get shop details
  SELECT * INTO shop_record FROM vendor_shops WHERE id = shop_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;
  
  -- Skip if admin override is set (Requirement 8.4)
  IF shop_record.admin_override THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'admin_override');
  END IF;
  
  -- Get marketplace settings
  SELECT * INTO settings_record FROM marketplace_settings LIMIT 1;
  
  -- Use pending fee if set, otherwise use current fee (Requirement 6.4)
  -- This ensures fee changes don't affect pending renewals
  IF shop_record.pending_subscription_fee IS NOT NULL THEN
    subscription_fee := shop_record.pending_subscription_fee;
  ELSE
    subscription_fee := settings_record.monthly_subscription_fee;
  END IF;
  
  -- Get wallet balance
  SELECT wallet_balance INTO wallet_balance_val FROM profiles WHERE id = shop_record.user_id;
  
  -- Calculate billing period
  billing_start := COALESCE(shop_record.subscription_due_date, now());
  billing_end := billing_start + interval '1 month';
  
  -- Check if wallet has sufficient balance (Requirement 3.1)
  IF wallet_balance_val < subscription_fee THEN
    -- Insufficient balance - disable shop (Requirement 3.3)
    UPDATE vendor_shops 
    SET status = 'disabled', updated_at = now()
    WHERE id = shop_uuid;
    
    -- Record failed subscription in history
    INSERT INTO subscription_history (shop_id, amount, status, billing_period_start, billing_period_end)
    VALUES (shop_uuid, subscription_fee, 'failed', billing_start, billing_end);
    
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'insufficient_balance',
      'shop_id', shop_uuid,
      'amount', subscription_fee
    );
  END IF;
  
  -- Deduct subscription fee from wallet
  new_balance := wallet_balance_val - subscription_fee;
  tx_reference := 'TRX-' || upper(substr(md5(random()::text), 1, 8));
  
  -- Update wallet balance
  UPDATE profiles SET wallet_balance = new_balance WHERE id = shop_record.user_id;
  
  -- Create transaction record (Requirement 3.2)
  INSERT INTO transactions (user_id, type, amount, status, reference, details)
  VALUES (
    shop_record.user_id,
    'shop_subscription',
    subscription_fee,
    'success',
    tx_reference,
    jsonb_build_object(
      'shop_id', shop_uuid,
      'shop_name', shop_record.name,
      'fee_type', 'subscription',
      'billing_period_start', billing_start,
      'billing_period_end', billing_end,
      'fee_locked_at_cycle_start', shop_record.pending_subscription_fee IS NOT NULL
    )
  )
  RETURNING id INTO tx_id;
  
  -- Update shop subscription dates and set new pending fee for next cycle
  UPDATE vendor_shops 
  SET 
    subscription_due_date = billing_end,
    last_subscription_paid_at = now(),
    pending_subscription_fee = settings_record.monthly_subscription_fee, -- Lock in current fee for next cycle
    updated_at = now()
  WHERE id = shop_uuid;
  
  -- Record successful subscription in history (Requirement 3.2)
  INSERT INTO subscription_history (shop_id, amount, status, transaction_id, billing_period_start, billing_period_end)
  VALUES (shop_uuid, subscription_fee, 'success', tx_id, billing_start, billing_end);
  
  RETURN jsonb_build_object(
    'success', true,
    'shop_id', shop_uuid,
    'amount', subscription_fee,
    'transaction_id', tx_id,
    'fee_was_locked', shop_record.pending_subscription_fee IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Update attempt_shop_reactivation to handle pending fees
-- Requirements: 3.5, 3.6, 6.4
-- ============================================
CREATE OR REPLACE FUNCTION attempt_shop_reactivation(user_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  shop_record RECORD;
  settings_record RECORD;
  wallet_balance_val decimal(10,2);
  subscription_fee decimal(10,2);
  billing_result jsonb;
BEGIN
  -- Get the user's disabled shop (not admin-disabled)
  SELECT * INTO shop_record 
  FROM vendor_shops 
  WHERE user_id = user_uuid 
    AND status = 'disabled' 
    AND admin_override = false
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No disabled shop found
    RETURN jsonb_build_object('success', false, 'reason', 'no_disabled_shop');
  END IF;
  
  -- Get wallet balance
  SELECT wallet_balance INTO wallet_balance_val FROM profiles WHERE id = user_uuid;
  
  -- Get subscription fee - use pending fee if set (Requirement 6.4)
  SELECT * INTO settings_record FROM marketplace_settings LIMIT 1;
  
  IF shop_record.pending_subscription_fee IS NOT NULL THEN
    subscription_fee := shop_record.pending_subscription_fee;
  ELSE
    subscription_fee := settings_record.monthly_subscription_fee;
  END IF;
  
  -- Check if wallet has sufficient balance (Requirement 3.5)
  IF wallet_balance_val < subscription_fee THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'insufficient_balance',
      'shop_id', shop_record.id,
      'required', subscription_fee,
      'available', wallet_balance_val
    );
  END IF;
  
  -- Process the subscription payment
  billing_result := process_shop_subscription(shop_record.id);
  
  IF (billing_result->>'success')::boolean THEN
    -- Reactivate the shop (Requirement 3.6)
    UPDATE vendor_shops 
    SET status = 'active', updated_at = now()
    WHERE id = shop_record.id;
    
    RETURN jsonb_build_object(
      'success', true,
      'shop_id', shop_record.id,
      'reactivated', true,
      'amount', subscription_fee
    );
  END IF;
  
  RETURN billing_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger to set pending fee when shop is created
-- ============================================
CREATE OR REPLACE FUNCTION set_initial_pending_fee()
RETURNS TRIGGER AS $$
DECLARE
  settings_record RECORD;
BEGIN
  -- Get current subscription fee
  SELECT * INTO settings_record FROM marketplace_settings LIMIT 1;
  
  -- Set the pending fee for the new shop
  NEW.pending_subscription_fee := settings_record.monthly_subscription_fee;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_initial_pending_fee_trigger ON vendor_shops;
CREATE TRIGGER set_initial_pending_fee_trigger
  BEFORE INSERT ON vendor_shops
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_pending_fee();
