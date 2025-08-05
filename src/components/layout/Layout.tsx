import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import { useAuthStore } from '../../store/authStore';

const Layout: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check user preference from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return newMode;
    });
  };

  const isHomePage = location.pathname === '/' && !isAuthenticated;
  const isDashboardPage = location.pathname === '/' && isAuthenticated;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Show header for all pages except dashboard when authenticated */}
      {!isDashboardPage && (
        <Header toggleDarkMode={toggleDarkMode} isDarkMode={isDarkMode} />
      )}
      
      <main className={`flex-1 ${!isDashboardPage && !isHomePage ? 'container-pad' : ''} ${isAuthenticated ? 'pb-32' : ''}`}>
        <Outlet />
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default Layout;