import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { formatCurrency } from '../../lib/utils';

type HeaderProps = {
  toggleDarkMode: () => void;
  isDarkMode: boolean;
};

const Header: React.FC<HeaderProps> = ({ toggleDarkMode, isDarkMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { siteName, siteLogoUrl } = useAppSettingsStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isHomePage = location.pathname === '/' && !isAuthenticated;

  const navigationItems = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'FAQ', path: '/faq' },
    { name: 'Contact Us', path: '/contact' },
    { name: 'Terms', path: '/terms' },
  ];

  if (isHomePage) {
    return (
      <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
        <div className="container-pad h-24 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              {siteLogoUrl ? (
                <img src={siteLogoUrl} alt={siteName} className="w-12 h-12 object-contain" />
              ) : (
                <span className="text-[#0F9D58] font-bold text-2xl">
                  {siteName.charAt(0)}
                </span>
              )}
            </div>
            <span className="text-white font-bold text-2xl hidden sm:block">{siteName}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="text-white hover:text-gray-200 transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/login')}
                className="text-white hover:text-gray-200 font-medium transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-white text-[#0F9D58] px-4 py-2 rounded-full font-medium hover:bg-gray-100 transition-colors"
              >
                Sign Up
              </button>
            </div>



            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-white"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white shadow-lg">
            <nav className="container-pad py-4 space-y-4">
              {navigationItems.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  className="block text-gray-800 hover:text-[#0F9D58] transition-colors font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={() => {
                    navigate('/login');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left text-gray-800 hover:text-[#0F9D58] transition-colors font-medium"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    navigate('/signup');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full bg-[#0F9D58] text-white px-4 py-2 rounded-full font-medium hover:bg-[#0d8a4f] transition-colors text-center"
                >
                  Sign Up
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
    );
  }

  // Regular header for other pages
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container-pad h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#0F9D58] rounded-xl flex items-center justify-center">
            {siteLogoUrl ? (
              <img src={siteLogoUrl} alt={siteName} className="w-10 h-10 object-contain" />
            ) : (
              <span className="text-white font-bold text-xl">{siteName.charAt(0)}</span>
            )}
          </div>
          <span className="text-2xl font-bold text-[#0F9D58]">{siteName}</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <button className="relative p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <Bell size={20} />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-error-500"></span>
              </button>
              
              <div className="hidden sm:block">
                <div className="text-sm text-gray-600 dark:text-gray-400">Balance</div>
                <div className="font-medium">{formatCurrency(user?.walletBalance || 0)}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-700 dark:text-gray-300 hover:text-[#0F9D58] font-medium transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-[#0F9D58] text-white px-4 py-2 rounded-full font-medium hover:bg-[#0d8a4f] transition-colors"
              >
                Sign Up
              </button>
            </div>
          )}
          
          {isAuthenticated && (
            <button
              onClick={toggleDarkMode}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;