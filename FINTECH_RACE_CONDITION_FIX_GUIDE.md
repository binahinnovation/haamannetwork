# Complete Guide: Race Condition & Multiple Click Prevention for Fintech Apps

## 🚨 Critical Security Issue

**Problem:** Users can click payment/purchase buttons multiple times, causing:
- Duplicate transactions and charges
- Race conditions in balance deduction
- Wallet balance inconsistencies
- Financial losses and customer complaints
- Regulatory compliance issues

**Solution:** Comprehensive multi-layer protection system with database-level locking and frontend state management.

---

## 📋 Implementation Plan

### Phase 1: Database Security Layer (30 minutes)
1. Create transaction locking system
2. Implement secure purchase functions
3. Add comprehensive audit logging
4. Set up automatic cleanup

### Phase 2: Frontend Protection Layer (45 minutes)
1. Update authentication store
2. Fix all payment components
3. Add button state management
4. Implement loading indicators

### Phase 3: Testing & Verification (15 minutes)
1. Run verification tests
2. Test user scenarios
3. Monitor audit logs

**Total Implementation Time: ~90 minutes**

---

## 🛠️ Step-by-Step Implementation

### Step 1: Database Security Layer

#### 1.1 Apply SQL Migration

Run this SQL in your database (Supabase SQL Editor, pgAdmin, etc.):

```sql
/*
  # PREVENT MULTIPLE TRANSACTIONS - Race Condition Fix
  
  CRITICAL: This prevents duplicate transactions and race conditions
  in fintech applications by implementing database-level locking.
*/

-- Create transaction locks table to prevent duplicate transactions
CREATE TABLE IF NOT EXISTS transaction_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  transaction_type text NOT NULL, -- 'airtime', 'data', 'electricity', 'transfer', etc.
  transaction_key text NOT NULL, -- Unique key for the transaction
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
  WITH CHECK (false);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS transaction_locks_user_id_idx ON transaction_locks(user_id);
CREATE INDEX IF NOT EXISTS transaction_locks_transaction_key_idx ON transaction_locks(transaction_key);
CREATE INDEX IF NOT EXISTS transaction_locks_expires_at_idx ON transaction_locks(expires_at);
CREATE INDEX IF NOT EXISTS transaction_locks_status_idx ON transaction_locks(status);
CREATE INDEX IF NOT EXISTS transaction_locks_active_idx 
  ON transaction_locks(user_id, transaction_key, status, expires_at);

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
      expires_at = now()
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
```

#### 1.2 Verify Database Setup

Run this verification query:

```sql
-- Verify race condition fix installation
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_locks') 
    THEN '✓ PASS - Transaction locks table exists'
    ELSE '✗ FAIL - Transaction locks table missing'
  END as result
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_secure_purchase_with_lock') 
    THEN '✓ PASS - Secure purchase function exists'
    ELSE '✗ FAIL - Secure purchase function missing'
  END as result
UNION ALL
SELECT '=== DATABASE SETUP VERIFICATION COMPLETE ===' as result;
```

### Step 2: Frontend Protection Layer

#### 2.1 Update Authentication Store

**For React/TypeScript with Zustand:**

```typescript
// In your authStore.ts or similar file

// Update the processSecurePurchase function to use the new secure function
processSecurePurchase: async (amount: number, transactionType: string, transactionDetails: any = {}, externalTransactionId?: string) => {
  const state = get();
  if (!state.user) throw new Error('User not authenticated');

  try {
    // Use the new secure function with transaction locking
    const { data, error } = await supabase.rpc('process_secure_purchase_with_lock', {
      p_user_id: state.user.id,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_transaction_details: transactionDetails,
      p_external_transaction_id: externalTransactionId
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Transaction failed');
    }

    // Update local state with new balance
    set((state) => ({
      user: state.user ? { ...state.user, walletBalance: data.balance_after } : null,
    }));

    return data;
  } catch (error) {
    console.error('Error processing secure purchase:', error);
    throw error;
  }
},
```

#### 2.2 Update Payment Components

**Template for any payment component:**

```typescript
// Example: PaymentComponent.tsx
const PaymentComponent: React.FC = () => {
  const { user, processSecurePurchase } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    // CRITICAL: Prevent multiple clicks by checking if already loading
    if (isLoading) {
      return;
    }

    // Check if user has PIN set (if applicable)
    if (user.hasPin) {
      setShowPinModal(true);
      return;
    }

    await processPayment();
  };

  const processPayment = async () => {
    // CRITICAL: Prevent multiple calls if already processing
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const amount = calculateAmount(); // Your amount calculation logic
      
      // SECURE: Process purchase with atomic balance validation and transaction locking
      await processSecurePurchase(
        amount,
        'your_transaction_type', // e.g., 'airtime_purchase', 'data_purchase', etc.
        {
          // Your transaction details
          phoneNumber: phoneNumber,
          // ... other details
        }
      );

      // Process the external transaction (if needed)
      const result = await yourExternalAPI.processTransaction({
        // Your API call details
      });
      
      setTransaction(result);
      setIsSuccess(true);
      
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // CRITICAL: Handle specific error messages for better UX
      let userErrorMessage = 'Payment failed. Please try again.';
      
      if (error.message === 'Transaction already in progress') {
        userErrorMessage = 'A transaction is already in progress. Please wait a moment and try again.';
      } else if (error.message === 'Insufficient balance') {
        userErrorMessage = 'Insufficient wallet balance. Please fund your wallet and try again.';
      } else if (error.message.includes('Unable to connect') || 
                 error.message.includes('internet connection')) {
        userErrorMessage = 'Unable to connect to payment service. Please check your internet connection and try again.';
      } else if (error.message.includes('Service temporarily unavailable') || 
                 error.message.includes('contact support')) {
        userErrorMessage = 'Payment service temporarily unavailable. Please try again later or contact support.';
      } else if (error.message.includes('timeout')) {
        userErrorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.message) {
        userErrorMessage = error.message;
      }
      
      setErrorMessage(userErrorMessage);
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Your component JSX */}
      <Button
        onClick={handlePayment}
        isLoading={isLoading}
        disabled={isLoading} // CRITICAL: Disable button during processing
        className="payment-button disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : 'Pay Now'}
      </Button>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
```

### Step 3: Testing & Verification

#### 3.1 Test Database Functions

```sql
-- Test the lock acquisition (replace with real user ID)
SELECT acquire_transaction_lock(
  'your-user-id-here'::uuid,
  'test_purchase',
  'test_key_123',
  '{"amount": 100}'::jsonb
) as lock_test_result;
```

#### 3.2 Frontend Testing Checklist

- [ ] Buttons show "Processing..." during transactions
- [ ] Buttons are disabled during processing
- [ ] Multiple rapid clicks don't create duplicate transactions
- [ ] Error messages are user-friendly
- [ ] Loading states are clear and consistent

---

## 🤖 AI Coder Prompt Template

Use this prompt when working with AI coding assistants:

```
CRITICAL FINTECH SECURITY TASK: Implement race condition and multiple click prevention for payment system.

CONTEXT:
- This is a fintech application handling real money transactions
- Users can accidentally click payment buttons multiple times
- This causes duplicate charges and financial losses
- Need comprehensive protection at database and frontend levels

REQUIREMENTS:
1. Database-level transaction locking to prevent concurrent identical transactions
2. Frontend button state management to prevent multiple clicks
3. Comprehensive error handling with user-friendly messages
4. Audit logging for all balance changes
5. Automatic cleanup of expired locks

IMPLEMENTATION NEEDED:
1. Update the payment function in [COMPONENT_NAME] to prevent multiple clicks
2. Add proper loading states and button disabling
3. Implement enhanced error handling for race condition scenarios
4. Ensure the processSecurePurchase function uses process_secure_purchase_with_lock
5. Add transaction type: [TRANSACTION_TYPE] (e.g., 'airtime_purchase', 'transfer', etc.)

CRITICAL PATTERNS TO FOLLOW:
- Always check if isLoading before processing
- Always disable buttons during processing
- Always show "Processing..." text during loading
- Always handle "Transaction already in progress" error specifically
- Always use try-catch with comprehensive error handling

SECURITY REQUIREMENTS:
- Never allow direct wallet balance updates
- Always use the secure purchase function with locking
- Always validate user authentication
- Always log all transaction attempts

Please implement these changes following the exact patterns shown in the documentation.
```

---

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor

```sql
-- Monitor lock conflicts (run daily)
SELECT 
  transaction_type,
  COUNT(*) as conflict_count,
  DATE(created_at) as date
FROM transaction_locks 
WHERE status = 'processing' 
  AND created_at > now() - interval '7 days'
GROUP BY transaction_type, DATE(created_at)
ORDER BY date DESC, conflict_count DESC;

-- Monitor failed transactions (run daily)
SELECT 
  transaction_type,
  error_message,
  COUNT(*) as failure_count,
  DATE(created_at) as date
FROM wallet_audit_log 
WHERE status = 'failed' 
  AND created_at > now() - interval '7 days'
GROUP BY transaction_type, error_message, DATE(created_at)
ORDER BY date DESC, failure_count DESC;

-- Check for stuck locks (run hourly)
SELECT 
  COUNT(*) as stuck_locks
FROM transaction_locks 
WHERE status = 'processing' 
  AND expires_at < now() - interval '10 minutes';
```

### Maintenance Tasks

**Daily:**
- Review failed transaction logs
- Check for unusual lock conflict patterns
- Monitor system performance

**Weekly:**
- Clean up old audit logs (older than 90 days)
- Review error patterns and user feedback
- Update documentation if needed

**Monthly:**
- Analyze transaction patterns
- Review and optimize database indexes
- Update security measures if needed

---

## 🚨 Common Issues & Solutions

### Issue 1: "Transaction already in progress" errors
**Cause:** User clicking too fast or network delays
**Solution:** Already handled by the implementation - user gets clear error message

### Issue 2: Stuck locks
**Cause:** Application crashes during transaction
**Solution:** Automatic cleanup function runs every 5 minutes

### Issue 3: Performance issues
**Cause:** Too many locks or slow cleanup
**Solution:** Optimize cleanup frequency and add more indexes

### Issue 4: Balance inconsistencies
**Cause:** Direct balance updates bypassing security
**Solution:** All balance updates must use secure functions only

---

## ✅ Implementation Checklist

### Database Layer
- [ ] Applied SQL migration successfully
- [ ] Verified all tables and functions exist
- [ ] Tested lock acquisition and release
- [ ] Confirmed RLS policies are active

### Frontend Layer
- [ ] Updated authentication store
- [ ] Fixed all payment components
- [ ] Added proper loading states
- [ ] Implemented error handling
- [ ] Added button state management

### Testing
- [ ] Tested rapid button clicking
- [ ] Verified duplicate prevention
- [ ] Confirmed error messages are user-friendly
- [ ] Tested with insufficient balance scenarios
- [ ] Verified audit logging works

### Monitoring
- [ ] Set up monitoring queries
- [ ] Configured alerts for stuck locks
- [ ] Established maintenance schedule
- [ ] Documented troubleshooting procedures

---

## 🎯 Success Criteria

After implementation, your fintech app should have:

✅ **Zero duplicate transactions** from multiple clicks
✅ **Clear user feedback** during processing
✅ **Comprehensive audit trail** of all balance changes
✅ **Automatic recovery** from system failures
✅ **Production-ready security** for financial transactions

This implementation provides enterprise-grade protection for fintech applications handling real money transactions.