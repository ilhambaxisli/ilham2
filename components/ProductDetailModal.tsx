import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { 
  X, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  TrendingDown, 
  Clock, 
  ArrowRight,
  GripHorizontal
} from 'lucide-react';
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
  showComparisons?: boolean;
  catalogEndDate?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
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
  catalogEndDate,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  currentIndex,
  totalCount
}) => {
  // TikTok-style vertical gesture and slide state (all hooks at the very top unconditionally)
  const [dragY, setDragY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [slideState, setSlideState] = useState<'idle' | 'sliding-up' | 'sliding-down' | 'entering-from-bottom' | 'entering-from-top'>('idle');

  const startY = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const isTouchOnScrollable = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rootWrapperRef = useRef<HTMLDivElement | null>(null);
  const isTransitioning = useRef<boolean>(false);

  // Lock background body scrolling completely while modal is open so nothing moves in background
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Intercept touchmove on the modal wrapper with passive: false to prevent background page scroll
  useEffect(() => {
    const el = rootWrapperRef.current;
    if (!el || !isOpen) return;

    const preventBackdropScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (scrollContainerRef.current && scrollContainerRef.current.contains(target)) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const diff = currentY.current !== null && startY.current !== null ? currentY.current - startY.current : 0;
        if (diff > 0 && scrollTop > 0) return;
        if (diff < 0 && scrollTop + clientHeight < scrollHeight - 4) return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchmove', preventBackdropScroll, { passive: false });
    return () => {
      el.removeEventListener('touchmove', preventBackdropScroll);
    };
  }, [isOpen]);

  // Reset drag and transition state when product changes or modal reopens
  useEffect(() => {
    setDragY(0);
    setIsDragging(false);
    isTransitioning.current = false;
    setSlideState('idle');
  }, [product, isOpen]);

  // Trigger TikTok slide-up to next product
  const triggerNext = useCallback(() => {
    if (!hasNext || !onNext || isTransitioning.current) return;
    isTransitioning.current = true;
    setSlideState('sliding-up');
    
    setTimeout(() => {
      onNext();
      setSlideState('entering-from-bottom');
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideState('idle');
          setDragY(0);
          isTransitioning.current = false;
        }, 30);
      });
    }, 200);
  }, [hasNext, onNext]);

  // Trigger TikTok slide-down to previous product
  const triggerPrev = useCallback(() => {
    if (!hasPrev || !onPrev || isTransitioning.current) return;
    isTransitioning.current = true;
    setSlideState('sliding-down');
    
    setTimeout(() => {
      onPrev();
      setSlideState('entering-from-top');
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideState('idle');
          setDragY(0);
          isTransitioning.current = false;
        }, 30);
      });
    }, 200);
  }, [hasPrev, onPrev]);

  // Keyboard navigation (ArrowDown for Next, ArrowUp for Prev, Escape to Close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowDown' || e.key === 'PageDown') && hasNext) {
        e.preventDefault();
        triggerNext();
      } else if ((e.key === 'ArrowUp' || e.key === 'PageUp') && hasPrev) {
        e.preventDefault();
        triggerPrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasNext, hasPrev, triggerNext, triggerPrev, onClose]);

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
    if (!showComparisons || !product) return [];

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
      if (market.name === marketName) return;

      const marketProducts = market.catalogs && market.catalogs.length > 0
        ? market.catalogs.flatMap(c => c.products)
        : market.products || [];

      const match = marketProducts.find(p => normalize(p.productName) === sourceName);
      
      if (match) {
        const matchPrice = parsePriceNumber(match.newPrice);
        if (!isNaN(matchPrice)) {
          const diff = currentPrice - matchPrice;
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

  const formatEndDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = parseDateString(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Touch handlers for vertical TikTok-style full-window swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning.current) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    currentY.current = touch.clientY;

    const target = e.target as HTMLElement;
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && scrollContainer.contains(target)) {
      isTouchOnScrollable.current = true;
    } else {
      isTouchOnScrollable.current = false;
    }
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || isTransitioning.current) return;
    const touch = e.touches[0];
    currentY.current = touch.clientY;
    const diff = currentY.current - startY.current;

    // Disambiguate with internal scrolling if touch started in scrollable area
    if (isTouchOnScrollable.current && scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // If user scrolls down and scrollTop > 0, let internal content scroll
      if (diff > 0 && scrollTop > 0) {
        setDragY(0);
        return;
      }
      // If user scrolls up and not yet at end of content, let internal content scroll
      if (diff < 0 && scrollTop + clientHeight < scrollHeight - 6) {
        setDragY(0);
        return;
      }
    }

    // Apply drag offset with pleasant physical damping
    const resistance = Math.abs(diff) > 100 ? 0.65 : 0.85;
    setDragY(diff * resistance);
  };

  const handleTouchEnd = () => {
    if (startY.current === null || currentY.current === null || isTransitioning.current) {
      setIsDragging(false);
      setDragY(0);
      return;
    }

    const diff = currentY.current - startY.current;
    const swipeThreshold = 50;

    if (diff < -swipeThreshold && hasNext) {
      // Swiped UP -> Show Next Product (TikTok style)
      triggerNext();
    } else if (diff > swipeThreshold && hasPrev) {
      // Swiped DOWN -> Show Previous Product
      triggerPrev();
    } else if (diff > 140 && !hasPrev) {
      // Pulled far down at top -> dismiss modal
      onClose();
    } else {
      // Spring back to default center
      setDragY(0);
    }

    setIsDragging(false);
    startY.current = null;
    currentY.current = null;
    isTouchOnScrollable.current = false;
  };

  // Mouse drag handlers for desktop support
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTransitioning.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    isMouseDown.current = true;
    startY.current = e.clientY;
    currentY.current = e.clientY;

    if (scrollContainerRef.current && scrollContainerRef.current.contains(target)) {
      isTouchOnScrollable.current = true;
    } else {
      isTouchOnScrollable.current = false;
    }
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || startY.current === null || isTransitioning.current) return;
    currentY.current = e.clientY;
    const diff = currentY.current - startY.current;

    if (isTouchOnScrollable.current && scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      if (diff > 0 && scrollTop > 0) return;
      if (diff < 0 && scrollTop + clientHeight < scrollHeight - 6) return;
    }

    const resistance = Math.abs(diff) > 100 ? 0.65 : 0.85;
    setDragY(diff * resistance);
  };

  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    handleTouchEnd();
  };

  if (!isOpen || !product) return null;

  const effectiveEndDate = extractProductEndDate(product, catalogEndDate);
  const countdownInfo = calculateDaysLeft(effectiveEndDate);
  const formattedEndDate = countdownInfo?.formattedDate || formatEndDate(effectiveEndDate);
  const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(product.productName);

  const imageUrl = product.customImageUrl 
    ? product.customImageUrl 
    : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(product.productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;

  // Compute transform and transition for the entire modal window ("komple pencere kaysin")
  let modalTransform = 'translateY(0px) scale(1)';
  let modalTransition = 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out';
  let modalOpacity = 1;

  if (isDragging) {
    modalTransform = `translateY(${dragY}px) scale(${1 - Math.min(Math.abs(dragY) * 0.0003, 0.04)})`;
    modalTransition = 'none';
  } else if (slideState === 'sliding-up') {
    modalTransform = 'translateY(-120%) scale(0.92)';
    modalTransition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease-in';
    modalOpacity = 0.2;
  } else if (slideState === 'sliding-down') {
    modalTransform = 'translateY(120%) scale(0.92)';
    modalTransition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease-in';
    modalOpacity = 0.2;
  } else if (slideState === 'entering-from-bottom') {
    modalTransform = 'translateY(90px) scale(0.95)';
    modalTransition = 'none';
    modalOpacity = 0.8;
  } else if (slideState === 'entering-from-top') {
    modalTransform = 'translateY(-90px) scale(0.95)';
    modalTransition = 'none';
    modalOpacity = 0.8;
  }

  return (
    <div ref={rootWrapperRef} className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 select-none overflow-hidden touch-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        onTouchMove={(e) => { if (e.cancelable) e.preventDefault(); }}
      />

      {/* TikTok-style Vertical Navigation Floating Dock (Desktop & Tablet) */}
      <div className="hidden sm:flex fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[115] flex-col items-center gap-3">
        {/* Up / Previous Product Button */}
        <button
          type="button"
          disabled={!hasPrev}
          onClick={(e) => { e.stopPropagation(); triggerPrev(); }}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${
            hasPrev 
              ? 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 hover:scale-110 active:scale-90 cursor-pointer border border-gray-100' 
              : 'bg-white/40 text-gray-400 cursor-not-allowed opacity-40'
          }`}
          title="Əvvəlki məhsul (Yuxarı sürüşdür)"
        >
          <ChevronUp className="w-6 h-6 stroke-[3]" />
        </button>

        {/* Counter / Page Indicator */}
        {totalCount !== undefined && currentIndex !== undefined && (
          <div className="bg-black/80 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1.5 rounded-full shadow-lg border border-white/10 tracking-tight flex flex-col items-center leading-none">
            <span>{currentIndex + 1}</span>
            <span className="text-[8px] text-gray-400 font-normal">/ {totalCount}</span>
          </div>
        )}

        {/* Down / Next Product Button */}
        <button
          type="button"
          disabled={!hasNext}
          onClick={(e) => { e.stopPropagation(); triggerNext(); }}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${
            hasNext 
              ? 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 hover:scale-110 active:scale-90 cursor-pointer border border-gray-100' 
              : 'bg-white/40 text-gray-400 cursor-not-allowed opacity-40'
          }`}
          title="Növbəti məhsul (Aşağı sürüşdür)"
        >
          <ChevronDown className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* ENTIRE MODAL CONTAINER - Slides completely up/down on vertical swipe like TikTok */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: modalTransform,
          transition: modalTransition,
          opacity: modalOpacity,
          willChange: 'transform, opacity'
        }}
        className="relative w-full max-w-sm bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden max-h-[90vh] z-10 touch-none cursor-grab active:cursor-grabbing border border-gray-100"
      >
        
        {/* TikTok Drag Handle Pill at the very top */}
        <div className="w-full flex items-center justify-center pt-2 pb-0.5 bg-gray-50/80 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header Image - Primary swipe area */}
        <div 
          className="relative w-full h-48 bg-gray-50 flex items-center justify-center shrink-0 select-none overflow-hidden"
        >
          <img 
            src={imageUrl} 
            alt={cleanName} 
            draggable={false}
            className="w-40 h-40 object-contain mix-blend-multiply pointer-events-none select-none"
          />

          {/* Mobile TikTok-style quick vertical indicators on image right edge */}
          <div className="sm:hidden absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            {hasPrev && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); triggerPrev(); }}
                className="w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                title="Əvvəlki məhsul"
              >
                <ChevronUp className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); triggerNext(); }}
                className="w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                title="Növbəti məhsul"
              >
                <ChevronDown className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
          </div>
          
          {/* Back Button */}
          {canGoBack && onBack && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="absolute top-2.5 left-2.5 p-2 bg-white/85 hover:bg-white rounded-full text-gray-700 shadow-sm transition-all font-medium flex items-center gap-1 text-xs z-10"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Close Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-2.5 right-2.5 p-2 bg-white/85 hover:bg-red-50 hover:text-red-600 rounded-full text-gray-500 shadow-sm transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Discount Badge */}
          {product.discountPercentage && (
            <div className="absolute top-2.5 left-2.5 bg-emerald-600 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm">
              {product.discountPercentage}
            </div>
          )}

          {/* Quantity Badge on bottom-right of image */}
          {quantityBadge && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-md tracking-tight">
              {quantityBadge}
            </div>
          )}
        </div>

        {/* Product Info Content */}
        <div ref={scrollContainerRef} className="p-5 sm:p-6 overflow-y-auto cursor-auto touch-pan-y">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-lg uppercase tracking-wider">
              {marketName}
            </span>
            <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-gray-500 bg-gray-100 rounded-lg">
              {product.category}
            </span>
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-3">
            {cleanName}
          </h2>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3.5 mt-2 mb-2">
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

          {/* TikTok Navigation Hint Footer */}
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-[11px] font-medium">
            <ChevronUp className="w-3.5 h-3.5 animate-bounce" />
            <span>Məhsulları dəyişmək üçün yuxarı / aşağı sürüşdürün</span>
            <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
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
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-100 bg-white overflow-hidden shadow-sm">
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
