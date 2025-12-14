# Implementation Plan

- [x] 1. Database Schema and Storage Setup






  - [x] 1.1 Create vendor_shops table migration

    - Create table with id, user_id, name, description, is_verified, status, admin_override, subscription_due_date, last_subscription_paid_at, created_at, updated_at
    - Add unique constraint on user_id
    - Add check constraint for status values
    - _Requirements: 1.1, 3.1_

  - [x] 1.2 Create marketplace_settings table migration

    - Create singleton table with setup_fee (default 500), monthly_subscription_fee (default 500)
    - Insert initial settings row
    - _Requirements: 6.1_

  - [x] 1.3 Create vendor_audit_logs table migration
    - Create table with admin_id, action, target_shop_id, details (JSONB), created_at
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.4 Create subscription_history table migration

    - Create table with shop_id, amount, status, transaction_id, billing_period_start, billing_period_end
    - _Requirements: 3.2_
  - [x] 1.5 Modify products table migration

    - Add shop_id column with foreign key to vendor_shops
    - Add is_vendor_product boolean column
    - _Requirements: 2.2_

  - [x] 1.6 Create Supabase Storage bucket for vendor product images
    - Create vendor-products bucket with public access
    - Add RLS policies for vendor upload/update/delete and public read
    - _Requirements: 2.5_
  - [x] 1.7 Create Row Level Security policies for vendor tables
    - Vendors can only read/write their own shop
    - Vendors can only CRUD products with their shop_id
    - Admins can read/write all vendor data
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 2. TypeScript Types and Interfaces





  - [x] 2.1 Create vendor types file


    - Define VendorShop, MarketplaceSettings, VendorAuditLog, SubscriptionHistory types
    - Define CreateShopData, CreateShopResult, UpdateShopData types
    - _Requirements: 1.2, 5.2_

  - [x] 2.2 Update existing types

    - Extend Product type with shop_id and is_vendor_product fields
    - Extend Transaction type with shop_setup_fee and shop_subscription types
    - _Requirements: 1.6, 2.2_

- [x] 3. Core Service Layer





  - [x] 3.1 Create image upload service


    - Implement uploadProductImage function with file validation (type, size)
    - Implement deleteProductImage function
    - Implement getPublicUrl helper
    - _Requirements: 2.5_
  - [x] 3.2 Write property test for image upload validation


    - **Property 4a: Image Upload Validation**
    - **Validates: Requirements 2.5**
  - [x] 3.3 Create vendor service for shop operations


    - Implement createShop with wallet balance check and fee deduction
    - Implement getShopByUserId
    - Implement updateShop
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 3.4 Write property test for wallet balance validation

    - **Property 1: Wallet Balance Validation for Shop Creation**
    - **Validates: Requirements 1.3, 1.4**
  - [x] 3.5 Write property test for shop creation fee deduction

    - **Property 2: Shop Creation Fee Deduction**
    - **Validates: Requirements 1.5, 1.6**
  - [x] 3.6 Create vendor product service


    - Implement fetchVendorProducts (filtered by shop_id)
    - Implement addVendorProduct with shop_id association
    - Implement updateVendorProduct with ownership check
    - Implement deleteVendorProduct with ownership check and image cleanup
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 3.7 Write property test for vendor product isolation


    - **Property 3: Vendor Product Isolation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  - [x] 3.8 Write property test for product validation

    - **Property 4: Product Validation**
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Zustand Stores





  - [x] 5.1 Create vendorStore


    - Implement shop state management
    - Implement fetchShop, createShop, updateShop actions
    - _Requirements: 1.2, 1.5_

  - [x] 5.2 Create vendorProductStore

    - Implement products state for vendor products only
    - Implement CRUD actions with shop_id filtering
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.3 Create adminVendorStore

    - Implement shops list state
    - Implement marketplace settings state
    - Implement fetchAllShops, updateShopStatus, toggleVerification, updateSubscriptionFee actions
    - _Requirements: 5.1, 6.1, 7.1, 8.1_

  - [x] 5.4 Update productStore for vendor product filtering

    - Modify fetchProducts to exclude disabled shop products from public view
    - Add shop info to product queries
    - _Requirements: 10.1, 10.4_

  - [x] 5.5 Write property test for disabled shop products exclusion

    - **Property 23: Disabled Shop Products Excluded**
    - **Validates: Requirements 10.4**

- [x] 6. Vendor Onboarding Flow





  - [x] 6.1 Create VendorOnboarding page component


    - Build shop creation form with name and description fields
    - Display setup fee and wallet balance
    - Handle insufficient balance with fund wallet prompt
    - Show success state with redirect to vendor dashboard
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 6.2 Add Become a Vendor button to dashboard

    - Show button for non-vendor users
    - Navigate to /vendor/onboard on click
    - _Requirements: 1.1_

  - [x] 6.3 Add vendor routes to App.tsx

    - Add routes for /vendor/onboard, /vendor/dashboard, /vendor/products
    - Add protected route wrapper for vendor pages
    - _Requirements: 1.1_

- [x] 7. Vendor Dashboard and Product Management
  - [x] 7.1 Create VendorDashboard page
    - Display shop info, status, verification badge
    - Show product count and subscription status
    - Quick links to product management
    - _Requirements: 4.2_
  - [x] 7.2 Create VendorProducts page
    - Reuse ProductsManagement component patterns
    - Filter to show only vendor products
    - Add/Edit/Delete product functionality with image upload
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 7.3 Create product image upload component

    - File input with drag-and-drop support
    - Preview before upload
    - Progress indicator during upload
    - Validation feedback for invalid files
    - _Requirements: 2.5_

- [x] 8. Public Vendor Shop Page





  - [x] 8.1 Create VendorShopPage component


    - Display shop name, description, verification badge
    - List all active products from the shop
    - Handle disabled shop with unavailable message
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 8.2 Write property test for public shop displays active products


    - **Property 8: Public Shop Displays Active Products**
    - **Validates: Requirements 4.3**
  - [x] 8.3 Write property test for verification badge visibility

    - **Property 9: Verification Badge Visibility**
    - **Validates: Requirements 4.4, 7.2, 7.3**
  - [x] 8.4 Write property test for disabled shop unavailable

    - **Property 10: Disabled Shop Unavailable**
    - **Validates: Requirements 4.5**
  - [x] 8.5 Update ProductCard to show vendor info


    - Display shop name with link to vendor profile
    - Show verification badge if verified
    - _Requirements: 4.1, 10.2_
  - [x] 8.6 Write property test for product displays shop info

    - **Property 21: Product Displays Shop Info**
    - **Validates: Requirements 10.2**
  - [x] 8.7 Add vendor shop route to App.tsx


    - Add route for /shop/:shopId
    - _Requirements: 4.1_

- [x] 9. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Store Integration with Vendor Products






  - [x] 10.1 Update StorePage to include vendor products

    - Fetch products from all active shops
    - Add vendor filter option
    - _Requirements: 10.1, 10.3_

  - [x] 10.2 Write property test for store shows all active shop products

    - **Property 20: Store Shows All Active Shop Products**
    - **Validates: Requirements 10.1**

  - [ ] 10.3 Write property test for shop filter works correctly
    - **Property 22: Shop Filter Works Correctly**
    - **Validates: Requirements 10.3**

- [x] 11. Admin Vendor Management





  - [x] 11.1 Create AdminVendorManagement page


    - List all vendor shops with search functionality
    - Display shop name, vendor name, status, verification, subscription status
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 11.2 Write property test for shop list contains required fields


    - **Property 11: Shop List Contains Required Fields**
    - **Validates: Requirements 5.2**
  - [x] 11.3 Write property test for shop search filters correctly

    - **Property 12: Shop Search Filters Correctly**
    - **Validates: Requirements 5.3**
  - [x] 11.4 Create shop detail view modal

    - Display subscription history, product count, creation date
    - Verification toggle control
    - Enable/Disable shop controls with reason input
    - _Requirements: 5.4, 7.1, 8.1_
  - [x] 11.5 Implement admin shop status override

    - Enable/Disable shop functionality
    - Set admin_override flag
    - Record action in audit log
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 11.6 Write property test for admin disable hides shop
    - **Property 16: Admin Disable Hides Shop**
    - **Validates: Requirements 8.2**
  - [x] 11.7 Write property test for admin enable restores visibility

    - **Property 17: Admin Enable Restores Visibility**
    - **Validates: Requirements 8.3**
  - [x] 11.8 Write property test for admin override prevents auto-status change

    - **Property 18: Admin Override Prevents Auto-Status Change**
    - **Validates: Requirements 8.4**
  - [x] 11.9 Write property test for admin status change audit logging

    - **Property 19: Admin Status Change Audit Logging**
    - **Validates: Requirements 8.5, 9.3**
  - [x] 11.10 Implement verification badge toggle

    - Toggle is_verified status
    - Record action in audit log
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 11.11 Write property test for verification change audit logging

    - **Property 15: Verification Change Audit Logging**
    - **Validates: Requirements 7.4, 9.2**
  - [x] 11.12 Add admin vendor routes

    - Add route for /admin/vendors
    - Add link in admin dashboard navigation
    - _Requirements: 5.1_

- [x] 12. Admin Marketplace Settings





  - [x] 12.1 Create AdminMarketplaceSettings page


    - Display current setup fee and subscription fee
    - Form to update fees
    - _Requirements: 6.1, 6.2_

  - [x] 12.2 Implement subscription fee update

    - Update marketplace_settings table
    - Record change in audit log with previous and new values
    - _Requirements: 6.2, 6.3_
  - [x] 12.3 Write property test for fee update applies to future charges


    - **Property 13: Fee Update Applies to Future Charges**
    - **Validates: Requirements 6.2**
  - [x] 12.4 Write property test for fee change audit logging


    - **Property 14: Fee Change Audit Logging**
    - **Validates: Requirements 6.3, 9.1**
  - [x] 12.5 Create audit log viewer component


    - Display logs in reverse chronological order
    - Filter by action type, date range
    - _Requirements: 9.4_

  - [x] 12.6 Add marketplace settings route

    - Add route for /admin/marketplace-settings
    - Add link in admin dashboard navigation
    - _Requirements: 6.1_

- [x] 13. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Subscription Billing System






  - [x] 14.1 Create subscription processing function

    - Check shops due for billing
    - Attempt wallet deduction
    - Update shop status based on result
    - Record in subscription_history
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 14.2 Write property test for subscription billing records transaction

    - **Property 5: Subscription Billing Records Transaction**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 14.3 Write property test for failed subscription disables shop

    - **Property 6: Failed Subscription Disables Shop**
    - **Validates: Requirements 3.3, 3.4**
  - [x] 14.4 Create database trigger for wallet funding reactivation


    - Trigger on wallet balance update
    - Check for disabled shops with outstanding fees
    - Attempt fee collection and reactivation
    - _Requirements: 3.5, 3.6_

  - [x] 14.5 Write property test for wallet funding triggers reactivation

    - **Property 7: Wallet Funding Triggers Reactivation**
    - **Validates: Requirements 3.5, 3.6**

  - [x] 14.6 Create Supabase Edge Function for scheduled billing

    - Run daily to check subscription due dates
    - Process billing for due shops
    - Respect admin_override flag
    - _Requirements: 3.1, 8.4_

  - [x] 14.7 Handle pending renewals with fee changes

    - Store fee at time of billing cycle start
    - Use stored fee for pending renewals
    - _Requirements: 6.4_

- [x] 15. Final Integration and Polish






  - [x] 15.1 Add vendor status indicator to user profile

    - Show Vendor badge if user has a shop
    - Link to vendor dashboard
    - _Requirements: 1.1_

  - [x] 15.2 Update navigation for vendor users

    - Add vendor dashboard link in main navigation
    - Conditional display based on vendor status
    - _Requirements: 1.1_

  - [x] 15.3 Add subscription status alerts for vendors

    - Warning when subscription due soon
    - Alert when shop is disabled
    - _Requirements: 3.3, 3.4_




- [x] 16. Final Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.
