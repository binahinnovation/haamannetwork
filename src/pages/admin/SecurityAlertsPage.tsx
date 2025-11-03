import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Shield, 
  Clock,
  User,
  DollarSign,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../lib/utils';

type SecurityAlert = {
  id: string;
  user_id: string;
  alert_type: string;
  transaction_type: string;
  amount: number;
  error_message: string;
  transaction_details: any;
  created_at: string;
  severity: string;
  user_name?: string;
  user_email?: string;
};

const SecurityAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (user?.isAdmin) {
      fetchSecurityAlerts();
    }
  }, [user]);

  const fetchSecurityAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_security_alerts', { p_limit: 100 });

      if (error) throw error;

      if (data?.alerts) {
        // Fetch user details for each alert
        const userIds = [...new Set(data.alerts.map((alert: any) => alert.user_id))];
        const { data: users } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const userMap = new Map(users?.map(u => [u.id, u]) || []);

        const enrichedAlerts = data.alerts.map((alert: any) => ({
          ...alert,
          user_name: userMap.get(alert.user_id)?.name || 'Unknown User',
          user_email: userMap.get(alert.user_id)?.email || 'Unknown Email'
        }));

        setAlerts(enrichedAlerts);
      }
    } catch (error) {
      console.error('Error fetching security alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && alert.alert_type !== typeFilter) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return <XCircle size={16} className="text-red-500" />;
      case 'MEDIUM':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'LOW':
        return <CheckCircle size={16} className="text-blue-500" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'SPENDING_LIMIT_EXCEEDED':
        return 'Spending Limit Exceeded';
      case 'DUPLICATE_TRANSACTION_ATTEMPT':
        return 'Duplicate Transaction';
      case 'INSUFFICIENT_BALANCE':
        return 'Insufficient Balance';
      default:
        return 'Other Error';
    }
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'SPENDING_LIMIT_EXCEEDED':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800';
      case 'DUPLICATE_TRANSACTION_ATTEMPT':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-300 dark:border-yellow-800';
      case 'INSUFFICIENT_BALANCE':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/10 dark:text-gray-300 dark:border-gray-800';
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
            <AlertTriangle className="text-[#0F9D58] mr-3" size={24} />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Security Alerts</h1>
          </div>
        </div>
        
        <Button
          onClick={fetchSecurityAlerts}
          variant="outline"
          icon={<RefreshCw size={16} />}
          className="text-sm"
        >
          Refresh
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Filter className="text-gray-500 mr-2" size={16} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>
            
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Severities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Types</option>
              <option value="SPENDING_LIMIT_EXCEEDED">Spending Limit</option>
              <option value="DUPLICATE_TRANSACTION_ATTEMPT">Duplicate Transaction</option>
              <option value="INSUFFICIENT_BALANCE">Insufficient Balance</option>
              <option value="OTHER_ERROR">Other Errors</option>
            </select>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredAlerts.length}</p>
              </div>
              <Shield className="text-blue-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">High Severity</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredAlerts.filter(alert => alert.severity === 'HIGH').length}
                </p>
              </div>
              <XCircle className="text-red-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Medium Severity</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredAlerts.filter(alert => alert.severity === 'MEDIUM').length}
                </p>
              </div>
              <AlertTriangle className="text-yellow-500" size={24} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Low Severity</p>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredAlerts.filter(alert => alert.severity === 'LOW').length}
                </p>
              </div>
              <CheckCircle className="text-blue-500" size={24} />
            </div>
          </Card>
        </div>

        {/* Alerts List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Security Alerts</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last 24 hours • {filteredAlerts.length} alerts
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F9D58]"></div>
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className={`border rounded-lg p-4 ${getAlertTypeColor(alert.alert_type)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium">{getAlertTypeLabel(alert.alert_type)}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center">
                            <User size={14} className="mr-2" />
                            <div>
                              <p className="font-medium">{alert.user_name}</p>
                              <p className="text-xs opacity-75">{alert.user_email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <DollarSign size={14} className="mr-2" />
                            <div>
                              <p className="font-medium">{formatCurrency(alert.amount)}</p>
                              <p className="text-xs opacity-75 capitalize">{alert.transaction_type.replace('_', ' ')}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Clock size={14} className="mr-2" />
                            <div>
                              <p className="font-medium">{new Date(alert.created_at).toLocaleTimeString()}</p>
                              <p className="text-xs opacity-75">{new Date(alert.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs">
                          <strong>Error:</strong> {alert.error_message}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="mx-auto text-green-500 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Security Alerts</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Great! No security violations have been detected in the last 24 hours.
              </p>
            </div>
          )}
        </Card>

        {/* Information Panel */}
        <Card className="p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Alert Types Explained</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">Spending Limit Exceeded</h4>
              <p className="text-red-700 dark:text-red-300">User attempted to spend more than their daily limit</p>
            </div>
            
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Duplicate Transaction</h4>
              <p className="text-yellow-700 dark:text-yellow-300">Multiple identical transactions attempted simultaneously</p>
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Insufficient Balance</h4>
              <p className="text-blue-700 dark:text-blue-300">Transaction attempted with insufficient wallet balance</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SecurityAlertsPage;