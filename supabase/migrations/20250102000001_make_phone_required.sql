/*
  # Make phone number required for security

  1. Changes
    - Make phone column NOT NULL in profiles table
    - This prevents referral system abuse by requiring phone verification
    
  2. Security
    - Prevents users from creating accounts without phone numbers
    - Helps prevent automated account creation and referral abuse
*/

-- First, update any existing profiles with empty phone numbers to have a placeholder
-- This ensures the NOT NULL constraint can be applied
UPDATE profiles 
SET phone = 'PHONE_REQUIRED' 
WHERE phone IS NULL OR phone = '';

-- Make phone column NOT NULL
ALTER TABLE profiles 
ALTER COLUMN phone SET NOT NULL;

-- Add a check constraint to ensure phone is not empty
ALTER TABLE profiles 
ADD CONSTRAINT phone_not_empty 
CHECK (phone != '' AND phone != 'PHONE_REQUIRED');

-- Create unique index on phone for better performance and prevent duplicate phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx ON profiles(phone);