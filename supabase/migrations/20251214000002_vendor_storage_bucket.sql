/*
  # Vendor Product Images Storage Bucket

  1. Storage Setup
    - Create vendor-products bucket with public access
    - Add RLS policies for vendor upload/update/delete
    - Add public read access

  2. Requirements Coverage
    - Requirements 2.5: Product image upload functionality
*/

-- Create the storage bucket for vendor product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-products',
  'vendor-products',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage policies for vendor product images

-- Vendors can upload images to their user folder
CREATE POLICY "Vendors can upload images to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Vendors can update their own images
CREATE POLICY "Vendors can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Vendors can delete their own images
CREATE POLICY "Vendors can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can view vendor product images (public bucket)
CREATE POLICY "Anyone can view vendor product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vendor-products');
