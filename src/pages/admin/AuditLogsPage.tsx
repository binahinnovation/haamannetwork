import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Eye, 
  Search, 
  Filter, 
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { formatCurrency } from '../../lib/utils';

type AuditLog = {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  error_message?: string;
  transaction_details: any;
  external_transaction_id?: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

const AuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (user?.isAdmin) {
      fetchAuditLogs();
    }
  }, [user, statusFilter, typeFilter, dateRange]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('wallet_audit_log')
        .select(`
          *,
          profiles!wallet_audit_log_user_id_fkey(name, email)
        `)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include user info
      const transformedData = data?.map(log => ({
        ...log,
        user_name: log.profiles?.name || 'Unknown User',
        user_email: log.profiles?.email || 'Unknown Email'
      })) || [];

      setAuditLogs(transformedData);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(query) ||
      log.user_email?.toLowerCase().includes(query) ||
      log.transaction_type.toLowerCase().includes(query) ||
      log.external_transaction_id?.toLowerCase().includes(query) ||
      log.error_message?.toLowerCase().includes(query)
    );
  });

  const exportLogs = () => {
    const csvContent = [
      ['Date', 'User', 'Email', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Status', 'Error', 'External ID'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.user_name,
        log.user_email,
        log.transaction_type,
        log.amount,
        log.balance_before,
        log.balance_after,
        log.status,
        log.error_message || '',
        log.external_transaction_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <Clock size={16} className="text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-6 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/security')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-2"
          >
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center">
            <Eye className="text-[#0F9D58] mr-3" size={24} />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Transaction Audit Logs</h1>
          </div>
        </div>
        
        <Button
          onClick={exportLogs}
          variant="outline"
          icon={<Download size={16} />}
          className="text-sm"
        >
          Export CSV
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="airtime_purchase">Airtime</option>
              <option value="data_purchase">Data</option>
              <option value="electricity_payment">Electricity</option>
              <option value="product_purchase">Products</option>
              <option value="wallet_funding">Wallet Funding</option>
            </select>

            {/* Date Range */}
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredLogs.length}</p>
              </div>
              <Eye className="text-blue-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Successful</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredLogs.filter(log => log.status === 'success').length}
                </p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredLogs.filter(log => log.status === 'failed').length}
                </p>
              </div>
              <XCircle className="text-red-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(filteredLogs.reduce((sum, log) => sum + (log.amount || 0), 0))}
                </p>
              </div>
              <DollarSign className="text-blue-500" size={24} />
            </div>
          </Card>
        </div>

        {/* Audit Logs Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Logs</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredLogs.length} logs
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Date/Time</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">User</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Type</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Balance Change</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-2">
                        <div className="text-gray-900 dark:text-white">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center">
                          <User size={14} className="text-gray-400 mr-2" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{log.user_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{log.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="capitalize text-gray-900 dark:text-white">
                          {log.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(log.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs">
                          <div className="text-gray-500 dark:text-gray-400">
                            Before: {formatCurrency(log.balance_before)}
                          </div>
                          <div className="text-gray-900 dark:text-white">
                            After: {formatCurrency(log.balance_after)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center">
                          {getStatusIcon(log.status)}
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {log.error_message ? (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            {log.error_message}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {log.external_transaction_id || 'N/A'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLogs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No audit logs found matching the selected filters.</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AuditLogsPage;