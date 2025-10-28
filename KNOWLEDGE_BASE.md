# ArabNetwork - Project Knowledge Base

## Project Overview

**ArabNetwork** is a comprehensive digital services and e-commerce platform built with React, TypeScript, and Supabase. It serves as a VTU (Virtual Top-Up) platform enabling users to purchase airtime, data bundles, pay utility bills, and shop for electronics and gadgets.

### Tech Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS with custom design system
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **State Management:** Zustand with persistence
- **Icons:** Lucide React
- **PDF Generation:** jsPDF
- **External APIs:** MASKAWA API for VTU services

---

## Architecture Overview

### Application Structure
```
src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components
├── store/              # Zustand state management
├── lib/                # Utilities and API services
├── types/              # TypeScript type definitions
└── index.css          # Global styles and Tailwind config
```

### Key Design Patterns
- **Component-based architecture** with clear separation of concerns
- **State management** using Zustand stores with persistence
- **Row Level Security (RLS)** for database access control
- **Edge functions** for secure API proxying
- **Responsive design** with mobile-first approach

---

## Core Features & User Flows

### 1. Authentication System
**Files:** `pages/auth/LoginPage.tsx`, `pages/auth/SignupPage.tsx`, `store/authStore.ts`

**Features:**
- Email/password authentication via Supabase Auth
- User profile creation with referral system
- Admin privilege management
- Persistent login state

**Flow:**
1. User registers with optional referral code
2. Profile created in `profiles` table
3. Referral bonuses calculated and applied
4. User redirected to dashboard

### 2. VTU Services (Core Business Logic)
**Files:** `pages/services/`, `lib/serviceApi.ts`, `lib/maskawaApi.ts`

**Services Available:**
- **Airtime:** Network recharge for MTN, Airtel, Glo, 9mobile
- **Data Bundles:** Dynamic plans with admin-controlled pricing
- **Electricity:** Bill payments for various DISCOs
- **WAEC:** Educational scratch card purchases

**Transaction Flow:**
1. User selects service and enters details
2. Wallet balance validation
3. External API call via edge function
4. Transaction record creation
5. Wallet balance update
6. Receipt generation

### 3. E-commerce Platform
**Files:** `pages/store/`, `store/cartStore.ts`, `store/productStore.ts`

**Features:**
- Product catalog with categories and search
- Shopping cart with quantity management
- Order placement with multiple payment methods
- Order tracking with status updates
- Admin product management

**Order Flow:**
1. Browse products → Add to cart → Checkout
2. Choose payment method (wallet/pay-on-delivery)
3. Enter shipping address
4. Order creation with tracking number
5. Admin fulfillment and status updates

### 4. Wallet System
**Files:** `pages/wallet/`, `store/authStore.ts`

**Features:**
- Real-time balance display
- Transaction history with filtering
- Wallet funding (currently in verification)
- Automatic balance updates after transactions

### 5. Referral Program
**Files:** `pages/refer/ReferEarnPage.tsx`

**Features:**
- Unique referral codes for each user
- Bonus percentage configurable by admin
- Referral tracking and earnings display
- Social sharing capabilities

---

## Admin Panel Features

### 1. Dashboard & Analytics
**File:** `pages/admin/AdminDashboard.tsx`

**Metrics:**
- Total users, products, transactions
- Revenue tracking
- Active user statistics
- Pending transaction alerts

### 2. Product Management
**File:** `pages/admin/ProductsManagement.tsx`

**Features:**
- CRUD operations for products
- Image URL management
- Category organization
- Stock status control
- Featured/new product flags

### 3. User Management
**File:** `pages/admin/UsersManagement.tsx`

**Features:**
- User listing with search/filter
- Admin privilege management
- Wallet balance viewing
- Referral statistics

### 4. Transaction Monitoring
**File:** `pages/admin/TransactionsManagement.tsx`

**Features:**
- Real-time transaction monitoring
- Status updates (pending → success/failed)
- Transaction filtering and search
- Export capabilities

### 5. Order Fulfillment
**File:** `pages/admin/OrdersManagement.tsx`

**Features:**
- Order status management
- Tracking event creation
- Customer communication
- Pay-on-delivery order cancellation

### 6. Data Plan Management
**File:** `pages/admin/DataPlansManagement.tsx`

**Features:**
- Dynamic pricing control
- Profit margin management
- Plan activation/deactivation
- Bulk pricing updates

### 7. System Configuration
**File:** `pages/admin/AdminSettings.tsx`

**Settings Categories:**
- API Configuration (MASKAWA tokens)
- General Settings (site name, contact info)
- Homepage Content (banners, text)
- Footer Information
- Transaction Limits
- Referral System Settings

---

## Database Schema

### Core Tables

#### `profiles`
- User authentication and profile data
- Wallet balance management
- Referral system tracking
- Admin privilege flags

#### `products`
- E-commerce product catalog
- Pricing and inventory management
- Category organization
- Featured/new product flags

#### `orders`
- Order management with JSON product data
- Payment method tracking
- Shipping address storage
- Status progression tracking

#### `transactions`
- All financial transactions
- Service type categorization
- Status tracking (pending/success/failed)
- JSON details storage

#### `data_plans`
- Dynamic data plan pricing
- External API ID mapping
- Admin profit margin control
- Network and plan type organization

#### `admin_settings` & `api_settings`
- Configurable system parameters
- API credentials management
- Homepage content control
- Business logic configuration

### Security Model
- **Row Level Security (RLS)** enabled on all tables
- **User-specific policies** for data access
- **Admin-only policies** for management functions
- **Public read access** for product catalogs

---

## API Integration

### MASKAWA API Integration
**Files:** `lib/maskawaApi.ts`, `supabase/functions/maskawa-proxy/`

**Purpose:** External VTU service provider for airtime, data, and electricity

**Architecture:**
- Edge function proxy for secure API calls
- Network ID mapping for different providers
- Error handling and user-friendly messages
- Transaction logging and status tracking

**Supported Operations:**
- Airtime purchase
- Data bundle purchase
- Electricity bill payment

### Edge Functions
**Location:** `supabase/functions/`

**Functions:**
- `maskawa-proxy`: Secure API proxy for VTU services

---

## State Management

### Zustand Stores

#### `authStore.ts`
- User authentication state
- Profile data management
- Wallet balance tracking
- Login/logout operations

#### `cartStore.ts`
- Shopping cart state
- Item quantity management
- Total calculations
- Persistent storage

#### `productStore.ts`
- Product catalog management
- CRUD operations
- Loading states

---

## UI/UX Design System

### Color Palette
- **Primary:** #0F9D58 (Google Green)
- **Accent:** #22c55e (Light Green)
- **Success:** #10b981
- **Warning:** #f59e0b
- **Error:** #ef4444

### Component Library
**Location:** `src/components/ui/`

**Components:**
- `Card`: Base container with elevation
- `Button`: Multi-variant button system
- `Input`: Form input with icons
- `Select`: Dropdown with styling
- `Badge`: Status indicators

### Responsive Design
- **Mobile-first** approach
- **Bottom navigation** for mobile users
- **Breakpoint system** for tablet/desktop
- **Touch-friendly** interface elements

---

## Key Business Logic

### Transaction Processing
1. **Validation:** Wallet balance, service availability
2. **API Call:** External service provider integration
3. **Recording:** Database transaction creation
4. **Balance Update:** Automatic wallet deduction
5. **Notification:** User feedback and receipts

### Order Management
1. **Cart Management:** Item addition/removal
2. **Checkout Process:** Address and payment method
3. **Order Creation:** Database record with tracking
4. **Status Updates:** Admin-driven progression
5. **Customer Communication:** Status notifications

### Referral System
1. **Code Generation:** Unique codes per user
2. **Tracking:** Referral relationship mapping
3. **Bonus Calculation:** Configurable percentage
4. **Payout:** Automatic wallet crediting

---

## Development Guidelines

### File Organization
- **200-line limit** per file for maintainability
- **Single responsibility** principle
- **Clear imports/exports** between modules
- **Logical directory structure**

### Code Standards
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **ESLint** for code quality

### Security Considerations
- **Environment variables** for sensitive data
- **RLS policies** for data protection
- **Input validation** on all forms
- **Secure API proxying** via edge functions

---

## Deployment & Environment

### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build Process
- **Vite** for fast development and building
- **TypeScript compilation** with strict mode
- **Tailwind CSS** optimization
- **Asset optimization** for production

### Database Migrations
- **Sequential migrations** for schema updates
- **RLS policy** management
- **Default data** seeding
- **Admin settings** initialization

---

## Common Development Patterns

### Adding New Services
1. Create service page in `pages/services/`
2. Add API integration in `lib/serviceApi.ts`
3. Update transaction types in `types/index.ts`
4. Add service card to dashboard
5. Create admin management if needed

### Adding New Admin Features
1. Create admin page in `pages/admin/`
2. Add navigation to `AdminDashboard.tsx`
3. Implement RLS policies for data access
4. Add logging to `admin_logs` table
5. Update admin authentication checks

### Database Schema Changes
1. Create new migration file
2. Update TypeScript types
3. Modify RLS policies if needed
4. Update related API functions
5. Test with existing data

---

## Troubleshooting Guide

### Common Issues
1. **Supabase Connection:** Check environment variables
2. **RLS Policies:** Verify user permissions
3. **API Integration:** Check edge function logs
4. **State Management:** Clear localStorage if needed
5. **Build Errors:** Check TypeScript types

### Debug Tools
- **Supabase Dashboard:** Database and auth monitoring
- **Browser DevTools:** Network and console debugging
- **React DevTools:** Component state inspection
- **Zustand DevTools:** State management debugging

---

## Future Enhancement Areas

### Planned Features
- **Mobile App:** React Native implementation
- **Advanced Analytics:** Business intelligence dashboard
- **Multi-currency:** Support for different currencies
- **Bulk Operations:** Admin bulk transaction processing
- **API Webhooks:** Real-time external integrations

### Technical Improvements
- **Caching Strategy:** Redis for performance
- **Background Jobs:** Queue system for heavy operations
- **Real-time Updates:** WebSocket integration
- **Testing Suite:** Comprehensive test coverage
- **Documentation:** API documentation generation

---

This knowledge base serves as a comprehensive reference for understanding, maintaining, and extending the ArabNetwork platform. It should be updated as new features are added or architectural changes are made.