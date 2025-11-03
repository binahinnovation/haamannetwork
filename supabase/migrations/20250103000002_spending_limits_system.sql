/*
  # SPENDING LIMITS SYSTEM - Account Age Based Limits

  SECURITY FEATURE: Implement spending limits based on account age
  - New accounts (< 7 days): ₦3,000 daily limit
  - Established accounts (≥ 7 days): ₦10,000 daily limit
  
  This prevents fraud and reduces risk exposure from new accounts.
*/

-- Create spending limits configuration table
CREATE TABLE IF NOT EXISTS spending_limits_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_type text NOT NULL, -- 'new_account', 'established_account', 'premium_account', etc.
  daily_limit numeric NOT NULL,
  account_age_days integer NOT NULL, -- Minimum account age in days to qualify
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on spending limits config
ALTER TABLE spending_limits_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage spending limits
CREATE POLICY "Only admins can manage spending limits"
  ON spending_limits_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Insert default spending limits
INSERT INTO spending_limits_config (limit_type, daily_limit, account_age_days, description) VALUES
('new_account', 3000, 0, 'Daily spending limit for new accounts (less than 7 days old)'),
('established_account', 10000, 7, 'Daily spending limit for established accounts (7+ days old)')
ON CONFLICT DO NOTHING;

-- Create daily spending tracking table
CREATE TABLE IF NOT EXISTS daily_spending_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  spending_date date NOT NULL DEFAULT CURRENT_DATE,
  total_spent numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  last_transaction_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, spending_date)
);

-- Enable RLS on daily spending tracker
ALTER TABLE daily_spending_tracker ENABLE ROW LEVEL SECURITY;

-- Users can only see their own spending data
CREATE POLICY "Users can read own spending data"
  ON daily_spending_tracker
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only functions can manage spending data
CREATE POLICY "Only functions can manage spending data"
  ON daily_spending_tracker
  FOR ALL
  TO authenticated
  WITH CHECK (false);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS daily_spending_tracker_user_date_idx ON daily_spending_tracker(user_id, spending_date);
CREATE INDEX IF NOT EXISTS daily_spending_tracker_date_idx ON daily_spending_tracker(spending_date);
CREATE INDEX IF NOT EXISTS spending_limits_config_active_idx ON spending_limits_config(is_active, account_age_days);

-- Function to get user's spending limit based on account age
CREATE OR REPLACE FUNCTION get_user_spending_limit(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_age_days integer;
  v_spending_limit numeric;
  v_limit_type text;
  v_user_created_at timestamptz;
BEGIN
  -- Get user's account creation date
  SELECT created_at INTO v_user_created_at
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Calculate account age in days
  v_account_age_days := EXTRACT(DAY FROM (now() - v_user_created_at));
  
  -- Get appropriate spending limit based on account age
  SELECT daily_limit, limit_type INTO v_spending_limit, v_limit_type
  FROM spending_limits_config
  WHERE is_active = true
    AND account_age_days <= v_account_age_days
  ORDER BY account_age_days DESC
  LIMIT 1;
  
  -- Default to new account limit if no config found
  IF NOT FOUND THEN
    SELECT daily_limit, limit_type INTO v_spending_limit, v_limit_type
    FROM spending_limits_config
    WHERE limit_type = 'new_account' AND is_active = true;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'daily_limit', v_spending_limit,
    'limit_type', v_limit_type,
    'account_age_days', v_account_age_days,
    'account_created_at', v_user_created_at
  );
END;
$$;

-- Function to get user's current daily spending
CREATE OR REPLACE FUNCTION get_user_daily_spending(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_spent numeric := 0;
  v_transaction_count integer := 0;
BEGIN
  -- Get current daily spending
  SELECT total_spent, transaction_count INTO v_total_spent, v_transaction_count
  FROM daily_spending_tracker
  WHERE user_id = p_user_id AND spending_date = p_date;
  
  -- If no record exists, return zero values
  IF NOT FOUND THEN
    v_total_spent := 0;
    v_transaction_count := 0;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'total_spent', v_total_spent,
    'transaction_count', v_transaction_count,
    'spending_date', p_date
  );
END;
$$;

-- Function to check if transaction exceeds spending limit
CREATE OR REPLACE FUNCTION check_spending_limit(
  p_user_id uuid,
  p_transaction_amount numeric,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit_info json;
  v_spending_info json;
  v_daily_limit numeric;
  v_current_spent numeric;
  v_new_total numeric;
  v_limit_type text;
  v_account_age_days integer;
BEGIN
  -- Get user's spending limit
  SELECT get_user_spending_limit(p_user_id) INTO v_limit_info;
  
  IF NOT (v_limit_info->>'success')::boolean THEN
    RETURN v_limit_info;
  END IF;
  
  -- Get current daily spending
  SELECT get_user_daily_spending(p_user_id, p_transaction_date) INTO v_spending_info;
  
  -- Extract values
  v_daily_limit := (v_limit_info->>'daily_limit')::numeric;
  v_current_spent := (v_spending_info->>'total_spent')::numeric;
  v_limit_type := v_limit_info->>'limit_type';
  v_account_age_days := (v_limit_info->>'account_age_days')::integer;
  v_new_total := v_current_spent + p_transaction_amount;
  
  -- Check if transaction would exceed limit
  IF v_new_total > v_daily_limit THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Daily spending limit exceeded',
      'daily_limit', v_daily_limit,
      'current_spent', v_current_spent,
      'transaction_amount', p_transaction_amount,
      'would_be_total', v_new_total,
      'remaining_limit', GREATEST(0, v_daily_limit - v_current_spent),
      'limit_type', v_limit_type,
      'account_age_days', v_account_age_days
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'daily_limit', v_daily_limit,
    'current_spent', v_current_spent,
    'transaction_amount', p_transaction_amount,
    'new_total', v_new_total,
    'remaining_limit', v_daily_limit - v_new_total,
    'limit_type', v_limit_type,
    'account_age_days', v_account_age_days
  );
END;
$$;

-- Function to update daily spending tracker
CREATE OR REPLACE FUNCTION update_daily_spending(
  p_user_id uuid,
  p_transaction_amount numeric,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update daily spending record
  INSERT INTO daily_spending_tracker (user_id, spending_date, total_spent, transaction_count, last_transaction_at)
  VALUES (p_user_id, p_transaction_date, p_transaction_amount, 1, now())
  ON CONFLICT (user_id, spending_date)
  DO UPDATE SET
    total_spent = daily_spending_tracker.total_spent + p_transaction_amount,
    transaction_count = daily_spending_tracker.transaction_count + 1,
    last_transaction_at = now(),
    updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'transaction_amount', p_transaction_amount,
    'transaction_date', p_transaction_date
  );
END;
$$;

-- Enhanced secure purchase function with spending limits
CREATE OR REPLACE FUNCTION process_secure_purchase_with_limits(
  p_user_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_transaction_details jsonb DEFAULT '{}'::jsonb,
  p_external_transaction_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance numeric;
  v_audit_id uuid;
  v_lock_result json;
  v_lock_id uuid;
  v_transaction_key text;
  v_result json;
  v_spending_check json;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- CRITICAL: Check spending limits before processing
  SELECT check_spending_limit(p_user_id, p_amount) INTO v_spending_check;
  
  IF NOT (v_spending_check->>'success')::boolean THEN
    -- Log failed attempt due to spending limit
    INSERT INTO wallet_audit_log (
      user_id, transaction_type, amount, balance_before, balance_after,
      transaction_details, external_transaction_id, status, error_message
    ) VALUES (
      p_user_id, p_transaction_type, p_amount, 0, 0,
      jsonb_build_object(
        'original_details', p_transaction_details,
        'spending_limit_info', v_spending_check
      ), p_external_transaction_id, 'failed', 'Daily spending limit exceeded'
    );
    
    RETURN v_spending_check;
  END IF;

  -- Generate unique transaction key
  v_transaction_key := p_user_id::text || '_' || p_transaction_type || '_' || 
                      COALESCE(p_transaction_details->>'phoneNumber', '') || '_' || 
                      p_amount::text || '_' || 
                      extract(epoch from date_trunc('minute', now()))::text;

  -- Acquire transaction lock
  SELECT acquire_transaction_lock(
    p_user_id, 
    p_transaction_type, 
    v_transaction_key,
    jsonb_build_object(
      'amount', p_amount,
      'details', p_transaction_details,
      'spending_check', v_spending_check
    )
  ) INTO v_lock_result;

  -- Check if lock was acquired
  IF NOT (v_lock_result->>'success')::boolean THEN
    RETURN v_lock_result;
  END IF;

  v_lock_id := (v_lock_result->>'lock_id')::uuid;

  -- Start atomic transaction with row-level locking
  BEGIN
    -- Lock the user's profile row to prevent race conditions
    SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if user exists
    IF NOT FOUND THEN
      PERFORM release_transaction_lock(v_lock_id, 'failed');
      RAISE EXCEPTION 'User not found';
    END IF;
    
    -- CRITICAL: Validate sufficient balance
    IF v_current_balance < p_amount THEN
      -- Log failed attempt
      INSERT INTO wallet_audit_log (
        user_id, transaction_type, amount, balance_before, balance_after,
        transaction_details, external_transaction_id, status, error_message
      ) VALUES (
        p_user_id, p_transaction_type, p_amount, v_current_balance, v_current_balance,
        p_transaction_details, p_external_transaction_id, 'failed', 'Insufficient balance'
      ) RETURNING id INTO v_audit_id;
      
      PERFORM release_transaction_lock(v_lock_id, 'failed');
      
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'current_balance', v_current_balance,
        'required_amount', p_amount,
        'audit_id', v_audit_id
      );
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_amount;
    
    -- Update balance atomically
    UPDATE profiles
    SET wallet_balance = v_new_balance,
        updated_at = now()
    WHERE id = p_user_id;
    
    -- Update daily spending tracker
    PERFORM update_daily_spending(p_user_id, p_amount);
    
    -- Log successful transaction
    INSERT INTO wallet_audit_log (
      user_id, transaction_type, amount, balance_before, balance_after,
      transaction_details, external_transaction_id, status
    ) VALUES (
      p_user_id, p_transaction_type, p_amount, v_current_balance, v_new_balance,
      jsonb_build_object(
        'original_details', p_transaction_details,
        'spending_limit_info', v_spending_check
      ), p_external_transaction_id, 'success'
    ) RETURNING id INTO v_audit_id;
    
    -- Release lock as completed
    PERFORM release_transaction_lock(v_lock_id, 'completed');
    
    -- Return success with spending limit info
    v_result := json_build_object(
      'success', true,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance,
      'amount_deducted', p_amount,
      'audit_id', v_audit_id,
      'transaction_type', p_transaction_type,
      'lock_id', v_lock_id,
      'spending_limit_info', v_spending_check
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Release lock on any error
      PERFORM release_transaction_lock(v_lock_id, 'failed');
      
      -- Log the error
      INSERT INTO wallet_audit_log (
        user_id, transaction_type, amount, balance_before, balance_after,
        transaction_details, external_transaction_id, status, error_message
      ) VALUES (
        p_user_id, p_transaction_type, p_amount, 
        COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0),
        p_transaction_details, p_external_transaction_id, 'failed', SQLERRM
      );
      
      -- Re-raise the exception to trigger rollback
      RAISE;
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_spending_limit TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_daily_spending TO authenticated;
GRANT EXECUTE ON FUNCTION check_spending_limit TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_spending TO authenticated;
GRANT EXECUTE ON FUNCTION process_secure_purchase_with_limits TO authenticated;

-- Create view for users to see their spending limits and usage
CREATE OR REPLACE VIEW user_spending_summary AS
SELECT 
  p.id as user_id,
  p.name,
  p.email,
  EXTRACT(DAY FROM (now() - p.created_at)) as account_age_days,
  get_user_spending_limit(p.id) as limit_info,
  get_user_daily_spending(p.id) as today_spending
FROM profiles p
WHERE p.id = auth.uid();

-- Grant access to the view
GRANT SELECT ON user_spending_summary TO authenticated;

-- Create admin view for spending limits monitoring
CREATE OR REPLACE VIEW admin_spending_limits_overview AS
SELECT 
  p.id as user_id,
  p.name,
  p.email,
  p.created_at,
  EXTRACT(DAY FROM (now() - p.created_at)) as account_age_days,
  dst.spending_date,
  dst.total_spent,
  dst.transaction_count,
  get_user_spending_limit(p.id) as limit_info
FROM profiles p
LEFT JOIN daily_spending_tracker dst ON p.id = dst.user_id 
  AND dst.spending_date = CURRENT_DATE
ORDER BY dst.total_spent DESC NULLS LAST;

-- Grant access to admin view
GRANT SELECT ON admin_spending_limits_overview TO authenticated;