/*
  # Subscription Billing Triggers and Functions

  1. New Functions
    - `attempt_shop_reactivation` - Attempts to reactivate a disabled shop when wallet is funded
    - `process_shop_subscription` - Processes subscription billing for a single shop
    - `check_wallet_funding_reactivation` - Trigger function for wallet balance updates

  2. New Triggers
    - `wallet_funding_reactivation_trigger` - Fires on wallet balance update to check for shop reactivation

  3. Requirements Coverage
    - Requirements 3.5, 3.6: Wallet funding triggers reactivation
    - Requirements 3.1, 3.2, 3.3: Subscription billing processing
    - Requirements 8.4: Respect admin_override flag
*/

-- ============================================
-- Function to process subscription billing for a shop
-- Requirements: 3.1, 3.2, 3.3
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
  subscription_fee := settings_record.monthly_subscription_fee;
  
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
      'billing_period_end', billing_end
    )
  )
  RETURNING id INTO tx_id;
  
  -- Update shop subscription dates
  UPDATE vendor_shops 
  SET 
    subscription_due_date = billing_end,
    last_subscription_paid_at = now(),
    updated_at = now()
  WHERE id = shop_uuid;
  
  -- Record successful subscription in history (Requirement 3.2)
  INSERT INTO subscription_history (shop_id, amount, status, transaction_id, billing_period_start, billing_period_end)
  VALUES (shop_uuid, subscription_fee, 'success', tx_id, billing_start, billing_end);
  
  RETURN jsonb_build_object(
    'success', true,
    'shop_id', shop_uuid,
    'amount', subscription_fee,
    'transaction_id', tx_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to attempt shop reactivation
-- Requirements: 3.5, 3.6
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
  
  -- Get subscription fee
  SELECT * INTO settings_record FROM marketplace_settings LIMIT 1;
  subscription_fee := settings_record.monthly_subscription_fee;
  
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
-- Trigger function for wallet funding reactivation
-- Requirements: 3.5, 3.6
-- ============================================
CREATE OR REPLACE FUNCTION check_wallet_funding_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  reactivation_result jsonb;
BEGIN
  -- Only process if wallet balance increased
  IF NEW.wallet_balance > OLD.wallet_balance THEN
    -- Attempt to reactivate any disabled shop for this user
    reactivation_result := attempt_shop_reactivation(NEW.id);
    
    -- Log the attempt (optional, for debugging)
    IF (reactivation_result->>'success')::boolean AND (reactivation_result->>'reactivated')::boolean THEN
      RAISE NOTICE 'Shop reactivated for user %: %', NEW.id, reactivation_result;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create trigger on profiles table for wallet funding
-- ============================================
DROP TRIGGER IF EXISTS wallet_funding_reactivation_trigger ON profiles;
CREATE TRIGGER wallet_funding_reactivation_trigger
  AFTER UPDATE OF wallet_balance ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_wallet_funding_reactivation();

-- ============================================
-- Function to get shops due for billing
-- ============================================
CREATE OR REPLACE FUNCTION get_shops_due_for_billing()
RETURNS SETOF vendor_shops AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM vendor_shops
  WHERE status = 'active'
    AND admin_override = false
    AND subscription_due_date <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to process all due subscriptions
-- ============================================
CREATE OR REPLACE FUNCTION process_all_due_subscriptions()
RETURNS jsonb AS $$
DECLARE
  shop_record RECORD;
  result jsonb;
  results jsonb[] := '{}';
  processed_count int := 0;
  success_count int := 0;
  failed_count int := 0;
BEGIN
  FOR shop_record IN SELECT * FROM get_shops_due_for_billing() LOOP
    result := process_shop_subscription(shop_record.id);
    results := array_append(results, result);
    processed_count := processed_count + 1;
    
    IF (result->>'success')::boolean THEN
      success_count := success_count + 1;
    ELSE
      failed_count := failed_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', processed_count,
    'success', success_count,
    'failed', failed_count,
    'results', to_jsonb(results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
