
import React, { useMemo } from 'react';
import { X, ArrowLeft, CheckCircle2, TrendingDown, ArrowRight, ShoppingCart, Clock, Calendar } from 'lucide-react';
import { DiscountProduct, MarketData } from '../types';
import { parseDateString, extractProductEndDate, calculateDaysLeft, extractQuantityAndCleanName } from './ProductCard';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: DiscountProduct | null;
  marketName: string; 
  allMarkets: MarketData[];
  onCompareClick: (marketId: string, productName: string) => void; 
  canGoBack?: boolean;
  onBack?: () => void;
  showComparisons?: boolean; // New prop to control visibility of comparison list
  catalogEndDate?: string;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  product, 
  marketName,
  allMarkets,
  onCompareClick,
  canGoBack,
  onBack,
  showComparisons = false,
  catalogEndDate
}) => {
  if (!isOpen || !product) return null;

  const parsePriceNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isNaN(val) ? NaN : val;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(str);
  };

  // --- BEST PRICE CHECK LOGIC ---
  const isBestPrice = useMemo(() => {
    if (!product) return false;
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const sourceName = normalize(product.productName);
    const currentPrice = parsePriceNumber(product.newPrice);

    for (const market of allMarkets) {
        const marketProducts = market.catalogs && market.catalogs.length > 0
            ? market.catalogs.flatMap(c => c.products)
            : market.products || [];
        
        for (const p of marketProducts) {
             if (normalize(p.productName) === sourceName) {
                 const pPrice = parsePriceNumber(p.newPrice);
                 if (!isNaN(pPrice) && !isNaN(currentPrice) && pPrice < currentPrice) return false; 
             }
        }
    }
    return true;
  }, [product, allMarkets]);

  // --- COMPARISON LIST GENERATION ---
  const comparisonData = useMemo(() => {
    if (!showComparisons || !product) return []; // Don't calculate if not needed

    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const sourceName = normalize(product.productName);
    const currentPrice = parsePriceNumber(product.newPrice);
    if (isNaN(currentPrice)) return [];

    const alternatives: { 
        marketId: string, 
        marketName: string, 
        logoUrl?: string,
        logoPlaceholder: string,
        themeColor: string,
        price: number, 
        diff: number, 
        product: DiscountProduct 
    }[] = [];

    allMarkets.forEach(market => {
      // Skip current market context based on name match
      if (market.name === marketName) return;

      const marketProducts = market.catalogs && market.catalogs.length > 0
          ? market.catalogs.flatMap(c => c.products)
          : market.products || [];

      const match = marketProducts.find(p => normalize(p.productName) === sourceName);
      
      if (match) {
        const matchPrice = parsePriceNumber(match.newPrice);
        if (!isNaN(matchPrice)) {
            const diff = currentPrice - matchPrice;
            // Only show cheaper alternatives
            if (diff > 0) {
                 alternatives.push({
                    marketId: market.id,
                    marketName: market.name,
                    logoUrl: market.logoUrl,
                    logoPlaceholder: market.logoPlaceholder,
                    themeColor: market.themeColor,
                    price: matchPrice,
                    diff: diff,
                    product: match
                 });
            }
        }
      }
    });

    return alternatives.sort((a, b) => b.diff - a.diff);
  }, [product, allMarkets, marketName, showComparisons]);

  // Format date helper
  const formatEndDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = parseDateString(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const effectiveEndDate = extractProductEndDate(product, catalogEndDate);
  const countdownInfo = calculateDaysLeft(effectiveEndDate);
  const formattedEndDate = countdownInfo?.formattedDate || formatEndDate(effectiveEndDate);

  const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(product.productName);

  // Image Fallback
  const imageUrl = product.customImageUrl 
    ? product.customImageUrl 
    : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(product.productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal Container - Centered */}
      <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out] max-h-[90vh]">
        
        {/* Header Image */}
        <div className="relative w-full h-48 bg-gray-50 flex items-center justify-center shrink-0">
            <img 
              src={imageUrl} 
              alt={cleanName} 
              className="w-40 h-40 object-contain mix-blend-multiply"
            />
            
            {/* Back Button */}
            {canGoBack && onBack && (
              <button 
                onClick={onBack}
                className="absolute top-3 left-3 p-2 bg-white/80 hover:bg-white rounded-full text-gray-700 shadow-sm transition-all font-medium flex items-center gap-1 text-xs z-10"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={onClose}
              className="absolute top-3 right-3 p-2 bg-white/80 hover:bg-red-50 hover:text-red-600 rounded-full text-gray-500 shadow-sm transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Discount Badge */}
            {product.discountPercentage && (
              <div className="absolute top-3 left-3 bg-emerald-600 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                {product.discountPercentage}
              </div>
            )}

            {/* Quantity Badge on bottom-right of image */}
            {quantityBadge && (
              <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-md tracking-tight">
                {quantityBadge}
              </div>
            )}
        </div>

        {/* Product Info Content */}
        <div className="p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-2 mb-2">
                 <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-lg uppercase tracking-wider">
                   {marketName}
                 </span>
                 <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-gray-500 bg-gray-100 rounded-lg">
                   {product.category}
                 </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-4">
              {cleanName}
            </h2>

            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2 mb-2">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-green-600 tracking-tight leading-none">
                      {product.newPrice} <span className="text-xl">₼</span>
                    </span>
                    {product.oldPrice && product.oldPrice !== '---' && (
                        <span className="text-gray-400 text-sm sm:text-base line-through font-medium leading-none">
                          {product.oldPrice} ₼
                        </span>
                    )}
                 </div>
                 
                 {formattedEndDate ? (
                   <div className="flex flex-col items-end">
                       <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border shadow-2xs ${countdownInfo?.badgeStyle || 'text-amber-800 bg-amber-50 border-amber-200/80'}`}>
                        <Clock className={`w-3.5 h-3.5 shrink-0 ${countdownInfo?.iconColor || 'text-amber-600'}`} />
                        <span>Bitmə: {formattedEndDate}{countdownInfo ? ` (${countdownInfo.label})` : ''}</span>
                       </div>
                   </div>
                 ) : (
                   <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Müddətsiz</span>
                       </div>
                   </div>
                 )}
            </div>

            {/* COMPARISON LIST - Only shown if requested and data exists */}
            {showComparisons && comparisonData.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-[fadeIn_0.3s_ease-out]">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-green-600" />
                  Daha Ucuz Alternativlər
                </h4>
                <div className="space-y-2">
                   {comparisonData.map((item, idx) => (
                     <div 
                        key={idx} 
                        onClick={() => onCompareClick(item.marketId, item.product.productName)}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100 hover:border-green-300 hover:shadow-md cursor-pointer transition-all group"
                     >
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-gray-100 bg-white overflow-hidden shadow-sm`}>
                             {item.logoUrl ? (
                               <img src={item.logoUrl} alt={item.marketName} className="w-full h-full object-contain p-1" />
                             ) : (
                               <span className={`font-bold text-${item.themeColor}-700 text-xs`}>{item.logoPlaceholder}</span>
                             )}
                           </div>
                           <div>
                              <div className="text-xs text-gray-500 font-medium">{item.marketName}</div>
                              <div className="text-sm font-bold text-gray-900">{item.price} ₼</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="bg-white text-green-700 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                             -{item.diff.toFixed(2)} ₼
                           </span>
                           <ArrowRight className="w-4 h-4 text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
