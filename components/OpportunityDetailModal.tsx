import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  TrendingDown,
  ArrowRight,
  Heart,
  Megaphone,
  Clock
} from 'lucide-react';
import { DiscountProduct, MarketData, ProductCategory, BannerData } from '../types';
import { extractQuantityAndCleanName, extractProductEndDate, calculateDaysLeft } from './ProductCard';
import SwipeAdSlide from './SwipeAdSlide';

export interface OpportunityVariant {
  marketId: string;
  marketName: string;
  price: number;
  originalPriceStr: string;
  oldPrice?: string;
  endDate?: string;
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
  zIndexClass?: string;
  singleItemView?: boolean;
  swipeAds?: BannerData[];
  swipeAdFirstOffset?: number;
  onSwipeProgress?: () => void;
}

type OppDeckEntry =
  | { type: 'opp'; oppIndex: number; item: OpportunityItem }
  | { type: 'ad'; ad: BannerData; nearestOppIndex: number };

const OpportunityDetailModalContent: React.FC<OpportunityDetailModalProps> = ({
  onClose,
  items,
  initialIndex,
  allMarkets,
  onSelectIndex,
  onMarketClick,
  checkIsFavorite,
  onToggleFavorite,
  onEnsureFavorite,
  zIndexClass = 'z-[100]',
  singleItemView = false,
  swipeAds = [],
  swipeAdFirstOffset = 5,
  onSwipeProgress
}) => {
  const clampedPropIdx = Math.max(0, Math.min(Math.max(items.length - 1, 0), initialIndex));

  const [mountAdConfig] = useState(() => ({
    offset: Math.max(1, swipeAdFirstOffset),
    ads: singleItemView ? [] : swipeAds.filter(a => a.isVisible && ((a.htmlContent || '').trim() || (a.imageUrl || '').trim() || (a.title || '').trim())),
    entryIdx: clampedPropIdx,
  }));

  const oppDeckEntries: OppDeckEntry[] = useMemo(() => {
    const { offset, ads, entryIdx } = mountAdConfig;
    if (singleItemView || ads.length === 0 || items.length <= 1) {
      return items.map((item, oppIndex) => ({ type: 'opp', oppIndex, item }));
    }
    const entries: OppDeckEntry[] = [];
    let stepsFromEntry = 0;
    let nextAdAt = offset;
    let adCursor = 0;
    for (let oIdx = 0; oIdx < items.length; oIdx++) {
      if (oIdx >= entryIdx && stepsFromEntry === nextAdAt) {
        entries.push({
          type: 'ad',
          ad: ads[adCursor % ads.length],
          nearestOppIndex: oIdx,
        });
        adCursor++;
        stepsFromEntry++;
        nextAdAt += 10;
      }
      entries.push({ type: 'opp', oppIndex: oIdx, item: items[oIdx] });
      if (oIdx >= entryIdx) {
        stepsFromEntry++;
      }
    }
    return entries;
  }, [items, mountAdConfig, singleItemView]);

  const oppToDeckIdx = useCallback((oppIdx: number) => {
    const found = oppDeckEntries.findIndex(e => e.type === 'opp' && e.oppIndex === oppIdx);
    return found >= 0 ? found : 0;
  }, [oppDeckEntries]);

  const initialDeckIdx = useMemo(() => oppToDeckIdx(clampedPropIdx), [oppToDeckIdx, clampedPropIdx]);

  const [activeIdx, setActiveIdx] = useState<number>(initialDeckIdx);
  const [burstSlideIdx, setBurstSlideIdx] = useState<number | null>(null);
  const [heartBurstPhase, setHeartBurstPhase] = useState<'hidden' | 'pop' | 'fade'>('hidden');

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeIdxRef = useRef<number>(initialDeckIdx);
  const targetScrollIdxRef = useRef<number>(initialDeckIdx);
  const prevItemsRef = useRef<OpportunityItem[]>(items);
  const needsScrollSyncRef = useRef<boolean>(true);
  const userInteractedRef = useRef<boolean>(false);
  const isProgrammaticScrollRef = useRef<boolean>(true);
  const lastTapTimeRef = useRef<number>(0);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Lock background page scroll without collapsing window.scrollY via position: fixed
  useLayoutEffect(() => {
    const savedScrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const origHtmlOverflow = html.style.overflow;
    const origHtmlOverscroll = html.style.overscrollBehavior;
    const origBodyOverflow = body.style.overflow;
    const origBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = origHtmlOverflow;
      html.style.overscrollBehavior = origHtmlOverscroll;
      body.style.overflow = origBodyOverflow;
      body.style.overscrollBehavior = origBodyOverscroll;
      if (Math.abs(window.scrollY - savedScrollY) > 1) {
        window.scrollTo(0, savedScrollY);
      }
    };
  }, []);

  const snapToSlideInstant = useCallback((idx: number): boolean => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight <= 0) return false;
    const targetSlide = el.children[idx] as HTMLElement | undefined;
    if (idx > 0 && (!targetSlide || targetSlide.offsetTop <= 0)) {
      return false;
    }
    const targetTop = targetSlide ? targetSlide.offsetTop : idx * el.clientHeight;
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';
    el.scrollTop = targetTop;
    void el.scrollTop;
    el.style.scrollSnapType = prevSnap;
    return Math.abs(el.scrollTop - targetTop) <= 4;
  }, []);

  // Snap scroller synchronously on mount or when external index/items change; StrictMode-safe via needsScrollSyncRef
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const listChanged = prevItemsRef.current !== items;
    const currentEntry = oppDeckEntries[activeIdxRef.current];
    const currentOppIdx = currentEntry?.type === 'opp' ? currentEntry.oppIndex : currentEntry?.nearestOppIndex;
    const indexChangedExternally = clampedPropIdx !== currentOppIdx;

    if (listChanged || indexChangedExternally) {
      needsScrollSyncRef.current = true;
      prevItemsRef.current = items;
    }

    if (!needsScrollSyncRef.current) return;

    const targetDeckIdx = oppToDeckIdx(clampedPropIdx);
    userInteractedRef.current = false;
    isProgrammaticScrollRef.current = true;
    targetScrollIdxRef.current = targetDeckIdx;
    activeIdxRef.current = targetDeckIdx;
    setActiveIdx(targetDeckIdx);

    snapToSlideInstant(targetDeckIdx);

    let cancelled = false;
    let rafId: number | null = null;
    let totalFrames = 0;
    let stableFrames = 0;

    const verifyPosition = () => {
      if (cancelled) return;
      if (userInteractedRef.current) {
        needsScrollSyncRef.current = false;
        isProgrammaticScrollRef.current = false;
        return;
      }

      const ok = snapToSlideInstant(targetScrollIdxRef.current);
      totalFrames += 1;
      stableFrames = ok ? stableFrames + 1 : 0;

      if (stableFrames < 5 && totalFrames < 30) {
        rafId = requestAnimationFrame(verifyPosition);
      } else {
        needsScrollSyncRef.current = false;
        isProgrammaticScrollRef.current = false;
      }
    };

    rafId = requestAnimationFrame(verifyPosition);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver(() => {
        if (cancelled || userInteractedRef.current) return;
        snapToSlideInstant(targetScrollIdxRef.current);
      });
      ro.observe(el);
      if (el.firstElementChild) {
        ro.observe(el.firstElementChild);
      }
      const targetChild = el.children[clampedPropIdx];
      if (targetChild && targetChild !== el.firstElementChild) {
        ro.observe(targetChild);
      }
    }

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [clampedPropIdx, items, snapToSlideInstant]);

  useEffect(() => {
    return () => {
      burstTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true;
    isProgrammaticScrollRef.current = false;
  }, []);

  const scrollToIndex = useCallback((targetIdx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    markUserInteraction();
    const clamped = Math.max(0, Math.min(oppDeckEntries.length - 1, targetIdx));
    const targetSlide = el.children[clamped] as HTMLElement | undefined;
    const targetTop = targetSlide && (clamped === 0 || targetSlide.offsetTop > 0)
      ? targetSlide.offsetTop
      : clamped * el.clientHeight;
    el.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
  }, [oppDeckEntries.length, markUserInteraction]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0 || oppDeckEntries.length === 0) return;
    if (isProgrammaticScrollRef.current && !userInteractedRef.current) {
      return;
    }
    const newIdx = Math.max(0, Math.min(oppDeckEntries.length - 1, Math.round(el.scrollTop / el.clientHeight)));
    if (newIdx !== activeIdxRef.current) {
      activeIdxRef.current = newIdx;
      setActiveIdx(newIdx);
      onSwipeProgress?.();
      const entry = oppDeckEntries[newIdx];
      if (entry?.type === 'opp') {
        onSelectIndex?.(entry.oppIndex);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (activeIdxRef.current < oppDeckEntries.length - 1) {
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
  }, [oppDeckEntries.length, scrollToIndex, onClose]);

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
      imageUrl: item.imageUrl,
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
  const activeDeckEntry = oppDeckEntries[activeIdx] || oppDeckEntries[0] || null;
  const isActiveAdSlide = activeDeckEntry?.type === 'ad';
  const activeOppIdx = activeDeckEntry
    ? (activeDeckEntry.type === 'opp' ? activeDeckEntry.oppIndex : activeDeckEntry.nearestOppIndex)
    : 0;
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < oppDeckEntries.length - 1;

  return (
    <div className={`fixed inset-0 ${zIndexClass} select-none overflow-hidden`}>
      {/* Dark Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none" />

      {/* Desktop/Tablet Floating Up/Down Navigation */}
      {!singleItemView && (
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
            <span>{isActiveAdSlide ? 'Reklam' : activeOppIdx + 1}</span>
            {!isActiveAdSlide && <span className="text-[8px] text-gray-400 font-normal">/ {totalCount}</span>}
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
      )}

      {/* Native 120Hz CSS Scroll-Snap Vertical Feed Container */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onTouchStart={markUserInteraction}
        onWheel={markUserInteraction}
        onPointerDown={markUserInteraction}
        style={{ touchAction: 'pan-y' }}
        className="relative z-10 w-full h-full overflow-y-auto snap-y snap-mandatory overscroll-y-none scrollbar-hide [overflow-anchor:none]"
      >
        {oppDeckEntries.map((entry, idx) => {
          const isNearby = Math.abs(idx - activeIdx) <= 2;

          if (!isNearby) {
            return (
              <div
                key={`opp-slide-${idx}`}
                className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center p-2.5 sm:p-4"
              >
                <div className="w-full max-w-[700px] min-h-[420px] sm:min-h-[500px] rounded-3xl bg-white/95 shadow-2xl" />
              </div>
            );
          }

          if (entry.type === 'ad') {
            return (
              <div
                key={`opp-slide-ad-${idx}-${entry.ad.id}`}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    onClose();
                  }
                }}
                className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center p-2.5 sm:p-5"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-[720px] h-[520px] sm:h-[560px] max-h-[90dvh] bg-white shadow-2xl rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden z-10 border border-amber-200/80"
                >
                  <div className="w-full flex items-center justify-center pt-2 pb-0.5 bg-white shrink-0">
                    <div className="w-10 h-1 rounded-full bg-gray-300" />
                  </div>
                  <div className="w-full px-3.5 sm:px-6 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 z-20 shrink-0">
                    <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
                      <Megaphone className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-extrabold text-amber-600 truncate">Sponsorlu Reklam</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="Bağla"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <SwipeAdSlide
                      ad={entry.ad}
                      hasPrev={idx > 0}
                      hasNext={idx < oppDeckEntries.length - 1}
                      onPrev={() => scrollToIndex(idx - 1)}
                      onNext={() => scrollToIndex(idx + 1)}
                      variant="opportunity"
                    />
                  </div>
                </div>
              </div>
            );
          }

          const item = entry.item;
          const oppNumber = entry.oppIndex + 1;

          const getShortMarketName = (name: string) => {
            const trimmed = (name || '').trim();
            if (!trimmed) return 'Market';
            if (/^al(\s+market)?$/i.test(trimmed)) return 'Al Market';
            return trimmed.replace(/\s+Market$/i, '').trim() || trimmed;
          };

          const sortedVariants = [...item.variants].sort((a, b) => a.price - b.price);
          const cheapest = sortedVariants[0];
          const priciest = sortedVariants[sortedVariants.length - 1];
          const minPrice = cheapest?.price ?? 0;
          const maxPrice = priciest?.price ?? 0;
          const saving = Math.max(0, maxPrice - minPrice);
          const savingPct = maxPrice > 0 ? Math.round((saving / maxPrice) * 100) : 0;

          const cheapestVariants = sortedVariants.filter((v) => Math.abs(v.price - minPrice) < 0.001);
          const priciestVariants =
            Math.abs(maxPrice - minPrice) < 0.001
              ? []
              : sortedVariants.filter((v) => Math.abs(v.price - maxPrice) < 0.001);

          const comparisonSides: Array<{
            kind: 'cheapest' | 'priciest';
            variants: OpportunityVariant[];
            representative: OpportunityVariant;
          }> = [];
          if (cheapestVariants.length > 0) {
            comparisonSides.push({
              kind: 'cheapest',
              variants: cheapestVariants,
              representative: cheapestVariants[0],
            });
          }
          if (priciestVariants.length > 0) {
            comparisonSides.push({
              kind: 'priciest',
              variants: priciestVariants,
              representative: priciestVariants[0],
            });
          }

          const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(item.productName);
          const trimmedItemImg = item.imageUrl?.trim();
          const bingImg450 = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(item.productName + ' product')}&w=450&h=450&c=7&rs=1&p=0`;
          const imgUrl = trimmedItemImg || bingImg450;

          const resolvedCheapestProduct = cheapest ? resolveProductForMarket(item, cheapest) : null;
          const slideIsFavorite = cheapest && checkIsFavorite
            ? Boolean(
                checkIsFavorite(item.productName, cheapest.marketId) ||
                (resolvedCheapestProduct && checkIsFavorite(resolvedCheapestProduct.productName, cheapest.marketId))
              )
            : false;

          return (
            <div
              key={`opp-slide-${idx}`}
              onClick={(e) => {
                if (!singleItemView && e.target === e.currentTarget) {
                  onClose();
                }
              }}
              className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center p-2.5 sm:p-5"
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
                className="relative w-full max-w-[720px] bg-white shadow-2xl rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden max-h-[90dvh] z-10 border border-gray-200/80"
              >
                {/* Top Drag Pill */}
                <div className="w-full flex items-center justify-center pt-2 pb-0.5 bg-white shrink-0">
                  <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>

                {/* Clean Header Strip */}
                <div className="w-full px-3.5 sm:px-6 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 z-20 shrink-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-xs sm:text-sm">
                    <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-gray-700 truncate">{item.category}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!singleItemView && (
                      <>
                        {/* Mobile compact Up/Down buttons so they never overlap the right-column details */}
                        <div className="sm:hidden flex items-center gap-1 mr-0.5">
                          <button
                            type="button"
                            disabled={idx <= 0}
                            onClick={(e) => { e.stopPropagation(); scrollToIndex(idx - 1); }}
                            className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 disabled:opacity-35 flex items-center justify-center active:scale-90"
                            title="Əvvəlki fürsət"
                          >
                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            disabled={idx >= oppDeckEntries.length - 1}
                            onClick={(e) => { e.stopPropagation(); scrollToIndex(idx + 1); }}
                            className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 disabled:opacity-35 flex items-center justify-center active:scale-90"
                            title="Növbəti fürsət"
                          >
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>

                        <div
                          className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200/90 text-gray-700 font-extrabold text-[11px] sm:text-xs tracking-tight select-none tabular-nums"
                          title={`Fürsət: ${oppNumber} / ${totalCount}`}
                        >
                          <span className="text-emerald-600 font-black">{oppNumber}</span>
                          <span className="text-gray-400 font-semibold">/</span>
                          <span>{totalCount}</span>
                        </div>
                      </>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="Bağla"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Top Hero Savings Highlight Strip */}
                <div className="px-3 sm:px-6 pt-2.5 sm:pt-3.5 pb-2 sm:pb-3 shrink-0">
                  <div
                    className="px-3.5 py-2.5 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2.5 shadow-md"
                    style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-lg sm:text-2xl font-black text-white tracking-tight leading-none tabular-nums">
                        {saving.toFixed(2)} ₼ QƏNAƏT!
                      </div>
                      {cheapestVariants.length > 0 && (
                        <div className="text-[11px] sm:text-sm font-bold text-emerald-50 mt-1 leading-snug">
                          Ən sərfəli: {cheapestVariants.map((v) => getShortMarketName(v.marketName)).join(', ')}
                        </div>
                      )}
                    </div>

                    {savingPct > 0 && (
                      <div className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-white text-emerald-700 text-base sm:text-2xl font-black leading-none shadow-xs shrink-0 tabular-nums">
                        -{savingPct}%
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Card Comparison: Cheapest (left) vs Most Expensive (right), grouping same-price markets on one card */}
                <div className="flex-1 min-h-0 px-3 sm:px-6 pb-2 sm:pb-3 flex flex-col justify-center relative overflow-hidden">
                  <div className="relative flex items-center" data-opp-cards-wrap="">
                    <div
                      className={`w-full grid gap-2.5 sm:gap-4 ${
                        comparisonSides.length <= 1 ? 'grid-cols-1 max-w-[340px] mx-auto' : 'grid-cols-2'
                      }`}
                    >
                      {comparisonSides.map((side) => {
                        const isCheapest = side.kind === 'cheapest';
                        const rep = side.representative;

                        // Pick earliest active endDate from variants in this group
                        let bestCountdown: ReturnType<typeof calculateDaysLeft> = null;
                        for (const v of side.variants) {
                          const rawEnd = extractProductEndDate({ endDate: v.endDate }, v.endDate);
                          const cd = calculateDaysLeft(rawEnd);
                          if (cd && (!bestCountdown || cd.daysLeft < bestCountdown.daysLeft)) {
                            bestCountdown = cd;
                          }
                        }

                        // Find old price if available on any variant in this side
                        const rawOld = side.variants.find((v) => v.oldPrice && v.oldPrice !== '---')?.oldPrice?.trim() || '';

                        const cardClass = `h-[282px] min-[400px]:h-[304px] sm:h-[346px] rounded-2xl sm:rounded-[24px] flex flex-col overflow-hidden transition-all text-left group relative ${
                          onMarketClick ? 'cursor-pointer active:scale-[0.985]' : 'cursor-default'
                        } ${
                          isCheapest
                            ? `bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/90 border-2 border-emerald-500 shadow-md ${onMarketClick ? 'hover:border-emerald-600' : ''}`
                            : `bg-white border border-gray-200/90 shadow-xs ${onMarketClick ? 'hover:border-gray-300' : ''}`
                        }`;

                        const cardBody = (
                          <>
                            {/* Top Market Header: Always crisp market logo(s) only */}
                            <div
                              className={`px-2 sm:px-3 py-2 sm:py-2.5 min-h-[44px] sm:min-h-[50px] flex items-center shrink-0 border-b ${
                                isCheapest ? 'border-emerald-200/70 bg-emerald-50/70' : 'border-gray-100 bg-gray-50/80'
                              }`}
                            >
                              <div className="w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {side.variants.map((v) => (
                                  <div
                                    key={v.marketId}
                                    title={v.marketName}
                                    aria-label={v.marketName}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center overflow-hidden p-1 shrink-0 border shadow-2xs ${
                                      isCheapest ? 'border-emerald-500/85' : 'border-gray-200'
                                    }`}
                                  >
                                    {v.logoUrl ? (
                                      <img src={v.logoUrl} alt={v.marketName} className="w-full h-full object-contain" />
                                    ) : (
                                      <span className={`font-black text-[9.5px] sm:text-[11px] text-${v.themeColor}-700`}>
                                        {v.logoPlaceholder}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Center Product Visual + Role Label + Unboxed Market Name(s) + End Date + Quantity */}
                            <div className="flex-1 min-h-0 relative flex items-center justify-center p-2.5 sm:p-3.5 bg-white/85 overflow-hidden">
                              <img
                                src={imgUrl}
                                alt={cleanName}
                                draggable={false}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  if (e.currentTarget.dataset.fallbackApplied !== '1') {
                                    e.currentTarget.dataset.fallbackApplied = '1';
                                    e.currentTarget.src = bingImg450;
                                  }
                                }}
                                className="w-full h-full object-contain mix-blend-multiply pointer-events-none select-none group-hover:scale-105 transition-transform duration-300"
                              />

                              {/* Top-Left on Image: ƏN UCUZ vs ƏN BAHALI + free unboxed market name(s) */}
                              <div className="absolute top-1.5 left-1.5 z-20 flex flex-col items-start gap-1 pointer-events-none max-w-[calc(100%-12px)]">
                                {isCheapest ? (
                                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] sm:text-[10.5px] font-black tracking-tight shadow-sm leading-none">
                                    ƏN UCUZ
                                  </span>
                                ) : (
                                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-gray-800/85 text-white text-[9px] sm:text-[10.5px] font-black tracking-tight shadow-sm leading-none">
                                    ƏN BAHALI
                                  </span>
                                )}

                                <div className="flex flex-col items-start gap-0.5 pl-0.5">
                                  {side.variants.map((v) => (
                                    <span
                                      key={v.marketId}
                                      className={`text-[10.5px] sm:text-xs font-extrabold leading-tight [text-shadow:0_1px_2px_rgba(255,255,255,0.95),0_0_6px_rgba(255,255,255,0.9)] ${
                                        isCheapest ? 'text-emerald-950' : 'text-gray-900'
                                      }`}
                                    >
                                      {v.marketName}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Bottom-Left on Image: Expiration / End Date Countdown */}
                              {bestCountdown && (
                                <div
                                  className={`absolute bottom-1.5 left-1.5 z-20 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md font-black text-[9.5px] sm:text-[11px] leading-none shadow-sm pointer-events-none ${
                                    bestCountdown.daysLeft < 0
                                      ? 'bg-gray-200 text-gray-600'
                                      : bestCountdown.daysLeft <= 1
                                        ? 'bg-red-600 text-white'
                                        : 'bg-amber-400 text-gray-950'
                                  }`}
                                  title={`Bitmə tarixi: ${bestCountdown.formattedDate}`}
                                >
                                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" strokeWidth={2.5} />
                                  <span>
                                    {bestCountdown.daysLeft < 0
                                      ? 'Bitib'
                                      : bestCountdown.daysLeft === 0
                                        ? 'Son gün'
                                        : `${bestCountdown.daysLeft} gün`}
                                  </span>
                                </div>
                              )}

                              {quantityBadge && (
                                <div className="absolute bottom-1.5 right-1.5 z-20 bg-black text-white px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black shadow-sm tracking-tight leading-none pointer-events-none">
                                  {quantityBadge}
                                </div>
                              )}
                            </div>

                            {/* Bottom Price Bar */}
                            <div
                              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-1 shrink-0 border-t ${
                                isCheapest ? 'bg-emerald-500/10 border-emerald-200/80' : 'bg-gray-50 border-gray-100'
                              }`}
                            >
                              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
                                <span
                                  className={`font-black leading-none tabular-nums whitespace-nowrap ${
                                    isCheapest ? 'text-lg sm:text-2xl text-emerald-600' : 'text-base sm:text-xl text-gray-800'
                                  }`}
                                >
                                  {rep.originalPriceStr} <span className="text-[0.8em] font-bold">₼</span>
                                </span>
                                {rawOld && (
                                  <span className="text-red-500 line-through text-[11px] sm:text-xs font-semibold leading-none whitespace-nowrap tabular-nums">
                                    {rawOld}
                                  </span>
                                )}
                              </div>

                              {onMarketClick && (
                                <ArrowRight
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                                    isCheapest ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'
                                  }`}
                                />
                              )}
                            </div>
                          </>
                        );

                        return onMarketClick ? (
                          <button
                            key={side.kind}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarketClick(rep.marketId, item.productName);
                            }}
                            className={cardClass}
                          >
                            {cardBody}
                          </button>
                        ) : (
                          <div key={side.kind} className={cardClass}>
                            {cardBody}
                          </div>
                        );
                      })}
                    </div>

                    {/* Double-tap Center Heart Burst Animation */}
                    {burstSlideIdx === idx && heartBurstPhase !== 'hidden' && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                        <Heart
                          className={`w-20 h-20 sm:w-24 sm:h-24 fill-red-500 text-red-500 drop-shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 ease-out ${
                            heartBurstPhase === 'pop'
                              ? 'scale-110 opacity-100'
                              : 'scale-150 opacity-0'
                          }`}
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Product Title (left-aligned) + Frameless Heart Icon (right) in unified gray frame */}
                <div className="px-3 sm:px-6 pt-1 pb-2.5 sm:pb-4 shrink-0">
                  <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl bg-gray-100/90 border border-gray-200/90 flex items-center justify-between gap-3">
                    <h2
                      style={{ WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                      className="flex-1 min-w-0 text-base sm:text-xl md:text-2xl font-extrabold text-gray-900 leading-snug text-left line-clamp-2 select-text cursor-text"
                    >
                      {item.productName}
                    </h2>

                    {onToggleFavorite && cheapest && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const prod = resolvedCheapestProduct || resolveProductForMarket(item, cheapest);
                          onToggleFavorite(prod, cheapest.marketId);
                        }}
                        className={`p-1 flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 ${
                          slideIsFavorite
                            ? 'text-red-500'
                            : 'text-gray-400 [@media(hover:hover)]:hover:text-red-500'
                        }`}
                        title={slideIsFavorite ? 'Seçilənlərdən çıxar' : 'Ən ucuzunu seçilənlərə əlavə et'}
                        aria-label={slideIsFavorite ? 'Seçilənlərdən çıxar' : 'Ən ucuzunu seçilənlərə əlavə et'}
                      >
                        <Heart
                          fill={slideIsFavorite ? 'currentColor' : 'none'}
                          className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-200 ${slideIsFavorite ? 'fill-red-500 text-red-500 scale-110' : ''}`}
                          strokeWidth={2.2}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* TikTok Swipe & Double-Tap Hint */}
                {!singleItemView && (
                  <div className="pb-2.5 px-3 flex items-center justify-center gap-1.5 text-gray-400 text-[10px] sm:text-[11px] font-medium shrink-0">
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Yuxarı sürüşdürün · Bəyənmək üçün 2 dəfə toxunun</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = (props) => {
  if (!props.isOpen || props.items.length === 0) return null;
  return <OpportunityDetailModalContent {...props} />;
};

export default OpportunityDetailModal;
