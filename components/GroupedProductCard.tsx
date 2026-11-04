
import React, { useState } from 'react';
import { ProductCategory, DiscountProduct } from '../types';
import { 
  Apple, Beef, Milk, Wheat, Coffee, Cookie, SprayCan, Sparkles, Home, Baby, Package, 
  ChevronRight, TrendingDown 
} from 'lucide-react';

interface ProductVariant {
  marketId: string;
  marketName: string;
  price: number;
  originalPriceStr: string; // The original string like "10.50"
  logoUrl?: string;
  logoPlaceholder: string;
  themeColor: string;
}

interface GroupedProductCardProps {
  productName: string;
  category: ProductCategory;
  imageUrl?: string;
  variants: ProductVariant[];
  onClick?: () => void;
}

const getCategoryIcon = (category: ProductCategory) => {
  const iconClass = "w-5 h-5"; 
  switch (category) {
    case 'Meyvə & Tərəvəz': return <Apple className={iconClass} />;
    case 'Ət & Toyuq': return <Beef className={iconClass} />;
    case 'Süd & Səhər Yeməyi': return <Milk className={iconClass} />;
    case 'Qida & Paxlalılar': return <Wheat className={iconClass} />;
    case 'İçkilər': return <Coffee className={iconClass} />;
    case 'Qəlyanaltı': return <Cookie className={iconClass} />;
    case 'Təmizlik': return <SprayCan className={iconClass} />;
    case 'Şəxsi Baxım': return <Sparkles className={iconClass} />;
    case 'Ev & Həyat': return <Home className={iconClass} />;
    case 'Uşaq': return <Baby className={iconClass} />;
    default: return <Package className={iconClass} />;
  }
};

const GroupedProductCard: React.FC<GroupedProductCardProps> = ({ 
  productName, 
  category, 
  imageUrl, 
  variants,
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  // Find min price to highlight
  const minPrice = Math.min(...variants.map(v => v.price));
  const sortedVariants = [...variants].sort((a, b) => a.price - b.price);

  // Use the image or fallback
  const finalImageUrl = imageUrl 
    ? imageUrl 
    : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;

  // Calculate potential saving
  const maxPrice = Math.max(...variants.map(v => v.price));
  const saving = maxPrice - minPrice;

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 flex flex-col h-full group relative cursor-pointer"
    >
      {/* Saving Badge */}
      {saving > 0 && (
         <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-bl-lg z-10 shadow-xs">
            {saving.toFixed(2)} ₼ Qənaət
         </div>
      )}

      {/* Image Section */}
      <div className="aspect-square w-full relative overflow-hidden bg-gray-50 border-b border-gray-100">
        {!imageError ? (
          <img 
            src={finalImageUrl} 
            alt={productName}
            className="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 flex-col gap-1 text-gray-300">
            {getCategoryIcon(category)}
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-800 leading-tight mb-2 line-clamp-2 text-xs sm:text-sm h-8 sm:h-9" title={productName}>
            {productName}
        </h3>

        {/* Market List */}
        <div className="space-y-1.5 sm:space-y-2 mt-auto">
            {sortedVariants.map((variant, idx) => {
                const isCheapest = variant.price === minPrice;
                const displayName = variant.marketName.replace(/\s+Market$/i, '') || variant.marketName;
                return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg border gap-1 min-w-0 ${isCheapest ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-transparent opacity-85'}`}
                    >
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 mr-0.5">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center overflow-hidden shrink-0`}>
                                {variant.logoUrl ? (
                                    <img src={variant.logoUrl} alt={variant.marketName} className="w-full h-full object-contain p-0.5" />
                                ) : (
                                    <span className={`text-[9px] sm:text-[10px] font-bold text-${variant.themeColor}-700`}>{variant.logoPlaceholder}</span>
                                )}
                            </div>
                            <span className={`text-[11px] sm:text-xs font-semibold truncate ${isCheapest ? 'text-gray-900' : 'text-gray-600'}`} title={variant.marketName}>
                                {displayName}
                            </span>
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 whitespace-nowrap">
                            <span className={`inline-flex items-baseline font-black leading-none whitespace-nowrap ${isCheapest ? 'text-green-700 text-xs sm:text-sm' : 'text-gray-700 text-[11px] sm:text-xs'}`}>
                                <span>{variant.originalPriceStr}</span>
                                <span className="text-[9px] sm:text-[10px] ml-0.5 font-bold">₼</span>
                            </span>
                            {isCheapest && <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600 shrink-0" />}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default GroupedProductCard;
