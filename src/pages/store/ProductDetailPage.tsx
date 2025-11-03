import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Star, 
  Heart, 
  ShoppingCart, 
  Truck, 
  Shield, 
  RotateCcw,
  Plus,
  Minus,
  CreditCard,
  Wallet,
  LogIn
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../lib/utils';
import TransactionPinModal from '../../components/ui/TransactionPinModal';
import SetPinModal from '../../components/ui/SetPinModal';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  category: string;
  in_stock: boolean;
  rating: number;
  reviews: number;
  discount: number;
  is_new: boolean;
  is_featured: boolean;
  created_at: string;
};

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, processSecurePurchase } = useAuthStore();
  const { addItem } = useCartStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'pay_on_delivery'>('wallet');
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || '',
    address: '',
    city: '',
    state: '',
    phone: user?.phone || '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
      navigate('/store');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    addItem(product, quantity);
    // Show success message
    alert('Product added to cart!');
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // Check if user has PIN set and is using wallet payment
    if (user && !user.hasPin) {
      setShowSetPinModal(true);
      return;
    }
    
    setShowCheckoutModal(true);
  };

  const handleCheckout = async () => {
    if (!product || !user) return;

    // Prevent multiple clicks by checking if already processing
    if (isProcessing) {
      return;
    }

    // Check if user has PIN set and is using wallet payment
    if (user.hasPin && paymentMethod === 'wallet') {
      setShowPinModal(true);
      return;
    }

    // If no PIN is set or using pay on delivery, proceed with checkout
    await processCheckout();
  };

  const processCheckout = async () => {
    if (!product || !user) return;

    // Prevent multiple calls if already processing
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const totalAmount = product.price * quantity;

      // Check wallet balance if paying with wallet
      if (paymentMethod === 'wallet' && user.walletBalance < totalAmount) {
        alert('Insufficient wallet balance. Please fund your wallet or choose pay on delivery.');
        setIsProcessing(false);
        return;
      }

      // Create order
      const orderData = {
        user_id: user.id,
        products: [{
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          image_url: product.image_url,
        }],
        total_amount: totalAmount,
        payment_method: paymentMethod,
        shipping_address: shippingAddress,
        status: paymentMethod === 'wallet' ? 'processing' : 'pending',
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create transaction record
      const transactionData = {
        user_id: user.id,
        type: 'product_purchase',
        amount: totalAmount,
        status: paymentMethod === 'wallet' ? 'success' : 'pending',
        reference: `ORD-${order.id.slice(0, 8)}`,
        details: {
          order_id: order.id,
          product_name: product.name, // Ensure product name is included
          quantity: quantity,
          payment_method: paymentMethod,
        },
      };

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([transactionData]);

      if (transactionError) throw transactionError;

      // SECURE: Deduct from wallet if paying with wallet using transaction locking
      if (paymentMethod === 'wallet') {
        await processSecurePurchase(
          totalAmount,
          'product_purchase',
          {
            product_id: product.id,
            product_name: product.name,
            quantity: quantity,
            unit_price: product.price,
            total_amount: totalAmount
          }
        );
      }

      setShowCheckoutModal(false);
      setShowPinModal(false);
      navigate('/store/orders');
    } catch (error: any) {
      console.error('Error processing order:', error);
      
      // Handle specific error messages for better UX
      let userErrorMessage = 'Error processing order. Please try again.';
      
      if (error.message === 'Transaction already in progress') {
        userErrorMessage = 'A transaction is already in progress. Please wait a moment and try again.';
      } else if (error.message === 'Insufficient balance') {
        userErrorMessage = 'Insufficient wallet balance. Please fund your wallet or choose pay on delivery.';
      } else if (error.message.includes('Unable to connect') || 
                 error.message.includes('internet connection')) {
        userErrorMessage = 'Unable to connect to payment service. Please check your internet connection and try again.';
      } else if (error.message.includes('Service temporarily unavailable') || 
                 error.message.includes('contact support')) {
        userErrorMessage = 'Payment service temporarily unavailable. Please try again later or contact support.';
      } else if (error.message.includes('timeout')) {
        userErrorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.message) {
        userErrorMessage = error.message;
      }
      
      alert(userErrorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h2>
          <Button onClick={() => navigate('/store')}>Back to Store</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/store')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white ml-4 truncate">Product Details</h1>
      </div>

      <div className="p-4 space-y-4 sm:space-y-6 pb-32">
        {/* Product Image */}
        <div className="relative">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-64 sm:h-80 object-cover rounded-2xl"
          />
          
          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col space-y-2">
            {product.is_new && (
              <Badge className="bg-[#0F9D58] text-white text-xs">NEW</Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-purple-500 text-white text-xs">FEATURED</Badge>
            )}
            {product.discount > 0 && (
              <Badge className="bg-red-500 text-white text-xs">-{product.discount}%</Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <button className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <Heart size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Product Info */}
        <Card className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Category */}
            <Badge variant="default" className="text-xs">{product.category}</Badge>

            {/* Name */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={`${
                      i < Math.floor(product.rating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center space-x-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-[#0F9D58]">
                {formatCurrency(product.price)}
              </span>
              {product.original_price && (
                <span className="text-lg text-gray-500 line-through">
                  {formatCurrency(product.original_price)}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${product.in_stock ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-medium ${product.in_stock ? 'text-green-600' : 'text-red-600'}`}>
                {product.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
                {product.description}
              </p>
            </div>
          </div>
        </Card>

        {/* Features */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Why Choose This Product?</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center space-x-3">
              <Truck className="text-[#0F9D58] flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Fast Delivery</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">2-3 business days</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Shield className="text-[#0F9D58] flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Warranty</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">1 year warranty</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <RotateCcw className="text-[#0F9D58] flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">Returns</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">7-day return policy</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Quantity and Actions */}
        {product.in_stock && (
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Quantity Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-lg font-semibold px-4 min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Total Price */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900 dark:text-white">Total:</span>
                  <span className="text-xl sm:text-2xl font-bold text-[#0F9D58]">
                    {formatCurrency(product.price * quantity)}
                  </span>
                </div>
              </div>

              {/* Authentication Notice */}
              {!isAuthenticated && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center">
                    <LogIn className="text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" size={20} />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Please <a href="/login" className="font-medium underline">login</a> to add items to cart or make purchases
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleAddToCart}
                  icon={<ShoppingCart size={16} />}
                  className="py-3 text-sm"
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? 'Add to Cart' : 'Login to Add'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBuyNow}
                  className="py-3 text-sm"
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? 'Buy Now' : 'Login to Buy'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Checkout</h2>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6">
              {/* Order Summary */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="truncate pr-2">{product.name} x {quantity}</span>
                    <span className="font-medium">{formatCurrency(product.price * quantity)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                    <div className="flex justify-between items-center font-bold">
                      <span>Total:</span>
                      <span className="text-[#0F9D58]">{formatCurrency(product.price * quantity)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Payment Method</h3>
                <div className="space-y-3">
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="wallet"
                      checked={paymentMethod === 'wallet'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'wallet')}
                      className="mr-3 flex-shrink-0"
                    />
                    <Wallet size={20} className="mr-3 text-[#0F9D58] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Wallet</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        Balance: {formatCurrency(user?.walletBalance || 0)}
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="pay_on_delivery"
                      checked={paymentMethod === 'pay_on_delivery'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'pay_on_delivery')}
                      className="mr-3 flex-shrink-0"
                    />
                    <CreditCard size={20} className="mr-3 text-[#0F9D58] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Pay on Delivery</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Pay when you receive your order</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Shipping Address</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({...shippingAddress, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={shippingAddress.address}
                    onChange={(e) => setShippingAddress({...shippingAddress, address: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress({...shippingAddress, phone: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCheckout}
                  isLoading={isProcessing}
                  disabled={isProcessing}
                  className="flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Place Order'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={processCheckout}
      />

      {/* Set PIN Modal */}
      <SetPinModal
        isOpen={showSetPinModal}
        onClose={() => setShowSetPinModal(false)}
        onSuccess={() => setShowCheckoutModal(true)}
      />
    </div>
  );
};

export default ProductDetailPage;