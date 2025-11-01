# Wallet Funding Issue - Debug Guide

## 🚨 **Current Problem**
- Virtual account deposits show in transaction history as successful
- But wallet balance is not being updated
- Example: "Wallet Funding (bank_transfer) 1 Nov 2025, 10:17 am +₦100.00 success"

## 🔍 **Debugging Tools Created**

### **1. Debug Wallet Issue Function**
- **File**: `supabase/functions/debug-wallet-issue/index.ts`
- **Purpose**: Analyzes user's transactions and balance discrepancies
- **Access**: Development mode dashboard "Debug" button

### **2. Fix Wallet Balance Function**
- **File**: `supabase/functions/fix-wallet-balance/index.ts`
- **Purpose**: Recalculates correct balance based on transaction history
- **Access**: Development mode dashboard "Fix" button

### **3. Test Wallet Update Function**
- **File**: `supabase/functions/test-wallet-update/index.ts`
- **Purpose**: Manually tests wallet balance updates
- **Access**: Development mode dashboard "Test" button

## 🔧 **How to Debug the Issue**

### **Step 1: Use Debug Function**
1. Open your app in development mode
2. Go to dashboard
3. Click the "Debug" button next to the balance
4. Check the console output and alert message

### **Step 2: Check Webhook Logs**
1. Go to Supabase Dashboard → Edge Functions
2. Check `flutterwave-webhook` function logs
3. Look for recent webhook calls and any errors

### **Step 3: Verify Webhook URL**
1. Check Flutterwave dashboard webhook configuration
2. Ensure webhook URL is: `https://your-project.supabase.co/functions/v1/flutterwave-webhook`
3. Verify webhook is active and receiving events

## 🎯 **Possible Root Causes**

### **1. Webhook Not Being Called**
- **Symptom**: Transaction created but balance not updated
- **Check**: Flutterwave webhook logs
- **Fix**: Verify webhook URL in Flutterwave dashboard

### **2. Webhook Failing Silently**
- **Symptom**: Webhook called but balance update fails
- **Check**: Supabase Edge Function logs
- **Fix**: Check database permissions and RLS policies

### **3. Real-time Subscription Not Working**
- **Symptom**: Balance updated in DB but not in UI
- **Check**: Browser console for subscription errors
- **Fix**: Use manual refresh button

### **4. Database Transaction Issues**
- **Symptom**: Partial updates (transaction created but balance not updated)
- **Check**: Database transaction logs
- **Fix**: Use the "Fix" button to recalculate balance

## 🛠️ **Quick Fixes**

### **Immediate Fix (Emergency)**
1. Click the "Fix" button in development mode
2. This will recalculate the balance based on transaction history
3. User should see correct balance immediately

### **Manual Database Fix**
If the Fix button doesn't work, run this SQL in Supabase:

```sql
-- Replace USER_ID with the actual user ID
WITH user_balance AS (
  SELECT 
    user_id,
    SUM(CASE 
      WHEN type = 'wallet_funding' AND status = 'success' THEN amount
      WHEN type != 'wallet_funding' AND status = 'success' THEN -amount
      ELSE 0
    END) as correct_balance
  FROM transactions 
  WHERE user_id = 'USER_ID'
  GROUP BY user_id
)
UPDATE profiles 
SET wallet_balance = user_balance.correct_balance
FROM user_balance 
WHERE profiles.id = user_balance.user_id;
```

## 🔍 **Diagnostic Queries**

### **Check User's Transaction History**
```sql
SELECT 
  type,
  amount,
  status,
  created_at,
  reference,
  details->>'payment_method' as payment_method
FROM transactions 
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

### **Check Current Balance vs Expected**
```sql
WITH expected_balance AS (
  SELECT 
    user_id,
    SUM(CASE 
      WHEN type = 'wallet_funding' AND status = 'success' THEN amount
      WHEN type != 'wallet_funding' AND status = 'success' THEN -amount
      ELSE 0
    END) as expected
  FROM transactions 
  WHERE user_id = 'USER_ID'
  GROUP BY user_id
)
SELECT 
  p.wallet_balance as current_balance,
  eb.expected as expected_balance,
  (eb.expected - p.wallet_balance) as discrepancy
FROM profiles p
JOIN expected_balance eb ON p.id = eb.user_id
WHERE p.id = 'USER_ID';
```

## 📋 **Deployment Steps**

### **1. Deploy Debug Functions**
```bash
# Commit and push the new debug functions
git add .
git commit -m "feat: add wallet funding debug and fix tools"
git push origin main
```

### **2. Test in Development**
1. Open app in development mode
2. Use the Debug, Test, and Fix buttons
3. Check console logs for detailed information

### **3. Check Webhook Configuration**
1. Verify Flutterwave webhook URL
2. Test webhook delivery
3. Check webhook signature verification (currently disabled)

## 🚀 **Long-term Solutions**

### **1. Improve Webhook Reliability**
- Add webhook signature verification
- Implement retry mechanism for failed webhooks
- Add webhook delivery confirmation

### **2. Add Monitoring**
- Set up alerts for failed balance updates
- Monitor webhook delivery success rates
- Track balance discrepancies

### **3. Implement Backup Systems**
- Periodic balance reconciliation
- Manual balance correction tools for admins
- Transaction audit logs

## 📞 **Support Actions**

### **For Users Reporting Balance Issues**
1. Use the Debug function to identify the problem
2. Use the Fix function to correct the balance immediately
3. Check webhook logs to prevent future issues
4. Document the issue for pattern analysis

### **For Systematic Issues**
1. Check Flutterwave webhook configuration
2. Review Supabase Edge Function logs
3. Verify database RLS policies
4. Test webhook delivery manually

---

## 🎯 **Next Steps**

1. **Deploy the debug tools** to production
2. **Test with the affected user** using the Debug button
3. **Fix the balance** using the Fix button if needed
4. **Investigate root cause** based on debug output
5. **Implement permanent fix** based on findings