import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ServicesPage from './pages/services/ServicesPage';
import AirtimeServicePage from './pages/services/AirtimeServicePage';
import DataServicePage from './pages/services/DataServicePage';
import ElectricityServicePage from './pages/services/ElectricityServicePage';
import WaecServicePage from './pages/services/WaecServicePage';
import StorePage from './pages/store/StorePage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import CartPage from './pages/store/CartPage';
import MyOrdersPage from './pages/store/MyOrdersPage';
import WalletPage from './pages/wallet/WalletPage';
import FundWalletPage from './pages/wallet/FundWalletPage';
import ProfilePage from './pages/profile/ProfilePage';
import TransactionsPage from './pages/transactions/TransactionsPage';
import ReferEarnPage from './pages/refer/ReferEarnPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ComingSoonPage from './pages/ComingSoonPage';
import SupportPage from './pages/support/SupportPage';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import About from './pages/About';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductsManagement from './pages/admin/ProductsManagement';
import ProductCategoriesManagement from './pages/admin/ProductCategoriesManagement';
import UsersManagement from './pages/admin/UsersManagement';
import TransactionsManagement from './pages/admin/TransactionsManagement';
import SecurityDashboard from './pages/admin/SecurityDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import OrdersManagement from './pages/admin/OrdersManagement';
import WalletManagement from './pages/admin/WalletManagement';
import DataPlansManagement from './pages/admin/DataPlansManagement';
import VirtualAccountManagement from './pages/admin/VirtualAccountManagement';
import SupportTicketsManagement from './pages/admin/SupportTicketsManagement';

import { useAuthStore } from './store/authStore';
import { useAppSettingsStore } from './store/appSettingsStore';

function App() {
  const { checkAuth, isAuthenticated, user, initRealtimeSubscription, cleanupRealtimeSubscription } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();

  useEffect(() => {
    checkAuth();
    fetchSettings();
    
    // Cleanup function
    return () => {
      cleanupRealtimeSubscription();
    };
  }, [checkAuth, fetchSettings, cleanupRealtimeSubscription]);
  
  // Initialize realtime subscription when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initRealtimeSubscription();
    }
  }, [isAuthenticated, user, initRealtimeSubscription]);

  return (
    <Router>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<ProductsManagement />} />
        <Route path="/admin/product-categories" element={<ProductCategoriesManagement />} />
        <Route path="/admin/users" element={<UsersManagement />} />
        <Route path="/admin/security" element={<SecurityDashboard />} />
        <Route path="/admin/transactions" element={<TransactionsManagement />} />
        <Route path="/admin/orders" element={<OrdersManagement />} />
        <Route path="/admin/wallet" element={<WalletManagement />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/data-plans" element={<DataPlansManagement />} />
        <Route path="/admin/virtual-accounts" element={<VirtualAccountManagement />} />
        <Route path="/admin/support-tickets" element={<SupportTicketsManagement />} />

        {/* Coming Soon Route */}
        <Route path="/coming-soon" element={<ComingSoonPage />} />

        {/* Auth routes outside of main layout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Main App Routes */}
        <Route path="/" element={<Layout />}>
          {/* Show HomePage for non-authenticated users, Dashboard for authenticated users */}
          <Route index element={isAuthenticated ? <DashboardPage /> : <HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/airtime" element={<AirtimeServicePage />} />
          <Route path="services/data" element={<DataServicePage />} />
          <Route path="services/electricity" element={<ElectricityServicePage />} />
          <Route path="services/waec" element={<WaecServicePage />} />
          <Route path="store" element={<StorePage />} />
          <Route path="store/product/:id" element={<ProductDetailPage />} />
          <Route path="store/cart" element={<CartPage />} />
          <Route path="store/orders" element={<MyOrdersPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet/fund" element={<FundWalletPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="refer" element={<ReferEarnPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="about" element={<About />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="contact" element={<Contact />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
