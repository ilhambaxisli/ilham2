import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  TrendingDown,
  ArrowRight,
  Heart
} from 'lucide-react';
import { DiscountProduct, MarketData, ProductCategory } from '../types';
import { extractQuantityAndCleanName } from './ProductCard';

export interface OpportunityVariant {
  marketId: string;
  marketName: string;
  price: number;
  originalPriceStr: string;
  logoUrl?: string;
  logoPlaceholder: string;
  themeColor: string;
}

export interface OpportunityItem {
  productName: string;
  category: ProductCategory;
  imageUrl?: string;
  variants: OpportunityVariant[];
}

interface OpportunityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: OpportunityItem[];
  initialIndex: number;
  allMarkets: MarketData[];
  onSelectIndex?: (index: number) => void;
  onMarketClick?: (marketId: string, productName: string) => void;
  checkIsFavorite?: (productName: string, marketId: string) => boolean;
  onToggleFavorite?: (product: DiscountProduct, marketId: string) => void;
  onEnsureFavorite?: (product: DiscountProduct, marketId: string) => void;
}

const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex,
  allMarkets,
  onSelectIndex,
  onMarketClick,
  checkIsFavorite,
  onToggleFavorite,
  onEnsureFavorite
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(initialIndex);
  const [burstSlideIdx, setBurstSlideIdx] = useState<number | null>(null);
  const [heartBurstPhase, setHeartBurstPhase] = useState<'hidden' | 'pop' | 'fade'>('hidden');

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeIdxRef = useRef<number>(initialIndex);
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

  // Snap scroller synchronously when modal opens or external index changes
  useLayoutEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const el = scrollerRef.current;
    const clampedIdx = Math.max(0, Math.min(Math.max(items.length - 1, 0), initialIndex));
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened || clampedIdx !== activeIdxRef.current) {
      activeIdxRef.current = clampedIdx;
      setActiveIdx(clampedIdx);
      if (el && el.clientHeight > 0) {
        el.scrollTop = clampedIdx * el.clientHeight;
      }
    }
  }, [isOpen, initialIndex, items.length]);

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

  const resolveProductForMarket = useCallback((item: OpportunityItem, cheapestVariant: OpportunityVariant): DiscountProduct => {
    const mkt = allMarkets.find(m => m.id === cheapestVariant.marketId);
    const norm = (item.productName || '').trim().toLowerCase();
    if (mkt) {
      const prods = mkt.catalogs && mkt.catalogs.length > 0
        ? mkt.catalogs.flatMap(c => c.products || [])
        : (mkt.products || []);
      const found = prods.find(p => (p.productName || '').trim().toLowerCase() === norm);
      if (found) return found;
    }
    return {
      productName: item.productName,
      category: item.category,
      newPrice: cheapestVariant.originalPriceStr,
      oldPrice: '---',
      discountPercentage: '',
      customImageUrl: item.imageUrl
    };
  }, [allMarkets]);

  const triggerHeartBurst = useCallback((item: OpportunityItem, cheapestVariant: OpportunityVariant, idx: number) => {
    if (onEnsureFavorite) {
      const prod = resolveProductForMarket(item, cheapestVariant);
      onEnsureFavorite(prod, cheapestVariant.marketId);
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
  }, [onEnsureFavorite, resolveProductForMarket]);

  const totalCount = items.length;
  if (!isOpen || totalCount === 0) return null;

  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < totalCount - 1;

  return (
    <div className="fixed inset-0 z-[100] select-none overflow-hidden">
      {/* Dark Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none" />

      {/* Desktop/Tablet Floating Up/Down Navigation */}
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
          title="Əvvəlki fürsət (Yuxarı sürüşdür)"
        >
          <ChevronUp className="w-6 h-6 stroke-[3]" />
        </button>

        <div className="bg-black/80 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1.5 rounded-full shadow-lg border border-white/10 tracking-tight flex flex-col items-center leading-none">
          <span>{activeIdx + 1}</span>
          <span className="text-[8px] text-gray-400 font-normal">/ {totalCount}</span>
        </div>

        <button
          type="button"
          disabled={!hasNext}
          onClick={(e) => { e.stopPropagation(); scrollToIndex(activeIdx + 1); }}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${
            hasNext
              ? 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 hover:scale-110 active:scale-90 cursor-pointer border border-gray-100'
              : 'bg-white/40 text-gray-400 cursor-not-allowed opacity-40'
          }`}
          title="Növbəti fürsət (Aşağı sürüşdür)"
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
          const isNearby = Math.abs(idx - activeIdx) <= 2;

          if (!isNearby) {
            return (
              <div
                key={`opp-slide-${idx}`}
                className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center p-3 sm:p-4"
              >
                <div className="w-full max-w-sm min-h-[490px] sm:min-h-[530px] rounded-2xl bg-white/95 shadow-2xl" />
              </div>
            );
          }

          const sortedVariants = [...item.variants].sort((a, b) => a.price - b.price);
          const cheapest = sortedVariants[0];
          const priciest = sortedVariants[sortedVariants.length - 1];
          const minPrice = cheapest?.price ?? 0;
          const maxPrice = priciest?.price ?? 0;
          const saving = Math.max(0, maxPrice - minPrice);
          const savingPct = maxPrice > 0 ? Math.round((saving / maxPrice) * 100) : 0;

          const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(item.productName);
          const imgUrl = item.imageUrl
            ? item.imageUrl
            : `https://tse2.mm.bing.net/th?q=${encodeURIComponent(item.productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;

          const slideIsFavorite = cheapest && checkIsFavorite
            ? checkIsFavorite(item.productName, cheapest.marketId)
            : false;

          return (
            <div
              key={`opp-slide-${idx}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onClose();
                }
              }}
              className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center p-3 sm:p-4"
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
                  if (!tapStartRef.current || !cheapest) return;
                  const touch = e.changedTouches[0];
                  const dx = Math.abs(touch.clientX - tapStartRef.current.x);
                  const dy = Math.abs(touch.clientY - tapStartRef.current.y);
                  const dt = Date.now() - tapStartRef.current.time;
                  tapStartRef.current = null;

                  if (dx < 12 && dy < 12 && dt < 260) {
                    const now = Date.now();
                    if (now - lastTapTimeRef.current < 330) {
                      lastTapTimeRef.current = 0;
                      triggerHeartBurst(item, cheapest, idx);
                    } else {
                      lastTapTimeRef.current = now;
                    }
                  }
                }}
                onDoubleClick={(e) => {
                  if (Date.now() - lastTouchTimeRef.current < 600) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('a') || !cheapest) return;
                  triggerHeartBurst(item, cheapest, idx);
                }}
                className="relative w-full max-w-sm bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden min-h-[490px] sm:min-h-[530px] max-h-[90dvh] z-10 border border-gray-100"
              >
                {/* Top Drag Pill */}
                <div className="w-full flex items-center justify-center pt-2 pb-1 bg-white shrink-0">
                  <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>

                {/* Header Bar: Saving Summary Pill + Counter + Close */}
                <div className="w-full px-3.5 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 z-20 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs shadow-2xs shrink-0">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{saving.toFixed(2)} ₼ fərq</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 truncate">
                      {sortedVariants.length} market
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-gray-50 border border-gray-200/90 text-gray-700 font-extrabold text-[11px] sm:text-xs shadow-2xs tracking-tight select-none"
                      title={`Fürsət: ${idx + 1} / ${totalCount}`}
                    >
                      <span className="text-emerald-600 font-black">{idx + 1}</span>
                      <span className="text-gray-400 font-semibold">/</span>
                      <span>{totalCount}</span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="Bağla"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Product Image Area */}
                <div className="relative w-full h-48 sm:h-52 bg-gray-50 flex items-center justify-center shrink-0 select-none overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={cleanName}
                    draggable={false}
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain mix-blend-multiply pointer-events-none select-none"
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
                  {cheapest && onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const prod = resolveProductForMarket(item, cheapest);
                        onToggleFavorite(prod, cheapest.marketId);
                      }}
                      className={`absolute top-2.5 right-2.5 z-20 w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-all active:scale-90 cursor-pointer border ${
                        slideIsFavorite
                          ? 'bg-red-50 border-red-200 text-red-500'
                          : 'bg-white/95 border-gray-100 text-gray-400 hover:text-red-500'
                      }`}
                      title={slideIsFavorite ? "Seçilənlərdən çıxar" : "Ən ucuzunu seçilənlərə əlavə et"}
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
                        title="Əvvəlki fürsət"
                      >
                        <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    )}
                    {idx < totalCount - 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); scrollToIndex(idx + 1); }}
                        className="w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                        title="Növbəti fürsət"
                      >
                        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>

                  {/* Top-Left Saving Percentage Badge */}
                  {savingPct > 0 && (
                    <div className="absolute top-2.5 left-2.5 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-sm">
                      -{savingPct}% Qənaət
                    </div>
                  )}

                  {/* Bottom-Right Quantity Badge */}
                  {quantityBadge && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-black shadow-md tracking-tight">
                      {quantityBadge}
                    </div>
                  )}
                </div>

                {/* Product Name + Price Difference Breakdown */}
                <div className={`p-4 sm:p-5 flex-1 flex flex-col justify-between ${sortedVariants.length > 3 ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold text-gray-600 bg-gray-100 rounded-lg">
                        {item.category}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                        {saving.toFixed(2)} ₼ Qənaət
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug mb-3 line-clamp-2">
                      {cleanName}
                    </h2>

                    {/* Cheapest vs Highest Price Strip */}
                    {cheapest && priciest && (
                      <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2 mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl sm:text-2xl font-black text-emerald-600 leading-none">
                            {cheapest.originalPriceStr} <span className="text-base">₼</span>
                          </span>
                          {maxPrice > minPrice && (
                            <span className="text-xs sm:text-sm text-gray-400 line-through font-semibold leading-none">
                              {priciest.originalPriceStr} ₼
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-emerald-700 block leading-tight">
                            Qiymət fərqi
                          </span>
                          <span className="text-sm font-black text-emerald-700 leading-none">
                            {saving.toFixed(2)} ₼
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Market-by-Market Price Difference List */}
                    <div className="space-y-1.5">
                      {sortedVariants.map((variant, vIdx) => {
                        const isCheapest = variant.price === minPrice;
                        const diffFromCheapest = variant.price - minPrice;
                        return (
                          <button
                            key={`${variant.marketId}-${vIdx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarketClick?.(variant.marketId, item.productName);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left group ${
                              isCheapest
                                ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400 shadow-2xs'
                                : 'bg-gray-50/90 border-gray-200/70 hover:bg-gray-100/80 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-white border border-gray-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                {variant.logoUrl ? (
                                  <img src={variant.logoUrl} alt={variant.marketName} className="w-full h-full object-contain p-0.5" />
                                ) : (
                                  <span className={`font-bold text-${variant.themeColor}-700 text-xs`}>{variant.logoPlaceholder}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className={`text-xs sm:text-sm font-bold truncate ${isCheapest ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {variant.marketName}
                                </div>
                                <div className={`text-[10px] sm:text-[11px] font-bold ${isCheapest ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {isCheapest ? 'Ən sərfəli qiymət' : `+${diffFromCheapest.toFixed(2)} ₼ baha`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className={`text-sm sm:text-base font-black whitespace-nowrap ${isCheapest ? 'text-emerald-700' : 'text-gray-800'}`}>
                                {variant.originalPriceStr} ₼
                              </span>
                              <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${isCheapest ? 'text-emerald-500' : 'text-gray-400'}`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TikTok Swipe & Double-Tap Hint */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-[11px] font-medium shrink-0">
                    <ChevronUp className="w-3.5 h-3.5 animate-bounce" />
                    <span>Yuxarı sürüşdürün · Bəyənmək üçün 2 dəfə toxunun</span>
                    <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
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

export default OpportunityDetailModal;
