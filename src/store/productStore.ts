/**
 * Product Store
 * Manages public product state with vendor product filtering
 * Requirements: 10.1, 10.4
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

type ProductState = {
  products: Product[];
  loading: boolean;
  shopFilter: string | null;
  fetchProducts: (options?: { shopId?: string; includeDisabledShops?: boolean }) => Promise<void>;
  setShopFilter: (shopId: string | null) => void;
  addProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
};

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  loading: false,
  shopFilter: null,

  /**
   * Fetches products with vendor shop filtering
   * Requirements: 10.1, 10.4
   * - Excludes products from disabled/admin_disabled shops in public view
   * - Includes shop info (name, verification status) for vendor products
   */
  fetchProducts: async (options?: { shopId?: string; includeDisabledShops?: boolean }) => {
    set({ loading: true });
    try {
      // Build query with shop info join for vendor products
      let query = supabase
        .from('products')
        .select(`
          *,
          vendor_shops (
            id,
            name,
            is_verified,
            status
          )
        `)
        .order('created_at', { ascending: false });

      // Apply shop filter if provided
      if (options?.shopId) {
        query = query.eq('shop_id', options.shopId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process products to add shop info and filter disabled shops
      let processedProducts = (data || []).map((product: any) => ({
        ...product,
        shop_name: product.vendor_shops?.name || null,
        shop_is_verified: product.vendor_shops?.is_verified || false,
        // Remove the nested vendor_shops object
        vendor_shops: undefined,
      }));

      // Filter out products from disabled shops unless explicitly included
      // Requirements: 10.4 - Disabled shop products excluded from public view
      if (!options?.includeDisabledShops) {
        processedProducts = processedProducts.filter((product: any) => {
          // Include non-vendor products (admin products)
          if (!product.is_vendor_product || !product.shop_id) {
            return true;
          }
          // For vendor products, check if shop is active
          const shopStatus = data?.find((p: any) => p.id === product.id)?.vendor_shops?.status;
          return shopStatus === 'active';
        });
      }

      set({ products: processedProducts });
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      set({ loading: false });
    }
  },

  setShopFilter: (shopId: string | null) => {
    set({ shopFilter: shopId });
  },

  addProduct: async (productData) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        products: [data, ...state.products],
      }));
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  },

  updateProduct: async (id, productData) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        products: state.products.map((product) =>
          product.id === id ? { ...product, ...data } : product
        ),
      }));
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        products: state.products.filter((product) => product.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },
}));