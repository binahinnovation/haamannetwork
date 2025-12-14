/**
 * Vendor Product Store
 * Manages vendor product state and CRUD operations
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { create } from 'zustand';
import type { Product } from '../types';
import {
  fetchVendorProducts as fetchVendorProductsService,
  addVendorProduct as addVendorProductService,
  updateVendorProduct as updateVendorProductService,
  deleteVendorProduct as deleteVendorProductService,
  type CreateVendorProductData,
} from '../lib/vendorProductService';

type VendorProductState = {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchVendorProducts: (userId: string) => Promise<void>;
  addProduct: (userId: string, productData: CreateVendorProductData) => Promise<Product | null>;
  updateProduct: (userId: string, productId: string, data: Partial<CreateVendorProductData>) => Promise<boolean>;
  deleteProduct: (userId: string, productId: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
};

export const useVendorProductStore = create<VendorProductState>((set) => ({
  products: [],
  loading: false,
  error: null,

  fetchVendorProducts: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const products = await fetchVendorProductsService(userId);
      set({ products, loading: false });
    } catch (error) {
      console.error('Error fetching vendor products:', error);
      set({ loading: false, error: 'Failed to fetch products' });
    }
  },

  addProduct: async (userId: string, productData: CreateVendorProductData): Promise<Product | null> => {
    set({ loading: true, error: null });
    try {
      const product = await addVendorProductService(userId, productData);
      
      if (product) {
        set((state) => ({
          products: [product, ...state.products],
          loading: false,
        }));
        return product;
      } else {
        set({ loading: false, error: 'Failed to add product' });
        return null;
      }
    } catch (error) {
      console.error('Error adding product:', error);
      set({ loading: false, error: 'Failed to add product' });
      return null;
    }
  },

  updateProduct: async (
    userId: string, 
    productId: string, 
    data: Partial<CreateVendorProductData>
  ): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const updatedProduct = await updateVendorProductService(userId, productId, data);
      
      if (updatedProduct) {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? updatedProduct : p
          ),
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to update product' });
        return false;
      }
    } catch (error) {
      console.error('Error updating product:', error);
      set({ loading: false, error: 'Failed to update product' });
      return false;
    }
  },

  deleteProduct: async (userId: string, productId: string): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const success = await deleteVendorProductService(userId, productId);
      
      if (success) {
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
          loading: false,
        }));
        return true;
      } else {
        set({ loading: false, error: 'Failed to delete product' });
        return false;
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      set({ loading: false, error: 'Failed to delete product' });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ products: [], loading: false, error: null }),
}));
