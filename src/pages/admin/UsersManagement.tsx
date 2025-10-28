import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Users, 
  Eye, 
  Ban, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Wallet, 
  TrendingUp,
  Trash2,
  AlertTriangle,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Key
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  wallet_balance: number;
  is_admin: boolean;
  referral_code: string;
  referred_by: string;
  total_referrals: number;
  referral_earnings: number;
  created_at: string;
  referrer_name?: string;
  transaction_pin?: string;
  hasPin?: boolean;
};

const UsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, resetTransactionPinForAdmin } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [userToResetPin, setUserToResetPin] = useState<User | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [resetPinSuccess, setResetPinSuccess] = useState(false);
  const [resetPinError, setResetPinError] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchUsers();
  }, [user, navigate, currentPage]);

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        fetchUsers(true);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = async (isSearch = false) => {
    try {
      setLoading(true);
      
      // If searching, reset to first page
      if (isSearch) {
        setCurrentPage(1);
      }
      
      // First get the total count for pagination with search applied
      let countQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      
      // Apply search filter to count query if provided
      if (searchQuery) {
        countQuery = countQuery.or(
          `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,referral_code.ilike.%${searchQuery}%`
        );
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
      // Calculate range for pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Get users with pagination and search
      let query = supabase
        .from('profiles')
        .select('*');
      
      // Apply search filter if provided
      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,referral_code.ilike.%${searchQuery}%`
        );
      }
      
      // Apply pagination
      query = query
        .range(from, to)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      // Create a map to store referrer names
      const userMap = new Map();
      data?.forEach(user => {
        userMap.set(user.id, user);
      });
      
      // Add referrer names to users
      const usersWithReferrers = data?.map(user => {
        const referrer = user.referred_by ? userMap.get(user.referred_by) : null;
        return {
          ...user,
          referrer_name: referrer ? referrer.name : null,
          hasPin: !!user.transaction_pin
        };
      }) || [];
      
      setUsers(usersWithReferrers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin privileges?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: currentStatus ? 'remove_admin' : 'grant_admin',
        details: { target_user_id: userId },
      }]);

      fetchUsers();
    } catch (error) {
      console.error('Error updating admin status:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setIsDeleting(true);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call the delete-user edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          adminId: user?.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      // Refresh the users list
      fetchUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
      
      alert(`User ${result.deletedUser.name} deleted successfully`);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Error deleting user: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    
    setIsBanning(true);
    try {
      // This is a placeholder for ban functionality
      // In a real implementation, you would:
      // 1. Add an is_banned column to the profiles table
      // 2. Set it to true for this user
      // 3. Modify auth logic to prevent banned users from logging in
      
      alert('Ban functionality not implemented yet. This would prevent the user from logging in.');
      
      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'ban_user',
        details: { 
          user_id: selectedUser.id,
          user_email: selectedUser.email,
          user_name: selectedUser.name
        },
      }]);
      
      setShowBanModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error banning user:', error);
      alert('Error banning user. Please try again.');
    } finally {
      setIsBanning(false);
    }
  };

  const handleResetPin = async () => {
    if (!userToResetPin) return;
    
    setIsResettingPin(true);
    setResetPinError('');
    setResetPinSuccess(false);
    
    try {
      await resetTransactionPinForAdmin(userToResetPin.id);
      setResetPinSuccess(true);
      
      // Update the user in the local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userToResetPin.id ? { ...u, hasPin: false } : u
        )
      );
      
      // If the user is currently selected in the modal, update that too
      if (selectedUser && selectedUser.id === userToResetPin.id) {
        setSelectedUser({ ...selectedUser, hasPin: false });
      }
    } catch (error) {
      console.error('Error resetting user PIN:', error);
      setResetPinError(error.message || 'Failed to reset PIN. Please try again.');
    } finally {
      setIsResettingPin(false);
    }
  };

  // Export to PDF function
  const handleExportPdf = async () => {
    setExportLoading(true);
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.setTextColor(15, 157, 88); // Primary color #0F9D58
      doc.text('ArabNetwork - User Report', 105, 15, { align: 'center' });
      
      // Add filters info
      doc.setFontSize(10);
      doc.setTextColor(100);
      let filterText = `Search: "${searchQuery || 'None'}"`;
      doc.text(filterText, 105, 22, { align: 'center' });
      
      // Add date
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 27, { align: 'center' });
      
      // Add summary
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Summary:', 14, 35);
      
      doc.setFontSize(10);
      doc.text(`Total Users: ${totalCount}`, 14, 42);
      doc.text(`Admin Users: ${users.filter(u => u.is_admin).length}`, 14, 48);
      
      const totalWalletBalance = users.reduce((sum, u) => sum + Number(u.wallet_balance), 0);
      doc.text(`Total Wallet Balance: ${formatCurrency(totalWalletBalance)}`, 14, 54);
      
      // Get data for export
      let usersToExport = users;
      
      // If exporting all pages, fetch all users matching the search
      if (exportScope === 'all') {
        let query = supabase
          .from('profiles')
          .select('*');
        
        // Apply search filter if provided
        if (searchQuery) {
          query = query.or(
            `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,referral_code.ilike.%${searchQuery}%`
          );
        }
        
        // Order by created_at
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        usersToExport = data || [];
      }
      
      // Add table
      const tableColumn = ["Name", "Email", "Phone", "Wallet Balance", "Referrals", "Joined"];
      const tableRows = usersToExport.map(user => [
        user.name,
        user.email,
        user.phone || 'N/A',
        formatCurrency(user.wallet_balance),
        user.total_referrals.toString(),
        formatDate(user.created_at)
      ]);
      
      // @ts-ignore - jspdf-autotable types are not included
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 60,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [15, 157, 88], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
          0: { cellWidth: 40 }, // Name
          1: { cellWidth: 50 }, // Email
          2: { cellWidth: 30 }, // Phone
          3: { cellWidth: 30, halign: 'right' }, // Wallet Balance
          4: { cellWidth: 20, halign: 'center' }, // Referrals
          5: { cellWidth: 30 } // Joined
        },
      });
      
      // Save the PDF
      doc.save(`haaman-users-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Export to CSV function
  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      // Get data for export
      let usersToExport = users;
      
      // If exporting all pages, fetch all users matching the search
      if (exportScope === 'all') {
        let query = supabase
          .from('profiles')
          .select('*');
        
        // Apply search filter if provided
        if (searchQuery) {
          query = query.or(
            `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,referral_code.ilike.%${searchQuery}%`
          );
        }
        
        // Order by created_at
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        usersToExport = data || [];
      }
      
      // Create CSV content
      const headers = ['Name', 'Email', 'Phone', 'Wallet Balance', 'Referrals', 'Referral Earnings', 'Joined', 'Referred By'];
      
      const rows = usersToExport.map(user => [
        user.name,
        user.email,
        user.phone || '',
        user.wallet_balance.toString(),
        user.total_referrals.toString(),
        user.referral_earnings.toString(),
        user.created_at,
        user.referrer_name || ''
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `haaman-users-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if there are few
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate start and end of middle pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4);
      }
      
      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

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
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-4"
              >
                <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{totalCount} total users</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <div className="relative">
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as 'current' | 'all')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                >
                  <option value="current">Export Current Page</option>
                  <option value="all">Export All Results</option>
                </select>
              </div>
              <button
                onClick={handleExportPdf}
                disabled={exportLoading || users.length === 0}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <FileText size={16} className="mr-2" />
                Export PDF
              </button>
              <button
                onClick={handleExportCsv}
                disabled={exportLoading || users.length === 0}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <Download size={16} className="mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.filter(u => u.is_admin).length}</p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Wallet Balance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(users.reduce((sum, u) => sum + Number(u.wallet_balance), 0))}</p>
              </div>
              <Wallet className="text-purple-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New Users (30d)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {users.filter(u => {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return new Date(u.created_at) > thirtyDaysAgo;
                  }).length}
                </p>
              </div>
              <TrendingUp className="text-orange-500" size={24} />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search users by name, email, phone, or referral code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
              />
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Filter size={16} className="mr-2" />
              {totalCount} users found
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Wallet Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Referrals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Referred By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#0F9D58] to-[#0d8a4f] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(user.wallet_balance)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {user.total_referrals} referrals
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(user.referral_earnings)} earned
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {user.referrer_name || 'None'}
                      </div>
                      {user.referred_by && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {user.referred_by.slice(0, 6)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_admin 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="View User"
                      >
                        <Eye size={16} />
                      </button>
                      {user.id !== user?.id && (
                        <>
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                            className={`${
                              user.is_admin 
                                ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300' 
                                : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                            }`}
                            title={user.is_admin ? 'Remove Admin' : 'Make Admin'}
                          >
                            {user.is_admin ? <Ban size={16} /> : <CheckCircle size={16} />}
                          </button>
                          <button
                            onClick={() => {
                              setUserToResetPin(user);
                              setShowResetPinModal(true);
                              setResetPinSuccess(false);
                              setResetPinError('');
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Reset PIN"
                          >
                            <Key size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowBanModal(true);
                            }}
                            className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                            title="Ban User"
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} users
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() => typeof page === 'number' ? handlePageClick(page) : null}
                  disabled={page === '...'}
                  className={`px-3 py-1 rounded-md ${
                    page === currentPage
                      ? 'bg-[#0F9D58] text-white'
                      : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  } ${page === '...' ? 'cursor-default' : ''}`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Details</h2>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <p className="text-gray-900 dark:text-white">{selectedUser.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <p className="text-gray-900 dark:text-white">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <p className="text-gray-900 dark:text-white">{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedUser.is_admin 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedUser.is_admin ? 'Admin' : 'User'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Financial Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wallet Balance</label>
                    <p className="text-2xl font-bold text-[#0F9D58]">{formatCurrency(selectedUser.wallet_balance)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referral Earnings</label>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedUser.referral_earnings)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction PIN</label>
                    <div className="flex items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedUser.hasPin 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedUser.hasPin ? 'PIN Set' : 'No PIN'}
                      </span>
                      {selectedUser.id !== user?.id && (
                        <button
                          onClick={() => {
                            setUserToResetPin(selectedUser);
                            setShowResetPinModal(true);
                            setResetPinSuccess(false);
                            setResetPinError('');
                            setShowUserModal(false);
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        >
                          Reset PIN
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Referral Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referral Code</label>
                    <p className="text-gray-900 dark:text-white font-mono">{selectedUser.referral_code}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Referrals</label>
                    <p className="text-gray-900 dark:text-white">{selectedUser.total_referrals}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referred By</label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedUser.referrer_name ? selectedUser.referrer_name : 'Not referred by anyone'}
                    </p>
                    {selectedUser.referred_by && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ID: {selectedUser.referred_by}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">User ID</label>
                    <p className="text-gray-900 dark:text-white font-mono text-sm">{selectedUser.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Joined Date</label>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedUser.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedUser.id !== user?.id && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowUserModal(false);
                        setShowBanModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      Ban User
                    </button>
                    <button
                      onClick={() => {
                        setShowUserModal(false);
                        setShowDeleteModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete User
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <AlertTriangle className="text-red-500 mr-3" size={24} />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete User</h2>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete the user <strong>{selectedUser.name}</strong>? This action cannot be undone and will remove all user data including transactions, orders, and wallet balance.
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
                  <div className="ml-3">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      <strong>Warning:</strong> This is a permanent action. All data associated with this user will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">User Information</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">Name: {selectedUser.name}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">Email: {selectedUser.email}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">Wallet Balance: {formatCurrency(selectedUser.wallet_balance)}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">Joined: {formatDate(selectedUser.created_at)}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {showBanModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Ban className="text-orange-500 mr-3" size={24} />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ban User</h2>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to ban the user <strong>{selectedUser.name}</strong>? This will prevent them from logging in to the platform.
              </p>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>Note:</strong> Banning is different from deleting. The user's data will remain in the system, but they will not be able to access their account.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">User Information</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">Name: {selectedUser.name}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">Email: {selectedUser.email}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">Joined: {formatDate(selectedUser.created_at)}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBanModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBanUser}
                  disabled={isBanning}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isBanning ? 'Banning...' : 'Ban User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN Confirmation Modal */}
      {showResetPinModal && userToResetPin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Key className="text-blue-500 mr-3" size={24} />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reset User's PIN</h2>
              </div>
            </div>
            
            <div className="p-6">
              {resetPinSuccess ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-green-500" size={28} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">PIN Reset Successfully</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    The transaction PIN for <strong>{userToResetPin.name}</strong> has been reset successfully. The user will need to set a new PIN before making any transactions.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to reset the transaction PIN for <strong>{userToResetPin.name}</strong>? This will remove their current PIN and they will need to set a new one before making any transactions.
                  </p>
                  
                  {resetPinError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                      <div className="flex items-start">
                        <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
                        <div className="ml-3">
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {resetPinError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <AlertTriangle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                      <div className="ml-3">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Note:</strong> This action is useful when a user has forgotten their PIN or is locked out of their account due to too many failed PIN attempts.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">User Information</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Name: {userToResetPin.name}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Email: {userToResetPin.email}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">PIN Status: {userToResetPin.hasPin ? 'PIN Set' : 'No PIN'}</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowResetPinModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {resetPinSuccess ? 'Close' : 'Cancel'}
                </button>
                {!resetPinSuccess && (
                  <button
                    onClick={handleResetPin}
                    disabled={isResettingPin}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isResettingPin ? 'Resetting...' : 'Reset PIN'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;