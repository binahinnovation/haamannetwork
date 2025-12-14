import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Filter, Store, BadgeCheck, X } from 'lucide-react';
import ProductCard from '../../components/store/ProductCard';
import Card from '../../components/ui/Card';
import { useCartStore } from '../../store/cartStore';
import { useProductStore } from '../../store/productStore';
import { supabase } from '../../lib/supabase';

// Simplified shop type for filter dropdown
type ShopFilterOption = {
  id: string;
  name: string;
  is_verified: boolean;
};

const StorePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeShops, setActiveShops] = useState<ShopFilterOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const { getTotalItems } = useCartStore();
  const { products, loading, fetchProducts, setShopFilter } = useProductStore();

  // Fetch active shops for the vendor filter
  // Requirements: 10.3 - Support filtering by vendor shop
  useEffect(() => {
    const fetchActiveShops = async () => {
      setShopsLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendor_shops')
          .select('id, name, is_verified')
          .eq('status', 'active')
          .order('name');
        
        if (error) throw error;
        setActiveShops(data || []);
      } catch (error) {
        console.error('Error fetching active shops:', error);
      } finally {
        setShopsLoading(false);
      }
    };

    fetchActiveShops();
  }, []);

  // Fetch products when shop filter changes
  useEffect(() => {
    fetchProducts({ shopId: selectedShopId || undefined });
    setShopFilter(selectedShopId);
  }, [fetchProducts, selectedShopId, setShopFilter]);

  // Handle shop filter change
  const handleShopFilterChange = (shopId: string | null) => {
    setSelectedShopId(shopId);
  };

  const filteredProducts = products
    .filter((product) => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'featured':
        default:
          return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
      }
    });

  const featuredProducts = products.filter(p => p.is_featured || p.is_new).slice(0, 4);

  const categories = [
    { value: 'all', label: 'All Products', count: products.length },
    ...Array.from(new Set(products.map(p => p.category))).map(category => ({
      value: category,
      label: category,
      count: products.filter(p => p.category === category).length
    }))
  ];

  const sortOptions = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'newest', label: 'Newest First' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 border-b border-gray-200 dark:border-gray-700 w-full">
        <div className="flex justify-between items-center mb-4 max-w-[350px] mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shop</h1>
          
          <div className="relative">
            <button 
              onClick={() => navigate('/store/cart')}
              className="relative p-2 bg-[#0F9D58] text-white rounded-full hover:bg-[#0d8a4f] transition-colors flex items-center justify-center"
            >
              <ShoppingBag size={20} />
              {getTotalItems() > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {getTotalItems()}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4 max-w-[350px] mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Filter size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl max-w-[350px] mx-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Vendor Shop Filter - Requirements: 10.3 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter by Vendor
              </label>
              <select
                value={selectedShopId || ''}
                onChange={(e) => handleShopFilterChange(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                disabled={shopsLoading}
              >
                <option value="">All Vendors</option>
                {activeShops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} {shop.is_verified ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {/* Active Shop Filter Badge */}
        {selectedShopId && (
          <div className="flex items-center justify-center mb-2 max-w-[350px] mx-auto">
            <div className="inline-flex items-center bg-[#0F9D58]/10 text-[#0F9D58] px-3 py-1 rounded-full text-sm">
              <Store size={14} className="mr-1" />
              <span className="mr-2">
                {activeShops.find(s => s.id === selectedShopId)?.name || 'Vendor'}
              </span>
              {activeShops.find(s => s.id === selectedShopId)?.is_verified && (
                <BadgeCheck size={14} className="text-blue-500 mr-1" />
              )}
              <button
                onClick={() => handleShopFilterChange(null)}
                className="ml-1 hover:bg-[#0F9D58]/20 rounded-full p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[350px] mx-auto p-4 space-y-6">
        {/* Categories */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Categories</h2>
            <button 
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="text-sm text-[#0F9D58] font-medium"
            >
              {showAllCategories ? 'Show Less' : 'View All'}
            </button>
          </div>
          
          <div className="overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex space-x-3 min-w-max flex-nowrap">
              {(showAllCategories ? categories : categories.slice(0, 5)).map((category) => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category.value
                      ? 'bg-[#0F9D58] text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-[#0F9D58]'
                  }`}
                >
                  {category.label} ({category.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Featured Products Section */}
        {selectedCategory === 'all' && featuredProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Featured</h2>
              <span className="text-sm text-[#0F9D58] font-medium">Limited Time</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-8">
              {featuredProducts.map((product) => (
                <div key={product.id} className="relative w-full">
                  <ProductCard product={product} />
                  {product.is_new && (
                    <div className="absolute top-2 left-2 bg-[#0F9D58] text-white text-xs px-2 py-1 rounded-full font-bold">
                      NEW
                    </div>
                  )}
                  {product.discount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                      -{product.discount}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Products Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedShopId 
                ? `${activeShops.find(s => s.id === selectedShopId)?.name || 'Vendor'}'s Products`
                : selectedCategory === 'all' 
                  ? 'All Products' 
                  : categories.find(c => c.value === selectedCategory)?.label}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredProducts.length} found
            </span>
          </div>
          
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="relative w-full">
                  <ProductCard product={product} />
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col space-y-1">
                    {product.is_new && (
                      <div className="bg-[#0F9D58] text-white text-xs px-2 py-1 rounded-full font-bold">
                        NEW
                      </div>
                    )}
                    {product.is_featured && (
                      <div className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        FEATURED
                      </div>
                    )}
                  </div>
                  
                  {product.discount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                      -{product.discount}%
                    </div>
                  )}
                  
                  {!product.in_stock && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                      <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Out of Stock
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center w-full">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No products found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your search or filter criteria
              </p>
            </Card>
          )}
        </div>

        {/* Promotional Banner */}
        <div className="bg-gradient-to-r from-[#0F9D58] to-[#0d8a4f] rounded-2xl p-6 text-white w-full">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Free Delivery</h3>
              <p className="text-sm opacity-90">On orders above ₦20,000</p>
            </div>
            <div className="text-4xl">🚚</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePage;