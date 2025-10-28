import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { formatCurrency } from '../../lib/utils';

const ProductSlideshow: React.FC = () => {
  const navigate = useNavigate();
  const { products, fetchProducts } = useProductStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Get latest 4 products
  const latestProducts = products
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    // Only auto-slide if there are multiple products
    if (latestProducts.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % latestProducts.length);
      }, 4000); // Auto-slide every 4 seconds

      return () => clearInterval(interval);
    }
  }, [latestProducts.length]);

  const nextSlide = () => {
    if (latestProducts.length > 1) {
      setCurrentSlide((prev) => (prev + 1) % latestProducts.length);
    }
  };

  const prevSlide = () => {
    if (latestProducts.length > 1) {
      setCurrentSlide((prev) => (prev - 1 + latestProducts.length) % latestProducts.length);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  if (latestProducts.length === 0) {
    return (
      <div className="w-full h-48 sm:h-56 md:h-64 lg:h-80 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 mb-6 sm:mb-8 flex items-center justify-center">
        <div className="text-center px-4">
          <ShoppingBag size={32} className="sm:w-12 sm:h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No Products Yet</h3>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 max-w-xs mx-auto">Products will appear here once they're added to the store.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-80 rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 mb-6 sm:mb-8">
      {/* Slides */}
      <div 
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ 
          transform: latestProducts.length > 1 
            ? `translateX(-${currentSlide * 100}%)` 
            : 'translateX(0%)' 
        }}
      >
        {latestProducts.map((product) => (
          <div
            key={product.id}
            className="w-full flex-shrink-0 relative cursor-pointer"
            onClick={() => navigate(`/store/product/${product.id}`)}
          >
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${product.image_url})`,
                filter: 'brightness(0.7)'
              }}
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            
            {/* Content */}
            <div className="relative z-10 h-full flex items-center p-3 sm:p-4 md:p-6 lg:p-8">
              <div className="text-white max-w-xs sm:max-w-sm md:max-w-md">
                {/* Badges */}
                <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3">
                  {product.is_new && (
                    <span className="inline-block bg-[#0F9D58] text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold">
                      NEW
                    </span>
                  )}
                  {product.is_featured && (
                    <span className="inline-block bg-purple-500 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold">
                      FEATURED
                    </span>
                  )}
                </div>
                
                {/* Product Name */}
                <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 leading-tight line-clamp-2">
                  {product.name}
                </h3>
                
                {/* Description - Hidden on very small screens */}
                <p className="hidden sm:block text-sm md:text-base text-gray-200 mb-2 sm:mb-4 line-clamp-2">
                  {product.description}
                </p>
                
                {/* Price */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                  <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#0F9D58]">
                    {formatCurrency(product.price)}
                  </span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-sm sm:text-base md:text-lg text-gray-300 line-through">
                      {formatCurrency(product.original_price)}
                    </span>
                  )}
                  {product.discount > 0 && (
                    <span className="bg-red-500 text-white text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold">
                      -{product.discount}% OFF
                    </span>
                  )}
                </div>
                
                {/* Stock Status */}
                <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                  <div className={`w-2 sm:w-3 h-2 sm:h-3 rounded-full ${product.in_stock ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs sm:text-sm">
                    {product.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                
                {/* CTA Button */}
                <button 
                  className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full font-semibold transition-colors duration-200 shadow-lg text-xs sm:text-sm md:text-base ${
                    product.in_stock 
                      ? 'bg-[#0F9D58] hover:bg-[#0d8a4f] text-white' 
                      : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  }`}
                  disabled={!product.in_stock}
                >
                  {product.in_stock ? 'Shop Now' : 'Out of Stock'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows - Only show if more than 1 product */}
      {latestProducts.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-1.5 sm:p-2 rounded-full transition-all duration-200"
          >
            <ChevronLeft size={18} className="sm:w-6 sm:h-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-1.5 sm:p-2 rounded-full transition-all duration-200"
          >
            <ChevronRight size={18} className="sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Dots Indicator - Only show if more than 1 product */}
      {latestProducts.length > 1 && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1.5 sm:space-x-2">
          {latestProducts.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 sm:w-3 h-2 sm:h-3 rounded-full transition-all duration-200 ${
                index === currentSlide 
                  ? 'bg-white scale-110' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}

      {/* Product Counter - Only show if more than 1 product */}
      {latestProducts.length > 1 && (
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/30 backdrop-blur-sm text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm">
          {currentSlide + 1} / {latestProducts.length}
        </div>
      )}

      {/* Single Product Indicator */}
      {latestProducts.length === 1 && (
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-[#0F9D58] text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold">
          Latest Product
        </div>
      )}
    </div>
  );
};

export default ProductSlideshow;