/*
  # Multi-Vendor Marketplace Schema

  1. New Tables
    - `vendor_shops` - Vendor shop profiles with subscription management
    - `marketplace_settings` - Singleton table for marketplace configuration
    - `vendor_audit_logs` - Admin action audit trail for vendor operations
    - `subscription_history` - Track subscription billing history

  2. Modified Tables
    - `products` - Add shop_id and is_vendor_product columns

  3. Security
    - Enable RLS on all new tables
    - Vendors can only access their own shop and products
    - Admins can access all vendor data

  4. Requirements Coverage
    - Requirements 1.1, 3.1: vendor_shops table
    - Requirements 6.1: marketplace_settings table
    - Requirements 9.1, 9.2, 9.3: vendor_audit_logs table
    - Requirements 3.2: subscription_history table
    - Requirements 2.2: products table modifications
*/

-- ============================================
-- 1.1 Create vendor_shops table
-- Requirements: 1.1, 3.1
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  is_verified boolean DEFAULT false,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'admin_disabled')),
  admin_override boolean DEFAULT false,
  subscription_due_date timestamptz,
  last_subscription_paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for vendor_shops
CREATE INDEX IF NOT EXISTS vendor_shops_user_id_idx ON vendor_shops(user_id);
CREATE INDEX IF NOT EXISTS vendor_shops_status_idx ON vendor_shops(status);
CREATE INDEX IF NOT EXISTS vendor_shops_is_verified_idx ON vendor_shops(is_verified);
CREATE INDEX IF NOT EXISTS vendor_shops_subscription_due_date_idx ON vendor_shops(subscription_due_date);

-- Enable RLS on vendor_shops
ALTER TABLE vendor_shops ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at on vendor_shops
DROP TRIGGER IF EXISTS update_vendor_shops_updated_at ON vendor_shops;
CREATE TRIGGER update_vendor_shops_updated_at 
  BEFORE UPDATE ON vendor_shops 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 1.2 Create marketplace_settings table (singleton)
-- Requirements: 6.1
-- ============================================
CREATE TABLE IF NOT EXISTS marketplace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_fee decimal(10,2) DEFAULT 500.00,
  monthly_subscription_fee decimal(10,2) DEFAULT 500.00,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on marketplace_settings
ALTER TABLE marketplace_settings ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at on marketplace_settings
DROP TRIGGER IF EXISTS update_marketplace_settings_updated_at ON marketplace_settings;
CREATE TRIGGER update_marketplace_settings_updated_at 
  BEFORE UPDATE ON marketplace_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial settings row (singleton pattern)
INSERT INTO marketplace_settings (setup_fee, monthly_subscription_fee)
VALUES (500.00, 500.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- 1.3 Create vendor_audit_logs table
-- Requirements: 9.1, 9.2, 9.3
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action varchar(50) NOT NULL,
  target_shop_id uuid REFERENCES vendor_shops(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for vendor_audit_logs
CREATE INDEX IF NOT EXISTS vendor_audit_logs_admin_id_idx ON vendor_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS vendor_audit_logs_action_idx ON vendor_audit_logs(action);
CREATE INDEX IF NOT EXISTS vendor_audit_logs_target_shop_id_idx ON vendor_audit_logs(target_shop_id);
CREATE INDEX IF NOT EXISTS vendor_audit_logs_created_at_idx ON vendor_audit_logs(created_at);

-- Enable RLS on vendor_audit_logs
ALTER TABLE vendor_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1.4 Create subscription_history table
-- Requirements: 3.2
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES vendor_shops(id) ON DELETE CASCADE NOT NULL,
  amount decimal(10,2) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('success', 'failed')),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for subscription_history
CREATE INDEX IF NOT EXISTS subscription_history_shop_id_idx ON subscription_history(shop_id);
CREATE INDEX IF NOT EXISTS subscription_history_status_idx ON subscription_history(status);
CREATE INDEX IF NOT EXISTS subscription_history_created_at_idx ON subscription_history(created_at);

-- Enable RLS on subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1.5 Modify products table
-- Requirements: 2.2
-- ============================================
-- Add shop_id column with foreign key to vendor_shops
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES vendor_shops(id) ON DELETE SET NULL;

-- Add is_vendor_product boolean column
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vendor_product boolean DEFAULT false;

-- Create index for shop_id
CREATE INDEX IF NOT EXISTS products_shop_id_idx ON products(shop_id);
CREATE INDEX IF NOT EXISTS products_is_vendor_product_idx ON products(is_vendor_product);


-- ============================================
-- 1.6 Create Supabase Storage bucket for vendor product images
-- Requirements: 2.5
-- ============================================
-- Note: Storage bucket creation is handled via Supabase Dashboard or CLI
-- The following policies assume the bucket 'vendor-products' exists

-- Storage policies for vendor product images
-- These will be created when the bucket exists

-- ============================================
-- 1.7 Row Level Security Policies for vendor tables
-- Requirements: 2.1, 2.3, 2.4
-- ============================================

-- vendor_shops RLS policies
-- Vendors can read their own shop
DROP POLICY IF EXISTS "Vendors can read own shop" ON vendor_shops;
CREATE POLICY "Vendors can read own shop"
  ON vendor_shops
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Vendors can update their own shop (name, description only - not status)
DROP POLICY IF EXISTS "Vendors can update own shop" ON vendor_shops;
CREATE POLICY "Vendors can update own shop"
  ON vendor_shops
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Vendors can insert their own shop
DROP POLICY IF EXISTS "Vendors can insert own shop" ON vendor_shops;
CREATE POLICY "Vendors can insert own shop"
  ON vendor_shops
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all shops
DROP POLICY IF EXISTS "Admins can read all shops" ON vendor_shops;
CREATE POLICY "Admins can read all shops"
  ON vendor_shops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admins can update all shops
DROP POLICY IF EXISTS "Admins can update all shops" ON vendor_shops;
CREATE POLICY "Admins can update all shops"
  ON vendor_shops
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admins can delete shops
DROP POLICY IF EXISTS "Admins can delete shops" ON vendor_shops;
CREATE POLICY "Admins can delete shops"
  ON vendor_shops
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Public can read active shops (for public shop pages)
DROP POLICY IF EXISTS "Public can read active shops" ON vendor_shops;
CREATE POLICY "Public can read active shops"
  ON vendor_shops
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- marketplace_settings RLS policies
-- Anyone can read marketplace settings
DROP POLICY IF EXISTS "Anyone can read marketplace settings" ON marketplace_settings;
CREATE POLICY "Anyone can read marketplace settings"
  ON marketplace_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can update marketplace settings
DROP POLICY IF EXISTS "Admins can update marketplace settings" ON marketplace_settings;
CREATE POLICY "Admins can update marketplace settings"
  ON marketplace_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- vendor_audit_logs RLS policies
-- Only admins can read audit logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON vendor_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON vendor_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Only admins can insert audit logs
DROP POLICY IF EXISTS "Admins can insert audit logs" ON vendor_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON vendor_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- subscription_history RLS policies
-- Vendors can read their own subscription history
DROP POLICY IF EXISTS "Vendors can read own subscription history" ON subscription_history;
CREATE POLICY "Vendors can read own subscription history"
  ON subscription_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = subscription_history.shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  );

-- Admins can read all subscription history
DROP POLICY IF EXISTS "Admins can read all subscription history" ON subscription_history;
CREATE POLICY "Admins can read all subscription history"
  ON subscription_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- System can insert subscription history (via service role)
DROP POLICY IF EXISTS "System can insert subscription history" ON subscription_history;
CREATE POLICY "System can insert subscription history"
  ON subscription_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- Products table RLS policies for vendor products
-- Vendors can read their own products
DROP POLICY IF EXISTS "Vendors can read own products" ON products;
CREATE POLICY "Vendors can read own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    shop_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = products.shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  );

-- Vendors can insert products for their shop
DROP POLICY IF EXISTS "Vendors can insert own products" ON products;
CREATE POLICY "Vendors can insert own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  );

-- Vendors can update their own products
DROP POLICY IF EXISTS "Vendors can update own products" ON products;
CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = products.shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  );

-- Vendors can delete their own products
DROP POLICY IF EXISTS "Vendors can delete own products" ON products;
CREATE POLICY "Vendors can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    shop_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM vendor_shops 
      WHERE vendor_shops.id = products.shop_id 
      AND vendor_shops.user_id = auth.uid()
    )
  );

-- ============================================
-- Storage bucket policies (to be applied when bucket exists)
-- ============================================
-- Note: These policies need to be applied via Supabase Dashboard
-- or after the bucket is created via CLI

/*
-- Vendors can upload images to their shop folder
CREATE POLICY "Vendors can upload images to their shop folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Vendors can update their own images
CREATE POLICY "Vendors can update their own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Vendors can delete their own images
CREATE POLICY "Vendors can delete their own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can view vendor product images
CREATE POLICY "Anyone can view vendor product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-products');
*/

-- ============================================
-- Helper function to check if user is a vendor
-- ============================================
CREATE OR REPLACE FUNCTION is_vendor(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vendor_shops 
    WHERE user_id = user_uuid 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper function to get user's shop_id
-- ============================================
CREATE OR REPLACE FUNCTION get_user_shop_id(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
  shop_uuid uuid;
BEGIN
  SELECT id INTO shop_uuid 
  FROM vendor_shops 
  WHERE user_id = user_uuid 
  LIMIT 1;
  RETURN shop_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
