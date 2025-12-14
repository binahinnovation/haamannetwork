/**
 * Vendor Product Service
 * Handles product CRUD operations for vendors
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { supabase } from './supabase';
import { deleteProductImage } from './imageUploadService';
import { getShopByUserId } from './vendorService';
import type { Product } from '../types';

/**
 * Product data required for creation
 */
export type CreateVendorProductData = {
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  in_stock: boolean;
  original_price?: number;
  discount?: number;
  is_new?: boolean;
  is_featured?: boolean;
};

/**
 * Product validation result
 */
export type ProductValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validates product data for required fields
 * Requirements: 2.5
 */
export function validateProductData(data: Partial<CreateVendorProductData>): ProductValidationResult {
  const errors: string[] = [];

  if (!data.name || data.name.trim() === '') {
    errors.push('Product name is required');
  }

  if (!data.description || data.description.trim() === '') {
    errors.push('Product description is required');
  }

  if (data.price === undefined || data.price === null || data.price < 0) {
    errors.push('Valid product price is required');
  }

  if (!data.image_url || data.image_url.trim() === '') {
    errors.push('Product image URL is required');
  }

  if (!data.category || data.category.trim() === '') {
    errors.push('Product category is required');
  }

  if (data.in_stock === undefined || data.in_stock === null) {
    errors.push('Stock status is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Fetches all products for a vendor's shop
 * Requirements: 2.1
 * 
 * @param userId - The vendor's user ID
 * @returns Array of products belonging to the vendor's shop
 */
export async function fetchVendorProducts(userId: string): Promise<Product[]> {
  // Get the vendor's shop
  const shop = await getShopByUserId(userId);
  if (!shop) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('is_vendor_product', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching vendor products:', error);
    return [];
  }

  return data || [];
}

/**
 * Adds a new product to a vendor's shop
 * Requirements: 2.2, 2.5
 * 
 * @param userId - The vendor's user ID
 * @param productData - The product data
 * @returns The created product or null if failed
 */
export async function addVendorProduct(
  userId: string,
  productData: CreateVendorProductData
): Promise<Product | null> {
  // Validate product data
  const validation = validateProductData(productData);
  if (!validation.valid) {
    console.error('Product validation failed:', validation.errors);
    return null;
  }

  // Get the vendor's shop
  const shop = await getShopByUserId(userId);
  if (!shop) {
    console.error('User does not have a shop');
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      ...productData,
      shop_id: shop.id,
      is_vendor_product: true,
      rating: 0,
      reviews: 0,
      discount: productData.discount || 0,
      is_new: productData.is_new || false,
      is_featured: productData.is_featured || false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding vendor product:', error);
    return null;
  }

  return data;
}

/**
 * Updates a vendor's product with ownership check
 * Requirements: 2.3
 * 
 * @param userId - The vendor's user ID
 * @param productId - The product ID to update
 * @param updateData - The data to update
 * @returns The updated product or null if failed
 */
export async function updateVendorProduct(
  userId: string,
  productId: string,
  updateData: Partial<CreateVendorProductData>
): Promise<Product | null> {
  // Get the vendor's shop
  const shop = await getShopByUserId(userId);
  if (!shop) {
    console.error('User does not have a shop');
    return null;
  }

  // Verify ownership by checking shop_id
  const { data: existingProduct, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .single();

  if (fetchError || !existingProduct) {
    console.error('Product not found or user does not own this product');
    return null;
  }

  // Update the product
  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vendor product:', error);
    return null;
  }

  return data;
}

/**
 * Deletes a vendor's product with ownership check and image cleanup
 * Requirements: 2.4, 2.5
 * 
 * @param userId - The vendor's user ID
 * @param productId - The product ID to delete
 * @returns True if deletion was successful
 */
export async function deleteVendorProduct(
  userId: string,
  productId: string
): Promise<boolean> {
  // Get the vendor's shop
  const shop = await getShopByUserId(userId);
  if (!shop) {
    console.error('User does not have a shop');
    return false;
  }

  // Fetch the product to get image URL for cleanup
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .single();

  if (fetchError || !product) {
    console.error('Product not found or user does not own this product');
    return false;
  }

  // Delete the product
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('shop_id', shop.id);

  if (deleteError) {
    console.error('Error deleting vendor product:', deleteError);
    return false;
  }

  // Clean up the product image from storage
  if (product.image_url && product.image_url.includes('vendor-products')) {
    await deleteProductImage(product.image_url);
  }

  return true;
}

/**
 * Gets a single product by ID with ownership verification
 * 
 * @param userId - The vendor's user ID
 * @param productId - The product ID
 * @returns The product or null if not found/not owned
 */
export async function getVendorProduct(
  userId: string,
  productId: string
): Promise<Product | null> {
  const shop = await getShopByUserId(userId);
  if (!shop) {
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .single();

  if (error) {
    console.error('Error fetching vendor product:', error);
    return null;
  }

  return data;
}

// Export for testing
export const vendorProductService = {
  validateProductData,
  fetchVendorProducts,
  addVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  getVendorProduct,
};
