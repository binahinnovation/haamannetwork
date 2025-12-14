/**
 * Property-Based Tests for Product Store
 * Tests for vendor product filtering and disabled shop exclusion
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Type definitions for testing
 */
type ShopStatus = 'active' | 'disabled' | 'admin_disabled';

type MockProduct = {
  id: string;
  name: string;
  is_vendor_product: boolean;
  shop_id: string | null;
  in_stock: boolean;
};

type MockShop = {
  id: string;
  name: string;
  status: ShopStatus;
  is_verified: boolean;
};

/**
 * Pure function that filters products based on shop status
 * This mirrors the logic in productStore.fetchProducts
 * Requirements: 10.4 - Disabled shop products excluded from public view
 */
function filterProductsByShopStatus(
  products: MockProduct[],
  shops: MockShop[],
  includeDisabledShops: boolean = false
): MockProduct[] {
  if (includeDisabledShops) {
    return products;
  }

  return products.filter((product) => {
    // Include non-vendor products (admin products)
    if (!product.is_vendor_product || !product.shop_id) {
      return true;
    }
    
    // For vendor products, check if shop is active
    const shop = shops.find((s) => s.id === product.shop_id);
    return shop?.status === 'active';
  });
}

/**
 * Generators for property-based tests
 */
const shopStatusGen = fc.constantFrom<ShopStatus>('active', 'disabled', 'admin_disabled');

const mockShopGen = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  status: shopStatusGen,
  is_verified: fc.boolean(),
});

describe('Product Store - Property Tests', () => {
  /**
   * **Feature: multi-vendor-marketplace, Property 23: Disabled Shop Products Excluded**
   * **Validates: Requirements 10.4**
   * 
   * Property: For any shop with status 'disabled' or 'admin_disabled', all products
   * from that shop SHALL be excluded from public store listings and search results.
   */
  describe('Property 23: Disabled Shop Products Excluded', () => {
    it('should exclude all products from disabled shops in public view', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          (shops) => {
            // Create products - some vendor products, some admin products
            const products: MockProduct[] = shops.flatMap((shop, index) => [
              // Vendor product for this shop
              {
                id: `product-${index}-vendor`,
                name: `Vendor Product ${index}`,
                is_vendor_product: true,
                shop_id: shop.id,
                in_stock: true,
              },
              // Admin product (no shop)
              {
                id: `product-${index}-admin`,
                name: `Admin Product ${index}`,
                is_vendor_product: false,
                shop_id: null,
                in_stock: true,
              },
            ]);

            const filteredProducts = filterProductsByShopStatus(products, shops, false);

            // Check that no products from disabled/admin_disabled shops are included
            const disabledShopIds = shops
              .filter(s => s.status === 'disabled' || s.status === 'admin_disabled')
              .map(s => s.id);

            const hasDisabledShopProducts = filteredProducts.some(
              (p) => p.shop_id && disabledShopIds.includes(p.shop_id)
            );

            expect(hasDisabledShopProducts).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all products from active shops in public view', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          (shops) => {
            // Create products for each shop
            const products: MockProduct[] = shops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const filteredProducts = filterProductsByShopStatus(products, shops, false);

            // Get active shop IDs
            const activeShopIds = shops
              .filter(s => s.status === 'active')
              .map(s => s.id);

            // All products from active shops should be included
            const activeShopProducts = products.filter(
              (p) => p.shop_id && activeShopIds.includes(p.shop_id)
            );

            const filteredActiveProducts = filteredProducts.filter(
              (p) => p.shop_id && activeShopIds.includes(p.shop_id)
            );

            expect(filteredActiveProducts.length).toBe(activeShopProducts.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always include admin products (non-vendor products)', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 20 }),
          (shops, adminProductCount) => {
            // Create admin products (no shop_id, is_vendor_product = false)
            const adminProducts: MockProduct[] = Array.from(
              { length: adminProductCount },
              (_, index) => ({
                id: `admin-product-${index}`,
                name: `Admin Product ${index}`,
                is_vendor_product: false,
                shop_id: null,
                in_stock: true,
              })
            );

            // Create some vendor products too
            const vendorProducts: MockProduct[] = shops.map((shop, index) => ({
              id: `vendor-product-${index}`,
              name: `Vendor Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const allProducts = [...adminProducts, ...vendorProducts];
            const filteredProducts = filterProductsByShopStatus(allProducts, shops, false);

            // All admin products should be included regardless of shop status
            const filteredAdminProducts = filteredProducts.filter(
              (p) => !p.is_vendor_product
            );

            expect(filteredAdminProducts.length).toBe(adminProductCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include disabled shop products when includeDisabledShops is true', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          (shops) => {
            // Create products for each shop
            const products: MockProduct[] = shops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            // With includeDisabledShops = true, all products should be returned
            const filteredProducts = filterProductsByShopStatus(products, shops, true);

            expect(filteredProducts.length).toBe(products.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle products with null shop_id as non-vendor products', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (shops, nullShopProductCount) => {
            // Create products with null shop_id but is_vendor_product = true
            // These should still be included (edge case handling)
            const nullShopProducts: MockProduct[] = Array.from(
              { length: nullShopProductCount },
              (_, index) => ({
                id: `null-shop-product-${index}`,
                name: `Null Shop Product ${index}`,
                is_vendor_product: true,
                shop_id: null,
                in_stock: true,
              })
            );

            const filteredProducts = filterProductsByShopStatus(nullShopProducts, shops, false);

            // Products with null shop_id should be included
            expect(filteredProducts.length).toBe(nullShopProductCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 20: Store Shows All Active Shop Products**
   * **Validates: Requirements 10.1**
   * 
   * Property: For any public store query, the results SHALL include products from all shops
   * where status is 'active' and the product's in_stock is true.
   */
  describe('Property 20: Store Shows All Active Shop Products', () => {
    /**
     * Pure function that filters products for public store display
     * This mirrors the logic for displaying products from all active vendor shops
     * alongside admin products
     * Requirements: 10.1 - Display products from all active vendor shops alongside admin products
     */
    function getPublicStoreProducts(
      products: MockProduct[],
      shops: MockShop[]
    ): MockProduct[] {
      return products.filter((product) => {
        // Must be in stock
        if (!product.in_stock) {
          return false;
        }

        // Admin products (non-vendor) are always included
        if (!product.is_vendor_product || !product.shop_id) {
          return true;
        }

        // Vendor products: only include if shop is active
        const shop = shops.find((s) => s.id === product.shop_id);
        return shop?.status === 'active';
      });
    }

    it('should include all in-stock products from active shops', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          (shops) => {
            // Create in-stock products for each shop
            const products: MockProduct[] = shops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const publicProducts = getPublicStoreProducts(products, shops);

            // Count active shops
            const activeShops = shops.filter(s => s.status === 'active');
            
            // All products from active shops should be included
            const expectedCount = activeShops.length;
            const actualActiveShopProducts = publicProducts.filter(
              p => p.is_vendor_product && p.shop_id
            );

            expect(actualActiveShopProducts.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include admin products alongside vendor products', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (shops, adminProductCount) => {
            // Create admin products
            const adminProducts: MockProduct[] = Array.from(
              { length: adminProductCount },
              (_, index) => ({
                id: `admin-${index}`,
                name: `Admin Product ${index}`,
                is_vendor_product: false,
                shop_id: null,
                in_stock: true,
              })
            );

            // Create vendor products
            const vendorProducts: MockProduct[] = shops.map((shop, index) => ({
              id: `vendor-${index}`,
              name: `Vendor Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const allProducts = [...adminProducts, ...vendorProducts];
            const publicProducts = getPublicStoreProducts(allProducts, shops);

            // All admin products should be included
            const adminInPublic = publicProducts.filter(p => !p.is_vendor_product);
            expect(adminInPublic.length).toBe(adminProductCount);

            // Active shop vendor products should be included
            const activeShopCount = shops.filter(s => s.status === 'active').length;
            const vendorInPublic = publicProducts.filter(p => p.is_vendor_product);
            expect(vendorInPublic.length).toBe(activeShopCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude out-of-stock products from public view', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen.filter(s => s.status === 'active'), { minLength: 1, maxLength: 5 }),
          (activeShops) => {
            // Create products with mixed in_stock status
            const products: MockProduct[] = activeShops.flatMap((shop, index) => [
              {
                id: `in-stock-${index}`,
                name: `In Stock Product ${index}`,
                is_vendor_product: true,
                shop_id: shop.id,
                in_stock: true,
              },
              {
                id: `out-of-stock-${index}`,
                name: `Out of Stock Product ${index}`,
                is_vendor_product: true,
                shop_id: shop.id,
                in_stock: false,
              },
            ]);

            const publicProducts = getPublicStoreProducts(products, activeShops);

            // Only in-stock products should be included
            const outOfStockInPublic = publicProducts.filter(p => !p.in_stock);
            expect(outOfStockInPublic.length).toBe(0);

            // All in-stock products from active shops should be included
            const inStockProducts = products.filter(p => p.in_stock);
            expect(publicProducts.length).toBe(inStockProducts.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no active shops exist and no admin products', () => {
      fc.assert(
        fc.property(
          fc.array(
            mockShopGen.filter(s => s.status !== 'active'),
            { minLength: 1, maxLength: 5 }
          ),
          (inactiveShops) => {
            // Create vendor products only for inactive shops
            const products: MockProduct[] = inactiveShops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const publicProducts = getPublicStoreProducts(products, inactiveShops);

            // No products should be returned since all shops are inactive
            expect(publicProducts.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 22: Shop Filter Works Correctly**
   * **Validates: Requirements 10.3**
   * 
   * Property: For any store query with a shop filter, all returned products SHALL have
   * shop_id matching the filter value.
   */
  describe('Property 22: Shop Filter Works Correctly', () => {
    /**
     * Pure function that filters products by shop ID
     * This mirrors the logic for filtering products by vendor shop
     * Requirements: 10.3 - Support filtering by vendor shop
     */
    function filterProductsByShopId(
      products: MockProduct[],
      shopId: string | null
    ): MockProduct[] {
      if (!shopId) {
        // No filter applied, return all products
        return products;
      }

      return products.filter((product) => product.shop_id === shopId);
    }

    it('should return only products matching the shop filter', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 2, maxLength: 10 }),
          (shops) => {
            // Create products for each shop
            const products: MockProduct[] = shops.flatMap((shop, shopIndex) =>
              Array.from({ length: 3 }, (_, productIndex) => ({
                id: `product-${shopIndex}-${productIndex}`,
                name: `Product ${shopIndex}-${productIndex}`,
                is_vendor_product: true,
                shop_id: shop.id,
                in_stock: true,
              }))
            );

            // Pick a random shop to filter by
            const targetShop = shops[0];
            const filteredProducts = filterProductsByShopId(products, targetShop.id);

            // All returned products should have the target shop_id
            const allMatchShopId = filteredProducts.every(
              (p) => p.shop_id === targetShop.id
            );

            expect(allMatchShopId).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct count of products for filtered shop', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (shops, productsPerShop) => {
            // Create equal number of products for each shop
            const products: MockProduct[] = shops.flatMap((shop, shopIndex) =>
              Array.from({ length: productsPerShop }, (_, productIndex) => ({
                id: `product-${shopIndex}-${productIndex}`,
                name: `Product ${shopIndex}-${productIndex}`,
                is_vendor_product: true,
                shop_id: shop.id,
                in_stock: true,
              }))
            );

            // Filter by first shop
            const targetShop = shops[0];
            const filteredProducts = filterProductsByShopId(products, targetShop.id);

            // Should return exactly productsPerShop products
            expect(filteredProducts.length).toBe(productsPerShop);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all products when no shop filter is applied', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          (shops) => {
            // Create products for each shop
            const products: MockProduct[] = shops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            // No filter (null)
            const filteredProducts = filterProductsByShopId(products, null);

            // All products should be returned
            expect(filteredProducts.length).toBe(products.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when filtering by non-existent shop', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          (shops, nonExistentShopId) => {
            // Ensure the generated UUID is not in our shops
            const shopIds = shops.map(s => s.id);
            if (shopIds.includes(nonExistentShopId)) {
              return true; // Skip this case
            }

            // Create products for existing shops
            const products: MockProduct[] = shops.map((shop, index) => ({
              id: `product-${index}`,
              name: `Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            // Filter by non-existent shop
            const filteredProducts = filterProductsByShopId(products, nonExistentShopId);

            // Should return empty array
            expect(filteredProducts.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include admin products when filtering by shop', () => {
      fc.assert(
        fc.property(
          fc.array(mockShopGen, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (shops, adminProductCount) => {
            // Create admin products (no shop_id)
            const adminProducts: MockProduct[] = Array.from(
              { length: adminProductCount },
              (_, index) => ({
                id: `admin-${index}`,
                name: `Admin Product ${index}`,
                is_vendor_product: false,
                shop_id: null,
                in_stock: true,
              })
            );

            // Create vendor products
            const vendorProducts: MockProduct[] = shops.map((shop, index) => ({
              id: `vendor-${index}`,
              name: `Vendor Product ${index}`,
              is_vendor_product: true,
              shop_id: shop.id,
              in_stock: true,
            }));

            const allProducts = [...adminProducts, ...vendorProducts];

            // Filter by first shop
            const targetShop = shops[0];
            const filteredProducts = filterProductsByShopId(allProducts, targetShop.id);

            // Admin products should not be included (they have null shop_id)
            const adminInFiltered = filteredProducts.filter(p => !p.is_vendor_product);
            expect(adminInFiltered.length).toBe(0);

            // Only the target shop's products should be included
            expect(filteredProducts.length).toBe(1);
            expect(filteredProducts[0].shop_id).toBe(targetShop.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
