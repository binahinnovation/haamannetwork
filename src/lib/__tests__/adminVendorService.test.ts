/**
 * Property-Based Tests for Admin Vendor Service
 * Tests for admin vendor management operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { VendorShop, ShopStatus, VendorAuditLog } from '../../types/vendor';

// Mock supabase before importing adminVendorService
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

/**
 * Helper to generate valid ISO date strings
 */
const isoDateStringGenerator = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 59 })
).map(([year, month, day, hour, min, sec]) => {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const h = String(hour).padStart(2, '0');
  const mi = String(min).padStart(2, '0');
  const s = String(sec).padStart(2, '0');
  return `${year}-${m}-${d}T${h}:${mi}:${s}.000Z`;
});

/**
 * Generator for VendorShop objects with valid dates
 */
const vendorShopGenerator = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  is_verified: fc.boolean(),
  status: fc.constantFrom<ShopStatus>('active', 'disabled', 'admin_disabled'),
  admin_override: fc.boolean(),
  subscription_due_date: fc.option(isoDateStringGenerator, { nil: null }),
  last_subscription_paid_at: fc.option(isoDateStringGenerator, { nil: null }),
  created_at: isoDateStringGenerator,
  updated_at: isoDateStringGenerator,
  vendor_name: fc.string({ minLength: 1, maxLength: 50 }),
  product_count: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
});

/**
 * Pure function to validate shop list contains required fields
 * Requirements: 5.2
 */
function validateShopListFields(shop: VendorShop): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  
  // Check name - must be non-empty string with non-whitespace content
  if (!shop.name || typeof shop.name !== 'string' || shop.name.trim().length === 0) {
    missingFields.push('name');
  }
  
  // Check vendor_name - must be present (can be empty string but not undefined)
  if (shop.vendor_name === undefined) {
    missingFields.push('vendor_name');
  }
  
  // Check status - must be valid status value
  if (!shop.status || !['active', 'disabled', 'admin_disabled'].includes(shop.status)) {
    missingFields.push('status');
  }
  
  // Check is_verified - must be boolean
  if (typeof shop.is_verified !== 'boolean') {
    missingFields.push('is_verified');
  }
  
  // Check subscription_due_date - field must exist (can be null)
  if (!('subscription_due_date' in shop)) {
    missingFields.push('subscription_due_date');
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Pure function to filter shops by search term
 * Requirements: 5.3
 */
function filterShopsBySearchTerm(
  shops: VendorShop[],
  searchTerm: string
): VendorShop[] {
  if (!searchTerm || !searchTerm.trim()) {
    return shops;
  }
  
  const term = searchTerm.toLowerCase().trim();
  return shops.filter(
    (shop) =>
      shop.name.toLowerCase().includes(term) ||
      (shop.vendor_name && shop.vendor_name.toLowerCase().includes(term))
  );
}

/**
 * Pure function to update shop status
 * Requirements: 8.2, 8.3, 8.4
 */
function applyShopStatusChange(
  shop: VendorShop,
  newStatus: ShopStatus
): VendorShop {
  return {
    ...shop,
    status: newStatus,
    admin_override: newStatus === 'admin_disabled',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Pure function to check if shop should be visible in public queries
 * Requirements: 8.2, 10.4
 */
function isShopVisibleInPublicQueries(shop: VendorShop): boolean {
  return shop.status === 'active';
}

/**
 * Pure function to create audit log entry
 * Requirements: 8.5, 9.3
 */
function createStatusChangeAuditLog(
  adminId: string,
  shopId: string,
  newStatus: ShopStatus,
  reason?: string
): Omit<VendorAuditLog, 'id' | 'created_at' | 'admin_name' | 'shop_name'> {
  return {
    admin_id: adminId,
    action: 'status_override',
    target_shop_id: shopId,
    details: {
      new_value: newStatus,
      reason: reason || 'No reason provided',
    },
  };
}

/**
 * Pure function to create verification change audit log
 * Requirements: 7.4, 9.2
 */
function createVerificationChangeAuditLog(
  adminId: string,
  shopId: string,
  previousValue: boolean,
  newValue: boolean
): Omit<VendorAuditLog, 'id' | 'created_at' | 'admin_name' | 'shop_name'> {
  return {
    admin_id: adminId,
    action: 'verification_change',
    target_shop_id: shopId,
    details: {
      previous_value: previousValue,
      new_value: newValue,
    },
  };
}

/**
 * Pure function to create fee change audit log
 * Requirements: 6.3, 9.1
 */
function createFeeChangeAuditLog(
  adminId: string,
  previousFee: number,
  newFee: number,
  feeType: 'setup' | 'subscription' = 'subscription'
): Omit<VendorAuditLog, 'id' | 'created_at' | 'admin_name' | 'shop_name'> {
  return {
    admin_id: adminId,
    action: 'fee_change',
    target_shop_id: null,
    details: {
      fee_type: feeType,
      previous_value: previousFee,
      new_value: newFee,
    },
  };
}

/**
 * Pure function to determine which fee applies to a subscription charge
 * Requirements: 6.2
 * 
 * Fee changes apply to future charges only. This function determines
 * which fee should be used based on when the fee was updated vs when
 * the charge is being processed.
 */
function determineFeeForCharge(
  feeUpdateTimestamp: Date,
  chargeTimestamp: Date,
  previousFee: number,
  newFee: number
): number {
  // If charge is after fee update, use new fee
  if (chargeTimestamp > feeUpdateTimestamp) {
    return newFee;
  }
  // Otherwise use previous fee
  return previousFee;
}

/**
 * Pure function to validate fee value
 * Requirements: 6.2
 */
function isValidFee(fee: number): boolean {
  return typeof fee === 'number' && !isNaN(fee) && fee >= 0 && isFinite(fee);
}

/**
 * Pure function to check if automated status change should be blocked
 * Requirements: 8.4
 */
function shouldBlockAutomatedStatusChange(shop: VendorShop): boolean {
  return shop.admin_override === true;
}

describe('Admin Vendor Service - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 11: Shop List Contains Required Fields**
   * **Validates: Requirements 5.2**
   * 
   * Property: For any shop returned in the admin vendor list, the response SHALL
   * include shop name, vendor name, status, is_verified, and subscription_due_date fields.
   */
  describe('Property 11: Shop List Contains Required Fields', () => {
    it('should validate that all required fields are present in shop objects', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const result = validateShopListFields(shop);
          
          // All generated shops should have required fields
          expect(result.valid).toBe(true);
          expect(result.missingFields).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect missing name field', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithoutName = { ...shop, name: '' };
          const result = validateShopListFields(shopWithoutName);
          
          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain('name');
        }),
        { numRuns: 100 }
      );
    });

    it('should detect whitespace-only name as invalid', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithWhitespaceName = { ...shop, name: '   ' };
          const result = validateShopListFields(shopWithWhitespaceName);
          
          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain('name');
        }),
        { numRuns: 100 }
      );
    });

    it('should detect missing vendor_name field', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithoutVendorName = { ...shop };
          delete (shopWithoutVendorName as any).vendor_name;
          const result = validateShopListFields(shopWithoutVendorName);
          
          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain('vendor_name');
        }),
        { numRuns: 100 }
      );
    });

    it('should detect invalid status field', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithInvalidStatus = { ...shop, status: 'invalid' as ShopStatus };
          const result = validateShopListFields(shopWithInvalidStatus);
          
          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain('status');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 12: Shop Search Filters Correctly**
   * **Validates: Requirements 5.3**
   * 
   * Property: For any search query in the admin vendor list, all returned shops
   * SHALL have either shop name or vendor name containing the search term (case-insensitive).
   */
  describe('Property 12: Shop Search Filters Correctly', () => {
    it('should return only shops matching search term in name or vendor_name', () => {
      const shopsGenerator = fc.array(vendorShopGenerator, { minLength: 1, maxLength: 20 });
      const searchTermGenerator = fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0);

      fc.assert(
        fc.property(shopsGenerator, searchTermGenerator, (shops, searchTerm) => {
          const filteredShops = filterShopsBySearchTerm(shops, searchTerm);
          const term = searchTerm.toLowerCase().trim();
          
          // All filtered shops should contain the search term
          filteredShops.forEach((shop) => {
            const nameMatches = shop.name.toLowerCase().includes(term);
            const vendorNameMatches = shop.vendor_name?.toLowerCase().includes(term) || false;
            
            expect(nameMatches || vendorNameMatches).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should return all shops when search term is empty', () => {
      const shopsGenerator = fc.array(vendorShopGenerator, { minLength: 0, maxLength: 20 });

      fc.assert(
        fc.property(shopsGenerator, (shops) => {
          const filteredShops = filterShopsBySearchTerm(shops, '');
          
          expect(filteredShops).toHaveLength(shops.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should return all shops when search term is whitespace only', () => {
      const shopsGenerator = fc.array(vendorShopGenerator, { minLength: 0, maxLength: 20 });
      // Generate whitespace strings using array of spaces
      const whitespaceGenerator = fc.nat({ max: 5 }).map(n => ' '.repeat(n + 1));

      fc.assert(
        fc.property(shopsGenerator, whitespaceGenerator, (shops, whitespace) => {
          const filteredShops = filterShopsBySearchTerm(shops, whitespace);
          
          expect(filteredShops).toHaveLength(shops.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive when filtering', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shops = [shop];
          
          // Search with different cases should return same results
          const upperResult = filterShopsBySearchTerm(shops, shop.name.toUpperCase());
          const lowerResult = filterShopsBySearchTerm(shops, shop.name.toLowerCase());
          const mixedResult = filterShopsBySearchTerm(shops, shop.name);
          
          expect(upperResult.length).toBe(lowerResult.length);
          expect(lowerResult.length).toBe(mixedResult.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 16: Admin Disable Hides Shop**
   * **Validates: Requirements 8.2**
   * 
   * Property: For any admin disable action on a shop, the shop status SHALL
   * immediately change to 'admin_disabled' and all products SHALL be excluded
   * from public queries.
   */
  describe('Property 16: Admin Disable Hides Shop', () => {
    it('should set status to admin_disabled when admin disables shop', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const updatedShop = applyShopStatusChange(shop, 'admin_disabled');
          
          expect(updatedShop.status).toBe('admin_disabled');
          expect(updatedShop.admin_override).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should exclude admin_disabled shops from public queries', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const disabledShop = applyShopStatusChange(shop, 'admin_disabled');
          
          expect(isShopVisibleInPublicQueries(disabledShop)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 17: Admin Enable Restores Visibility**
   * **Validates: Requirements 8.3**
   * 
   * Property: For any admin enable action on an 'admin_disabled' shop with current
   * subscription, the shop status SHALL change to 'active' and products SHALL
   * appear in public queries.
   */
  describe('Property 17: Admin Enable Restores Visibility', () => {
    it('should set status to active when admin enables shop', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          // Start with a disabled shop
          const disabledShop = { ...shop, status: 'admin_disabled' as ShopStatus };
          const enabledShop = applyShopStatusChange(disabledShop, 'active');
          
          expect(enabledShop.status).toBe('active');
          expect(enabledShop.admin_override).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should include active shops in public queries', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const activeShop = applyShopStatusChange(shop, 'active');
          
          expect(isShopVisibleInPublicQueries(activeShop)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 18: Admin Override Prevents Auto-Status Change**
   * **Validates: Requirements 8.4**
   * 
   * Property: For any shop with admin_override set to true, automated subscription
   * billing logic SHALL NOT modify the shop status.
   */
  describe('Property 18: Admin Override Prevents Auto-Status Change', () => {
    it('should block automated status changes when admin_override is true', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithOverride = { ...shop, admin_override: true };
          
          expect(shouldBlockAutomatedStatusChange(shopWithOverride)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow automated status changes when admin_override is false', () => {
      fc.assert(
        fc.property(vendorShopGenerator, (shop) => {
          const shopWithoutOverride = { ...shop, admin_override: false };
          
          expect(shouldBlockAutomatedStatusChange(shopWithoutOverride)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 19: Admin Status Change Audit Logging**
   * **Validates: Requirements 8.5, 9.3**
   * 
   * Property: For any admin shop status override, a vendor_audit_log entry SHALL
   * exist with action 'status_override', admin_id, target_shop_id, and details
   * containing the action type and reason.
   */
  describe('Property 19: Admin Status Change Audit Logging', () => {
    it('should create audit log with required fields for status change', () => {
      const adminIdGen = fc.uuid();
      const shopIdGen = fc.uuid();
      const statusGen = fc.constantFrom<ShopStatus>('active', 'disabled', 'admin_disabled');
      const reasonGen = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined });

      fc.assert(
        fc.property(adminIdGen, shopIdGen, statusGen, reasonGen, (adminId, shopId, status, reason) => {
          const auditLog = createStatusChangeAuditLog(adminId, shopId, status, reason);
          
          expect(auditLog.admin_id).toBe(adminId);
          expect(auditLog.action).toBe('status_override');
          expect(auditLog.target_shop_id).toBe(shopId);
          expect(auditLog.details.new_value).toBe(status);
          expect(auditLog.details.reason).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should use default reason when none provided', () => {
      const adminIdGen = fc.uuid();
      const shopIdGen = fc.uuid();
      const statusGen = fc.constantFrom<ShopStatus>('active', 'disabled', 'admin_disabled');

      fc.assert(
        fc.property(adminIdGen, shopIdGen, statusGen, (adminId, shopId, status) => {
          const auditLog = createStatusChangeAuditLog(adminId, shopId, status);
          
          expect(auditLog.details.reason).toBe('No reason provided');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 15: Verification Change Audit Logging**
   * **Validates: Requirements 7.4, 9.2**
   * 
   * Property: For any verification status change, a vendor_audit_log entry SHALL
   * exist with action 'verification_change', the admin_id, target_shop_id, and
   * the new verification status.
   */
  describe('Property 15: Verification Change Audit Logging', () => {
    it('should create audit log with required fields for verification change', () => {
      const adminIdGen = fc.uuid();
      const shopIdGen = fc.uuid();
      const previousValueGen = fc.boolean();
      const newValueGen = fc.boolean();

      fc.assert(
        fc.property(adminIdGen, shopIdGen, previousValueGen, newValueGen, (adminId, shopId, previousValue, newValue) => {
          const auditLog = createVerificationChangeAuditLog(adminId, shopId, previousValue, newValue);
          
          expect(auditLog.admin_id).toBe(adminId);
          expect(auditLog.action).toBe('verification_change');
          expect(auditLog.target_shop_id).toBe(shopId);
          expect(auditLog.details.previous_value).toBe(previousValue);
          expect(auditLog.details.new_value).toBe(newValue);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 13: Fee Update Applies to Future Charges**
   * **Validates: Requirements 6.2**
   * 
   * Property: For any subscription fee update, all subscription charges occurring
   * after the update timestamp SHALL use the new fee value.
   */
  describe('Property 13: Fee Update Applies to Future Charges', () => {
    it('should use new fee for charges after fee update', () => {
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });
      
      fc.assert(
        fc.property(feeGenerator, feeGenerator, (previousFee, newFee) => {
          const feeUpdateTime = new Date('2024-01-15T12:00:00Z');
          const chargeAfterUpdate = new Date('2024-01-16T12:00:00Z');
          
          const appliedFee = determineFeeForCharge(
            feeUpdateTime,
            chargeAfterUpdate,
            previousFee,
            newFee
          );
          
          expect(appliedFee).toBe(newFee);
        }),
        { numRuns: 100 }
      );
    });

    it('should use previous fee for charges before fee update', () => {
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });
      
      fc.assert(
        fc.property(feeGenerator, feeGenerator, (previousFee, newFee) => {
          const feeUpdateTime = new Date('2024-01-15T12:00:00Z');
          const chargeBeforeUpdate = new Date('2024-01-14T12:00:00Z');
          
          const appliedFee = determineFeeForCharge(
            feeUpdateTime,
            chargeBeforeUpdate,
            previousFee,
            newFee
          );
          
          expect(appliedFee).toBe(previousFee);
        }),
        { numRuns: 100 }
      );
    });

    it('should use previous fee for charges at exact update time', () => {
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });
      
      fc.assert(
        fc.property(feeGenerator, feeGenerator, (previousFee, newFee) => {
          const feeUpdateTime = new Date('2024-01-15T12:00:00Z');
          const chargeAtExactTime = new Date('2024-01-15T12:00:00Z');
          
          const appliedFee = determineFeeForCharge(
            feeUpdateTime,
            chargeAtExactTime,
            previousFee,
            newFee
          );
          
          // At exact same time, use previous fee (charge not strictly after update)
          expect(appliedFee).toBe(previousFee);
        }),
        { numRuns: 100 }
      );
    });

    it('should only accept valid non-negative fee values', () => {
      const validFeeGenerator = fc.float({ min: 0, max: 100000, noNaN: true });
      
      fc.assert(
        fc.property(validFeeGenerator, (fee) => {
          expect(isValidFee(fee)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject negative fee values', () => {
      // Use Math.fround to ensure 32-bit float compatibility
      const negativeFeeGenerator = fc.float({ 
        min: Math.fround(-100000), 
        max: Math.fround(-0.01), 
        noNaN: true 
      });
      
      fc.assert(
        fc.property(negativeFeeGenerator, (fee) => {
          expect(isValidFee(fee)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject NaN fee values', () => {
      expect(isValidFee(NaN)).toBe(false);
    });

    it('should reject Infinity fee values', () => {
      expect(isValidFee(Infinity)).toBe(false);
      expect(isValidFee(-Infinity)).toBe(false);
    });
  });

  /**
   * **Feature: multi-vendor-marketplace, Property 14: Fee Change Audit Logging**
   * **Validates: Requirements 6.3, 9.1**
   * 
   * Property: For any subscription fee change, a vendor_audit_log entry SHALL
   * exist with action 'fee_change', the admin_id, and details containing both
   * previous and new fee values.
   */
  describe('Property 14: Fee Change Audit Logging', () => {
    it('should create audit log with required fields for fee change', () => {
      const adminIdGen = fc.uuid();
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });
      const feeTypeGen = fc.constantFrom<'setup' | 'subscription'>('setup', 'subscription');

      fc.assert(
        fc.property(adminIdGen, feeGenerator, feeGenerator, feeTypeGen, (adminId, previousFee, newFee, feeType) => {
          const auditLog = createFeeChangeAuditLog(adminId, previousFee, newFee, feeType);
          
          expect(auditLog.admin_id).toBe(adminId);
          expect(auditLog.action).toBe('fee_change');
          expect(auditLog.target_shop_id).toBeNull();
          expect(auditLog.details.previous_value).toBe(previousFee);
          expect(auditLog.details.new_value).toBe(newFee);
          expect(auditLog.details.fee_type).toBe(feeType);
        }),
        { numRuns: 100 }
      );
    });

    it('should default to subscription fee type when not specified', () => {
      const adminIdGen = fc.uuid();
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });

      fc.assert(
        fc.property(adminIdGen, feeGenerator, feeGenerator, (adminId, previousFee, newFee) => {
          const auditLog = createFeeChangeAuditLog(adminId, previousFee, newFee);
          
          expect(auditLog.details.fee_type).toBe('subscription');
        }),
        { numRuns: 100 }
      );
    });

    it('should have null target_shop_id for fee changes (global setting)', () => {
      const adminIdGen = fc.uuid();
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });

      fc.assert(
        fc.property(adminIdGen, feeGenerator, feeGenerator, (adminId, previousFee, newFee) => {
          const auditLog = createFeeChangeAuditLog(adminId, previousFee, newFee);
          
          // Fee changes are global, not shop-specific
          expect(auditLog.target_shop_id).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve exact fee values in audit log', () => {
      const adminIdGen = fc.uuid();
      // Use specific decimal values to test precision
      const feeGenerator = fc.float({ min: 0, max: 10000, noNaN: true });

      fc.assert(
        fc.property(adminIdGen, feeGenerator, feeGenerator, (adminId, previousFee, newFee) => {
          const auditLog = createFeeChangeAuditLog(adminId, previousFee, newFee);
          
          // Values should be exactly preserved
          expect(auditLog.details.previous_value).toStrictEqual(previousFee);
          expect(auditLog.details.new_value).toStrictEqual(newFee);
        }),
        { numRuns: 100 }
      );
    });
  });
});
