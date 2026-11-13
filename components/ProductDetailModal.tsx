import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { 
  X, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  TrendingDown, 
  Clock, 
  ArrowRight,
  Heart
} from 'lucide-react';
import { DiscountProduct, MarketData } from '../types';
import { parseDateString, extractProductEndDate, calculateDaysLeft, extractQuantityAndCleanName } from './ProductCard';

export interface ModalProductItem {
  product: DiscountProduct;
  marketName: string;
  marketId?: string;
  catalogEndDate?: string;
}

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
  productList?: ModalProductItem[];
  onSelectIndex?: (index: number) => void;
  prevItem?: ModalProductItem | null;
  nextItem?: ModalProductItem | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onEnsureFavorite?: () => void;
  checkIsFavorite?: (item: ModalProductItem) => boolean;
  onToggleFavoriteItem?: (item: ModalProductItem) => void;
  onEnsureFavoriteItem?: (item: ModalProductItem) => void;
  onSelectMarketInModal?: (marketId: string) => void;
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
  currentIndex = 0,
  totalCount,
  productList,
  onSelectIndex,
  isFavorite = false,
  onToggleFavorite,
  onEnsureFavorite,
  checkIsFavorite,
  onToggleFavoriteItem,
  onEnsureFavoriteItem,
  onSelectMarketInModal
}) => {
  const items: ModalProductItem[] = useMemo(() => {
    if (productList && productList.length > 0) return productList;
    if (product) return [{ product, marketName, catalogEndDate }];
    return [];
  }, [productList, product, marketName, catalogEndDate]);

  const effectiveTotal = totalCount ?? items.length;

  const [activeIdx, setActiveIdx] = useState<number>(currentIndex);
  const [burstSlideIdx, setBurstSlideIdx] = useState<number | null>(null);
  const [heartBurstPhase, setHeartBurstPhase] = useState<'hidden' | 'pop' | 'fade'>('hidden');
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState<boolean>(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeIdxRef = useRef<number>(currentIndex);
  const prevItemsRef = useRef<ModalProductItem[]>(items);
  const wasOpenRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Strong iOS/Android background body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const savedScrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalLeft = document.body.style.left;
    const originalRight = document.body.style.right;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = originalLeft;
      document.body.style.right = originalRight;
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.scrollTo(0, savedScrollY);
    };
  }, [isOpen]);

  // Snap scroller synchronously to currentIndex when modal opens or productList/index changes
  useLayoutEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setIsMarketDropdownOpen(false);
      return;
    }

    const el = scrollerRef.current;
    const clampedIdx = Math.max(0, Math.min(Math.max(items.length - 1, 0), currentIndex));
    const justOpened = !wasOpenRef.current;
    const listChanged = prevItemsRef.current !== items;
    wasOpenRef.current = true;
    prevItemsRef.current = items;

    if (justOpened || listChanged || clampedIdx !== activeIdxRef.current) {
      activeIdxRef.current = clampedIdx;
      setActiveIdx(clampedIdx);
      if (el && el.clientHeight > 0) {
        el.scrollTop = clampedIdx * el.clientHeight;
      }
    }
  }, [isOpen, currentIndex, items]);

  useEffect(() => {
    return () => {
      burstTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const scrollToIndex = useCallback((targetIdx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, targetIdx));
    el.scrollTo({
      top: clamped * el.clientHeight,
      behavior: 'smooth'
    });
  }, [items.length]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0 || items.length === 0) return;
    const newIdx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / el.clientHeight)));
    if (newIdx !== activeIdxRef.current) {
      activeIdxRef.current = newIdx;
      setActiveIdx(newIdx);
      setIsMarketDropdownOpen(false);
      onSelectIndex?.(newIdx);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (activeIdxRef.current < items.length - 1) {
          e.preventDefault();
          scrollToIndex(activeIdxRef.current + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (activeIdxRef.current > 0) {
          e.preventDefault();
          scrollToIndex(activeIdxRef.current - 1);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items.length, scrollToIndex, onClose]);

  const parsePriceNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isNaN(val) ? NaN : val;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(str);
  };

  // Build product lowest price map once per allMarkets change for fast Best Price checks across all slides
  const minPriceByProductName = useMemo(() => {
    const map = new Map<string, number>();
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    for (const market of allMarkets) {
      const marketProducts = market.catalogs && market.catalogs.length > 0
        ? market.catalogs.flatMap(c => c.products)
        : market.products || [];
      for (const p of marketProducts) {
        const key = normalize(p.productName);
        const price = parsePriceNumber(p.newPrice);
        if (!key || isNaN(price)) continue;
        const prev = map.get(key);
        if (prev === undefined || price < prev) {
          map.set(key, price);
        }
      }
    }
    return map;
  }, [allMarkets]);

  const activeItem = items[activeIdx] || (product ? { product, marketName, catalogEndDate } : null);

  // Comparison list for currently active item when Fürsətlər mode is active
  const comparisonData = useMemo(() => {
    if (!showComparisons || !activeItem) return [];
    const curProd = activeItem.product;
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const sourceName = normalize(curProd.productName);
    const currentPrice = parsePriceNumber(curProd.newPrice);
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
      if (market.name === activeItem.marketName) return;
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
              diff,
              product: match
            });
          }
        }
      }
    });

    return alternatives.sort((a, b) => b.diff - a.diff);
  }, [activeItem, allMarkets, showComparisons]);

  const findMarketForItem = useCallback((item: ModalProductItem) => {
    if (!allMarkets || allMarkets.length === 0) return null;
    if (item.marketId) {
      const byId = allMarkets.find(m => m.id === item.marketId);
      if (byId) return byId;
    }
    const lowerName = (item.marketName || '').trim().toLowerCase();
    return allMarkets.find(m => 
      m.name.trim().toLowerCase() === lowerName || 
      m.id === (item.product as any)?.marketId
    ) || null;
  }, [allMarkets]);

  const formatEndDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = parseDateString(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const triggerHeartBurst = useCallback((item: ModalProductItem, idx: number) => {
    if (onEnsureFavoriteItem) {
      onEnsureFavoriteItem(item);
    } else if (onEnsureFavorite) {
      onEnsureFavorite();
    } else if (onToggleFavorite) {
      onToggleFavorite();
    }

    burstTimersRef.current.forEach(clearTimeout);
    burstTimersRef.current = [];

    setBurstSlideIdx(idx);
    setHeartBurstPhase('hidden');
    requestAnimationFrame(() => {
      setHeartBurstPhase('pop');
      const t1 = setTimeout(() => {
        setHeartBurstPhase('fade');
      }, 420);
      const t2 = setTimeout(() => {
        setHeartBurstPhase('hidden');
        setBurstSlideIdx(null);
      }, 750);
      burstTimersRef.current.push(t1, t2);
    });
  }, [onEnsureFavoriteItem, onEnsureFavorite, onToggleFavorite]);

  if (!isOpen || items.length === 0) return null;

  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < items.length - 1;

  return (
    <div className="fixed inset-0 z-[100] select-none overflow-hidden bg-white sm:bg-black/80">
      {/* Dark Backdrop on larger screens */}
      <div 
        className="hidden sm:block absolute inset-0 backdrop-blur-sm pointer-events-none"
      />

      {/* TikTok-style Vertical Navigation Floating Dock (Desktop & Tablet) */}
      <div className="hidden sm:flex fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[115] flex-col items-center gap-3">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={(e) => { e.stopPropagation(); scrollToIndex(activeIdx - 1); }}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${
            hasPrev 
              ? 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 hover:scale-110 active:scale-90 cursor-pointer border border-gray-100' 
              : 'bg-white/40 text-gray-400 cursor-not-allowed opacity-40'
          }`}
          title="Əvvəlki məhsul (Yuxarı sürüşdür)"
        >
          <ChevronUp className="w-6 h-6 stroke-[3]" />
        </button>

        {effectiveTotal > 0 && (
          <div className="bg-black/80 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1.5 rounded-full shadow-lg border border-white/10 tracking-tight flex flex-col items-center leading-none">
            <span>{activeIdx + 1}</span>
            <span className="text-[8px] text-gray-400 font-normal">/ {effectiveTotal}</span>
          </div>
        )}

        <button
          type="button"
          disabled={!hasNext}
          onClick={(e) => { e.stopPropagation(); scrollToIndex(activeIdx + 1); }}
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

      {/* Native 120Hz CSS Scroll-Snap Vertical Feed Container */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="relative z-10 w-full h-full overflow-y-auto snap-y snap-mandatory overscroll-y-none scrollbar-hide touch-pan-y [overflow-anchor:none]"
      >
        {items.map((item, idx) => {
          // Virtualize far-away slides so even 300+ products open and scroll effortlessly at 60/120fps
          const isNearby = Math.abs(idx - activeIdx) <= 2;

          if (!isNearby) {
            return (
              <div
                key={`slide-${idx}`}
                className="w-full h-full shrink-0 snap-start snap-always flex items-stretch sm:items-center justify-center p-0"
              >
                <div className="w-full sm:max-w-lg h-full bg-white" />
              </div>
            );
          }

          const p = item.product;
          const mName = item.marketName;
          const mkt = findMarketForItem(item);
          const effectiveEndDate = extractProductEndDate(p, item.catalogEndDate);
          const countdownInfo = calculateDaysLeft(effectiveEndDate);
          const formattedEndDate = countdownInfo?.formattedDate || formatEndDate(effectiveEndDate);
          const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(p.productName);
          const imgUrl = p.customImageUrl 
            ? p.customImageUrl 
            : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(p.productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;

          const normName = (p.productName || '').trim().toLowerCase();
          const curPriceNum = parsePriceNumber(p.newPrice);
          const minMarketPrice = minPriceByProductName.get(normName);
          const slideIsBestPrice = !isNaN(curPriceNum) && (minMarketPrice === undefined || curPriceNum <= minMarketPrice);

          const slideIsFavorite = checkIsFavorite
            ? checkIsFavorite(item)
            : (idx === activeIdx ? isFavorite : false);

          const isCurrentSlide = idx === activeIdx;

          return (
            <div
              key={`slide-${idx}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onClose();
                }
              }}
              className="w-full h-full shrink-0 snap-start snap-always flex items-stretch sm:items-center justify-center p-0"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  lastTouchTimeRef.current = Date.now();
                  const touch = e.touches[0];
                  tapStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                }}
                onTouchEnd={(e) => {
                  lastTouchTimeRef.current = Date.now();
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('a')) return;
                  if (!tapStartRef.current) return;
                  const touch = e.changedTouches[0];
                  const dx = Math.abs(touch.clientX - tapStartRef.current.x);
                  const dy = Math.abs(touch.clientY - tapStartRef.current.y);
                  const dt = Date.now() - tapStartRef.current.time;
                  tapStartRef.current = null;

                  if (dx < 12 && dy < 12 && dt < 260) {
                    const now = Date.now();
                    if (now - lastTapTimeRef.current < 330) {
                      lastTapTimeRef.current = 0;
                      triggerHeartBurst(item, idx);
                    } else {
                      lastTapTimeRef.current = now;
                    }
                  }
                }}
                onDoubleClick={(e) => {
                  if (Date.now() - lastTouchTimeRef.current < 600) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('a')) return;
                  triggerHeartBurst(item, idx);
                }}
                className="relative w-full sm:max-w-lg h-full bg-white flex flex-col overflow-hidden z-10 rounded-none border-0 sm:border-x sm:border-gray-100 sm:shadow-2xl"
              >
                {/* Full-Screen Top Header Bar: Large Clickable Market Logo & Name on Left, Product Count & Close on Right */}
                <div className="relative w-full px-4 py-3 sm:py-3.5 bg-white border-b border-gray-100 flex items-center justify-between gap-2.5 z-30 shrink-0">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    {canGoBack && onBack && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors shrink-0 cursor-pointer"
                        title="Geri"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    )}

                    {onSelectMarketInModal ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMarketDropdownOpen(prev => !prev);
                        }}
                        className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left rounded-xl px-1.5 py-1 -my-1 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group"
                        title="Başqa market seç"
                      >
                        {mkt?.logoUrl ? (
                          <img 
                            src={mkt.logoUrl} 
                            alt={mName} 
                            className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl bg-white p-1 border border-gray-200/90 shadow-xs shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-800 font-black text-base sm:text-lg flex items-center justify-center border border-gray-200/90 shadow-xs shrink-0">
                            {mkt?.logoPlaceholder || mName?.charAt(0) || 'M'}
                          </div>
                        )}

                        <span className="font-black text-gray-900 text-lg sm:text-2xl tracking-tight truncate">
                          {mName}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-gray-400 group-hover:text-gray-700 shrink-0 transition-transform duration-200 ${isMarketDropdownOpen && isCurrentSlide ? 'rotate-180 text-gray-800' : ''}`} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {mkt?.logoUrl ? (
                          <img 
                            src={mkt.logoUrl} 
                            alt={mName} 
                            className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl bg-white p-1 border border-gray-200/90 shadow-xs shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-800 font-black text-base sm:text-lg flex items-center justify-center border border-gray-200/90 shadow-xs shrink-0">
                            {mkt?.logoPlaceholder || mName?.charAt(0) || 'M'}
                          </div>
                        )}

                        <span className="font-black text-gray-900 text-lg sm:text-2xl tracking-tight truncate">
                          {mName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Click-outside backdrop & Simple Market Dropdown List */}
                  {isMarketDropdownOpen && isCurrentSlide && onSelectMarketInModal && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMarketDropdownOpen(false);
                        }}
                      />
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-4 top-full mt-1 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-30 max-h-80 overflow-y-auto animate-[fadeIn_0.15s_ease-out]"
                      >
                        <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          <span>Marketlər</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMarketDropdownOpen(false);
                            }}
                            className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {allMarkets
                          .map((m) => {
                            const mProds = m.catalogs && m.catalogs.length > 0
                              ? (m.catalogs[0]?.products || [])
                              : (m.products || []);
                            return { market: m, count: mProds.length };
                          })
                          .filter(entry => entry.count > 0)
                          .map(({ market: m, count }) => {
                            const isCur = mkt?.id === m.id || m.name.trim().toLowerCase() === (mName || '').trim().toLowerCase();
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsMarketDropdownOpen(false);
                                  onSelectMarketInModal(m.id);
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isCur
                                    ? 'bg-gray-100 font-bold text-gray-900'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-white border border-gray-200/80 flex items-center justify-center overflow-hidden shrink-0">
                                    {m.logoUrl ? (
                                      <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-0.5" />
                                    ) : (
                                      <span className="text-emerald-700 font-bold text-[10px]">{m.logoPlaceholder}</span>
                                    )}
                                  </div>
                                  <span className="truncate">{m.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 bg-gray-100 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {effectiveTotal > 0 && (
                      <div 
                        className="inline-flex items-center gap-0.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200/90 text-gray-700 font-extrabold text-xs sm:text-sm shadow-2xs tracking-tight select-none"
                        title={`Məhsul: ${idx + 1} / ${effectiveTotal}`}
                      >
                        <span className="text-emerald-600 font-black">{idx + 1}</span>
                        <span className="text-gray-400 font-semibold">/</span>
                        <span>{effectiveTotal}</span>
                      </div>
                    )}

                    <button 
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="Bağla"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Product Image */}
                <div className="relative w-full flex-1 min-h-[240px] max-h-[48dvh] bg-gray-50 flex items-center justify-center shrink-0 select-none overflow-hidden">
                  <img 
                    src={imgUrl} 
                    alt={cleanName} 
                    draggable={false}
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain mix-blend-multiply pointer-events-none select-none"
                  />

                  {/* Double-tap Center Heart Burst Animation */}
                  {burstSlideIdx === idx && heartBurstPhase !== 'hidden' && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                      <Heart 
                        className={`w-24 h-24 fill-red-500 text-red-500 drop-shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 ease-out ${
                          heartBurstPhase === 'pop' 
                            ? 'scale-110 opacity-100' 
                            : 'scale-150 opacity-0'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                  )}

                  {/* Top-Right Heart / Favorite Toggle Button */}
                  {(onToggleFavoriteItem || onToggleFavorite) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleFavoriteItem) {
                          onToggleFavoriteItem(item);
                        } else if (onToggleFavorite) {
                          onToggleFavorite();
                        }
                      }}
                      className={`absolute top-2.5 right-2.5 z-20 w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-all active:scale-90 cursor-pointer border ${
                        slideIsFavorite 
                          ? 'bg-red-50 border-red-200 text-red-500' 
                          : 'bg-white/95 border-gray-100 text-gray-400 hover:text-red-500'
                      }`}
                      title={slideIsFavorite ? "Seçilənlərdən çıxar" : "Seçilənlərə əlavə et"}
                    >
                      <Heart 
                        className={`w-5 h-5 transition-transform duration-200 ${slideIsFavorite ? 'fill-red-500 text-red-500 scale-110' : ''}`} 
                        strokeWidth={2.2} 
                      />
                    </button>
                  )}

                  {/* Mobile TikTok quick up/down buttons */}
                  <div className="sm:hidden absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); scrollToIndex(idx - 1); }}
                        className="w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                        title="Əvvəlki məhsul"
                      >
                        <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    )}
                    {idx < items.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); scrollToIndex(idx + 1); }}
                        className="w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                        title="Növbəti məhsul"
                      >
                        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>

                  {/* Discount Badge */}
                  {p.discountPercentage && (
                    <div className="absolute top-2.5 left-2.5 bg-emerald-600 text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-sm">
                      {p.discountPercentage}
                    </div>
                  )}

                  {/* Quantity Badge */}
                  {quantityBadge && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-md tracking-tight">
                      {quantityBadge}
                    </div>
                  )}
                </div>

                {/* Product Info Content */}
                <div className={`p-5 sm:p-6 flex-1 flex flex-col justify-between ${isCurrentSlide && showComparisons && comparisonData.length > 0 ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-gray-600 bg-gray-100 rounded-lg">
                        {p.category}
                      </span>
                      {slideIsBestPrice && (
                        <span className="inline-block px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-lg">
                          Ən Sərfəli Qiymət
                        </span>
                      )}
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-3">
                      {cleanName}
                    </h2>
                  </div>

                  <div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3.5 mt-2 mb-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-green-600 tracking-tight leading-none">
                          {p.newPrice} <span className="text-xl">₼</span>
                        </span>
                        {p.oldPrice && p.oldPrice !== '---' && (
                          <span className="text-gray-400 text-sm sm:text-base line-through font-medium leading-none">
                            {p.oldPrice} ₼
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

                    {/* TikTok Swipe & Double-Tap Hint */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-[11px] font-medium">
                      <ChevronUp className="w-3.5 h-3.5 animate-bounce" />
                      <span>Yuxarı sürüşdürün · Bəyənmək üçün 2 dəfə toxunun</span>
                      <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                    </div>

                    {/* COMPARISON LIST */}
                    {isCurrentSlide && showComparisons && comparisonData.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-[fadeIn_0.3s_ease-out]">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-green-600" />
                          Daha Ucuz Alternativlər
                        </h4>
                        <div className="space-y-2">
                          {comparisonData.map((compItem, cIdx) => (
                            <div 
                              key={cIdx} 
                              onClick={() => onCompareClick(compItem.marketId, compItem.product.productName)}
                              className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100 hover:border-green-300 hover:shadow-md cursor-pointer transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-100 bg-white overflow-hidden shadow-sm">
                                  {compItem.logoUrl ? (
                                    <img src={compItem.logoUrl} alt={compItem.marketName} className="w-full h-full object-contain p-1" />
                                  ) : (
                                    <span className={`font-bold text-${compItem.themeColor}-700 text-xs`}>{compItem.logoPlaceholder}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 font-medium">{compItem.marketName}</div>
                                  <div className="text-sm font-bold text-gray-900">{compItem.price} ₼</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="bg-white text-green-700 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                                  -{compItem.diff.toFixed(2)} ₼
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductDetailModal;
