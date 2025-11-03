import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ShoppingBag, DollarSign, TrendingUp, Settings, Package, CreditCard, Activity, LogOut, Eye, Plus, Wallet, Wifi, Ban as Bank, Tag, MessageCircle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../lib/utils';

type DashboardStats = {
  totalUsers: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  pendingTransactions: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalVirtualAccounts: number;
  openSupportTickets: number;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingTransactions: 0,
    activeUsers: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    totalVirtualAccounts: 0,
    openSupportTickets: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchDashboardStats();
    fetchRecentUsers();
    fetchRecentTransactions();
    fetchRecentTickets();
  }, [user, navigate]);

  const fetchDashboardStats = async () => {
    try {
      // Fetch users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch transactions stats
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, status, created_at');

      const totalTransactions = transactions?.length || 0;
      
      // Calculate total revenue from successful transactions only
      const totalRevenue = transactions
        ?.filter(t => t.status === 'success')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        
      const pendingTransactions = transactions?.filter(t => t.status === 'pending').length || 0;

      // Active users (users who made transactions in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: activeTransactions } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Count unique user IDs from transactions
      const uniqueActiveUserIds = new Set();
      activeTransactions?.forEach(t => {
        if (t.user_id) uniqueActiveUserIds.add(t.user_id);
      });
      const uniqueActiveUsers = uniqueActiveUserIds.size;

      // New users today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: newUsersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // New users this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { count: newUsersThisWeek } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      // New users this month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { count: newUsersThisMonth } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo.toISOString());

      // Count virtual accounts
      const { count: virtualAccountsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('virtual_account_number', 'is', null);

      // Count open support tickets
      const { count: openTicketsCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'pending_admin_reply']);

      setStats({
        totalUsers: usersCount || 0,
        totalProducts: productsCount || 0,
        totalTransactions,
        totalRevenue,
        pendingTransactions,
        activeUsers: uniqueActiveUsers,
        newUsersToday: newUsersToday || 0,
        newUsersThisWeek: newUsersThisWeek || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        totalVirtualAccounts: virtualAccountsCount || 0,
        openSupportTickets: openTicketsCount || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, created_at, referred_by')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // Get referrer names for users who were referred
      const usersWithReferrers = await Promise.all(
        (data || []).map(async (user) => {
          if (user.referred_by) {
            const { data: referrer } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', user.referred_by)
              .single();
            
            return {
              ...user,
              referrer_name: referrer?.name || 'Unknown'
            };
          }
          return {
            ...user,
            referrer_name: null
          };
        })
      );
      
      setRecentUsers(usersWithReferrers);
    } catch (error) {
      console.error('Error fetching recent users:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles!transactions_user_id_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentTransactions(data || []);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles!support_tickets_user_id_fkey (
            name,
            email
          )
        `)
        .in('status', ['open', 'pending_admin_reply'])
        .order('priority', { ascending: false })
        .order('last_message_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentTickets(data || []);
    } catch (error) {
      console.error('Error fetching recent tickets:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const menuItems = [
    {
      title: 'Products',
      description: 'Manage store products',
      icon: Package,
      path: '/admin/products',
      color: 'bg-blue-500',
    },
    {
      title: 'Categories',
      description: 'Manage product categories',
      icon: Tag,
      path: '/admin/product-categories',
      color: 'bg-indigo-500',
    },
    {
      title: 'Users',
      description: 'View and manage users',
      icon: Users,
      path: '/admin/users',
      color: 'bg-green-500',
    },
    {
      title: 'Security Dashboard',
      description: 'Monitor security & spending limits',
      icon: Shield,
      path: '/admin/security',
      color: 'bg-red-500',
    },
    {
      title: 'Transactions',
      description: 'Monitor all transactions',
      icon: CreditCard,
      path: '/admin/transactions',
      color: 'bg-purple-500',
    },
    {
      title: 'Orders',
      description: 'Manage customer orders',
      icon: ShoppingBag,
      path: '/admin/orders',
      color: 'bg-indigo-500',
    },
    {
      title: 'Wallet Management',
      description: 'Fund user wallets',
      icon: Wallet,
      path: '/admin/wallet',
      color: 'bg-emerald-500',
    },
    {
      title: 'Virtual Accounts',
      description: 'Manage virtual accounts',
      icon: Bank,
      path: '/admin/virtual-accounts',
      color: 'bg-pink-500',
    },
    {
      title: 'Data Plans',
      description: 'Manage data plans & pricing',
      icon: Wifi,
      path: '/admin/data-plans',
      color: 'bg-amber-500',
    },
    {
      title: 'Support Tickets',
      description: 'Manage customer support',
      icon: MessageCircle,
      path: '/admin/support-tickets',
      color: 'bg-red-500',
    },
    {
      title: 'Settings',
      description: 'Configure app settings',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-orange-500',
    },
  ];

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: 'bg-blue-500',
      change: `+${stats.newUsersThisMonth}`,
      period: 'this month'
    },
    {
      title: 'Total Products',
      value: stats.totalProducts.toLocaleString(),
      icon: Package,
      color: 'bg-green-500',
      change: '+5%',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'bg-purple-500',
      change: '+18%',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers.toLocaleString(),
      icon: Activity,
      color: 'bg-orange-500',
      change: '+8%',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#0F9D58] rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {user?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Eye size={16} className="mr-2" />
                View Site
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                  {stat.change && (
                    <p className="text-sm text-green-600 mt-1">{stat.change} {stat.period || 'from last month'}</p>
                  )}
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Users Today</h3>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Users className="text-blue-500" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.newUsersToday}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Transactions</h3>
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <CreditCard className="text-yellow-500" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingTransactions}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Virtual Accounts</h3>
              <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
                <Bank className="text-pink-500" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalVirtualAccounts}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Open Support Tickets</h3>
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <MessageCircle className="text-red-500" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.openSupportTickets}</p>
            {stats.openSupportTickets > 0 && (
              <button 
                onClick={() => navigate('/admin/support-tickets')}
                className="mt-2 text-sm text-red-500 hover:underline"
              >
                View tickets →
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 text-left group"
            >
              <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className="text-white" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Users</h3>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="text-sm text-[#0F9D58] hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <div className="p-6">
              {recentUsers.length > 0 ? (
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#0F9D58] to-[#0d8a4f] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                        {user.referred_by && (
                          <p className="text-xs text-[#0F9D58]">
                            Referred by: {user.referrer_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center">No recent users</p>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                <button
                  onClick={() => navigate('/admin/transactions')}
                  className="text-sm text-[#0F9D58] hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <div className="p-6">
              {recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.type === 'wallet_funding' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          <span className={`${
                            transaction.type === 'wallet_funding' 
                              ? 'text-green-500' 
                              : 'text-blue-500'
                          }`}>
                            {transaction.type === 'wallet_funding' ? <Plus size={18} /> : <CreditCard size={18} />}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.type.replace('_', ' ').toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {transaction.profiles?.name || 'Unknown user'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className={`text-xs ${
                          transaction.status === 'success' 
                            ? 'text-green-500' 
                            : transaction.status === 'pending' 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                        }`}>
                          {transaction.status.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center">No recent transactions</p>
              )}
            </div>
          </div>

          {/* Recent Support Tickets */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Support Tickets</h3>
                <button
                  onClick={() => navigate('/admin/support-tickets')}
                  className="text-sm text-[#0F9D58] hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
            <div className="p-6">
              {recentTickets.length > 0 ? (
                <div className="space-y-4">
                  {recentTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ticket.priority === 'high' || ticket.priority === 'critical'
                            ? 'bg-red-100 dark:bg-red-900/30' 
                            : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          <MessageCircle className={`${
                            ticket.priority === 'high' || ticket.priority === 'critical'
                              ? 'text-red-500' 
                              : 'text-blue-500'
                          }`} size={18} />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {ticket.subject.length > 20 
                              ? ticket.subject.substring(0, 20) + '...' 
                              : ticket.subject}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {ticket.profiles?.name || 'Unknown user'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs px-2 py-1 rounded-full ${
                          ticket.priority === 'critical' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                            : ticket.priority === 'high'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {ticket.priority.toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(ticket.last_message_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center">No open support tickets</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;