/*
  # Centralize Footer Contact Information

  1. New Settings
    - Ensures footer contact settings exist in admin_settings table
    - `footer_phone` - Contact phone number
    - `footer_email` - Contact email address  
    - `footer_address` - Business address
    - `footer_company_name` - Company name for footer

  2. Security
    - Uses upsert to avoid conflicts with existing settings
    - Allows admin configuration of all footer contact details
*/

-- Insert footer contact settings if they don't exist
INSERT INTO admin_settings (key, value, description, updated_by) 
VALUES 
  ('footer_phone', '+234 907 599 2464', 'Contact phone number displayed in footer', NULL),
  ('footer_email', 'support@haamannetwork.com', 'Contact email address displayed in footer', NULL),
  ('footer_address', 'Lagos, Nigeria', 'Business address displayed in footer', NULL),
  ('footer_company_name', 'ArabNetwork', 'Company name displayed in footer', NULL)
ON CONFLICT (key) DO NOTHING;

-- Ensure airtime provider setting exists with default 'maskawa'
INSERT INTO admin_settings (key, value, description, updated_by)
VALUES ('airtime_provider', 'maskawa', 'Default airtime provider (maskawa or smeplug). Maskawa is the default.', NULL)
ON CONFLICT (key) DO NOTHING;

-- Ensure data_plans has provider column for per-plan routing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_plans' AND column_name = 'provider'
  ) THEN
    ALTER TABLE data_plans ADD COLUMN provider text;
    UPDATE data_plans SET provider = 'smeplug' WHERE provider IS NULL;
  END IF;
END $$;