/*
  # Add Footer Contact Settings

  1. New Settings
    - `footer_phone` - Footer phone number
    - `footer_email` - Footer email address
    - `footer_address` - Footer address
    - `footer_company_name` - Company name in footer

  2. Default Values
    - Pre-configured with current contact information
    - Admin can modify through settings panel
*/

INSERT INTO admin_settings (key, value, description) VALUES
  ('footer_phone', '+234 907 599 2464', 'Phone number displayed in footer'),
  ('footer_email', 'support@haamannetwork.com', 'Email address displayed in footer'),
  ('footer_address', 'Lagos, Nigeria', 'Address displayed in footer'),
  ('footer_company_name', 'ArabNetwork', 'Company name displayed in footer')
ON CONFLICT (key) DO NOTHING;