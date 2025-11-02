/*
  # Fix RLS policy for signup process

  1. Changes
    - Create a database function to handle profile creation during signup
    - This bypasses RLS issues during the signup process
    
  2. Security
    - Function runs with definer rights (bypasses RLS)
    - Still validates that the user ID matches auth.uid()
    - Maintains security while allowing signup to work
*/

-- Create a function to create user profile during signup
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id uuid,
  user_name text,
  user_email text,
  user_phone text,
  user_referral_code text DEFAULT NULL,
  user_referred_by uuid DEFAULT NULL,
  user_bvn text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
  new_profile profiles%ROWTYPE;
BEGIN
  -- Validate that the user_id matches the current auth user
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create profile for different user';
  END IF;

  -- Insert the profile
  INSERT INTO profiles (
    id,
    name,
    email,
    phone,
    wallet_balance,
    is_admin,
    referral_code,
    referred_by,
    total_referrals,
    referral_earnings,
    bvn,
    created_at
  ) VALUES (
    user_id,
    user_name,
    user_email,
    user_phone,
    0,
    false,
    user_referral_code,
    user_referred_by,
    0,
    0,
    user_bvn,
    now()
  )
  RETURNING * INTO new_profile;

  -- Return the created profile as JSON
  RETURN row_to_json(new_profile);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;