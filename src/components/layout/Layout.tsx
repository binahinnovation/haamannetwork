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
    // Check user preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    
    // Only apply dark mode if explicitly saved as 'dark'
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      // Default to light mode for everyone (authenticated or not) unless explicitly saved as dark
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, [isAuthenticated]);

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
  const isDashboardPage = false;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Show header on all pages, including dashboard */}
      <Header toggleDarkMode={toggleDarkMode} isDarkMode={isDarkMode} />
      
      <main className={`flex-1 ${!isDashboardPage && !isHomePage ? 'container-pad' : ''} ${isAuthenticated ? 'pb-32' : ''}`}>
        <Outlet />
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default Layout;