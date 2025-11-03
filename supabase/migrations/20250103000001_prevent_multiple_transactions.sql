/*
  # PREVENT MULTIPLE TRANSACTIONS - Race Condition Fix

  PROBLEM: Users can click purchase buttons multiple times causing:
  - Multiple transactions for the same purchase
  - Race conditions in balance deduction
  - Duplicate charges and services

  SOLUTION: 
  - Add transaction locking mechanism
  - Prevent duplicate transactions within time window
  - Add comprehensive transaction status tracking
*/

-- Create transaction locks table to prevent duplicate transactions
CREATE TABLE IF NOT EXISTS transaction_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  transaction_type text NOT NULL, -- 'airtime', 'data', 'electricity', etc.
  transaction_key text NOT NULL, -- Unique key for the transaction (phone+amount+type)
  status text NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '5 minutes'),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on transaction locks
ALTER TABLE transaction_locks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transaction locks
CREATE POLICY "Users can read own transaction locks"
  ON transaction_locks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only functions can manage transaction locks
CREATE POLICY "Only functions can manage transaction locks"
  ON transaction_locks
  FOR ALL
  TO authenticated
  WITH CHECK (false); -- Deny all direct access

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS transaction_locks_user_id_idx ON transaction_locks(user_id);
CREATE INDEX IF NOT EXISTS transaction_locks_transaction_key_idx ON transaction_locks(transaction_key);
CREATE INDEX IF NOT EXISTS transaction_locks_expires_at_idx ON transaction_locks(expires_at);
CREATE INDEX IF NOT EXISTS transaction_locks_status_idx ON transaction_locks(status);

-- Create unique constraint to prevent duplicate active locks
CREATE UNIQUE INDEX IF NOT EXISTS transaction_locks_unique_active 
  ON transaction_locks(user_id, transaction_key) 
  WHERE status = 'processing' AND expires_at > now();

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_transaction_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM transaction_locks 
  WHERE expires_at < now() 
    OR (status IN ('completed', 'failed') AND created_at < now() - interval '1 hour');
END;
$$;

-- Create secure function to acquire transaction lock
CREATE OR REPLACE FUNCTION acquire_transaction_lock(
  p_user_id uuid,
  p_transaction_type text,
  p_transaction_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_id uuid;
  v_existing_lock record;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_transaction_type IS NULL OR p_transaction_key IS NULL THEN
    RAISE EXCEPTION 'User ID, transaction type, and transaction key are required';
  END IF;

  -- Clean up expired locks first
  PERFORM cleanup_expired_transaction_locks();

  -- Check for existing active lock
  SELECT * INTO v_existing_lock
  FROM transaction_locks
  WHERE user_id = p_user_id 
    AND transaction_key = p_transaction_key
    AND status = 'processing'
    AND expires_at > now();

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Transaction already in progress',
      'lock_id', v_existing_lock.id,
      'expires_at', v_existing_lock.expires_at
    );
  END IF;

  -- Create new lock
  INSERT INTO transaction_locks (
    user_id, 
    transaction_type, 
    transaction_key, 
    metadata
  ) VALUES (
    p_user_id, 
    p_transaction_type, 
    p_transaction_key, 
    p_metadata
  ) RETURNING id INTO v_lock_id;

  RETURN json_build_object(
    'success', true,
    'lock_id', v_lock_id,
    'expires_at', now() + interval '5 minutes'
  );
END;
$$;

-- Create secure function to release transaction lock
CREATE OR REPLACE FUNCTION release_transaction_lock(
  p_lock_id uuid,
  p_status text DEFAULT 'completed'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate inputs
  IF p_lock_id IS NULL THEN
    RAISE EXCEPTION 'Lock ID is required';
  END IF;

  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Status must be either completed or failed';
  END IF;

  -- Update lock status
  UPDATE transaction_locks
  SET status = p_status,
      expires_at = now() -- Mark as expired immediately
  WHERE id = p_lock_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Lock not found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'lock_id', p_lock_id,
    'status', p_status
  );
END;
$$;

-- Enhanced secure purchase function with transaction locking
CREATE OR REPLACE FUNCTION process_secure_purchase_with_lock(
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
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
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
      'details', p_transaction_details
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
    FOR UPDATE; -- Critical: This locks the row until transaction completes
    
    -- Check if user exists
    IF NOT FOUND THEN
      -- Release lock before raising exception
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
      
      -- Release lock
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
    
    -- Log successful transaction
    INSERT INTO wallet_audit_log (
      user_id, transaction_type, amount, balance_before, balance_after,
      transaction_details, external_transaction_id, status
    ) VALUES (
      p_user_id, p_transaction_type, p_amount, v_current_balance, v_new_balance,
      p_transaction_details, p_external_transaction_id, 'success'
    ) RETURNING id INTO v_audit_id;
    
    -- Release lock as completed
    PERFORM release_transaction_lock(v_lock_id, 'completed');
    
    -- Return success
    v_result := json_build_object(
      'success', true,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance,
      'amount_deducted', p_amount,
      'audit_id', v_audit_id,
      'transaction_type', p_transaction_type,
      'lock_id', v_lock_id
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
GRANT EXECUTE ON FUNCTION acquire_transaction_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_transaction_lock TO authenticated;
GRANT EXECUTE ON FUNCTION process_secure_purchase_with_lock TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_transaction_locks TO authenticated;

-- Create a scheduled job to clean up expired locks (if pg_cron is available)
-- This is optional and depends on your Supabase plan
-- SELECT cron.schedule('cleanup-transaction-locks', '*/5 * * * *', 'SELECT cleanup_expired_transaction_locks();');

-- Create view for users to see their transaction locks
CREATE OR REPLACE VIEW user_transaction_locks AS
SELECT 
  id,
  transaction_type,
  transaction_key,
  status,
  created_at,
  expires_at,
  metadata
FROM transaction_locks
WHERE user_id = auth.uid()
  AND created_at > now() - interval '24 hours';

-- Grant access to the view
GRANT SELECT ON user_transaction_locks TO authenticated;