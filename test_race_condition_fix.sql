-- Test script to verify race condition fix
-- Run this after applying the migration

-- Test 1: Verify transaction locks table exists
SELECT 'Transaction locks table exists' as test_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_locks') 
            THEN 'PASS' ELSE 'FAIL' END as result;

-- Test 2: Verify wallet audit log table exists
SELECT 'Wallet audit log table exists' as test_name,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_audit_log') 
            THEN 'PASS' ELSE 'FAIL' END as result;

-- Test 3: Verify secure functions exist
SELECT 'Secure functions exist' as test_name,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_secure_purchase_with_lock') 
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'acquire_transaction_lock')
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'release_transaction_lock')
            THEN 'PASS' ELSE 'FAIL' END as result;

-- Test 4: Create a test user and test the locking mechanism
DO $$
DECLARE
    test_user_id uuid := gen_random_uuid();
    lock_result1 json;
    lock_result2 json;
    purchase_result1 json;
    purchase_result2 json;
BEGIN
    -- Create test user profile
    INSERT INTO profiles (id, name, email, phone, wallet_balance, referral_code)
    VALUES (test_user_id, 'Test User', 'test@example.com', '1234567890', 1000, 'TEST123');
    
    -- Test acquiring the same lock twice (should fail on second attempt)
    SELECT acquire_transaction_lock(
        test_user_id,
        'test_purchase',
        'test_key_123',
        '{"amount": 100}'::jsonb
    ) INTO lock_result1;
    
    SELECT acquire_transaction_lock(
        test_user_id,
        'test_purchase', 
        'test_key_123',
        '{"amount": 100}'::jsonb
    ) INTO lock_result2;
    
    -- First lock should succeed, second should fail
    IF (lock_result1->>'success')::boolean = true AND (lock_result2->>'success')::boolean = false THEN
        RAISE NOTICE 'Test 4: Transaction locking - PASS';
    ELSE
        RAISE NOTICE 'Test 4: Transaction locking - FAIL';
    END IF;
    
    -- Release the lock
    PERFORM release_transaction_lock((lock_result1->>'lock_id')::uuid, 'completed');
    
    -- Test concurrent purchase attempts (should prevent race condition)
    SELECT process_secure_purchase_with_lock(
        test_user_id,
        100,
        'test_purchase',
        '{"phoneNumber": "1234567890"}'::jsonb,
        'test_tx_1'
    ) INTO purchase_result1;
    
    -- Try the same purchase again immediately (should be blocked)
    SELECT process_secure_purchase_with_lock(
        test_user_id,
        100,
        'test_purchase',
        '{"phoneNumber": "1234567890"}'::jsonb,
        'test_tx_2'
    ) INTO purchase_result2;
    
    -- First purchase should succeed, second should fail due to duplicate transaction key
    IF (purchase_result1->>'success')::boolean = true AND (purchase_result2->>'success')::boolean = false THEN
        RAISE NOTICE 'Test 5: Duplicate purchase prevention - PASS';
    ELSE
        RAISE NOTICE 'Test 5: Duplicate purchase prevention - FAIL';
        RAISE NOTICE 'Result 1: %', purchase_result1;
        RAISE NOTICE 'Result 2: %', purchase_result2;
    END IF;
    
    -- Clean up test data
    DELETE FROM wallet_audit_log WHERE user_id = test_user_id;
    DELETE FROM transaction_locks WHERE user_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'All tests completed. Check results above.';
END $$;

-- Test 6: Verify indexes exist for performance
SELECT 'Performance indexes exist' as test_name,
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transaction_locks_user_id_idx')
            AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transaction_locks_transaction_key_idx')
            AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'wallet_audit_log_user_id_idx')
            THEN 'PASS' ELSE 'FAIL' END as result;

-- Test 7: Verify RLS policies are in place
SELECT 'RLS policies exist' as test_name,
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_locks')
            AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_audit_log')
            THEN 'PASS' ELSE 'FAIL' END as result;