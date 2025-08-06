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
  ('footer_company_name', 'Haaman Network', 'Company name displayed in footer', NULL)
ON CONFLICT (key) DO NOTHING;