# Spending Limits System - Complete Implementation Guide

## 🛡️ Security Feature Overview

**Purpose:** Implement account age-based spending limits to reduce fraud risk and protect new users.

**Business Logic:**
- **New Accounts** (0-6 days): ₦3,000 daily spending limit
- **Established Accounts** (7+ days): ₦10,000 daily spending limit

**Benefits:**
- ✅ **Fraud Protection** - Limits exposure from compromised new accounts
- ✅ **Risk Management** - Reduces potential losses from suspicious activity  
- ✅ **Regulatory Compliance** - Shows responsible financial controls
- ✅ **User Trust** - Demonstrates security-first approach

---

## 📋 Implementation Components

### 1. Database Layer (SQL Migration)

**File:** `supabase/migrations/20250103000002_spending_limits_system.sql`

#### New Tables:
- **`spending_limits_config`** - Configurable spending limits by account type
- **`daily_spending_tracker`** - Tracks daily spending per user

#### New Functions:
- **`get_user_spending_limit()`** - Gets user's limit based on account age
- **`get_user_daily_spending()`** - Gets current daily spending
- **`check_spending_limit()`** - Validates if transaction exceeds limit
- **`update_daily_spending()`** - Updates spending tracker
- **`process_secure_purchase_with_limits()`** - Enhanced purchase function with limits

#### New Views:
- **`user_spending_summary`** - User's spending overview
- **`admin_spending_limits_overview`** - Admin monitoring view

### 2. Frontend Components

**Files Updated:**
- `src/store/authStore.ts` - Added spending limit functions
- `src/components/ui/SpendingLimitInfo.tsx` - New spending limit display component

---

## 🚀 Implementation Steps

### Step 1: Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy the entire content from supabase/migrations/20250103000002_spending_limits_system.sql
-- This creates all tables, functions, and views needed for spending limits
```

### Step 2: Verify Installation

```sql
-- Verify spending limits system installation
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spending_limits_config') 
    THEN '✓ PASS - Spending limits config table exists'
    ELSE '✗ FAIL - Spending limits config table missing'
  END as result
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_spending_tracker') 
    THEN '✓ PASS - Daily spending tracker table exists'
    ELSE '✗ FAIL - Daily spending tracker table missing'
  END as result
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_secure_purchase_with_limits') 
    THEN '✓ PASS - Enhanced purchase function exists'
    ELSE '✗ FAIL - Enhanced purchase function missing'
  END as result
UNION ALL
SELECT '=== SPENDING LIMITS SYSTEM VERIFICATION COMPLETE ===' as result;
```

### Step 3: Test Spending Limits

```sql
-- Test spending limit for a user (replace with real user ID)
SELECT get_user_spending_limit('your-user-id-here'::uuid) as limit_info;

-- Test daily spending check
SELECT get_user_daily_spending('your-user-id-here'::uuid) as spending_info;

-- Test spending limit validation
SELECT check_spending_limit('your-user-id-here'::uuid, 5000) as limit_check;
```

---

## 💻 Frontend Integration

### Using the SpendingLimitInfo Component

```tsx
import SpendingLimitInfo from '../components/ui/SpendingLimitInfo';

// In your component
<SpendingLimitInfo 
  className="mb-4" 
  showDetails={true} 
/>
```

### Using Spending Limit Functions

```tsx
import { useAuthStore } from '../store/authStore';

const MyComponent = () => {
  const { getSpendingLimitInfo, getDailySpending } = useAuthStore();
  
  const checkLimits = async () => {
    try {
      const limitInfo = await getSpendingLimitInfo();
      const spendingInfo = await getDailySpending();
      
      console.log('Daily Limit:', limitInfo.daily_limit);
      console.log('Spent Today:', spendingInfo.total_spent);
      console.log('Account Type:', limitInfo.limit_type);
    } catch (error) {
      console.error('Error checking limits:', error);
    }
  };
};
```

---

## 🎯 User Experience

### For New Accounts (0-6 days)
- **Daily Limit:** ₦3,000
- **Status:** "New Account" with clock icon
- **Message:** "Your daily limit will increase to ₦10,000 in X days"
- **Progress Bar:** Yellow/Red when approaching limit

### For Established Accounts (7+ days)
- **Daily Limit:** ₦10,000  
- **Status:** "Established" with trending up icon
- **Progress Bar:** Green/Yellow/Red based on usage

### Error Messages
- **Limit Exceeded:** "Daily spending limit exceeded. You can spend ₦X more today."
- **Near Limit:** "Approaching daily limit. ₦X remaining for today."

---

## 🔧 Admin Management

### View All User Limits
```sql
-- See all users' spending limits and current usage
SELECT * FROM admin_spending_limits_overview 
ORDER BY total_spent DESC NULLS LAST;
```

### Update Spending Limits
```sql
-- Update limits for different account types
UPDATE spending_limits_config 
SET daily_limit = 5000 
WHERE limit_type = 'new_account';

UPDATE spending_limits_config 
SET daily_limit = 15000 
WHERE limit_type = 'established_account';
```

### Add New Limit Tiers
```sql
-- Add premium account tier
INSERT INTO spending_limits_config (limit_type, daily_limit, account_age_days, description) 
VALUES ('premium_account', 50000, 30, 'Daily spending limit for premium accounts (30+ days old)');
```

---

## 📊 Monitoring & Analytics

### Daily Spending Reports
```sql
-- Daily spending summary
SELECT 
  spending_date,
  COUNT(*) as active_users,
  SUM(total_spent) as total_volume,
  AVG(total_spent) as avg_per_user,
  SUM(transaction_count) as total_transactions
FROM daily_spending_tracker 
WHERE spending_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY spending_date
ORDER BY spending_date DESC;
```

### Limit Breach Analysis
```sql
-- Users who hit their limits
SELECT 
  p.name,
  p.email,
  dst.total_spent,
  get_user_spending_limit(p.id) as limit_info
FROM profiles p
JOIN daily_spending_tracker dst ON p.id = dst.user_id
WHERE dst.spending_date = CURRENT_DATE
  AND dst.total_spent >= (get_user_spending_limit(p.id)->>'daily_limit')::numeric;
```

### Account Age Distribution
```sql
-- Distribution of users by account age
SELECT 
  CASE 
    WHEN EXTRACT(DAY FROM (now() - created_at)) < 7 THEN 'New (0-6 days)'
    WHEN EXTRACT(DAY FROM (now() - created_at)) < 30 THEN 'Established (7-29 days)'
    ELSE 'Mature (30+ days)'
  END as account_age_group,
  COUNT(*) as user_count,
  AVG(wallet_balance) as avg_balance
FROM profiles 
GROUP BY account_age_group
ORDER BY user_count DESC;
```

---

## 🚨 Error Handling

### Common Error Scenarios

1. **Daily Limit Exceeded**
   ```json
   {
     "success": false,
     "error": "Daily spending limit exceeded",
     "daily_limit": 3000,
     "current_spent": 2800,
     "transaction_amount": 500,
     "remaining_limit": 200,
     "limit_type": "new_account"
   }
   ```

2. **Account Not Found**
   ```json
   {
     "success": false,
     "error": "User not found"
   }
   ```

### Frontend Error Handling
```tsx
try {
  await processSecurePurchase(amount, 'airtime_purchase', details);
} catch (error) {
  if (error.message === 'Daily spending limit exceeded') {
    // Show spending limit exceeded modal
    setShowLimitExceededModal(true);
  } else {
    // Handle other errors
    setErrorMessage(error.message);
  }
}
```

---

## 🔄 Maintenance Tasks

### Daily Cleanup (Automated)
```sql
-- Clean up old spending records (keep last 90 days)
DELETE FROM daily_spending_tracker 
WHERE spending_date < CURRENT_DATE - INTERVAL '90 days';
```

### Weekly Reports
```sql
-- Weekly spending limit analysis
SELECT 
  DATE_TRUNC('week', spending_date) as week,
  COUNT(DISTINCT user_id) as active_users,
  SUM(total_spent) as total_volume,
  COUNT(*) as total_days_with_spending
FROM daily_spending_tracker 
WHERE spending_date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;
```

---

## 🎯 Success Metrics

### Key Performance Indicators
- **Fraud Reduction:** % decrease in fraudulent transactions from new accounts
- **User Retention:** % of users who stay active after limit increase
- **Transaction Volume:** Daily/weekly transaction volumes by account age
- **Limit Utilization:** % of users who reach their daily limits

### Expected Outcomes
- ✅ **Reduced Fraud Risk** - New account fraud limited to ₦3,000/day
- ✅ **Better User Experience** - Clear spending visibility and limits
- ✅ **Regulatory Compliance** - Demonstrates responsible lending practices
- ✅ **Business Growth** - Increased trust leads to higher user retention

---

## 🔧 Customization Options

### Adjustable Parameters
- **New Account Limit:** Currently ₦3,000 (easily configurable)
- **Established Account Limit:** Currently ₦10,000 (easily configurable)
- **Account Age Threshold:** Currently 7 days (easily configurable)
- **Additional Tiers:** Can add premium, VIP, or other account types

### Future Enhancements
- **Weekly/Monthly Limits** - Beyond daily limits
- **Transaction Count Limits** - Limit number of transactions per day
- **Category-Specific Limits** - Different limits for different services
- **Dynamic Limits** - AI-based limits based on user behavior
- **Temporary Limit Increases** - Special occasions or verified users

This spending limits system provides comprehensive protection while maintaining excellent user experience and administrative control.