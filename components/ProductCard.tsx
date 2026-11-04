
import React, { useState } from 'react';
import { DiscountProduct, ProductCategory } from '../types';
import { 
  Apple, 
  Beef, 
  Milk, 
  Wheat, 
  Coffee, 
  Cookie, 
  SprayCan, 
  Sparkles, 
  Home, 
  Baby, 
  Package,
  Edit2,
  TrendingDown,
  Heart,
  Clock
} from 'lucide-react';

interface ProductCardProps {
  product: DiscountProduct;
  accentColor: string;
  catalogEndDate?: string;
  hideCountdown?: boolean;
  isAdmin?: boolean;
  hasCheaperAlternative?: boolean; 
  isHighlighted?: boolean;
  id?: string;
  onEdit?: () => void;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'mini';
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  marketLogoUrl?: string;
  marketName?: string;
}

export interface CleanProductInfo {
  cleanName: string;
  quantity: string | null;
}

export const extractQuantityAndCleanName = (productName: string): CleanProductInfo => {
  if (!productName) return { cleanName: '', quantity: null };
  const raw = productName.trim();

  // Pattern matches quantity/weight tokens like "600 q", "400 q", "1 kg", "100 qr", "250 ml", "1 lt", etc.
  const pattern = /(?:^|\s|\()(\d+(?:[.,]\d+)?\s*(?:[xX*]\s*\d+(?:[.,]\d+)?)?\s*(?:kq|kg|qr|gr|q|g|ml|litr|lt|l|ədəd|eded|əd|ed|dənə|dene|paçka|pack|əd\.?))(?:\)|$|\s)/i;

  const match = raw.match(pattern);
  if (match && match[1]) {
    const matchedToken = match[1].trim();
    const matchIdx = raw.indexOf(matchedToken);
    if (matchIdx !== -1) {
      const charAfter = raw[matchIdx + matchedToken.length];
      if (charAfter === '%') {
        return { cleanName: raw, quantity: null };
      }
    }

    const cleaned = raw
      .replace(match[0], ' ')
      .replace(/\(\s*\)/g, ' ')
      .replace(/\s*[,/-]\s*$/, '')
      .replace(/^\s*[,/-]\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleaned.length > 0) {
      return { cleanName: cleaned, quantity: matchedToken };
    }
  }

  return { cleanName: raw, quantity: null };
};

const getCategoryIcon = (category: ProductCategory, isCompact: boolean) => {
  const iconClass = isCompact ? "w-3 h-3" : "w-5 h-5"; 
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

export const extractProductEndDate = (product: any, catalogEndDate?: string): string | undefined => {
  if (!product) return catalogEndDate;
  if (product.expiryDate) return String(product.expiryDate).trim();
  if (product.bitis) return String(product.bitis).trim();
  if (product.bitisTarixi) return String(product.bitisTarixi).trim();
  if (product.bitis_tarixi) return String(product.bitis_tarixi).trim();
  if (product.bitis_tarix) return String(product.bitis_tarix).trim();
  if (product.endDate) return String(product.endDate).trim();
  if (product.end_date) return String(product.end_date).trim();
  if (product.expiry_date) return String(product.expiry_date).trim();
  if (product.son_tarix) return String(product.son_tarix).trim();
  if (product.sonTarix) return String(product.sonTarix).trim();
  
  for (const k of Object.keys(product)) {
    const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lk.includes('bitis') || lk.includes('bitme') || lk.includes('sontarix') || lk === 'enddate' || lk === 'expirydate') {
      const v = product[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }

  return catalogEndDate;
};

export const parseDateString = (rawDate: any): Date | null => {
  if (!rawDate) return null;
  if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? null : rawDate;
  const str = String(rawDate).trim();
  if (!str) return null;

  // Numeric timestamp (e.g. 1729000000000 or 1729000000)
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    const d = new Date(str.length === 10 ? num * 1000 : num);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const ymdMatch = str.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  const dmyMatch = str.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD.MM.YY (2-digit year)
  const dmy2Match = str.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
  if (dmy2Match) {
    const day = parseInt(dmy2Match[1], 10);
    const month = parseInt(dmy2Match[2], 10) - 1;
    const year = 2000 + parseInt(dmy2Match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD.MM (no year, e.g. 21.10)
  const dmMatch = str.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1;
    const nowYear = new Date().getFullYear();
    const d = new Date(nowYear, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle Azerbaijani / Turkish / English month names
  const monthMap: Record<string, number> = {
    'yanvar': 0, 'ocak': 0, 'january': 0,
    'fevral': 1, 'subat': 1, 'şubat': 1, 'february': 1,
    'mart': 2, 'march': 2,
    'aprel': 3, 'nisan': 3, 'april': 3,
    'may': 4, 'mayis': 4, 'mayıs': 4,
    'iyun': 5, 'haziran': 5, 'june': 5,
    'iyul': 6, 'temmuz': 6, 'july': 6,
    'avqust': 7, 'agustos': 7, 'ağustos': 7, 'august': 7,
    'sentyabr': 8, 'eylul': 8, 'eylül': 8, 'september': 8,
    'oktyabr': 9, 'ekim': 9, 'october': 9,
    'noyabr': 10, 'kasim': 10, 'kasım': 10, 'november': 10,
    'dekabr': 11, 'aralik': 11, 'aralık': 11, 'december': 11
  };
  const lower = str.toLowerCase();
  for (const [mName, mIdx] of Object.entries(monthMap)) {
    if (lower.includes(mName)) {
      const dayMatch = lower.match(/(\d{1,2})\s+/);
      const yearMatch = lower.match(/\s+(\d{4})/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      const d = new Date(year, mIdx, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
};

export interface CountdownInfo {
  daysLeft: number;
  label: string;
  badgeStyle: string;
  iconColor: string;
  formattedDate: string;
}

export const calculateDaysLeft = (rawEndDate: any): CountdownInfo | null => {
  if (!rawEndDate) return null;
  const target = parseDateString(rawEndDate);
  if (!target) return null;

  const now = new Date();
  
  // Year alignment: If target year is in a future year like 2026, but current browser year is different,
  // align target's year to now.getFullYear() so countdown matches the brochure's actual day & month
  let effectiveTarget = new Date(target);
  if (Math.abs(effectiveTarget.getFullYear() - now.getFullYear()) > 1) {
    effectiveTarget.setFullYear(now.getFullYear());
    const diffDays = Math.round((effectiveTarget.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < -90) {
      effectiveTarget.setFullYear(now.getFullYear() + 1);
    }
  }

  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMid = new Date(effectiveTarget.getFullYear(), effectiveTarget.getMonth(), effectiveTarget.getDate()).getTime();
  const daysLeft = Math.round((targetMid - todayMid) / (1000 * 60 * 60 * 24));

  const dayStr = String(effectiveTarget.getDate()).padStart(2, '0');
  const monthStr = String(effectiveTarget.getMonth() + 1).padStart(2, '0');
  const formattedDate = `${dayStr}.${monthStr}.${effectiveTarget.getFullYear()}`;

  let label = `${daysLeft} gün`;
  let badgeStyle = "text-gray-800 bg-gray-100 border-gray-200";
  let iconColor = "text-gray-600";

  if (daysLeft < 0) {
    label = "Bitib";
    badgeStyle = "text-gray-500 bg-gray-100 border-gray-200";
    iconColor = "text-gray-400";
  } else if (daysLeft === 0) {
    label = "Son gün";
    badgeStyle = "text-red-700 bg-red-50 border-red-200";
    iconColor = "text-red-600";
  } else if (daysLeft === 1) {
    label = "1 gün";
    badgeStyle = "text-red-700 bg-red-50 border-red-200";
    iconColor = "text-red-600";
  } else if (daysLeft === 2) {
    label = "2 gün";
    badgeStyle = "text-amber-800 bg-amber-50 border-amber-300";
    iconColor = "text-amber-600";
  } else {
    label = `${daysLeft} gün`;
    badgeStyle = "text-gray-800 bg-gray-100 border-gray-200";
    iconColor = "text-gray-600";
  }

  return { daysLeft, label, badgeStyle, iconColor, formattedDate };
};

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  accentColor, 
  catalogEndDate,
  hideCountdown = false,
  isAdmin, 
  hasCheaperAlternative,
  isHighlighted,
  id,
  onEdit, 
  onClick, 
  variant = 'compact',
  isFavorite,
  onToggleFavorite,
  marketLogoUrl,
  marketName
}) => {
  const [imageError, setImageError] = useState(false);
  const isMini = variant === 'mini';
  const isCompact = variant === 'compact' || isMini;

  const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(product.productName);

  const imageUrl = product.customImageUrl 
    ? product.customImageUrl 
    : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(product.productName + ' product')}&w=200&h=200&c=7&rs=1&p=0`;

  return (
    <div 
      id={id}
      onClick={onClick}
      className={`
      bg-white rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 flex flex-col h-full group relative cursor-pointer
      shadow-2xs hover:shadow-xs border border-gray-100 hover:border-${accentColor}-200
      ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-2 scale-105 z-10' : ''}
    `}>
      
      {/* Top Right: Heart / Favorite Button */}
      {!isAdmin && onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute z-30 transition-colors top-1 right-1 text-gray-300 hover:text-red-500 ${isMini ? 'p-1' : 'p-1.5'}`}
          title={isFavorite ? "Yadda saxlanılanlardan çıxar" : "Yadda saxla"}
        >
          <Heart 
            className={`${isMini ? "w-3.5 h-3.5 sm:w-4 sm:h-4" : "w-4 h-4 sm:w-5 sm:h-5"} ${isFavorite ? "fill-red-500 text-red-500" : "hover:text-red-400"} drop-shadow-xs`} 
            strokeWidth={2} 
          />
        </button>
      )}

      {isAdmin && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onEdit) onEdit();
          }}
          className="absolute z-20 bg-white/90 rounded-full shadow-xs text-gray-500 hover:text-blue-600 border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity top-1 left-1 p-0.5 sm:p-1"
        >
          <Edit2 className={isMini ? "w-2.5 h-2.5 sm:w-3 sm:h-3" : "w-3 h-3"} />
        </button>
      )}

      {/* Product Image Container - Reduced image height (aspect-[4/3]) */}
      <div className="aspect-[4/3] w-full relative overflow-hidden bg-gray-50 flex items-center justify-center">
        {!imageError ? (
          <img 
            src={imageUrl} 
            alt={cleanName}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-${accentColor}-50 flex-col gap-1 text-${accentColor}-300`}>
            {getCategoryIcon(product.category, true)}
          </div>
        )}

        {/* Top Left: Market Logo Icon (when provided) */}
        {marketLogoUrl && (
          <div 
            className="absolute top-1.5 left-1.5 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/95 backdrop-blur-xs p-0.5 shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden pointer-events-none"
            title={marketName || "Market"}
          >
            <img src={marketLogoUrl} alt={marketName || "Market"} className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Discount Percentage Badge (Top-left if no market logo, or bottom-left if market logo present) */}
        {product.discountPercentage && (
          <div className={`
            absolute ${marketLogoUrl ? 'bottom-1.5 left-1.5' : 'top-0 left-0'} bg-emerald-600 text-white font-bold rounded shadow-xs flex items-center z-10
            ${isMini ? 'text-[7.5px] sm:text-[8.5px] px-1.5 py-0.5' : 'text-[8.5px] sm:text-[9.5px] px-1.5 py-0.5'}
          `}>
            {product.discountPercentage}
          </div>
        )}

        {/* Bottom Right: Large & Prominently Visible Quantity/Weight Badge */}
        {quantityBadge && (
          <div 
            className="absolute bottom-1.5 right-1.5 z-10 bg-black/75 backdrop-blur-xs text-white font-black text-[11px] sm:text-xs md:text-sm px-2 sm:px-2.5 py-0.5 rounded-md shadow-md tracking-tight select-none pointer-events-none"
            title={`Miqdar / Çəki: ${quantityBadge}`}
          >
            {quantityBadge}
          </div>
        )}
      </div>

      {/* Content Area - Enlarged title text and room for product name */}
      <div className={`${isMini ? 'p-1.5 pt-1.5 sm:p-2' : 'p-2 sm:p-2.5'} flex-1 flex flex-col justify-between`}>
        <div>
          <div className="min-h-[2.75rem] sm:min-h-[3.15rem] flex items-start">
            <h3 
              className={`font-normal text-gray-800 line-clamp-2 leading-snug ${isMini ? 'text-xs sm:text-[13px]' : 'text-sm sm:text-base md:text-[15.5px]'}`} 
              title={product.productName}
            >
              {cleanName}
            </h3>
          </div>
          
          {hasCheaperAlternative && (
            <div className={isMini ? "mt-0.5" : "mt-1"}>
              <div className={`inline-flex items-center gap-0.5 sm:gap-1 bg-green-100 border border-green-200 text-green-700 rounded font-bold ${isMini ? 'px-1.5 py-0.5 text-[7.5px] sm:text-[8.5px]' : 'px-1.5 py-0.5 text-[8.5px] sm:text-[9.5px]'}`}>
                <TrendingDown className={isMini ? "w-2 h-2" : "w-2.5 h-2.5"} />
                {isMini ? 'Ucuz' : 'Daha Ucuzu Var'}
              </div>
            </div>
          )}
        </div>
        
        {/* Price Row: Bold green current price and line-through old price */}
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1">
          {/* Left: Prices */}
          <div className="flex items-baseline gap-1.5 flex-nowrap whitespace-nowrap overflow-hidden min-w-0">
            <span className="font-black text-emerald-600 leading-none text-base sm:text-lg shrink-0 whitespace-nowrap">
              {product.newPrice} <span className="text-[0.8em] font-bold">₼</span>
            </span>
            {product.oldPrice && product.oldPrice !== '---' && (
              <span className="text-gray-400 line-through leading-none font-semibold text-xs sm:text-sm shrink-0 whitespace-nowrap">
                {product.oldPrice}
              </span>
            )}
          </div>

          {/* Right: Clock Icon & Remaining Days badge (hidden when hideCountdown is true) */}
          {!hideCountdown && (() => {
            const rawEndDate = extractProductEndDate(product, catalogEndDate);
            const countdownInfo = calculateDaysLeft(rawEndDate);

            if (!countdownInfo) return null;

            return (
              <div 
                className="flex items-center gap-1 shrink-0 select-none ml-auto"
                title={`Bitmə tarixi: ${countdownInfo.formattedDate} (${countdownInfo.daysLeft <= 0 ? (countdownInfo.daysLeft === 0 ? 'Bu gün bitir' : 'Bitib') : `${countdownInfo.daysLeft} gün qaldı`})`}
              >
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shrink-0">
                  <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${countdownInfo.iconColor}`} strokeWidth={2.2} />
                </div>
                <span className={`text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded border leading-none shrink-0 ${countdownInfo.badgeStyle}`}>
                  {countdownInfo.label}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
