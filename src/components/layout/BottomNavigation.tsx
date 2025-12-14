import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, TrendingUp, User, Store } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useVendorStore } from '../../store/vendorStore';
import { cn } from '../../lib/utils';

const BottomNavigation: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { shop, fetchShop } = useVendorStore();

  // Fetch vendor shop status when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchShop(user.id);
    }
  }, [isAuthenticated, user?.id, fetchShop]);

  // Only show bottom navigation when user is authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Build navigation items dynamically based on vendor status
  const navigationItems = [
    {
      name: 'Home',
      path: '/',
      icon: Home,
    },
    {
      name: 'Shop',
      path: '/store',
      icon: ShoppingBag,
    },
    // Conditionally add vendor dashboard for vendors
    ...(shop ? [{
      name: 'My Shop',
      path: '/vendor/dashboard',
      icon: Store,
    }] : [{
      name: 'Refer & Earn',
      path: '/refer',
      icon: TrendingUp,
    }]),
    {
      name: 'Profile',
      path: '/profile',
      icon: User,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around z-50 px-2 sm:px-6 safe-area-pb">
      {navigationItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'bottom-nav-item flex flex-col items-center justify-center text-center pt-2 pb-1 w-full min-h-[3rem]',
              isActive ? 'bottom-nav-item-active' : 'bottom-nav-item-inactive'
            )
          }
          end
        >
          {({ isActive }) => {
            const IconComponent = item.icon;
            return (
              <>
                <IconComponent
                  size={20}
                  className={cn(
                    'mb-1',
                    isActive ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'
                  )}
                />
                <span className={cn(
                  'text-xs leading-tight',
                  isActive ? 'text-green-500 font-medium' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {item.name}
                </span>
              </>
            );
          }}
        </NavLink>
      ))}
    </div>
  );
};

export default BottomNavigation;