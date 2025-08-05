import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/profile/ProfilePage';
import WalletPage from './pages/wallet/WalletPage';
import FundWalletPage from './pages/wallet/FundWalletPage';
import ServicesPage from './pages/services/ServicesPage';
import AirtimeServicePage from './pages/services/AirtimeServicePage';
import DataServicePage from './pages/services/DataServicePage';
import ReferEarnPage from './pages/refer/ReferEarnPage';
import SupportPage from './pages/support/SupportPage';
import StorePage from './pages/store/StorePage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import CartPage from './pages/store/CartPage';
import MyOrdersPage from './pages/store/MyOrdersPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import ProductsManagement from './pages/admin/ProductsManagement';
import ProductCategoriesManagement from './pages/admin/ProductCategoriesManagement';
import TransactionsManagement from './pages/admin/TransactionsManagement';
import WalletManagement from './pages/admin/WalletManagement';
import VirtualAccountManagement from './pages/admin/VirtualAccountManagement';
import SupportTicketsManagement from './pages/admin/SupportTicketsManagement';
import ComingSoonPage from './pages/ComingSoonPage';
import AboutPage from './pages/AboutPage';
import FaqPage from './pages/FaqPage';
import ContactPage from './pages/ContactPage';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { useAuthStore } from './store/authStore';
import { useAppSettingsStore } from './store/appSettingsStore';

function App() {
  const { user, isAdmin } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/about" element={<Layout><AboutPage /></Layout>} />
          <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
          <Route path="/contact" element={<Layout><ContactPage /></Layout>} />
          <Route path="/terms" element={<Layout><Terms /></Layout>} />
          <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={user ? <Layout><DashboardPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/profile" 
            element={user ? <Layout><ProfilePage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/wallet" 
            element={user ? <Layout><WalletPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/fund-wallet" 
            element={user ? <Layout><FundWalletPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/services" 
            element={user ? <Layout><ServicesPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/services/airtime" 
            element={user ? <Layout><AirtimeServicePage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/services/data" 
            element={user ? <Layout><DataServicePage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/refer" 
            element={user ? <Layout><ReferEarnPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/support" 
            element={user ? <Layout><SupportPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/store" 
            element={user ? <Layout><StorePage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/store/product/:id" 
            element={user ? <Layout><ProductDetailPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/cart" 
            element={user ? <Layout><CartPage /></Layout> : <Navigate to="/login" />} 
          />
          <Route 
            path="/orders" 
            element={user ? <Layout><MyOrdersPage /></Layout> : <Navigate to="/login" />} 
          />
          
          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route 
            path="/admin" 
            element={isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/settings" 
            element={isAdmin ? <AdminSettings /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/products" 
            element={isAdmin ? <ProductsManagement /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/categories" 
            element={isAdmin ? <ProductCategoriesManagement /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/transactions" 
            element={isAdmin ? <TransactionsManagement /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/wallets" 
            element={isAdmin ? <WalletManagement /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/virtual-accounts" 
            element={isAdmin ? <VirtualAccountManagement /> : <Navigate to="/admin/login" />} 
          />
          <Route 
            path="/admin/support" 
            element={isAdmin ? <SupportTicketsManagement /> : <Navigate to="/admin/login" />} 
          />
          
          {/* Coming soon routes */}
          <Route path="/coming-soon" element={<Layout><ComingSoonPage /></Layout>} />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;