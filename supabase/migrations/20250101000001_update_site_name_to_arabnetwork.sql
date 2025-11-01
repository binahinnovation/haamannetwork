/*
  # Update site name to ArabNetwork
  
  This migration ensures that the site_name is properly set to 'ArabNetwork'
  and updates any references that might still have the old name.
*/

-- Update the site_name setting to ensure it's ArabNetwork
UPDATE admin_settings 
SET value = 'ArabNetwork' 
WHERE key = 'site_name';

-- If the setting doesn't exist, insert it
INSERT INTO admin_settings (key, value, description) 
VALUES ('site_name', 'ArabNetwork', 'Website name')
ON CONFLICT (key) DO UPDATE SET value = 'ArabNetwork';

-- Update footer company name as well
UPDATE admin_settings 
SET value = 'ArabNetwork' 
WHERE key = 'footer_company_name';

-- If the footer company name setting doesn't exist, insert it
INSERT INTO admin_settings (key, value, description) 
VALUES ('footer_company_name', 'ArabNetwork', 'Company name displayed in footer')
ON CONFLICT (key) DO UPDATE SET value = 'ArabNetwork';

-- Update steps title to use ArabNetwork
UPDATE admin_settings 
SET value = '3 Simple Steps to Enjoy ArabNetwork.' 
WHERE key = 'steps_title';

-- If the steps title setting doesn't exist, insert it
INSERT INTO admin_settings (key, value, description) 
VALUES ('steps_title', '3 Simple Steps to Enjoy ArabNetwork.', 'Steps section title text')
ON CONFLICT (key) DO UPDATE SET value = '3 Simple Steps to Enjoy ArabNetwork.';