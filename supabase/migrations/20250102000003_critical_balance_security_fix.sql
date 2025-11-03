/*
  # CRITICAL SECURITY FIX - Balance Validation Exploit

  PROBLEM: Users can spend beyond their actual balance due to:
  - Race conditions in concurrent transactions
  - Lack of atomic balance validation
  - Client-side balance checks being bypassed
  - No row-level locking during transactions

  SOLUTION: Secure PostgreSQL functions with:
  - Atomic transactions with FOR UPDATE locking
  - Server-side balance validation
  - Comprehensive audit logging
  - Automatic rollback on failures
*/

-- Create audit log table for all balance operations
CREATE TABLE IF NOT EXISTS wallet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  transaction_type text NOT NULL, -- 'purchase', 'deposit', 'refund'
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  transaction_details jsonb,
  external_transaction_id text,
  status text NOT NULL DEFAULT 'success', -- 'success', 'failed', 'pending'
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE wallet_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY "Users can read own audit logs"
  ON wallet_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only functions can insert audit logs (no direct user access)
CREATE POLICY "Only functions can insert audit logs"
  ON wallet_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Deny all direct inserts

-- Create secure function to process purchases with atomic balance validation
CREATE OR REPLACE FUNCTION process_secure_purchase(
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
  v_result json;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Start atomic transaction with row-level locking
  BEGIN
    -- Lock the user's profile row to prevent race conditions
    SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE; -- Critical: This locks the row until transaction completes
    
    -- Check if user exists
    IF NOT FOUND THEN
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
    
    -- Return success
    v_result := json_build_object(
      'success', true,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance,
      'amount_deducted', p_amount,
      'audit_id', v_audit_id,
      'transaction_type', p_transaction_type
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
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

-- Create secure function to process deposits
CREATE OR REPLACE FUNCTION process_secure_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_deposit_details jsonb DEFAULT '{}'::jsonb,
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
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Start atomic transaction with row-level locking
  BEGIN
    -- Lock the user's profile row
    SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if user exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + p_amount;
    
    -- Update balance atomically
    UPDATE profiles
    SET wallet_balance = v_new_balance,
        updated_at = now()
    WHERE id = p_user_id;
    
    -- Log successful deposit
    INSERT INTO wallet_audit_log (
      user_id, transaction_type, amount, balance_before, balance_after,
      transaction_details, external_transaction_id, status
    ) VALUES (
      p_user_id, 'deposit', p_amount, v_current_balance, v_new_balance,
      p_deposit_details, p_external_transaction_id, 'success'
    ) RETURNING id INTO v_audit_id;
    
    -- Return success
    RETURN json_build_object(
      'success', true,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance,
      'amount_added', p_amount,
      'audit_id', v_audit_id
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      INSERT INTO wallet_audit_log (
        user_id, transaction_type, amount, balance_before, balance_after,
        transaction_details, external_transaction_id, status, error_message
      ) VALUES (
        p_user_id, 'deposit', p_amount, 
        COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0),
        p_deposit_details, p_external_transaction_id, 'failed', SQLERRM
      );
      
      -- Re-raise the exception to trigger rollback
      RAISE;
  END;
END;
$$;

-- Create secure function to process refunds
CREATE OR REPLACE FUNCTION process_secure_refund(
  p_user_id uuid,
  p_amount numeric,
  p_original_transaction_id text,
  p_refund_reason text,
  p_refund_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance numeric;
  v_audit_id uuid;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Start atomic transaction with row-level locking
  BEGIN
    -- Lock the user's profile row
    SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if user exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + p_amount;
    
    -- Update balance atomically
    UPDATE profiles
    SET wallet_balance = v_new_balance,
        updated_at = now()
    WHERE id = p_user_id;
    
    -- Log successful refund
    INSERT INTO wallet_audit_log (
      user_id, transaction_type, amount, balance_before, balance_after,
      transaction_details, external_transaction_id, status
    ) VALUES (
      p_user_id, 'refund', p_amount, v_current_balance, v_new_balance,
      jsonb_build_object(
        'original_transaction_id', p_original_transaction_id,
        'refund_reason', p_refund_reason,
        'details', p_refund_details
      ), p_original_transaction_id, 'success'
    ) RETURNING id INTO v_audit_id;
    
    -- Return success
    RETURN json_build_object(
      'success', true,
      'balance_before', v_current_balance,
      'balance_after', v_new_balance,
      'amount_refunded', p_amount,
      'audit_id', v_audit_id,
      'original_transaction_id', p_original_transaction_id
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      INSERT INTO wallet_audit_log (
        user_id, transaction_type, amount, balance_before, balance_after,
        transaction_details, external_transaction_id, status, error_message
      ) VALUES (
        p_user_id, 'refund', p_amount, 
        COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0),
        jsonb_build_object(
          'original_transaction_id', p_original_transaction_id,
          'refund_reason', p_refund_reason,
          'details', p_refund_details
        ), p_original_transaction_id, 'failed', SQLERRM
      );
      
      -- Re-raise the exception to trigger rollback
      RAISE;
  END;
END;
$$;

-- Create secure function to get user balance (with audit logging)
CREATE OR REPLACE FUNCTION get_secure_user_balance(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
  v_user_exists boolean;
BEGIN
  -- Validate input
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Get current balance
  SELECT wallet_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if user exists
  v_user_exists := FOUND;
  
  IF NOT v_user_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Return balance
  RETURN json_build_object(
    'success', true,
    'balance', v_balance,
    'user_id', p_user_id,
    'timestamp', now()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION process_secure_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION process_secure_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION process_secure_refund TO authenticated;
GRANT EXECUTE ON FUNCTION get_secure_user_balance TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS wallet_audit_log_user_id_idx ON wallet_audit_log(user_id);
CREATE INDEX IF NOT EXISTS wallet_audit_log_created_at_idx ON wallet_audit_log(created_at);
CREATE INDEX IF NOT EXISTS wallet_audit_log_transaction_type_idx ON wallet_audit_log(transaction_type);
CREATE INDEX IF NOT EXISTS wallet_audit_log_status_idx ON wallet_audit_log(status);

-- CRITICAL: Revoke direct UPDATE access to wallet_balance
-- Users can no longer directly modify their balance
REVOKE UPDATE (wallet_balance) ON profiles FROM authenticated;
REVOKE UPDATE (wallet_balance) ON profiles FROM anon;

-- Create a view for users to see their audit logs
CREATE OR REPLACE VIEW user_wallet_audit AS
SELECT 
  id,
  transaction_type,
  amount,
  balance_before,
  balance_after,
  transaction_details,
  external_transaction_id,
  status,
  error_message,
  created_at
FROM wallet_audit_log
WHERE user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON user_wallet_audit TO authenticated;