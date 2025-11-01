import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Save,
  Percent,
  Wifi,
  Database,
  Tag,
  Clock,
  DollarSign,
  Star,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../lib/utils';

type DataPlan = {
  id: string;
  external_id: number;
  network: string;
  plan_type: string;
  size: string;
  validity: string;
  cost_price: number;
  selling_price: number;
  profit_margin: number;
  description: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  discount_percentage: number;
  show_discount_badge: boolean;
  provider?: 'maskawa' | 'smeplug';
};

type DataPlanCategory = {
  id: string;
  network: string;
  plan_type: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

const DataPlansManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  const [categories, setCategories] = useState<DataPlanCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DataPlan | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkProfitMargin, setBulkProfitMargin] = useState('');
  const [bulkNetworkFilter, setBulkNetworkFilter] = useState('all');
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState('all');
  const [globalProfitMargin, setGlobalProfitMargin] = useState('');
  const [isUpdatingGlobalMargin, setIsUpdatingGlobalMargin] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DataPlanCategory | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    selling_price: '',
    profit_margin: '',
    is_active: true,
    is_popular: false,
    discount_percentage: 0,
    show_discount_badge: false,
    external_id: '',
    provider: 'smeplug',
  });

  const [categoryFormData, setcategoryFormData] = useState({
    network: '',
    plan_type: '',
    display_name: '',
    description: '',
    is_active: true,
    sort_order: 0,
  });

  // Add Plan modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    network: '',
    plan_type: '',
    size: '',
    validity: '',
    external_id: '',
    provider: 'smeplug',
    cost_price: '',
    profit_margin: '',
    selling_price: '',
    description: '',
    is_active: true,
    is_popular: false,
    discount_percentage: 0,
    show_discount_badge: false,
    sort_order: 0,
  });

  // Success banner and selection state
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/admin/login');
      return;
    }
    fetchDataPlans();
    fetchCategories();
    fetchGlobalProfitMargin();
  }, [user, navigate]);

  const fetchDataPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select('*')
        .order('network')
        .order('plan_type')
        .order('sort_order');

      if (error) throw error;
      setDataPlans(data || []);
    } catch (error) {
      console.error('Error fetching data plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('data_plan_categories')
        .select('*')
        .order('network')
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchGlobalProfitMargin = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'data_plan_profit_margin')
        .single();

      if (error) throw error;
      setGlobalProfitMargin(data?.value || '15');
    } catch (error) {
      console.error('Error fetching global profit margin:', error);
      setGlobalProfitMargin('15'); // Default to 15% if not found
    }
  };

  const handleEditPlan = (plan: DataPlan) => {
    setEditingPlan(plan);
    setFormData({
      description: plan.description,
      selling_price: plan.selling_price.toString(),
      profit_margin: plan.profit_margin.toString(),
      is_active: plan.is_active,
      is_popular: plan.is_popular,
      discount_percentage: plan.discount_percentage || 0,
      show_discount_badge: plan.show_discount_badge || false,
      external_id: String(plan.external_id || ''),
      provider: plan.provider || 'smeplug',
    });
    setShowEditModal(true);
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;

    try {
      const profit_margin = parseFloat(formData.profit_margin);
      const selling_price = parseFloat(formData.selling_price);
      const discount_percentage = parseInt(formData.discount_percentage.toString());
      const external_id_num = parseInt(String(formData.external_id));
      const provider_value = formData.provider === 'maskawa' ? 'maskawa' : 'smeplug';
      
      // Validate inputs
      if (isNaN(external_id_num) || external_id_num <= 0) {
        alert('Please enter a valid External ID (number)');
        return;
      }
      if (isNaN(profit_margin) || isNaN(selling_price) || selling_price <= 0) {
        alert('Please enter valid numbers for selling price and profit margin');
        return;
      }

      if (isNaN(discount_percentage) || discount_percentage < 0 || discount_percentage > 100) {
        alert('Discount percentage must be between 0 and 100');
        return;
      }

      const { error } = await supabase
        .from('data_plans')
        .update({
          description: formData.description,
          selling_price: selling_price,
          profit_margin: profit_margin,
          is_active: formData.is_active,
          is_popular: formData.is_popular,
          discount_percentage: discount_percentage,
          show_discount_badge: formData.show_discount_badge,
          external_id: external_id_num,
          provider: provider_value,
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'update_data_plan',
        details: { 
          plan_id: editingPlan.id,
          plan_name: editingPlan.description,
          network: editingPlan.network,
          external_id_old: editingPlan.external_id,
          external_id_new: external_id_num,
          provider: provider_value,
        },
      }]);

      fetchDataPlans();
      setShowEditModal(false);
      setEditingPlan(null);
      setSuccessMessage('Data plan updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating data plan:', error);
      alert('Error updating data plan. Please try again.');
    }
  };

  // Open Add Plan Modal
  const handleOpenAddPlan = () => {
    setAddForm({
      network: '',
      plan_type: '',
      size: '',
      validity: '',
      external_id: '',
      cost_price: '',
      profit_margin: globalProfitMargin || '15',
      selling_price: '',
      description: '',
      is_active: true,
      is_popular: false,
      discount_percentage: 0,
      show_discount_badge: false,
      sort_order: 0,
    });
    setShowAddModal(true);
  };

  // Save new plan
  const handleSaveNewPlan = async () => {
    try {
      // Basic validation
      if (!addForm.network || !addForm.plan_type || !addForm.size || !addForm.validity) {
        alert('Please fill in Network, Plan Type, Size, and Validity');
        return;
      }
      const external_id_num = parseInt(addForm.external_id);
      if (isNaN(external_id_num) || external_id_num <= 0) {
        alert('Please enter a valid External ID');
        return;
      }
      const cost_price_num = parseFloat(addForm.cost_price);
      if (isNaN(cost_price_num) || cost_price_num <= 0) {
        alert('Please enter a valid Cost Price');
        return;
      }
      const profit_margin_num = parseFloat(addForm.profit_margin || '0');
      const selling_price_num = addForm.selling_price
        ? parseFloat(addForm.selling_price)
        : Math.ceil(cost_price_num + (cost_price_num * (profit_margin_num / 100)));
      const discount_percentage_num = parseInt(String(addForm.discount_percentage));
      const sort_order_num = parseInt(String(addForm.sort_order || 0));

      const { error } = await supabase
        .from('data_plans')
        .insert([{
          external_id: external_id_num,
          network: addForm.network,
          plan_type: addForm.plan_type,
          size: addForm.size,
          validity: addForm.validity,
          cost_price: cost_price_num,
          selling_price: selling_price_num,
          profit_margin: profit_margin_num,
          description: addForm.description,
          is_active: addForm.is_active,
          is_popular: addForm.is_popular,
          sort_order: isNaN(sort_order_num) ? 0 : sort_order_num,
          discount_percentage: isNaN(discount_percentage_num) ? 0 : discount_percentage_num,
          show_discount_badge: addForm.show_discount_badge,
          provider: addForm.provider as any,
        }]);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'create_data_plan',
        details: {
          network: addForm.network,
          plan_type: addForm.plan_type,
          size: addForm.size,
          validity: addForm.validity,
          external_id: external_id_num,
          provider: addForm.provider,
        },
      }]);

      fetchDataPlans();
      setShowAddModal(false);
      setSuccessMessage('Data plan created successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating data plan:', error);
      alert('Error creating data plan. Please ensure External ID is unique and try again.');
    }
  };

  // Selection helpers
  const togglePlanSelection = (planId: string) => {
    setSelectedPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId); else next.add(planId);
      return next;
    });
  };

  const toggleSelectAllInGroup = (plansInGroup: DataPlan[]) => {
    const allSelected = plansInGroup.every(p => selectedPlanIds.has(p.id));
    setSelectedPlanIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        plansInGroup.forEach(p => next.delete(p.id));
      } else {
        plansInGroup.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  // Delete single plan
  const handleDeletePlan = async (plan: DataPlan) => {
    const confirmed = window.confirm(`Delete data plan "${plan.description}" for ${plan.network}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('data_plans')
        .delete()
        .eq('id', plan.id);
      if (error) throw error;

      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'delete_data_plan',
        details: { plan_id: plan.id, network: plan.network, size: plan.size, plan_type: plan.plan_type },
      }]);

      setSelectedPlanIds(prev => { const next = new Set(prev); next.delete(plan.id); return next; });
      fetchDataPlans();
      setSuccessMessage('Data plan deleted');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting data plan:', error);
      alert('Error deleting data plan.');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedPlanIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected data plan(s)? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('data_plans')
        .delete()
        .in('id', ids);
      if (error) throw error;

      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'bulk_delete_data_plans',
        details: { count: ids.length, plan_ids: ids },
      }]);

      setSelectedPlanIds(new Set());
      fetchDataPlans();
      setSuccessMessage('Selected data plans deleted');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error bulk deleting data plans:', error);
      alert('Error bulk deleting data plans.');
    }
  };

  const handleToggleActive = async (plan: DataPlan) => {
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: plan.is_active ? 'deactivate_data_plan' : 'activate_data_plan',
        details: { 
          plan_id: plan.id,
          plan_name: plan.description,
          network: plan.network,
        },
      }]);

      fetchDataPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      alert('Error updating plan status. Please try again.');
    }
  };

  const handleTogglePopular = async (plan: DataPlan) => {
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({ is_popular: !plan.is_popular })
        .eq('id', plan.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: plan.is_popular ? 'remove_popular_data_plan' : 'mark_popular_data_plan',
        details: { 
          plan_id: plan.id,
          plan_name: plan.description,
          network: plan.network,
        },
      }]);

      fetchDataPlans();
    } catch (error) {
      console.error('Error toggling popular status:', error);
      alert('Error updating popular status. Please try again.');
    }
  };

  const handleToggleDiscountBadge = async (plan: DataPlan) => {
    try {
      const { error } = await supabase
        .from('data_plans')
        .update({ show_discount_badge: !plan.show_discount_badge })
        .eq('id', plan.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: plan.show_discount_badge ? 'hide_discount_badge' : 'show_discount_badge',
        details: { 
          plan_id: plan.id,
          plan_name: plan.description,
          network: plan.network,
        },
      }]);

      fetchDataPlans();
    } catch (error) {
      console.error('Error toggling discount badge:', error);
      alert('Error updating discount badge visibility. Please try again.');
    }
  };

  const handleBulkUpdate = async () => {
    try {
      const profitMargin = parseFloat(bulkProfitMargin);
      
      if (isNaN(profitMargin)) {
        alert('Please enter a valid profit margin percentage');
        return;
      }

      // Build query
      let query = supabase
        .from('data_plans')
        .update({ profit_margin: profitMargin });

      // Apply filters
      if (bulkNetworkFilter !== 'all') {
        query = query.eq('network', bulkNetworkFilter);
      }
      
      if (bulkCategoryFilter !== 'all') {
        query = query.eq('plan_type', bulkCategoryFilter);
      }

      const { error } = await query;

      if (error) throw error;

      // Update selling prices based on new profit margin
      const { data: updatedPlans, error: fetchError } = await supabase
        .from('data_plans')
        .select('*');

      if (fetchError) throw fetchError;

      // For each plan, recalculate selling price based on cost_price and profit_margin
      for (const plan of updatedPlans || []) {
        if ((bulkNetworkFilter === 'all' || plan.network === bulkNetworkFilter) &&
            (bulkCategoryFilter === 'all' || plan.plan_type === bulkCategoryFilter)) {
          
          const newSellingPrice = Math.ceil(plan.cost_price + (plan.cost_price * (profitMargin / 100)));
          
          await supabase
            .from('data_plans')
            .update({ selling_price: newSellingPrice })
            .eq('id', plan.id);
        }
      }

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'bulk_update_data_plans',
        details: { 
          profit_margin: profitMargin,
          network_filter: bulkNetworkFilter,
          category_filter: bulkCategoryFilter,
        },
      }]);

      fetchDataPlans();
      setShowBulkEditModal(false);
      setBulkProfitMargin('');
      setBulkNetworkFilter('all');
      setBulkCategoryFilter('all');
    } catch (error) {
      console.error('Error performing bulk update:', error);
      alert('Error updating data plans. Please try again.');
    }
  };

  const handleUpdateGlobalMargin = async () => {
    try {
      setIsUpdatingGlobalMargin(true);
      const margin = parseFloat(globalProfitMargin);
      
      if (isNaN(margin)) {
        alert('Please enter a valid profit margin percentage');
        return;
      }

      // Update the admin setting
      const { error: settingError } = await supabase
        .from('admin_settings')
        .update({ value: margin.toString() })
        .eq('key', 'data_plan_profit_margin');

      if (settingError) throw settingError;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: 'update_global_profit_margin',
        details: { new_margin: margin },
      }]);

      alert('Global profit margin updated successfully!');
    } catch (error) {
      console.error('Error updating global profit margin:', error);
      alert('Error updating global profit margin. Please try again.');
    } finally {
      setIsUpdatingGlobalMargin(false);
    }
  };

  const handleAddEditCategory = () => {
    setEditingCategory(null);
    setcategoryFormData({
      network: '',
      plan_type: '',
      display_name: '',
      description: '',
      is_active: true,
      sort_order: 0,
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: DataPlanCategory) => {
    setEditingCategory(category);
    setcategoryFormData({
      network: category.network,
      plan_type: category.plan_type,
      display_name: category.display_name,
      description: category.description || '',
      is_active: category.is_active,
      sort_order: category.sort_order,
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (!categoryFormData.network || !categoryFormData.plan_type || !categoryFormData.display_name) {
        alert('Please fill in all required fields');
        return;
      }

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('data_plan_categories')
          .update({
            network: categoryFormData.network,
            plan_type: categoryFormData.plan_type,
            display_name: categoryFormData.display_name,
            description: categoryFormData.description,
            is_active: categoryFormData.is_active,
            sort_order: categoryFormData.sort_order,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        // Log admin action
        await supabase.from('admin_logs').insert([{
          admin_id: user?.id,
          action: 'update_data_plan_category',
          details: { 
            category_id: editingCategory.id,
            network: categoryFormData.network,
            plan_type: categoryFormData.plan_type,
          },
        }]);
      } else {
        // Create new category
        const { error } = await supabase
          .from('data_plan_categories')
          .insert([{
            network: categoryFormData.network,
            plan_type: categoryFormData.plan_type,
            display_name: categoryFormData.display_name,
            description: categoryFormData.description,
            is_active: categoryFormData.is_active,
            sort_order: categoryFormData.sort_order,
          }]);

        if (error) throw error;

        // Log admin action
        await supabase.from('admin_logs').insert([{
          admin_id: user?.id,
          action: 'create_data_plan_category',
          details: { 
            network: categoryFormData.network,
            plan_type: categoryFormData.plan_type,
          },
        }]);
      }

      fetchCategories();
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error saving category. Please try again.');
    }
  };

  const handleToggleCategoryActive = async (category: DataPlanCategory) => {
    try {
      const { error } = await supabase
        .from('data_plan_categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert([{
        admin_id: user?.id,
        action: category.is_active ? 'deactivate_data_plan_category' : 'activate_data_plan_category',
        details: { 
          category_id: category.id,
          network: category.network,
          plan_type: category.plan_type,
        },
      }]);

      fetchCategories();
    } catch (error) {
      console.error('Error toggling category status:', error);
      alert('Error updating category status. Please try again.');
    }
  };

  const filteredPlans = dataPlans.filter(plan => {
    const matchesSearch = 
      plan.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.validity.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesNetwork = selectedNetwork === 'all' || plan.network === selectedNetwork;
    const matchesCategory = selectedCategory === 'all' || plan.plan_type === selectedCategory;
    
    return matchesSearch && matchesNetwork && matchesCategory;
  });

  const networks = ['all', ...Array.from(new Set(dataPlans.map(p => p.network)))];
  const planTypes = ['all', ...Array.from(new Set(dataPlans.map(p => p.plan_type)))];

  // Group plans by category for better organization
  const groupedPlans: Record<string, DataPlan[]> = {};
  
  filteredPlans.forEach(plan => {
    const key = `${plan.network}-${plan.plan_type}`;
    if (!groupedPlans[key]) {
      groupedPlans[key] = [];
    }
    groupedPlans[key].push(plan);
  });

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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Plans Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{dataPlans.length} total data plans</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleOpenAddPlan()}
                className="flex items-center px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Add Plan
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedPlanIds.size === 0}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${selectedPlanIds.size === 0 ? 'bg-red-300 text-white opacity-50 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
              >
                <Trash2 size={16} className="mr-2" />
                Bulk Delete
              </button>
              <button
                onClick={() => handleAddEditCategory()}
                className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Tag size={16} className="mr-2" />
                Manage Categories
              </button>
              
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Percent size={16} className="mr-2" />
                Bulk Update Margins
              </button>
              
              <button
                onClick={() => fetchDataPlans()}
                className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="text-sm">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Profit Margin Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Percent className="mr-2 text-[#0F9D58]" size={20} />
            Global Profit Margin
          </h2>
          
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Profit Margin Percentage
              </label>
              <input
                type="number"
                value={globalProfitMargin}
                onChange={(e) => setGlobalProfitMargin(e.target.value)}
                min="0"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This is the default profit margin applied to new data plans. Changing this does not affect existing plans.
              </p>
            </div>
            
            <button
              onClick={handleUpdateGlobalMargin}
              disabled={isUpdatingGlobalMargin}
              className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors disabled:opacity-50"
            >
              {isUpdatingGlobalMargin ? 'Updating...' : 'Update Global Margin'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search data plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
              />
            </div>
            
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
            >
              {networks.map(network => (
                <option key={network} value={network}>
                  {network === 'all' ? 'All Networks' : network}
                </option>
              ))}
            </select>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
            >
              {planTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Plan Types' : type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Plan Categories */}
        {Object.keys(groupedPlans).length > 0 ? (
          Object.entries(groupedPlans).map(([key, plans]) => {
            const [network, planType] = key.split('-');
            const category = categories.find(c => c.network === network && c.plan_type === planType);
            
            return (
              <div key={key} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {network} - {category?.display_name || planType}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {plans.length} plans
                    </p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={plans.every(p => selectedPlanIds.has(p.id)) && plans.length > 0}
                            onChange={() => toggleSelectAllInGroup(plans)}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Data Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Validity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cost Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Selling Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Profit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Discount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Popular
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {plans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedPlanIds.has(plan.id)}
                              onChange={() => togglePlanSelection(plan.id)}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {plan.size}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {plan.validity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatCurrency(plan.cost_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(plan.selling_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-[#0F9D58]">
                                {formatCurrency(plan.selling_price - plan.cost_price)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({plan.profit_margin}%)
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                plan.show_discount_badge && plan.discount_percentage > 0
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {plan.discount_percentage > 0 ? `${plan.discount_percentage}% OFF` : 'No Discount'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {plan.show_discount_badge ? 'Visible' : 'Hidden'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              plan.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              plan.is_popular 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {plan.is_popular ? 'Popular' : 'Regular'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit Plan"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(plan)}
                              className={`${
                                plan.is_active 
                                  ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300' 
                                  : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                              }`}
                              title={plan.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {plan.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            <button
                              onClick={() => handleTogglePopular(plan)}
                              className={`${
                                plan.is_popular 
                                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300' 
                                  : 'text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300'
                              }`}
                              title={plan.is_popular ? 'Remove from Popular' : 'Mark as Popular'}
                            >
                              <Star size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleDiscountBadge(plan)}
                              className={`${
                                plan.show_discount_badge 
                                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300' 
                                  : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                              }`}
                              title={plan.show_discount_badge ? 'Hide Discount Badge' : 'Show Discount Badge'}
                            >
                              {plan.show_discount_badge ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete Plan"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No data plans found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Add Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Data Plan</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Network</label>
                  <select
                    value={addForm.network}
                    onChange={(e) => setAddForm({...addForm, network: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  >
                    <option value="">Select Network</option>
                    <option value="MTN">MTN</option>
                    <option value="AIRTEL">AIRTEL</option>
                    <option value="GLO">GLO</option>
                    <option value="9MOBILE">9MOBILE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Plan Type</label>
                  <select
                    value={addForm.plan_type}
                    onChange={(e) => setAddForm({...addForm, plan_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  >
                    <option value="">Select Plan Type</option>
                    {categories.map(c => (
                      <option key={`${c.network}-${c.plan_type}`} value={c.plan_type}>
                        {c.network === addForm.network || !addForm.network ? `${c.network} - ${c.display_name}` : `${c.network} - ${c.display_name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">External ID</label>
                  <input
                    type="number"
                    value={addForm.external_id}
                    onChange={(e) => setAddForm({...addForm, external_id: e.target.value})}
                    placeholder="Provider plan ID"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={addForm.sort_order}
                    onChange={(e) => setAddForm({...addForm, sort_order: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Provider</label>
                  <select
                    value={addForm.provider}
                    onChange={(e) => setAddForm({ ...addForm, provider: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  >
                    <option value="smeplug">SME Plug</option>
                    {/* MASKAWA option hidden but kept for future use */}
                    {/* <option value="maskawa">MASKAWA</option> */}
                  </select>
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Size</label>
                  <input
                    type="text"
                    value={addForm.size}
                    onChange={(e) => setAddForm({...addForm, size: e.target.value})}
                    placeholder="e.g., 1GB"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Validity</label>
                  <input
                    type="text"
                    value={addForm.validity}
                    onChange={(e) => setAddForm({...addForm, validity: e.target.value})}
                    placeholder="e.g., 30 days"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cost Price (₦)</label>
                  <input
                    type="number"
                    value={addForm.cost_price}
                    onChange={(e) => {
                      const cost = e.target.value;
                      let selling = addForm.selling_price;
                      const margin = parseFloat(addForm.profit_margin || '0');
                      if (!isNaN(parseFloat(cost)) && !isNaN(margin)) {
                        selling = String(Math.ceil(parseFloat(cost) + (parseFloat(cost) * (margin / 100))));
                      }
                      setAddForm({...addForm, cost_price: cost, selling_price: selling});
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Profit Margin (%)</label>
                  <input
                    type="number"
                    value={addForm.profit_margin}
                    onChange={(e) => {
                      const margin = e.target.value;
                      let selling = addForm.selling_price;
                      const cost = parseFloat(addForm.cost_price || '0');
                      if (!isNaN(parseFloat(margin)) && !isNaN(cost) && cost > 0) {
                        selling = String(Math.ceil(cost + (cost * (parseFloat(margin) / 100))));
                      }
                      setAddForm({...addForm, profit_margin: margin, selling_price: selling});
                    }}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selling Price (₦)</label>
                  <input
                    type="number"
                    value={addForm.selling_price}
                    onChange={(e) => setAddForm({...addForm, selling_price: e.target.value})}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm({...addForm, description: e.target.value})}
                  placeholder="e.g., 1GB (SME) monthly"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_active}
                    onChange={(e) => setAddForm({...addForm, is_active: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_popular}
                    onChange={(e) => setAddForm({...addForm, is_popular: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Popular</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Discount (%)</label>
                  <input
                    type="number"
                    value={addForm.discount_percentage}
                    onChange={(e) => setAddForm({...addForm, discount_percentage: parseInt(e.target.value) || 0})}
                    min="0"
                    max="100"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  />
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.show_discount_badge}
                    onChange={(e) => setAddForm({...addForm, show_discount_badge: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Discount Badge</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewPlan}
                  className="flex-1 px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors"
                >
                  Save Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditModal && editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Data Plan</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Network</span>
                  <span className="text-sm text-gray-900 dark:text-white">{editingPlan.network}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan Type</span>
                  <span className="text-sm text-gray-900 dark:text-white">{editingPlan.plan_type}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Size</span>
                  <span className="text-sm text-gray-900 dark:text-white">{editingPlan.size}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Validity</span>
                  <span className="text-sm text-gray-900 dark:text-white">{editingPlan.validity}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost Price</span>
                  <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(editingPlan.cost_price)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">External ID</label>
                <input
                  type="number"
                  value={formData.external_id}
                  onChange={(e) => setFormData({...formData, external_id: e.target.value})}
                  placeholder="Provider plan ID"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This must match the provider's plan ID used for API requests.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                >
                  <option value="smeplug">SME Plug</option>
                  {/* MASKAWA option hidden but kept for future use */}
                  {/* <option value="maskawa">MASKAWA</option> */}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selling Price (₦)
                </label>
                <input
                  type="number"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  min={editingPlan.cost_price}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum: {formatCurrency(editingPlan.cost_price)} (cost price)
                </p>
              </div>

              <div>
                <label className="block text sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profit Margin (%)
                </label>
                <input
                  type="number"
                  value={formData.profit_margin}
                  onChange={(e) => {
                    const margin = parseFloat(e.target.value);
                    setFormData({
                      ...formData, 
                      profit_margin: e.target.value,
                      selling_price: isNaN(margin) ? formData.selling_price : 
                        (editingPlan.cost_price + (editingPlan.cost_price * (margin / 100))).toFixed(2)
                    });
                  }}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Changing profit margin automatically updates selling price
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Discount Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({...formData, discount_percentage: parseInt(e.target.value)})}
                  min="0"
                  max="100"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a percentage between 0-100 (e.g., 20 for 20% off)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_popular}
                    onChange={(e) => setFormData({...formData, is_popular: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Popular</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_discount_badge}
                    onChange={(e) => setFormData({...formData, show_discount_badge: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Discount</span>
                </label>
              </div>

              {formData.show_discount_badge && formData.discount_percentage > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Discount Badge Preview:</span>
                    <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white">
                      -{formData.discount_percentage}% OFF
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePlan}
                  className="flex-1 px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Update Profit Margins</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Warning:</strong> This will update the profit margin and selling price for all selected data plans.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Network
                </label>
                <select
                  value={bulkNetworkFilter}
                  onChange={(e) => setBulkNetworkFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                >
                  <option value="all">All Networks</option>
                  {networks.filter(n => n !== 'all').map(network => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Type
                </label>
                <select
                  value={bulkCategoryFilter}
                  onChange={(e) => setBulkCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                >
                  <option value="all">All Plan Types</option>
                  {planTypes.filter(t => t !== 'all').map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Profit Margin (%)
                </label>
                <input
                  type="number"
                  value={bulkProfitMargin}
                  onChange={(e) => setBulkProfitMargin(e.target.value)}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  placeholder="Enter profit margin percentage"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will automatically recalculate selling prices based on cost price and the new margin
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBulkEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdate}
                  className="flex-1 px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors"
                >
                  Update Plans
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Network
                </label>
                <select
                  value={categoryFormData.network}
                  onChange={(e) => setcategoryFormData({...categoryFormData, network: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                >
                  <option value="">Select Network</option>
                  <option value="MTN">MTN</option>
                  <option value="AIRTEL">AIRTEL</option>
                  <option value="GLO">GLO</option>
                  <option value="9MOBILE">9MOBILE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Type ID
                </label>
                <input
                  type="text"
                  value={categoryFormData.plan_type}
                  onChange={(e) => setcategoryFormData({...categoryFormData, plan_type: e.target.value})}
                  placeholder="e.g., sme, corporate, gifting"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This is the internal ID used to group plans (e.g., sme, corporate)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={categoryFormData.display_name}
                  onChange={(e) => setcategoryFormData({...categoryFormData, display_name: e.target.value})}
                  placeholder="e.g., SME Plans, Corporate Plans"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This is the name shown to users in the app
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setcategoryFormData({...categoryFormData, description: e.target.value})}
                  placeholder="Optional description of this plan category"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={categoryFormData.sort_order}
                  onChange={(e) => setcategoryFormData({...categoryFormData, sort_order: parseInt(e.target.value)})}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lower numbers appear first in the list
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={categoryFormData.is_active}
                  onChange={(e) => setcategoryFormData({...categoryFormData, is_active: e.target.checked})}
                  className="h-4 w-4 text-[#0F9D58] focus:ring-[#0F9D58] border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors"
                >
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Management Modal */}
      {categories.length > 0 && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => handleAddEditCategory()}
            className="bg-[#0F9D58] text-white p-4 rounded-full shadow-lg hover:bg-[#0d8a4f] transition-colors"
            title="Add Category"
          >
            <Plus size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DataPlansManagement;