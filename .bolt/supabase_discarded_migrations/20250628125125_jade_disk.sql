/*
  # Create leaderboard RPC functions

  1. New Functions
    - `get_data_usage_leaderboard` - Returns top users by data spending with network filtering
    - Handles ambiguous column references by using proper table aliases
    - Includes privacy protection by masking user names
    - Returns current user's position even if not in top 10

  2. Security
    - Functions are accessible to authenticated users
    - User names are masked for privacy except for the current user
*/

-- Create function to get data usage leaderboard
CREATE OR REPLACE FUNCTION get_data_usage_leaderboard(
  network_filter text DEFAULT NULL,
  current_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  name text,
  network text,
  total_amount numeric,
  rank integer,
  is_current_user boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_data_spending AS (
    SELECT 
      p.id as user_id,
      p.name,
      COALESCE(
        (
          SELECT t.details->>'network'
          FROM transactions t
          WHERE t.user_id = p.id 
            AND t.type = 'data' 
            AND t.status = 'success'
            AND (network_filter IS NULL OR LOWER(t.details->>'network') = LOWER(network_filter))
          GROUP BY t.details->>'network'
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ), 
        'unknown'
      ) as most_used_network,
      COALESCE(
        (
          SELECT SUM(t.amount)
          FROM transactions t
          WHERE t.user_id = p.id 
            AND t.type = 'data' 
            AND t.status = 'success'
            AND (network_filter IS NULL OR LOWER(t.details->>'network') = LOWER(network_filter))
        ), 
        0
      ) as total_spent
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 
      FROM transactions t 
      WHERE t.user_id = p.id 
        AND t.type = 'data' 
        AND t.status = 'success'
        AND (network_filter IS NULL OR LOWER(t.details->>'network') = LOWER(network_filter))
    )
  ),
  ranked_users AS (
    SELECT 
      uds.user_id,
      CASE 
        WHEN uds.user_id = current_user_id THEN uds.name || ' (You)'
        ELSE SPLIT_PART(uds.name, ' ', 1) || ' ' || COALESCE(LEFT(SPLIT_PART(uds.name, ' ', 2), 1), '')
      END as masked_name,
      uds.most_used_network,
      uds.total_spent,
      ROW_NUMBER() OVER (ORDER BY uds.total_spent DESC) as user_rank,
      (uds.user_id = current_user_id) as is_current_user
    FROM user_data_spending uds
    WHERE uds.total_spent > 0
  )
  SELECT 
    ru.user_id,
    ru.masked_name,
    ru.most_used_network,
    ru.total_spent,
    ru.user_rank::integer,
    ru.is_current_user
  FROM ranked_users ru
  WHERE ru.user_rank <= 10 
     OR ru.user_id = current_user_id
  ORDER BY ru.user_rank;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_data_usage_leaderboard(text, uuid) TO authenticated;