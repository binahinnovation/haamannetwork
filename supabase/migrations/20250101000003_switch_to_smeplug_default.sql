/*
  # Switch Default Provider to SME Plug
  
  This migration switches the default airtime provider to SME Plug
  and hides MASKAWA options from the UI while keeping the code
  for potential future use.
*/

-- Update the default airtime provider to SME Plug
UPDATE admin_settings 
SET value = 'smeplug' 
WHERE key = 'airtime_provider';

-- If the setting doesn't exist, insert it with SME Plug as default
INSERT INTO admin_settings (key, value, description) 
VALUES ('airtime_provider', 'smeplug', 'Default airtime provider (smeplug or maskawa). SME Plug is now the default.')
ON CONFLICT (key) DO UPDATE SET value = 'smeplug';

-- Update all data plans to use SME Plug by default (if not already set)
UPDATE data_plans 
SET provider = 'smeplug' 
WHERE provider IS NULL OR provider = 'maskawa';

-- Add a setting to control MASKAWA visibility (hidden by default)
INSERT INTO admin_settings (key, value, description) 
VALUES ('maskawa_enabled', 'false', 'Enable or disable MASKAWA provider options in admin UI')
ON CONFLICT (key) DO UPDATE SET value = 'false';