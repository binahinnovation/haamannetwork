/**
 * VendorShopPage - Public vendor shop profile page
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * 
 * Displays shop name, description, verification badge
 * Lists all active products from the shop
 * Handles disabled shop with unavailable message
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Store, ShoppingBag, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import ProductCard from '../../components/store/ProductCard';
import { supabase } from '../../lib/supabase';
import type { VendorShop } from '../../types/vendor';
import type { Product } from '../../types';

type ShopWithProducts = {
  shop: VendorShop | null;
  products: Product[];
  isUnavailable: boolean;
  loading: boolean;
  error: string | null;
};

const VendorShopPage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ShopWithProducts>({
    shop: null,
    products: [],
    isUnavailable: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchShopData = async () => {
      if (!shopId) {
        setState(prev => ({ ...prev, loading: false, error: 'Shop not found' }));
        return;
      }

      try {
        // Fetch shop details
        const { data: shop, error: shopError } = await supabase
          .from('vendor_shops')
          .select('*')
          .eq('id', shopId)
          .single();

        if (shopError || !shop) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: 'Shop not found' 
          }));
          return;
        }

        // Check if shop is disabled (Requirement 4.5)
        if (shop.status === 'disabled' || shop.status === 'admin_disabled') {
          setState(prev => ({ 
            ...prev, 
            shop,
            isUnavailable: true,
            loading: false 
          }));
          return;
        }

        // Fetch active products from the shop (Requirement 4.3)
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('shop_id', shopId)
          .eq('is_vendor_product', true)
          .order('created_at', { ascending: false });

        if (productsError) {
          console.error('Error fetching products:', productsError);
        }

        setState({
          shop,
          products: products || [],
          isUnavailable: false,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching shop data:', error);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Failed to load shop' 
        }));
      }
    };

    fetchShopData();
  }, [shopId]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-[350px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-400 mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>
          <Card className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Shop Not Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {state.error}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Requirement 4.5: Show unavailable message for disabled shops
  if (state.isUnavailable) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-[350px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-400 mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>
          <Card className="p-8 text-center">
            <Store size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Shop Unavailable
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              This shop is currently unavailable. Please check back later.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const { shop, products } = state;
  const inStockProducts = products.filter(p => p.in_stock);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[350px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-400 mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>
          
          {/* Shop Info - Requirements 4.2, 4.4 */}
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-[#0F9D58]/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Store size={32} className="text-[#0F9D58]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {shop?.name}
                </h1>
                {/* Requirement 4.4: Verification badge */}
                {shop?.is_verified && (
                  <BadgeCheck size={20} className="text-blue-500 flex-shrink-0" />
                )}
              </div>
              {shop?.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                  {shop.description}
                </p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <ShoppingBag size={14} className="mr-1" />
                  {products.length} products
                </span>
                {shop?.is_verified && (
                  <span className="text-blue-500 font-medium">Verified Seller</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section - Requirement 4.3 */}
      <div className="max-w-[350px] mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Products
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {inStockProducts.length} in stock
          </span>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <div key={product.id} className="relative w-full">
                <ProductCard product={product} />
                {product.is_new && (
                  <div className="absolute top-2 left-2 bg-[#0F9D58] text-white text-xs px-2 py-1 rounded-full font-bold">
                    NEW
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
          <Card className="p-8 text-center">
            <ShoppingBag size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Products Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              This shop hasn't added any products yet.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorShopPage;
