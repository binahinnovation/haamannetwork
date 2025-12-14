/**
 * Image Upload Service
 * Handles product image uploads to Supabase Storage
 * Requirements: 2.5
 */

import { supabase } from './supabase';

// Constants for image validation
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const BUCKET_NAME = 'vendor-products';

/**
 * Image validation result
 */
export type ImageValidationResult = {
  valid: boolean;
  error?: 'invalid_type' | 'file_too_large';
};

/**
 * Image upload result
 */
export type ImageUploadResult = {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
};

/**
 * Validates an image file for type and size
 * @param file - The file to validate
 * @returns Validation result with error type if invalid
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'invalid_type' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'file_too_large' };
  }

  return { valid: true };
}

/**
 * Uploads a product image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The user ID (used for folder organization)
 * @returns Upload result with public URL if successful
 */
export async function uploadProductImage(
  file: File,
  userId: string
): Promise<ImageUploadResult> {
  // Validate the file first
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error === 'invalid_type'
        ? 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
        : 'File too large. Maximum size is 5MB.',
    };
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${userId}/${timestamp}_${sanitizedFilename}`;

  try {
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Image upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image',
      };
    }

    // Get public URL
    const publicUrl = getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Image upload exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

/**
 * Deletes a product image from Supabase Storage
 * @param imageUrl - The public URL or path of the image to delete
 * @returns True if deletion was successful
 */
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract path from URL if it's a full URL
    let path = imageUrl;
    
    // If it's a full URL, extract the path
    if (imageUrl.includes(BUCKET_NAME)) {
      const urlParts = imageUrl.split(`${BUCKET_NAME}/`);
      if (urlParts.length > 1) {
        path = urlParts[1];
      }
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Image deletion error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Image deletion exception:', error);
    return false;
  }
}

/**
 * Gets the public URL for an image path
 * @param path - The storage path of the image
 * @returns The public URL for the image
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Extracts the storage path from a public URL
 * @param publicUrl - The public URL of the image
 * @returns The storage path or null if not a valid URL
 */
export function extractPathFromUrl(publicUrl: string): string | null {
  if (!publicUrl.includes(BUCKET_NAME)) {
    return null;
  }
  
  const urlParts = publicUrl.split(`${BUCKET_NAME}/`);
  return urlParts.length > 1 ? urlParts[1] : null;
}

// Export constants for testing
export const IMAGE_CONSTANTS = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  BUCKET_NAME,
};
