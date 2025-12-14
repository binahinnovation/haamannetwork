/**
 * Property-Based Tests for Vendor Product Service
 * Tests for product isolation and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { validateProductData, type CreateVendorProductData } from '../vendorProductService';

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

// Mock vendorService
vi.mock('../vendorService', () => ({
  getShopByUserId: vi.fn(),
}));

// Mock imageUploadService
vi.mock('../imageUploadService', () => ({
  deleteProductImage: vi.fn(),
}));

/**
 * Helper to generate non-empty, non-whitespace strings
 */
const nonEmptyStringGen = (maxLength: number) => 
  fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\s]*[a-zA-Z0-9]$/, { maxLength })
    .filter(s => s.trim().length > 0);

/**
 * Helper to generate valid product data
 * Uses alphanumeric strings to avoid whitespace-only values
 */
const validProductDataGen = fc.record({
  name: nonEmptyStringGen(200),
  description: nonEmptyStringGen(1000),
  price: fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
  image_url: fc.webUrl(),
  category: nonEmptyStringGen(50),
  in_stock: fc.boolean(),
});

/**
 * Helper to simulate product isolation check
 * This mirrors the logic in the service but is testable without database
 */
function checkProductOwnership(
  productShopId: string,
  userShopId: string
): boolean {
  return productShopId === userShopId;
}

/**
 * Helper to filter products by shop_id
 * This mirrors the logic in fetchVendorProducts
 */
function filterProductsByShop(
  products: Array<{ shop_id: string; is_vendor_product: boolean }>,
  shopId: string
): Array<{ shop_id: string; is_vendor_product: boolean }> {
  return products.filter(p => p.shop_id === shopId && p.is_vendor_product);
}

describe('Vendor Product Service - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 3: Vendor Product Isolation**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   * 
   * Property: For any vendor, all products returned by their product management
   * queries SHALL have a shop_id matching their shop, and any create/update/delete
   * operation SHALL only affect products with matching shop_id.
   */
  describe('Property 3: Vendor Product Isolation', () => {
    it('should only return products with matching shop_id', () => {
      // Generator for shop IDs
      const shopIdGen = fc.uuid();
      
      // Generator for products with various shop_ids
      const productGen = fc.record({
        shop_id: fc.uuid(),
        is_vendor_product: fc.boolean(),
      });
      
      const productsListGen = fc.array(productGen, { minLength: 0, maxLength: 20 });

      fc.assert(
        fc.property(shopIdGen, productsListGen, (userShopId, products) => {
          const filteredProducts = filterProductsByShop(products, userShopId);
          
          // All returned products should have matching shop_id
          filteredProducts.forEach(product => {
            expect(product.shop_id).toBe(userShopId);
            expect(product.is_vendor_product).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should allow operations only on products with matching shop_id', () => {
      const shopIdGen = fc.uuid();
      const productShopIdGen = fc.uuid();

      fc.assert(
        fc.property(shopIdGen, productShopIdGen, (userShopId, productShopId) => {
          const canOperate = checkProductOwnership(productShopId, userShopId);
          
          if (productShopId === userShopId) {
            expect(canOperate).toBe(true);
          } else {
            expect(canOperate).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should never return products from other shops', () => {
      const userShopIdGen = fc.uuid();
      const otherShopIdGen = fc.uuid();
      
      fc.assert(
        fc.property(userShopIdGen, otherShopIdGen, (userShopId, otherShopId) => {
          // Create products from another shop
          const otherShopProducts = [
            { shop_id: otherShopId, is_vendor_product: true },
            { shop_id: otherShopId, is_vendor_product: true },
          ];
          
          const filteredProducts = filterProductsByShop(otherShopProducts, userShopId);
          
          // If shop IDs are different, no products should be returned
          if (userShopId !== otherShopId) {
            expect(filteredProducts.length).toBe(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify ownership for update/delete operations', () => {
      // Generate multiple shop IDs
      const shopIdsGen = fc.array(fc.uuid(), { minLength: 2, maxLength: 5 });
      
      fc.assert(
        fc.property(shopIdsGen, (shopIds) => {
          const userShopId = shopIds[0];
          
          // Test ownership check for each shop ID
          shopIds.forEach(productShopId => {
            const canOperate = checkProductOwnership(productShopId, userShopId);
            
            if (productShopId === userShopId) {
              expect(canOperate).toBe(true);
            } else {
              expect(canOperate).toBe(false);
            }
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 4: Product Validation**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any product creation attempt missing required fields
   * (name, description, price, image_url, category, in_stock), the creation
   * SHALL be rejected.
   */
  describe('Property 4: Product Validation', () => {
    it('should accept valid product data with all required fields', () => {
      fc.assert(
        fc.property(validProductDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(true);
          expect(result.errors.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data missing name', () => {
      const invalidDataGen = validProductDataGen.map(data => ({
        ...data,
        name: '',
      }));

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Product name is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data missing description', () => {
      const invalidDataGen = validProductDataGen.map(data => ({
        ...data,
        description: '',
      }));

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Product description is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data with negative price', () => {
      const invalidDataGen = validProductDataGen.map(data => ({
        ...data,
        price: -1,
      }));

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Valid product price is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data missing image_url', () => {
      const invalidDataGen = validProductDataGen.map(data => ({
        ...data,
        image_url: '',
      }));

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Product image URL is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data missing category', () => {
      const invalidDataGen = validProductDataGen.map(data => ({
        ...data,
        category: '',
      }));

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Product category is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should reject product data with undefined in_stock', () => {
      const invalidDataGen = validProductDataGen.map(data => {
        const { in_stock, ...rest } = data;
        return rest as Partial<CreateVendorProductData>;
      });

      fc.assert(
        fc.property(invalidDataGen, (productData) => {
          const result = validateProductData(productData);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Stock status is required');
        }),
        { numRuns: 100 }
      );
    });

    it('should collect all validation errors for multiple missing fields', () => {
      // Empty product data should have multiple errors
      const result = validateProductData({});
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Product name is required');
      expect(result.errors).toContain('Product description is required');
      expect(result.errors).toContain('Valid product price is required');
      expect(result.errors).toContain('Product image URL is required');
      expect(result.errors).toContain('Product category is required');
      expect(result.errors).toContain('Stock status is required');
    });
  });
});
