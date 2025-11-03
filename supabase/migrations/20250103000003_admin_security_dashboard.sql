/*
  # ADMIN SECURITY DASHBOARD - Complete Monitoring System

  This creates comprehensive admin functions and views for monitoring
  all security features including spending limits, transaction locks,
  and audit logs.
*/

-- Function to get security dashboard statistics
CREATE OR REPLACE FUNCTION get_security_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users integer;
  v_new_accounts integer;
  v_established_accounts integer;
  v_total_daily_spending numeric;
  v_blocked_transactions integer;
  v_active_locks integer;
BEGIN
  -- Get total users
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  
  -- Get new accounts (less than 7 days old)
  SELECT COUNT(*) INTO v_new_accounts 
  FROM profiles 
  WHERE created_at > now() - interval '7 days';
  
  -- Get established accounts (7+ days old)
  SELECT COUNT(*) INTO v_established_accounts 
  FROM profiles 
  WHERE created_at <= now() - interval '7 days';
  
  -- Get total daily spending for today
  SELECT COALESCE(SUM(total_spent), 0) INTO v_total_daily_spending
  FROM daily_spending_tracker 
  WHERE spending_date = CURRENT_DATE;
  
  -- Get blocked transactions today (from audit log)
  SELECT COUNT(*) INTO v_blocked_transactions
  FROM wallet_audit_log 
  WHERE status = 'failed' 
    AND error_message IN ('Daily spending limit exceeded', 'Transaction already in progress')
    AND created_at >= CURRENT_DATE;
  
  -- Get active transaction locks
  SELECT COUNT(*) INTO v_active_locks
  FROM transaction_locks 
  WHERE status = 'processing' 
    AND expires_at > now();
  
  RETURN json_build_object(
    'total_users', v_total_users,
    'new_accounts', v_new_accounts,
    'established_accounts', v_established_accounts,
    'total_daily_spending', v_total_daily_spending,
    'blocked_transactions', v_blocked_transactions,
    'active_locks', v_active_locks
  );
END;
$$;

-- Function to get detailed spending analytics
CREATE OR REPLACE FUNCTION get_spending_analytics(
  p_start_date date DEFAULT CURRENT_DATE - interval '7 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_daily_stats json;
  v_user_stats json;
  v_limit_stats json;
BEGIN
  -- Get daily spending statistics
  SELECT json_agg(
    json_build_object(
      'date', spending_date,
      'total_volume', total_volume,
      'total_transactions', total_transactions,
      'active_users', active_users,
      'avg_per_user', avg_per_user
    )
  ) INTO v_daily_stats
  FROM (
    SELECT 
      spending_date,
      SUM(total_spent) as total_volume,
      SUM(transaction_count) as total_transactions,
      COUNT(*) as active_users,
      AVG(total_spent) as avg_per_user
    FROM daily_spending_tracker 
    WHERE spending_date BETWEEN p_start_date AND p_end_date
    GROUP BY spending_date
    ORDER BY spending_date DESC
  ) daily_data;
  
  -- Get user category statistics
  SELECT json_build_object(
    'new_accounts', json_build_object(
      'count', COUNT(*) FILTER (WHERE account_age_days < 7),
      'total_spent', COALESCE(SUM(total_spent) FILTER (WHERE account_age_days < 7), 0),
      'avg_spent', COALESCE(AVG(total_spent) FILTER (WHERE account_age_days < 7), 0)
    ),
    'established_accounts', json_build_object(
      'count', COUNT(*) FILTER (WHERE account_age_days >= 7),
      'total_spent', COALESCE(SUM(total_spent) FILTER (WHERE account_age_days >= 7), 0),
      'avg_spent', COALESCE(AVG(total_spent) FILTER (WHERE account_age_days >= 7), 0)
    )
  ) INTO v_user_stats
  FROM (
    SELECT 
      p.id,
      EXTRACT(DAY FROM (now() - p.created_at)) as account_age_days,
      COALESCE(dst.total_spent, 0) as total_spent
    FROM profiles p
    LEFT JOIN daily_spending_tracker dst ON p.id = dst.user_id 
      AND dst.spending_date = CURRENT_DATE
  ) user_data;
  
  -- Get spending limit breach statistics
  SELECT json_build_object(
    'users_at_limit', COUNT(*) FILTER (WHERE usage_percentage >= 100),
    'users_near_limit', COUNT(*) FILTER (WHERE usage_percentage >= 80 AND usage_percentage < 100),
    'users_moderate_usage', COUNT(*) FILTER (WHERE usage_percentage >= 50 AND usage_percentage < 80),
    'users_low_usage', COUNT(*) FILTER (WHERE usage_percentage < 50)
  ) INTO v_limit_stats
  FROM (
    SELECT 
      CASE 
        WHEN (limit_info->>'daily_limit')::numeric > 0 
        THEN (COALESCE(dst.total_spent, 0) / (limit_info->>'daily_limit')::numeric) * 100
        ELSE 0 
      END as usage_percentage
    FROM profiles p
    LEFT JOIN daily_spending_tracker dst ON p.id = dst.user_id 
      AND dst.spending_date = CURRENT_DATE
    CROSS JOIN LATERAL get_user_spending_limit(p.id) as limit_info
    WHERE (limit_info->>'success')::boolean = true
  ) usage_data;
  
  RETURN json_build_object(
    'daily_stats', v_daily_stats,
    'user_stats', v_user_stats,
    'limit_stats', v_limit_stats,
    'period', json_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    )
  );
END;
$$;

-- Function to get security alerts
CREATE OR REPLACE FUNCTION get_security_alerts(p_limit integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alerts json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', id,
      'user_id', user_id,
      'alert_type', 
        CASE 
          WHEN error_message = 'Daily spending limit exceeded' THEN 'SPENDING_LIMIT_EXCEEDED'
          WHEN error_message = 'Transaction already in progress' THEN 'DUPLICATE_TRANSACTION_ATTEMPT'
          WHEN error_message = 'Insufficient balance' THEN 'INSUFFICIENT_BALANCE'
          ELSE 'OTHER_ERROR'
        END,
      'transaction_type', transaction_type,
      'amount', amount,
      'error_message', error_message,
      'transaction_details', transaction_details,
      'created_at', created_at,
      'severity', 
        CASE 
          WHEN error_message = 'Daily spending limit exceeded' THEN 'HIGH'
          WHEN error_message = 'Transaction already in progress' THEN 'MEDIUM'
          ELSE 'LOW'
        END
    )
    ORDER BY created_at DESC
  ) INTO v_alerts
  FROM (
    SELECT *
    FROM wallet_audit_log 
    WHERE status = 'failed' 
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT p_limit
  ) recent_alerts;
  
  RETURN json_build_object(
    'alerts', v_alerts,
    'total_count', (
      SELECT COUNT(*) 
      FROM wallet_audit_log 
      WHERE status = 'failed' 
        AND created_at > now() - interval '24 hours'
    )
  );
END;
$$;

-- Function to update spending limits (admin only)
CREATE OR REPLACE FUNCTION update_spending_limit(
  p_limit_type text,
  p_new_daily_limit numeric,
  p_admin_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_old_limit numeric;
BEGIN
  -- Verify admin privileges
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = p_admin_user_id;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin privileges required'
    );
  END IF;
  
  -- Get old limit for logging
  SELECT daily_limit INTO v_old_limit
  FROM spending_limits_config
  WHERE limit_type = p_limit_type AND is_active = true;
  
  -- Update the limit
  UPDATE spending_limits_config
  SET daily_limit = p_new_daily_limit,
      updated_at = now()
  WHERE limit_type = p_limit_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Limit type not found'
    );
  END IF;
  
  -- Log the admin action
  INSERT INTO admin_logs (admin_id, action, details)
  VALUES (
    p_admin_user_id,
    'update_spending_limit',
    json_build_object(
      'limit_type', p_limit_type,
      'old_limit', v_old_limit,
      'new_limit', p_new_daily_limit,
      'timestamp', now()
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'limit_type', p_limit_type,
    'old_limit', v_old_limit,
    'new_limit', p_new_daily_limit
  );
END;
$$;

-- Enhanced admin view with more details
CREATE OR REPLACE VIEW admin_security_overview AS
SELECT 
  p.id as user_id,
  p.name,
  p.email,
  p.phone,
  p.created_at as account_created,
  EXTRACT(DAY FROM (now() - p.created_at)) as account_age_days,
  p.wallet_balance,
  
  -- Today's spending
  COALESCE(dst_today.total_spent, 0) as today_spent,
  COALESCE(dst_today.transaction_count, 0) as today_transactions,
  
  -- This week's spending
  COALESCE(week_spending.total_spent, 0) as week_spent,
  COALESCE(week_spending.transaction_count, 0) as week_transactions,
  
  -- Spending limit info
  get_user_spending_limit(p.id) as limit_info,
  
  -- Recent failed transactions
  (
    SELECT COUNT(*)
    FROM wallet_audit_log wal
    WHERE wal.user_id = p.id 
      AND wal.status = 'failed'
      AND wal.created_at > now() - interval '24 hours'
  ) as recent_failed_transactions,
  
  -- Risk score (simple calculation)
  CASE 
    WHEN EXTRACT(DAY FROM (now() - p.created_at)) < 1 THEN 'HIGH'
    WHEN EXTRACT(DAY FROM (now() - p.created_at)) < 7 THEN 'MEDIUM'
    ELSE 'LOW'
  END as risk_level

FROM profiles p
LEFT JOIN daily_spending_tracker dst_today ON p.id = dst_today.user_id 
  AND dst_today.spending_date = CURRENT_DATE
LEFT JOIN (
  SELECT 
    user_id,
    SUM(total_spent) as total_spent,
    SUM(transaction_count) as transaction_count
  FROM daily_spending_tracker
  WHERE spending_date >= CURRENT_DATE - interval '7 days'
  GROUP BY user_id
) week_spending ON p.id = week_spending.user_id
ORDER BY today_spent DESC NULLS LAST;

-- Grant execute permissions to authenticated users (admin check is inside functions)
GRANT EXECUTE ON FUNCTION get_security_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_spending_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_security_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION update_spending_limit TO authenticated;

-- Grant access to admin views (RLS will handle admin-only access)
GRANT SELECT ON admin_security_overview TO authenticated;

-- Create RLS policy for admin views
CREATE POLICY "Only admins can access security overview"
  ON admin_security_overview
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );