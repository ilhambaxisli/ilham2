
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  showMarketRibbon?: boolean;
  isRowOnMobile?: boolean;
  isListMode?: boolean;
  isThreeColMobile?: boolean;
}

let sharedMeasureCanvasCtx: CanvasRenderingContext2D | null = null;
const getMeasureCanvasCtx = (): CanvasRenderingContext2D | null => {
  if (typeof document === 'undefined') return null;
  if (!sharedMeasureCanvasCtx) {
    const canvas = document.createElement('canvas');
    sharedMeasureCanvasCtx = canvas.getContext('2d');
  }
  return sharedMeasureCanvasCtx;
};

const fitWholeWordsToLines = (text: string, el: HTMLElement, maxLines = 2): string => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return text;

  const maxWidth = el.clientWidth;
  if (maxWidth <= 0) return text;

  const ctx = getMeasureCanvasCtx();
  if (!ctx) return text;

  const cs = window.getComputedStyle(el);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

  const usableWidth = Math.max(16, maxWidth - 2);
  let lineIndex = 0;
  let currentLine = '';
  let fittedCount = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!currentLine) {
      const wWidth = ctx.measureText(w).width;
      if (i === 0) {
        currentLine = w;
        fittedCount = 1;
        if (wWidth > usableWidth) {
          lineIndex = 1;
        }
      } else if (wWidth <= usableWidth) {
        currentLine = w;
        fittedCount = i + 1;
      } else {
        break;
      }
    } else {
      const candidate = `${currentLine} ${w}`;
      if (ctx.measureText(candidate).width <= usableWidth) {
        currentLine = candidate;
        fittedCount = i + 1;
      } else {
        lineIndex += 1;
        if (lineIndex >= maxLines) break;
        if (ctx.measureText(w).width <= usableWidth) {
          currentLine = w;
          fittedCount = i + 1;
        } else {
          break;
        }
      }
    }
  }

  return words.slice(0, Math.max(1, fittedCount)).join(' ');
};

const WholeWordsTitle: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [displayText, setDisplayText] = useState<string>(text);

  useLayoutEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const next = fitWholeWordsToLines(text, el, 2);
    setDisplayText(prev => (prev === next ? prev : next));
  }, [text, className]);

  useLayoutEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.28);
    const maxAllowedH = lh * 2 + 2;
    const currentWords = displayText.trim().split(/\s+/).filter(Boolean);
    if (el.scrollHeight > maxAllowedH && currentWords.length > 1) {
      setDisplayText(currentWords.slice(0, currentWords.length - 1).join(' '));
    }
  }, [displayText]);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const recompute = () => {
      if (!headingRef.current) return;
      const next = fitWholeWordsToLines(text, headingRef.current, 2);
      setDisplayText(prev => (prev === next ? prev : next));
    };
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    if (document.fonts?.ready) {
      document.fonts.ready.then(recompute).catch(() => {});
    }
    return () => ro.disconnect();
  }, [text]);

  return (
    <h3
      ref={headingRef}
      className={`${className} w-full overflow-hidden`}
      title={text}
    >
      {displayText}
    </h3>
  );
};

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

export const getExplicitProductImageUrl = (product?: Partial<DiscountProduct> | null): string | undefined => {
  if (!product) return undefined;
  const img = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
  if (img) return img;
  const customImg = typeof product.customImageUrl === 'string' ? product.customImageUrl.trim() : '';
  if (customImg) return customImg;
  return undefined;
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
  marketName,
  showMarketRibbon = false,
  isRowOnMobile = false,
  isListMode = false,
  isThreeColMobile = false
}) => {
  const [imageError, setImageError] = useState(false);
  const isMini = variant === 'mini';
  const isMiniRow = isMini && isListMode;
  const isPureList = isListMode && !isMini;
  const isCompact = variant === 'compact' || isMini;
  const effectiveRow = isListMode || isRowOnMobile;

  const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(product.productName);

const getMarketSoftBadgeStyle = (name: string, accentColor?: string) => {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('oba')) {
    return { bg: 'bg-emerald-500', text: 'text-white', hex: '#10b981' };
  }
  if (n.includes('araz')) {
    return { bg: 'bg-emerald-600', text: 'text-white', hex: '#059669' };
  }
  if (n.includes('bravo')) {
    return { bg: 'bg-lime-600', text: 'text-white', hex: '#65a30d' };
  }
  if (n.includes('al')) {
    return { bg: 'bg-amber-400', text: 'text-gray-900', hex: '#fbbf24' };
  }
  if (n.includes('bazarstore')) {
    return { bg: 'bg-sky-600', text: 'text-white', hex: '#0284c7' };
  }
  if (n.includes('tamstore') || n.includes('tam')) {
    return { bg: 'bg-teal-500', text: 'text-white', hex: '#14b8a6' };
  }
  if (n.includes('rahat')) {
    return { bg: 'bg-purple-500', text: 'text-white', hex: '#a855f7' };
  }
  if (n.includes('neptun')) {
    return { bg: 'bg-orange-500', text: 'text-white', hex: '#f97316' };
  }
  if (n.includes('bolmart')) {
    return { bg: 'bg-rose-500', text: 'text-white', hex: '#f43f5e' };
  }
  if (n.includes('grandmart')) {
    return { bg: 'bg-indigo-500', text: 'text-white', hex: '#6366f1' };
  }
  if (n.includes('megastore')) {
    return { bg: 'bg-fuchsia-500', text: 'text-white', hex: '#d946ef' };
  }
  return { bg: 'bg-emerald-500', text: 'text-white', hex: '#10b981' };
};

  const explicitImageUrl = getExplicitProductImageUrl(product);
  const autoBingUrl = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(product.productName + ' product')}&w=200&h=200&c=7&rs=1&p=0`;
  const [useFallbackBing, setUseFallbackBing] = useState(false);

  useEffect(() => {
    setImageError(false);
    setUseFallbackBing(false);
  }, [explicitImageUrl, product.productName]);

  const imageUrl = (explicitImageUrl && !useFallbackBing) ? explicitImageUrl : autoBingUrl;
  const rawEndDate = extractProductEndDate(product, catalogEndDate);
  const countdownInfo = calculateDaysLeft(rawEndDate);
  const isExpired = Boolean(countdownInfo && countdownInfo.daysLeft < 0);

  const formattedMarketName = marketName 
    ? marketName.replace(/\s+market$/i, '').trim().toLowerCase().replace(/^\w/, c => c.toUpperCase())
    : '';

  const softBadge = getMarketSoftBadgeStyle(marketName || '', accentColor);

  return (
    <div
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      className={`relative flex flex-col h-full select-none ${showMarketRibbon ? (isMiniRow ? 'pt-3.5 sm:pt-4' : isMini ? 'pt-4 sm:pt-5' : 'pt-5 sm:pt-5.5') : ''}`}
    >
      {/* Market Name Tab - Sits UNDER the card (z-0), extends well below top-left rounded corner */}
      {showMarketRibbon && formattedMarketName && (
        <div 
          className={`absolute top-0 left-0 z-0 ${softBadge.bg} ${softBadge.text} ${isMiniRow ? 'px-2 pt-[3px]' : isMini ? 'px-2 sm:px-2.5 pt-1' : 'px-2.5 sm:px-3 pt-1'} rounded-t-lg sm:rounded-t-xl flex items-start justify-center pointer-events-none select-none max-w-[88%] shadow-xs`}
          style={{ height: isMiniRow ? '34px' : isMini ? '38px' : '44px', backgroundColor: softBadge.hex }}
          title={marketName}
        >
          <span className={`${isMiniRow ? 'text-[9px] sm:text-[10.5px]' : isMini ? 'text-[9.5px] sm:text-[11px]' : 'text-[11px] sm:text-xs'} font-black tracking-tight whitespace-nowrap leading-none`}>
            {formattedMarketName}
          </span>
        </div>
      )}

      <div 
        id={id}
        onClick={onClick}
        className={`
        bg-white rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300
        ${isMiniRow ? 'flex flex-row p-1.5 sm:p-2 items-center' : isPureList ? 'flex flex-row p-2 sm:p-2.5 items-center' : isRowOnMobile ? 'flex flex-row sm:flex-col p-2 sm:p-0 items-center sm:items-stretch' : 'flex flex-col'}
        h-full group relative cursor-pointer z-10
        ${hasCheaperAlternative
          ? 'shadow-xs hover:shadow-sm border-[1.5px] border-emerald-500 hover:border-emerald-600'
          : `shadow-2xs hover:shadow-xs border border-gray-100 hover:border-${accentColor}-200`}
        ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-2 scale-105 z-20' : ''}
      `}>
        
        {/* Top Right: Heart / Favorite Button */}
        {!isAdmin && onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute z-30 transition-colors ${isMiniRow ? 'top-1 right-1 p-0.5' : effectiveRow ? 'top-2 right-2 p-1' : isThreeColMobile ? 'top-1 right-1 sm:top-1.5 sm:right-1.5 p-1 sm:p-1.5' : 'top-1.5 right-1.5 p-1.5'} text-gray-300 hover:text-red-500`}
            title={isFavorite ? "Yadda saxlanılanlardan çıxar" : "Yadda saxla"}
          >
            <Heart 
              className={`${isMiniRow ? "w-3.5 h-3.5" : isMini ? "w-3.5 h-3.5 sm:w-4 sm:h-4" : isThreeColMobile ? "w-3.5 h-3.5 sm:w-5 sm:h-5" : "w-4 h-4 sm:w-5 sm:h-5"} ${isFavorite ? "fill-red-500 text-red-500" : "hover:text-red-400"} drop-shadow-xs`} 
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
            className="absolute z-20 bg-white/90 rounded-full shadow-xs text-gray-500 hover:text-blue-600 border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity top-1.5 left-1.5 p-0.5 sm:p-1"
          >
            <Edit2 className={isMini ? "w-2.5 h-2.5 sm:w-3 sm:h-3" : "w-3 h-3"} />
          </button>
        )}

        {/* Product Image Container */}
        <div className={`
          ${isMiniRow
            ? 'w-[68px] h-[68px] min-[380px]:w-[74px] min-[380px]:h-[74px] sm:w-[82px] sm:h-[82px] rounded-lg shrink-0'
            : isPureList
              ? 'w-24 h-24 xs:w-28 xs:h-28 sm:w-28 sm:h-28 rounded-lg shrink-0'
              : isRowOnMobile
                ? 'w-24 h-24 xs:w-28 xs:h-28 sm:w-full sm:aspect-[6/5] rounded-lg sm:rounded-none shrink-0'
                : isMini
                  ? 'aspect-square w-full'
                  : 'aspect-[6/5] w-full'}
          relative overflow-hidden bg-gray-50 flex items-center justify-center
        `}>
          {!imageError ? (
            <img 
              src={imageUrl} 
              alt={cleanName}
              className={`w-full h-full object-contain object-center mix-blend-multiply group-hover:scale-105 transition-transform duration-500 ${isExpired ? 'grayscale-[55%] opacity-85' : ''}`}
              onError={() => {
                if (explicitImageUrl && !useFallbackBing) {
                  setUseFallbackBing(true);
                } else {
                  setImageError(true);
                }
              }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isExpired ? 'bg-gray-100/70 text-gray-400 grayscale-[55%]' : `bg-${accentColor}-50 text-${accentColor}-300`} flex-col gap-1`}>
              {getCategoryIcon(product.category, true)}
            </div>
          )}

          {/* Soft light-gray wash overlay + diagonal BİTDİ stamp for expired products */}
          {isExpired && (
            <>
              <div className="absolute inset-0 bg-gray-200/25 pointer-events-none z-[5]" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[15]">
                <span
                  className={`-rotate-12 select-none uppercase font-black tracking-widest text-red-600/90 bg-white/85 backdrop-blur-[1px] border-2 border-red-600/85 rounded-lg shadow-md leading-none ${
                    isMini
                      ? 'text-xs sm:text-sm px-2 py-0.5'
                      : isListMode
                        ? 'text-xs sm:text-sm px-2 sm:px-2.5 py-0.5'
                        : isThreeColMobile
                          ? 'text-xs sm:text-base md:text-lg px-2 sm:px-3 py-0.5 sm:py-1'
                          : 'text-base sm:text-xl px-3.5 py-1'
                  }`}
                >
                  BİTDİ
                </span>
              </div>
            </>
          )}

          {/* Top Left: Market Logo Icon and/or "Ucuzu var" badge, or Discount Percentage */}
          {(marketLogoUrl || hasCheaperAlternative || product.discountPercentage) && (() => {
            const hasHeartOverImage = !isAdmin && Boolean(onToggleFavorite);
            const topLeftMaxWidth = hasHeartOverImage
              ? isListMode
                ? 'max-w-[calc(100%-0.5rem)]'
                : isRowOnMobile
                  ? 'max-w-[calc(100%-0.5rem)] sm:max-w-[calc(100%-3rem)]'
                  : 'max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)]'
              : 'max-w-[calc(100%-0.5rem)]';

            return (
              <div className={`absolute ${isMini ? 'top-1 left-1' : 'top-1 left-1 sm:top-1.5 sm:left-1.5'} z-20 flex flex-row items-start gap-1 pointer-events-none ${topLeftMaxWidth}`}>
                {marketLogoUrl && (
                  <div 
                    className={`${isMini ? 'w-5 h-5 sm:w-6 sm:h-6' : isThreeColMobile ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-6 h-6 sm:w-7 sm:h-7'} rounded-lg bg-white/95 backdrop-blur-xs p-0.5 shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden shrink-0`}
                    title={marketName || "Market"}
                  >
                    <img src={marketLogoUrl} alt={marketName || "Market"} className="w-full h-full object-contain" />
                  </div>
                )}

                {hasCheaperAlternative && (
                  <div
                    className={`flex flex-col items-start text-left font-black text-emerald-700 leading-[1.05] tracking-tight select-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.95)] ${
                      isThreeColMobile
                        ? 'text-[9.5px] min-[380px]:text-[10.5px] sm:text-xs'
                        : isMini
                          ? 'text-[9px] sm:text-[10px]'
                          : 'text-[10.5px] sm:text-xs'
                    }`}
                  >
                    <span>Daha</span>
                    <span>Ucuzu</span>
                    <span>Var</span>
                  </div>
                )}

                {!marketLogoUrl && !hasCheaperAlternative && product.discountPercentage && (
                  <div className={`
                    ${isExpired ? 'bg-gray-400' : 'bg-emerald-600'} text-white font-bold rounded shadow-xs flex items-center
                    ${isThreeColMobile ? 'text-[7.5px] sm:text-[9.5px] px-1 sm:px-1.5 py-0.5' : isMini ? 'text-[7px] sm:text-[8.5px] px-1 sm:px-1.5 py-0.5' : 'text-[8.5px] sm:text-[9.5px] px-1.5 py-0.5'}
                  `}>
                    {product.discountPercentage}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bottom Left: Discount Percentage (when top-left is occupied) + Countdown Badge matching weight badge scale */}
          {(((marketLogoUrl || hasCheaperAlternative) && product.discountPercentage) || (!hideCountdown && countdownInfo && countdownInfo.daysLeft >= 0)) && (
            <div className="absolute bottom-1 left-1 sm:bottom-1.5 sm:left-1.5 z-10 flex flex-col items-start gap-1 pointer-events-none">
              {(marketLogoUrl || hasCheaperAlternative) && product.discountPercentage && (
                <div className={`
                  ${isExpired ? 'bg-gray-400' : 'bg-emerald-600'} text-white font-bold rounded shadow-xs flex items-center
                  ${isThreeColMobile ? 'text-[7.5px] sm:text-[9.5px] px-1 sm:px-1.5 py-0.5' : isMini ? 'text-[7px] sm:text-[8.5px] px-1 sm:px-1.5 py-0.5' : 'text-[8.5px] sm:text-[9.5px] px-1.5 py-0.5'}
                `}>
                  {product.discountPercentage}
                </div>
              )}

              {!hideCountdown && countdownInfo && countdownInfo.daysLeft >= 0 && (
                <div
                  className={`inline-flex items-center gap-1 font-black rounded-md shadow-md tracking-tight leading-none select-none ${
                    countdownInfo.daysLeft <= 1
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-400 text-gray-950'
                  } ${
                    isThreeColMobile
                      ? 'text-[10.5px] sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1'
                      : isMini
                        ? 'text-[10px] sm:text-xs px-2 py-0.5'
                        : 'text-xs sm:text-sm md:text-base px-2.5 py-1'
                  }`}
                  title={`Bitmə tarixi: ${countdownInfo.formattedDate} (${countdownInfo.daysLeft === 0 ? 'Bu gün bitir' : `${countdownInfo.daysLeft} gün qaldı`})`}
                >
                  <Clock
                    className={`${
                      isThreeColMobile
                        ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5'
                        : isMini
                          ? 'w-2.5 h-2.5 sm:w-3 sm:h-3'
                          : 'w-3 h-3 sm:w-3.5 sm:h-3.5'
                    } shrink-0`}
                    strokeWidth={2.5}
                  />
                  <span>{countdownInfo.daysLeft >= 1 ? countdownInfo.daysLeft : 'Son'}</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Right: Quantity/Weight Badge */}
          {quantityBadge && (
            <div 
              className={`absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 z-10 bg-black text-white font-black ${isMiniRow ? 'text-[8.5px] sm:text-[10px] px-1.5 py-0.5' : isThreeColMobile ? 'text-[10.5px] sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1' : isMini ? 'text-[10px] sm:text-xs px-2 py-0.5' : 'text-xs sm:text-sm md:text-base px-2.5 py-1'} rounded-md shadow-md tracking-tight leading-none select-none pointer-events-none`}
              title={`Miqdar / Çəki: ${quantityBadge}`}
            >
              {quantityBadge}
            </div>
          )}
        </div>

      {/* Content Area */}
      <div className={`${
        isMiniRow
          ? 'flex-1 min-w-0 pl-2 sm:pl-2.5 py-0.5 flex flex-col justify-between h-full'
          : isPureList
            ? 'flex-1 min-w-0 pl-3.5 p-1 flex flex-col justify-between h-full'
            : isRowOnMobile
              ? 'flex-1 min-w-0 pl-3.5 sm:pl-2.5 p-1 sm:p-2.5 flex flex-col justify-between h-full'
              : isThreeColMobile
                ? 'p-1.5 sm:p-2.5 flex-1 flex flex-col justify-between'
                : `${isMini ? 'p-2 sm:p-2.5' : 'p-2 sm:p-2.5'} flex-1 flex flex-col justify-between`
      }`}>
        <div>
          <div className={`${
            isMiniRow
              ? 'min-h-0 pr-4'
              : isPureList
                ? 'min-h-0 pr-6'
                : isRowOnMobile
                  ? 'min-h-0 sm:min-h-[2.65rem] pr-6 sm:pr-0'
                  : isThreeColMobile
                    ? 'min-h-[2.25rem] sm:min-h-[2.65rem]'
                    : isMini
                      ? 'min-h-[2.2rem] sm:min-h-[2.45rem]'
                      : 'min-h-[2.45rem] sm:min-h-[2.75rem]'
          } flex items-start`}>
            <WholeWordsTitle
              text={product.productName}
              className={`font-bold text-gray-900 leading-[1.22] ${
                isMiniRow
                  ? 'text-[12px] min-[380px]:text-[12.5px] sm:text-sm'
                  : isPureList
                    ? 'text-[15.5px] min-[380px]:text-[16.5px] sm:text-lg'
                    : isRowOnMobile
                      ? 'text-[15.5px] min-[380px]:text-[16.5px] sm:text-sm md:text-[15px]'
                      : isThreeColMobile
                        ? 'text-[12.5px] min-[380px]:text-[13px] sm:text-sm md:text-[15px]'
                        : isMini
                          ? 'text-xs sm:text-[13px]'
                          : 'text-[13.5px] min-[380px]:text-sm sm:text-[15px] md:text-base'
              }`}
            />
          </div>
        </div>
        
        {/* Price Row */}
        <div className={`${isMiniRow ? 'mt-1 pt-1' : isThreeColMobile || isMini ? 'mt-1.5 sm:mt-2 pt-1.5 flex-wrap sm:flex-nowrap' : 'mt-2 pt-1.5'} border-t border-gray-100 flex items-center justify-between gap-1`}>
          {/* Left: Prices */}
          <div className={isMini && !isMiniRow ? 'flex flex-col items-start justify-center gap-0.5 min-h-[2.4rem] sm:min-h-[2.7rem] min-w-0' : `flex flex-wrap items-baseline ${isThreeColMobile || isMiniRow ? 'gap-x-1 sm:gap-x-1.5' : 'gap-x-1.5'} gap-y-0.5 min-w-0`}>
            <span className={`font-black ${isExpired ? 'text-gray-500' : 'text-emerald-600'} leading-none ${
              isMiniRow
                ? 'text-[15px] min-[380px]:text-[16px] sm:text-lg'
                : isPureList
                  ? 'text-xl min-[380px]:text-2xl'
                  : isRowOnMobile
                    ? 'text-xl min-[380px]:text-2xl sm:text-xl'
                    : isThreeColMobile
                      ? 'text-[15px] min-[400px]:text-[16.5px] sm:text-xl'
                      : isMini
                        ? 'text-[15px] sm:text-lg'
                        : 'text-lg sm:text-xl'
            } shrink-0 whitespace-nowrap`}>
              {product.newPrice} <span className="text-[0.8em] font-bold">₼</span>
            </span>
            {product.oldPrice && product.oldPrice !== '---' && (
              <span className={`text-red-500 line-through leading-none font-semibold ${
                isMiniRow
                  ? 'text-[10px] min-[380px]:text-[11px] sm:text-xs'
                  : isPureList
                    ? 'text-xs min-[380px]:text-sm'
                    : isRowOnMobile
                      ? 'text-xs min-[380px]:text-sm sm:text-sm'
                      : isThreeColMobile
                        ? 'text-[10.5px] min-[400px]:text-[11.5px] sm:text-sm'
                        : isMini
                          ? 'text-[11px] sm:text-xs'
                          : 'text-xs sm:text-sm'
              } shrink-0 whitespace-nowrap`}>
                {product.oldPrice}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ProductCard;
