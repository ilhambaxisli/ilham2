import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { 
  X, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  ChevronRight,
  TrendingDown, 
  Clock, 
  ArrowRight,
  Heart,
  ShoppingBag,
  Megaphone
} from 'lucide-react';
import { DiscountProduct, MarketData, BannerData } from '../types';
import { parseDateString, extractProductEndDate, calculateDaysLeft, extractQuantityAndCleanName, getExplicitProductImageUrl } from './ProductCard';
import OpportunityDetailModal, { OpportunityItem } from './OpportunityDetailModal';
import SwipeAdSlide from './SwipeAdSlide';

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
  swipeAds?: BannerData[];
  swipeAdFirstOffset?: number;
  onSwipeProgress?: () => void;
}

interface ProductDetailModalContentProps extends ProductDetailModalProps {
  items: ModalProductItem[];
}

type ProductDeckEntry =
  | { type: 'product'; productIndex: number; item: ModalProductItem }
  | { type: 'ad'; ad: BannerData; nearestProductIndex: number };

interface ProductImageSlideProps {
  src: string;
  fallbackSrc?: string;
  secondaryFallbackSrc?: string;
  alt: string;
  isExpired: boolean;
  compactHeight?: boolean;
  children?: React.ReactNode;
}

const ProductImageSlide: React.FC<ProductImageSlideProps> = ({
  src,
  fallbackSrc,
  secondaryFallbackSrc,
  alt,
  isExpired,
  compactHeight = false,
  children,
}) => {
  const [fallbackStep, setFallbackStep] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    setFallbackStep(0);
  }, [src, fallbackSrc, secondaryFallbackSrc]);

  const effectiveSrc = fallbackStep === 0
    ? src
    : fallbackStep === 1
      ? (fallbackSrc || secondaryFallbackSrc || src)
      : fallbackStep === 2
        ? (secondaryFallbackSrc || fallbackSrc || src)
        : '';

  return (
    <div className={`relative w-full ${compactHeight ? 'h-40 sm:h-48' : 'h-52 sm:h-60'} bg-gray-50 flex items-center justify-center shrink-0 select-none overflow-hidden transition-[height] duration-150`}>
      {fallbackStep < 3 && effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={alt}
          draggable={false}
          decoding="async"
          onError={() => {
            if (fallbackStep === 0 && fallbackSrc && fallbackSrc !== src) {
              setFallbackStep(1);
            } else if (fallbackStep < 2 && secondaryFallbackSrc && secondaryFallbackSrc !== effectiveSrc) {
              setFallbackStep(2);
            } else {
              setFallbackStep(3);
            }
          }}
          className={`w-full h-full p-2 object-contain mix-blend-multiply pointer-events-none select-none ${isExpired ? 'grayscale-[55%] opacity-85' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <ShoppingBag className="w-14 h-14 stroke-[1.5]" />
        </div>
      )}
      {isExpired && (
        <>
          <div className="absolute inset-0 bg-gray-200/25 pointer-events-none z-[5]" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[15]">
            <span className="-rotate-12 select-none uppercase font-black tracking-[0.18em] text-2xl sm:text-3xl px-5 py-1.5 text-red-600/90 bg-white/85 backdrop-blur-[1px] border-[3px] border-red-600/85 rounded-xl shadow-lg leading-none">
              BİTDİ
            </span>
          </div>
        </>
      )}

      {children}
    </div>
  );
};

interface LeftProductRailProps {
  items: ModalProductItem[];
  activeIdx: number;
  onSelect: (targetIdx: number) => void;
}

const RAIL_INITIAL_BEFORE = 4;
const RAIL_INITIAL_AFTER = 10;
const RAIL_EXPAND_STEP = 12;

const LeftProductRail: React.FC<LeftProductRailProps> = ({
  items,
  activeIdx,
  onSelect,
}) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef<boolean>(false);
  const pendingPrependHeightRef = useRef<number | null>(null);

  const [range, setRange] = useState<{ start: number; end: number }>(() => ({
    start: Math.max(0, activeIdx - RAIL_INITIAL_BEFORE),
    end: Math.min(items.length, activeIdx + RAIL_INITIAL_AFTER + 1),
  }));

  // Reset window only when the product list itself changes
  const prevItemsRef = useRef(items);
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items;
      didMountRef.current = false;
      setRange({
        start: Math.max(0, activeIdx - RAIL_INITIAL_BEFORE),
        end: Math.min(items.length, activeIdx + RAIL_INITIAL_AFTER + 1),
      });
    }
  }, [items, activeIdx]);

  // Expand window on demand so activeIdx always has buffer above & below for anchored scrolling
  useEffect(() => {
    setRange((prev) => {
      let nextStart = prev.start;
      let nextEnd = prev.end;
      if (activeIdx - 2 < prev.start) {
        nextStart = Math.max(0, activeIdx - RAIL_INITIAL_BEFORE);
      }
      if (activeIdx + 4 > prev.end) {
        nextEnd = Math.min(items.length, activeIdx + RAIL_INITIAL_AFTER + 1);
      }
      if (nextStart === prev.start && nextEnd === prev.end) return prev;
      return { start: nextStart, end: nextEnd };
    });
  }, [activeIdx, items.length]);

  // Preserve scrollTop cleanly when prepending earlier rail items above
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || pendingPrependHeightRef.current === null) return;
    const prevHeight = pendingPrependHeightRef.current;
    pendingPrependHeightRef.current = null;
    const delta = rail.scrollHeight - prevHeight;
    if (delta > 0) {
      rail.scrollTop += delta;
    }
  }, [range.start]);

  // Anchor the active green selection frame in place (slot #2) whenever activeIdx changes
  const lastAutoScrolledIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (didMountRef.current && lastAutoScrolledIdxRef.current === activeIdx) return;

    const topTargetIdx = Math.max(range.start, activeIdx - 1);
    const targetBtn = rail.querySelector(`[data-rail-idx="${topTargetIdx}"]`) as HTMLElement | null;
    if (!targetBtn) return;

    const targetTop = Math.max(0, targetBtn.offsetTop - 6);
    if (!didMountRef.current) {
      didMountRef.current = true;
      lastAutoScrolledIdxRef.current = activeIdx;
      rail.scrollTop = targetTop;
      return;
    }

    lastAutoScrolledIdxRef.current = activeIdx;
    rail.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [activeIdx, range.start, range.end]);

  const handleRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;

    if (range.end < items.length && rail.scrollTop + rail.clientHeight >= rail.scrollHeight - 160) {
      setRange((prev) => ({
        ...prev,
        end: Math.min(items.length, prev.end + RAIL_EXPAND_STEP),
      }));
      return;
    }

    if (range.start > 0 && rail.scrollTop <= 120 && pendingPrependHeightRef.current === null) {
      pendingPrependHeightRef.current = rail.scrollHeight;
      setRange((prev) => ({
        ...prev,
        start: Math.max(0, prev.start - RAIL_EXPAND_STEP),
      }));
    }
  };

  const visibleRailItems = items.slice(range.start, range.end);

  return (
    <div
      ref={railRef}
      data-upcoming-strip="true"
      onScroll={handleRailScroll}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="relative w-[70px] sm:w-[78px] h-full shrink-0 border-r border-gray-100 bg-gray-50/75 overflow-y-auto overscroll-y-contain scrollbar-hide py-1.5 px-1 flex flex-col gap-1.5 touch-pan-y"
    >
      {visibleRailItems.map((railItem, offsetIdx) => {
        const targetIdx = range.start + offsetIdx;
        const railProd = railItem.product;
        const { cleanName: railCleanName } = extractQuantityAndCleanName(railProd.productName);
        const railCountdown = calculateDaysLeft(extractProductEndDate(railProd, railItem.catalogEndDate));
        const railExpired = Boolean(railCountdown && railCountdown.daysLeft < 0);
        const railExplicitImg = getExplicitProductImageUrl(railProd);
        const railBingImg = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(railProd.productName + ' product')}&w=150&h=150&c=7&rs=1&p=0`;
        const railImgUrl = railExplicitImg || railBingImg;
        const isSelected = targetIdx === activeIdx;

        return (
          <button
            key={`rail-${targetIdx}`}
            data-rail-idx={targetIdx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(targetIdx);
            }}
            className={`group w-full h-[calc((100%-30px)/4.5)] shrink-0 flex flex-col items-center justify-center p-1 rounded-xl transition-all cursor-pointer active:scale-95 text-center ${
              isSelected
                ? 'bg-emerald-50 border-2 border-emerald-500 ring-2 ring-emerald-200/70 shadow-xs'
                : 'bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-400 shadow-2xs'
            }`}
            title={railCleanName}
          >
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={railImgUrl}
                alt={railCleanName}
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(e) => {
                  if (e.currentTarget.dataset.fallbackApplied !== '1') {
                    e.currentTarget.dataset.fallbackApplied = '1';
                    e.currentTarget.src = railBingImg;
                  }
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 object-contain mix-blend-multiply pointer-events-none select-none ${railExpired ? 'grayscale-[55%] opacity-85' : ''}`}
              />
              {railExpired && (
                <div className="absolute inset-0 bg-gray-200/20 pointer-events-none" />
              )}
            </div>
            <span
              className={`w-full text-[8.5px] sm:text-[9px] font-semibold truncate leading-tight mt-0.5 ${
                isSelected ? 'text-emerald-900 font-bold' : 'text-gray-800 group-hover:text-emerald-800'
              }`}
            >
              {railCleanName}
            </span>
            <span
              className={`text-[9.5px] sm:text-[10px] font-black leading-none mt-0.5 ${
                railExpired ? 'text-gray-500' : isSelected ? 'text-emerald-700' : 'text-green-600'
              }`}
            >
              {railProd.newPrice} ₼
            </span>
          </button>
        );
      })}
    </div>
  );
};

interface CachedPriceEntry {
  marketId: string;
  marketName: string;
  logoUrl?: string;
  logoPlaceholder: string;
  themeColor: string;
  price: number;
  product: DiscountProduct;
  catalogEndDate?: string;
}

const parsePriceNumberFast = (val: any): number => {
  if (val === null || val === undefined) return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;
  const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
  return parseFloat(str);
};

const marketPriceIndexCache = new WeakMap<MarketData[], Map<string, CachedPriceEntry[]>>();

const getOrBuildMarketPriceIndex = (allMarkets: MarketData[]): Map<string, CachedPriceEntry[]> => {
  const cached = marketPriceIndexCache.get(allMarkets);
  if (cached) return cached;

  const map = new Map<string, CachedPriceEntry[]>();
  allMarkets.forEach(market => {
    const catalogs = market.catalogs && market.catalogs.length > 0
      ? market.catalogs
      : [{ endDate: undefined, products: market.products || [] }];
    catalogs.forEach(cat => {
      (cat.products || []).forEach(prod => {
        const key = (prod.productName || '').trim().toLowerCase();
        if (!key) return;
        const price = parsePriceNumberFast(prod.newPrice);
        if (isNaN(price)) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          marketId: market.id,
          marketName: market.name,
          logoUrl: market.logoUrl,
          logoPlaceholder: market.logoPlaceholder,
          themeColor: market.themeColor,
          price,
          product: prod,
          catalogEndDate: cat.endDate
        });
      });
    });
  });

  marketPriceIndexCache.set(allMarkets, map);
  return map;
};

const ProductDetailModalContent: React.FC<ProductDetailModalContentProps> = ({
  items,
  onClose,
  allMarkets,
  onCompareClick,
  canGoBack,
  onBack,
  showComparisons = false,
  currentIndex = 0,
  totalCount,
  onSelectIndex,
  isFavorite = false,
  onToggleFavorite,
  onEnsureFavorite,
  checkIsFavorite,
  onToggleFavoriteItem,
  onEnsureFavoriteItem,
  onSelectMarketInModal,
  swipeAds = [],
  swipeAdFirstOffset = 5,
  onSwipeProgress
}) => {
  const effectiveTotal = totalCount ?? items.length;
  const clampedPropIdx = Math.max(0, Math.min(Math.max(items.length - 1, 0), currentIndex));

  const [mountAdConfig] = useState(() => ({
    offset: Math.max(1, swipeAdFirstOffset),
    ads: swipeAds.filter(a => a.isVisible && ((a.htmlContent || '').trim() || (a.imageUrl || '').trim() || (a.title || '').trim())),
    entryProductIdx: clampedPropIdx,
  }));

  const deckEntries: ProductDeckEntry[] = useMemo(() => {
    const { offset, ads, entryProductIdx } = mountAdConfig;
    if (ads.length === 0 || items.length <= 1) {
      return items.map((item, productIndex) => ({ type: 'product', productIndex, item }));
    }
    const entries: ProductDeckEntry[] = [];
    let stepsFromEntry = 0;
    let nextAdAt = offset;
    let adCursor = 0;
    for (let pIdx = 0; pIdx < items.length; pIdx++) {
      if (pIdx >= entryProductIdx) {
        if (stepsFromEntry === nextAdAt) {
          entries.push({
            type: 'ad',
            ad: ads[adCursor % ads.length],
            nearestProductIndex: pIdx,
          });
          adCursor++;
          stepsFromEntry++;
          nextAdAt += 10;
        }
      }
      entries.push({ type: 'product', productIndex: pIdx, item: items[pIdx] });
      if (pIdx >= entryProductIdx) {
        stepsFromEntry++;
      }
    }
    return entries;
  }, [items, mountAdConfig]);

  const productToDeckIdx = useCallback((prodIdx: number) => {
    const found = deckEntries.findIndex(e => e.type === 'product' && e.productIndex === prodIdx);
    return found >= 0 ? found : 0;
  }, [deckEntries]);

  const initialDeckIdx = useMemo(() => productToDeckIdx(clampedPropIdx), [productToDeckIdx, clampedPropIdx]);

  const [activeIdx, setActiveIdx] = useState<number>(initialDeckIdx);
  const [burstSlideIdx, setBurstSlideIdx] = useState<number | null>(null);
  const [heartBurstPhase, setHeartBurstPhase] = useState<'hidden' | 'pop' | 'fade'>('hidden');
  const [quickOpportunityItem, setQuickOpportunityItem] = useState<OpportunityItem | null>(null);

  const modalWrapperRef = useRef<HTMLDivElement | null>(null);
  const modalShellRef = useRef<HTMLDivElement | null>(null);
  const modalZoomRef = useRef<{
    active: boolean;
    mode: 'idle' | 'pinch' | 'hold';
    scale: number;
    tx: number;
    ty: number;
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    startMidX: number;
    startMidY: number;
    holdStartX: number;
    holdStartY: number;
    wheelResetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    active: false,
    mode: 'idle',
    scale: 1,
    tx: 0,
    ty: 0,
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startMidX: 0,
    startMidY: 0,
    holdStartX: 0,
    holdStartY: 0,
    wheelResetTimer: null,
  });

  const deckRef = useRef<HTMLDivElement | null>(null);
  const activeIdxRef = useRef<number>(initialDeckIdx);
  const targetScrollIdxRef = useRef<number>(initialDeckIdx);
  const prevItemsRef = useRef<ModalProductItem[]>(items);
  const needsScrollSyncRef = useRef<boolean>(true);
  const userInteractedRef = useRef<boolean>(false);
  const isProgrammaticScrollRef = useRef<boolean>(true);
  const lastReportedIdxRef = useRef<number | null>(null);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Lock background page scroll without collapsing window.scrollY
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
    const el = deckRef.current;
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

  // Snap scroller synchronously on mount or when external index/items change (never echo back our own onSelectIndex)
  useLayoutEffect(() => {
    const el = deckRef.current;
    const listChanged = prevItemsRef.current !== items;
    const currentEntry = deckEntries[activeIdxRef.current];
    const currentProductIdx = currentEntry?.type === 'product' ? currentEntry.productIndex : currentEntry?.nearestProductIndex;
    const indexChangedExternally =
      clampedPropIdx !== lastReportedIdxRef.current &&
      clampedPropIdx !== currentProductIdx;

    if (listChanged || indexChangedExternally) {
      needsScrollSyncRef.current = true;
      prevItemsRef.current = items;
    }

    if (!needsScrollSyncRef.current) return;

    const targetDeckIdx = productToDeckIdx(clampedPropIdx);
    userInteractedRef.current = false;
    isProgrammaticScrollRef.current = true;
    targetScrollIdxRef.current = targetDeckIdx;
    activeIdxRef.current = targetDeckIdx;
    lastReportedIdxRef.current = clampedPropIdx;
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
      if (modalZoomRef.current.wheelResetTimer !== null) {
        clearTimeout(modalZoomRef.current.wheelResetTimer);
      }
    };
  }, []);

  // Whole-modal 2-finger pinch-to-zoom anywhere on the detail window; auto-resets cleanly when fingers are released
  useEffect(() => {
    const shell = modalShellRef.current;
    if (!shell) return;

    const applyModalZoom = (scale: number, tx: number, ty: number, animate: boolean) => {
      const z = modalZoomRef.current;
      z.scale = scale;
      z.tx = tx;
      z.ty = ty;
      shell.style.transition = animate ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
      shell.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    };

    const getCenterPoint = (clientX: number, clientY: number) => {
      const wrapper = modalWrapperRef.current || shell;
      const rect = wrapper.getBoundingClientRect();
      return {
        x: clientX - (rect.left + rect.width / 2),
        y: clientY - (rect.top + rect.height / 2),
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        tapStartRef.current = null;
        if (deckRef.current) {
          deckRef.current.style.overflowY = 'hidden';
        }
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const mid = getCenterPoint((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);
        const z = modalZoomRef.current;
        z.active = true;
        z.mode = 'pinch';
        z.startDist = dist;
        z.startScale = z.scale;
        z.startTx = z.tx;
        z.startTy = z.ty;
        z.startMidX = mid.x;
        z.startMidY = mid.y;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const z = modalZoomRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const mid = getCenterPoint((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);

        if (z.mode !== 'pinch') {
          z.active = true;
          z.mode = 'pinch';
          z.startDist = dist;
          z.startScale = z.scale;
          z.startTx = z.tx;
          z.startTy = z.ty;
          z.startMidX = mid.x;
          z.startMidY = mid.y;
        }

        const nextScale = Math.max(0.9, Math.min(3.6, z.startScale * (dist / z.startDist)));
        const ratio = nextScale / z.startScale;
        const tx = mid.x - ratio * (z.startMidX - z.startTx);
        const ty = mid.y - ratio * (z.startMidY - z.startTy);
        applyModalZoom(nextScale, tx, ty, false);
        return;
      }

      if (e.touches.length === 1 && z.active && z.mode === 'hold') {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        applyModalZoom(z.scale, z.startTx + (t0.clientX - z.holdStartX), z.startTy + (t0.clientY - z.holdStartY), false);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const z = modalZoomRef.current;
      if (!z.active) return;

      e.stopPropagation();
      if (e.touches.length === 1) {
        const t0 = e.touches[0];
        z.mode = 'hold';
        z.holdStartX = t0.clientX;
        z.holdStartY = t0.clientY;
        z.startTx = z.tx;
        z.startTy = z.ty;
        return;
      }

      if (e.touches.length === 0) {
        z.active = false;
        z.mode = 'idle';
        if (deckRef.current) {
          deckRef.current.style.overflowY = '';
        }
        applyModalZoom(1, 0, 0, true);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const z = modalZoomRef.current;
      const pt = getCenterPoint(e.clientX, e.clientY);
      const curScale = z.scale;
      const nextScale = Math.max(1, Math.min(3.6, curScale * Math.exp(-e.deltaY * 0.01)));
      const ratio = nextScale / curScale;
      const tx = pt.x - ratio * (pt.x - z.tx);
      const ty = pt.y - ratio * (pt.y - z.ty);
      z.active = nextScale > 1.02;
      applyModalZoom(nextScale, tx, ty, false);

      if (z.wheelResetTimer !== null) clearTimeout(z.wheelResetTimer);
      z.wheelResetTimer = setTimeout(() => {
        z.active = false;
        z.mode = 'idle';
        applyModalZoom(1, 0, 0, true);
      }, 240);
    };

    shell.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    shell.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    shell.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
    shell.addEventListener('touchcancel', onTouchEnd, { passive: false, capture: true });
    shell.addEventListener('wheel', onWheel, { passive: false, capture: true });

    return () => {
      if (deckRef.current) {
        deckRef.current.style.overflowY = '';
      }
      shell.removeEventListener('touchstart', onTouchStart, { capture: true });
      shell.removeEventListener('touchmove', onTouchMove, { capture: true });
      shell.removeEventListener('touchend', onTouchEnd, { capture: true });
      shell.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      shell.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []);

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true;
    isProgrammaticScrollRef.current = false;
  }, []);

  const scrollToIndex = useCallback((targetIdx: number) => {
    const el = deckRef.current;
    if (!el) return;
    markUserInteraction();
    const clamped = Math.max(0, Math.min(deckEntries.length - 1, targetIdx));
    if (Math.abs(clamped - activeIdxRef.current) > 4) {
      activeIdxRef.current = clamped;
      setActiveIdx(clamped);
      const entry = deckEntries[clamped];
      if (entry?.type === 'product') {
        lastReportedIdxRef.current = entry.productIndex;
        onSelectIndex?.(entry.productIndex);
      }
      onSwipeProgress?.();
      snapToSlideInstant(clamped);
      return;
    }
    const targetSlide = el.children[clamped] as HTMLElement | undefined;
    const targetTop = targetSlide && (clamped === 0 || targetSlide.offsetTop > 0)
      ? targetSlide.offsetTop
      : clamped * el.clientHeight;
    el.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
  }, [deckEntries, markUserInteraction, onSelectIndex, onSwipeProgress, snapToSlideInstant]);

  const scrollToProductIndex = useCallback((prodIdx: number) => {
    scrollToIndex(productToDeckIdx(prodIdx));
  }, [productToDeckIdx, scrollToIndex]);

  const handleDeckScroll = () => {
    const el = deckRef.current;
    if (!el || el.clientHeight === 0 || deckEntries.length === 0) return;
    if (isProgrammaticScrollRef.current && !userInteractedRef.current) {
      return;
    }
    const newIdx = Math.max(0, Math.min(deckEntries.length - 1, Math.round(el.scrollTop / el.clientHeight)));
    if (newIdx !== activeIdxRef.current) {
      activeIdxRef.current = newIdx;
      setActiveIdx(newIdx);
      onSwipeProgress?.();
      const entry = deckEntries[newIdx];
      if (entry?.type === 'product') {
        lastReportedIdxRef.current = entry.productIndex;
        onSelectIndex?.(entry.productIndex);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (quickOpportunityItem) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (activeIdxRef.current < deckEntries.length - 1) {
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
  }, [deckEntries.length, scrollToIndex, onClose, quickOpportunityItem]);

  const activeDeckEntry = deckEntries[activeIdx] || deckEntries[0] || null;
  const isActiveAdSlide = activeDeckEntry?.type === 'ad';
  const activeProductIdx = activeDeckEntry
    ? (activeDeckEntry.type === 'product' ? activeDeckEntry.productIndex : activeDeckEntry.nearestProductIndex)
    : 0;
  const activeItem = items[activeProductIdx] || items[0] || null;

  // Module-cached WeakMap lookup (zero date parsing upfront)
  const allProductsPriceIndex = useMemo(() => {
    return getOrBuildMarketPriceIndex(allMarkets);
  }, [allMarkets]);

  const getCheaperAlternativesForSlide = useCallback((prod: DiscountProduct, curMarketId?: string, curMarketName?: string) => {
    const key = (prod.productName || '').trim().toLowerCase();
    const currentPrice = parsePriceNumberFast(prod.newPrice);
    if (!key || isNaN(currentPrice)) return [];
    const candidates = allProductsPriceIndex.get(key);
    if (!candidates || candidates.length === 0) return [];
    const curLower = (curMarketName || '').trim().toLowerCase();
    const seenMarkets = new Set<string>();
    const results: Array<{
      marketId: string;
      marketName: string;
      logoUrl?: string;
      logoPlaceholder: string;
      themeColor: string;
      price: number;
      diff: number;
      product: DiscountProduct;
    }> = [];

    candidates.forEach(cand => {
      if (curMarketId && cand.marketId === curMarketId) return;
      if (curLower && cand.marketName.trim().toLowerCase() === curLower) return;
      if (cand.price >= currentPrice) return;
      if (seenMarkets.has(cand.marketId)) return;
      const cd = calculateDaysLeft(extractProductEndDate(cand.product, cand.catalogEndDate));
      if (cd && cd.daysLeft < 0) return;
      seenMarkets.add(cand.marketId);
      results.push({
        marketId: cand.marketId,
        marketName: cand.marketName,
        logoUrl: cand.logoUrl,
        logoPlaceholder: cand.logoPlaceholder,
        themeColor: cand.themeColor,
        price: cand.price,
        product: cand.product,
        diff: currentPrice - cand.price
      });
    });

    return results.sort((a, b) => b.diff - a.diff);
  }, [allProductsPriceIndex]);

  const openPriceComparisonPopup = useCallback((prod: DiscountProduct, explicitFallbackImg?: string, fallbackMarketId?: string) => {
    const key = (prod.productName || '').trim().toLowerCase();
    if (!key) return;
    const candidates = allProductsPriceIndex.get(key) || [];
    const byMarket = new Map<string, {
      marketId: string;
      marketName: string;
      price: number;
      originalPriceStr: string;
      logoUrl?: string;
      logoPlaceholder: string;
      themeColor: string;
    }>();

    let bestImg = explicitFallbackImg;
    candidates.forEach(cand => {
      const cd = calculateDaysLeft(extractProductEndDate(cand.product, cand.catalogEndDate));
      if (cd && cd.daysLeft < 0) return;
      const candImg = getExplicitProductImageUrl(cand.product);
      if (!bestImg && candImg) bestImg = candImg;
      const existing = byMarket.get(cand.marketId);
      const variant = {
        marketId: cand.marketId,
        marketName: cand.marketName,
        price: cand.price,
        originalPriceStr: String(cand.product.newPrice ?? ''),
        logoUrl: cand.logoUrl,
        logoPlaceholder: cand.logoPlaceholder,
        themeColor: cand.themeColor
      };
      if (!existing || cand.price < existing.price) {
        byMarket.set(cand.marketId, variant);
      }
    });

    const variants = Array.from(byMarket.values());
    if (variants.length < 2) {
      if (fallbackMarketId) {
        onCompareClick(fallbackMarketId, prod.productName);
      }
      return;
    }

    setQuickOpportunityItem({
      productName: prod.productName,
      category: prod.category,
      imageUrl: bestImg,
      variants
    });
  }, [allProductsPriceIndex, onCompareClick]);

  // Keep comparisonData for scroll overflow if needed when in Fürsətlər mode with >2 alternatives
  const comparisonData = useMemo(() => {
    if (!showComparisons || !activeItem) return [];
    return getCheaperAlternativesForSlide(activeItem.product, activeItem.marketId, activeItem.marketName);
  }, [activeItem, showComparisons, getCheaperAlternativesForSlide]);

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

  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < deckEntries.length - 1;

  return (
    <div className="fixed inset-0 z-[100] select-none overflow-hidden">
      {/* Dark Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
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
            <span>{isActiveAdSlide ? 'Reklam' : activeProductIdx + 1}</span>
            {!isActiveAdSlide && <span className="text-[8px] text-gray-400 font-normal">/ {effectiveTotal}</span>}
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

      {/* Fixed Center Modal Shell: Header & Left Rail stay stationary while ONLY Right Product Column scrolls */}
      <div
        ref={modalWrapperRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        className="relative z-10 w-full h-full flex items-center justify-center p-3 sm:p-4"
      >
        {(() => {
          const activeMName = activeItem?.marketName || '';
          const activeMkt = activeItem ? findMarketForItem(activeItem) : null;

          return (
            <div
              ref={modalShellRef}
              onClick={(e) => e.stopPropagation()}
              style={{ transformOrigin: 'center center', willChange: 'transform', touchAction: 'pan-x pan-y' }}
              className="relative w-full max-w-sm sm:max-w-[430px] md:max-w-[460px] bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden h-[520px] sm:h-[580px] md:h-[610px] max-h-[90dvh] z-10 border border-gray-100"
            >
              {/* Subtle Top Drag Pill */}
              <div className="w-full flex items-center justify-center pt-2 pb-0.5 bg-white shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Fixed Window Top Header Bar */}
              <div className="relative w-full px-3.5 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 z-30 shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  {canGoBack && onBack && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onBack(); }}
                      className="p-1 -ml-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors shrink-0 cursor-pointer"
                      title="Geri"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}

                  {(() => {
                    if (isActiveAdSlide) {
                      return (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center shadow-2xs shrink-0">
                            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <span className="font-black text-amber-600 text-base sm:text-lg tracking-tight truncate">
                            Sponsorlu Reklam
                          </span>
                        </div>
                      );
                    }
                    const targetMarketId = activeMkt?.id || activeItem?.marketId;
                    if (onSelectMarketInModal && targetMarketId) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMarketInModal(targetMarketId);
                          }}
                          className="flex items-center gap-2 min-w-0 text-left rounded-xl px-1.5 py-1 -my-1 hover:bg-emerald-50/70 active:bg-emerald-100/70 transition-colors cursor-pointer group"
                          title={`${activeMName} məhsul siyahısına keç`}
                        >
                          {activeMkt?.logoUrl ? (
                            <img 
                              src={activeMkt.logoUrl} 
                              alt={activeMName} 
                              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl bg-white p-0.5 border border-gray-200/90 shadow-2xs shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center border border-gray-200/90 shadow-2xs shrink-0">
                              {activeMkt?.logoPlaceholder || activeMName?.charAt(0) || 'M'}
                            </div>
                          )}

                          <span className="font-black text-gray-900 group-hover:text-emerald-700 text-base sm:text-lg tracking-tight truncate transition-colors">
                            {activeMName}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 shrink-0 transition-all" />
                        </button>
                      );
                    }
                    return (
                      <div className="flex items-center gap-2 min-w-0">
                        {activeMkt?.logoUrl ? (
                          <img 
                            src={activeMkt.logoUrl} 
                            alt={activeMName} 
                            className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl bg-white p-0.5 border border-gray-200/90 shadow-2xs shrink-0" 
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center border border-gray-200/90 shadow-2xs shrink-0">
                            {activeMkt?.logoPlaceholder || activeMName?.charAt(0) || 'M'}
                          </div>
                        )}

                        <span className="font-black text-gray-900 text-base sm:text-lg tracking-tight truncate">
                          {activeMName}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isActiveAdSlide ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 font-extrabold text-[11px] sm:text-xs shadow-2xs tracking-tight select-none">
                      Reklam
                    </span>
                  ) : effectiveTotal > 0 ? (
                    <div 
                      className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200/90 text-gray-700 font-extrabold text-[11px] sm:text-xs shadow-2xs tracking-tight select-none"
                      title={`Məhsul: ${activeProductIdx + 1} / ${effectiveTotal}`}
                    >
                      <span className="text-emerald-600 font-black">{activeProductIdx + 1}</span>
                      <span className="text-gray-400 font-semibold">/</span>
                      <span>{effectiveTotal}</span>
                    </div>
                  ) : null}

                  <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                    title="Bağla"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stationary Body Split: Fixed Left Product Rail + Scrollable Right Product Pane */}
              <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
                {items.length > 1 && (
                  <LeftProductRail
                    items={items}
                    activeIdx={activeProductIdx}
                    onSelect={scrollToProductIndex}
                  />
                )}

                {/* Native 120Hz CSS Scroll-Snap Vertical Feed Viewport */}
                <div
                  ref={deckRef}
                  onScroll={handleDeckScroll}
                  onWheel={markUserInteraction}
                  onPointerDown={markUserInteraction}
                  onTouchStart={(e) => {
                    markUserInteraction();
                    lastTouchTimeRef.current = Date.now();
                    if (e.touches.length !== 1) {
                      tapStartRef.current = null;
                      return;
                    }
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('[data-upcoming-strip]')) return;
                    const touch = e.touches[0];
                    tapStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                  }}
                  onTouchEnd={(e) => {
                    lastTouchTimeRef.current = Date.now();
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a') || target.closest('[data-upcoming-strip]')) return;
                    if (!tapStartRef.current || isActiveAdSlide) return;
                    const touch = e.changedTouches[0];
                    const tdx = Math.abs(touch.clientX - tapStartRef.current.x);
                    const tdy = Math.abs(touch.clientY - tapStartRef.current.y);
                    const tdt = Date.now() - tapStartRef.current.time;
                    tapStartRef.current = null;

                    if (tdx < 12 && tdy < 12 && tdt < 260) {
                      const now = Date.now();
                      if (now - lastTapTimeRef.current < 330) {
                        lastTapTimeRef.current = 0;
                        if (activeItem) {
                          triggerHeartBurst(activeItem, activeIdx);
                        }
                      } else {
                        lastTapTimeRef.current = now;
                      }
                    }
                  }}
                  onDoubleClick={(e) => {
                    if (Date.now() - lastTouchTimeRef.current < 600 || isActiveAdSlide) return;
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a') || target.closest('[data-upcoming-strip]')) return;
                    if (activeItem) {
                      triggerHeartBurst(activeItem, activeIdx);
                    }
                  }}
                  className="relative flex-1 min-w-0 h-full overflow-y-auto snap-y snap-mandatory overscroll-y-none scrollbar-hide touch-pan-y [overflow-anchor:none] bg-white select-none"
                >
                  {deckEntries.map((entry, idx) => {
                    const isNearby = Math.abs(idx - activeIdx) <= 2;

                    if (!isNearby) {
                      return (
                        <div
                          key={`slide-${idx}`}
                          className="w-full h-full shrink-0 snap-start snap-always bg-white"
                        />
                      );
                    }

                    if (entry.type === 'ad') {
                      return (
                        <div
                          key={`slide-ad-${idx}-${entry.ad.id}`}
                          className="relative w-full h-full shrink-0 snap-start snap-always overflow-hidden bg-white"
                        >
                          <SwipeAdSlide
                            ad={entry.ad}
                            hasPrev={idx > 0}
                            hasNext={idx < deckEntries.length - 1}
                            onPrev={() => scrollToIndex(idx - 1)}
                            onNext={() => scrollToIndex(idx + 1)}
                            variant="product"
                          />
                        </div>
                      );
                    }

                    const item = entry.item;

                    const p = item.product;
                    const mName = item.marketName;
                    const mkt = findMarketForItem(item);
                    const effectiveEndDate = extractProductEndDate(p, item.catalogEndDate);
                    const countdownInfo = calculateDaysLeft(effectiveEndDate);
                    const isExpired = Boolean(countdownInfo && countdownInfo.daysLeft < 0);
                    const formattedEndDate = countdownInfo?.formattedDate || formatEndDate(effectiveEndDate);
                    const { cleanName, quantity: quantityBadge } = extractQuantityAndCleanName(p.productName);
                    const explicitImgUrl = getExplicitProductImageUrl(p);
                    const bingImgUrl300 = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(p.productName + ' product')}&w=300&h=300&c=7&rs=1&p=0`;
                    const bingImgUrl200 = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(p.productName + ' product')}&w=200&h=200&c=7&rs=1&p=0`;
                    const imgUrl = explicitImgUrl || bingImgUrl300;

                    const slideIsFavorite = checkIsFavorite
                      ? checkIsFavorite(item)
                      : (idx === activeIdx ? isFavorite : false);

                    const isCurrentSlide = idx === activeIdx;
                    const slideComparisons = getCheaperAlternativesForSlide(p, mkt?.id || item.marketId, mName);

                    return (
                      <div
                        key={`slide-${idx}`}
                        className="relative w-full h-full shrink-0 snap-start snap-always flex flex-col justify-between overflow-hidden bg-white"
                      >
                        {/* Product Image */}
                        <ProductImageSlide
                          src={imgUrl}
                          fallbackSrc={bingImgUrl300}
                          secondaryFallbackSrc={bingImgUrl200}
                          alt={cleanName}
                          isExpired={isExpired}
                          compactHeight={slideComparisons.length > 0}
                        >
                          <>
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

                            {/* Mobile TikTok quick up/down buttons */}
                            <div className="sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); scrollToIndex(idx - 1); }}
                                  className="w-7 h-7 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                                  title="Əvvəlki məhsul"
                                >
                                  <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                                </button>
                              )}
                              {idx < deckEntries.length - 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); scrollToIndex(idx + 1); }}
                                  className="w-7 h-7 rounded-full bg-white/90 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
                                  title="Növbəti məhsul"
                                >
                                  <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                                </button>
                              )}
                            </div>

                            {/* Discount Badge */}
                            {p.discountPercentage && (
                              <div className={`absolute top-2 left-2 ${isExpired ? 'bg-gray-400' : 'bg-emerald-600'} text-white px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold shadow-sm z-10`}>
                                {p.discountPercentage}
                              </div>
                            )}

                            {/* Quantity Badge */}
                            {quantityBadge && (
                              <div className="absolute bottom-2 right-2 bg-black text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-sm sm:text-base font-black shadow-lg tracking-tight leading-none">
                                {quantityBadge}
                              </div>
                            )}
                          </>
                        </ProductImageSlide>

                        {/* Product Info Content */}
                        <div
                          data-modal-scrollable="true"
                          className={`px-3 pt-2 pb-2 sm:px-4 sm:pt-2.5 sm:pb-2.5 flex-1 min-h-0 flex flex-col justify-between ${isCurrentSlide && ((showComparisons && comparisonData.length > 0) || slideComparisons.length > 0) ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 shrink-0">
                              <span className="inline-block px-1.5 sm:px-2 py-0.5 text-[9.5px] sm:text-[10.5px] font-bold text-gray-600 bg-gray-100 rounded-lg truncate">
                                {p.category}
                              </span>

                              {countdownInfo || formattedEndDate ? (
                                <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[10.5px] font-bold border shadow-2xs shrink-0 ${countdownInfo?.badgeStyle || 'text-amber-800 bg-amber-50 border-amber-200/80'}`}>
                                  <Clock className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${countdownInfo?.iconColor || 'text-amber-600'}`} />
                                  <span>Bitmə: {countdownInfo ? countdownInfo.label : formattedEndDate}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[10.5px] font-semibold border border-gray-200 shrink-0">
                                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400 shrink-0" />
                                  <span>Müddətsiz</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 sm:mt-2.5">

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h2
                                  style={{ WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                                  className="text-[14px] sm:text-[15px] font-bold text-gray-900 leading-snug break-words select-text cursor-text"
                                >
                                  {p.productName}
                                </h2>
                              </div>

                              <div className="flex flex-col items-end shrink-0 text-right">
                                <span className={`text-2xl sm:text-[26px] font-black ${isExpired ? 'text-gray-500' : 'text-green-600'} tracking-tight leading-none whitespace-nowrap`}>
                                  {p.newPrice} <span className="text-base sm:text-lg">₼</span>
                                </span>
                                {p.oldPrice && p.oldPrice !== '---' && (
                                  <span className="text-red-500 text-xs sm:text-sm line-through font-semibold leading-none mt-1 whitespace-nowrap">
                                    {p.oldPrice} ₼
                                  </span>
                                )}
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
                                    className="mt-1.5 p-0.5 flex items-center justify-center transition-transform duration-200 active:scale-90 cursor-pointer bg-transparent border-0"
                                    title={slideIsFavorite ? "Seçilənlərdən çıxar" : "Seçilənlərə əlavə et"}
                                  >
                                    <Heart
                                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-200 ${
                                        slideIsFavorite
                                          ? 'fill-red-500 text-red-500 scale-110'
                                          : 'text-gray-400 hover:text-red-500'
                                      }`}
                                      strokeWidth={2}
                                    />
                                  </button>
                                )}
                              </div>
                            </div>

                            {slideComparisons.length > 0 && (() => {
                              const topComparisons = slideComparisons.slice(0, 2);
                              const maxSaving = slideComparisons[0]?.diff ?? 0;
                              const isSingle = topComparisons.length === 1;
                              return (
                                <div className="mt-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1 text-[10.5px] sm:text-[11px] font-extrabold text-emerald-700 uppercase tracking-wide min-w-0">
                                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">Burada daha ucuz var</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10.5px] sm:text-[11px] font-black tracking-tight shadow-2xs shrink-0 whitespace-nowrap">
                                      {maxSaving.toFixed(2)} ₼ qənaət
                                    </span>
                                  </div>

                                  {isSingle ? (() => {
                                    const compItem = topComparisons[0];
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openPriceComparisonPopup(p, explicitImgUrl, compItem.marketId);
                                        }}
                                        className="w-full p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border-2 border-emerald-400/80 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between gap-2.5 text-left group"
                                        title="Qiymət fərqini göstər"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-emerald-200/90 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                                            {compItem.logoUrl ? (
                                              <img src={compItem.logoUrl} alt={compItem.marketName} className="w-full h-full object-contain p-1" />
                                            ) : (
                                              <span className="text-xs font-black text-emerald-700">{compItem.logoPlaceholder}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="text-xs sm:text-sm font-black text-gray-900 truncate leading-tight">
                                              {compItem.marketName}
                                            </div>
                                            <div className="text-[11px] sm:text-xs font-extrabold text-emerald-700 mt-0.5 leading-tight">
                                              -{compItem.diff.toFixed(2)} ₼ daha ucuz
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-lg sm:text-xl font-black text-emerald-700 tracking-tight leading-none whitespace-nowrap">
                                            {compItem.product.newPrice} <span className="text-xs sm:text-sm">₼</span>
                                          </span>
                                          <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                        </div>
                                      </button>
                                    );
                                  })() : (
                                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                      {topComparisons.map((compItem, cIdx) => (
                                        <button
                                          key={cIdx}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openPriceComparisonPopup(p, explicitImgUrl, compItem.marketId);
                                          }}
                                          className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/95 hover:bg-emerald-100 border border-emerald-300/90 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-2 text-left group min-w-0"
                                          title="Qiymət fərqini göstər"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 w-full">
                                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white border border-emerald-200/80 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                                              {compItem.logoUrl ? (
                                                <img src={compItem.logoUrl} alt={compItem.marketName} className="w-full h-full object-contain p-0.5" />
                                              ) : (
                                                <span className="text-[10px] font-black text-emerald-700">{compItem.logoPlaceholder}</span>
                                              )}
                                            </div>
                                            <span className="text-xs sm:text-[13px] font-black text-gray-900 truncate flex-1">
                                              {compItem.marketName}
                                            </span>
                                            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                          </div>

                                          <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="text-sm sm:text-base font-black text-emerald-700 leading-none whitespace-nowrap">
                                              {compItem.product.newPrice} ₼
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] sm:text-[11px] font-black leading-none whitespace-nowrap shrink-0">
                                              -{compItem.diff.toFixed(2)} ₼
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {/* TikTok Swipe & Double-Tap Hint */}
                            <div className="pt-1.5 border-t border-gray-100 flex items-center justify-center gap-1 text-gray-400 text-[9.5px] sm:text-[10px] font-medium">
                              <ChevronUp className="w-3 h-3 animate-bounce shrink-0" />
                              <span className="truncate">Yuxarı sürüşdürün · Bəyənmək üçün 2 dəfə toxunun</span>
                              <ChevronDown className="w-3 h-3 animate-bounce shrink-0" />
                            </div>

                            {/* Remaining COMPARISON LIST if more than 2 alternatives in Fürsətlər mode */}
                            {isCurrentSlide && showComparisons && comparisonData.length > 2 && (
                              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 animate-[fadeIn_0.3s_ease-out]">
                                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                                  Digər Ucuz Alternativlər
                                </h4>
                                <div className="space-y-1.5">
                                  {comparisonData.slice(2).map((compItem, cIdx) => (
                                    <div 
                                      key={cIdx} 
                                      onClick={() => onCompareClick(compItem.marketId, compItem.product.productName)}
                                      className="flex items-center justify-between p-2.5 bg-green-50 rounded-xl border border-green-100 hover:border-green-300 hover:shadow-md cursor-pointer transition-all group"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center border border-gray-100 bg-white overflow-hidden shadow-sm shrink-0">
                                          {compItem.logoUrl ? (
                                            <img src={compItem.logoUrl} alt={compItem.marketName} className="w-full h-full object-contain p-0.5" />
                                          ) : (
                                            <span className={`font-bold text-${compItem.themeColor}-700 text-[10px]`}>{compItem.logoPlaceholder}</span>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[11px] text-gray-500 font-medium truncate">{compItem.marketName}</div>
                                          <div className="text-xs font-bold text-gray-900">{compItem.price} ₼</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="bg-white text-green-700 px-1.5 py-0.5 rounded-lg text-[11px] font-bold shadow-sm">
                                          -{compItem.diff.toFixed(2)} ₼
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
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
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Price Difference Modal from Fürsətlər (closes with X and keeps user at exact spot) */}
      <OpportunityDetailModal
        isOpen={quickOpportunityItem !== null}
        onClose={() => setQuickOpportunityItem(null)}
        items={quickOpportunityItem ? [quickOpportunityItem] : []}
        initialIndex={0}
        allMarkets={allMarkets}
        zIndexClass="z-[130]"
        singleItemView={true}
        checkIsFavorite={checkIsFavorite ? (productName, marketId) => {
          const m = allMarkets.find(mk => mk.id === marketId);
          return checkIsFavorite({
            product: {
              productName,
              category: quickOpportunityItem?.category || activeItem?.product.category || 'Digər',
              newPrice: '0',
              oldPrice: '---',
              discountPercentage: ''
            },
            marketName: m?.name || '',
            marketId
          });
        } : undefined}
        onToggleFavorite={onToggleFavoriteItem ? (prod, marketId) => {
          const m = allMarkets.find(mk => mk.id === marketId);
          onToggleFavoriteItem({ product: prod, marketName: m?.name || '', marketId });
        } : undefined}
        onEnsureFavorite={onEnsureFavoriteItem ? (prod, marketId) => {
          const m = allMarkets.find(mk => mk.id === marketId);
          onEnsureFavoriteItem({ product: prod, marketName: m?.name || '', marketId });
        } : undefined}
      />
    </div>
  );
};

const ProductDetailModal: React.FC<ProductDetailModalProps> = (props) => {
  const items: ModalProductItem[] = useMemo(() => {
    if (props.productList && props.productList.length > 0) return props.productList;
    if (props.product) {
      return [{ product: props.product, marketName: props.marketName, catalogEndDate: props.catalogEndDate }];
    }
    return [];
  }, [props.productList, props.product, props.marketName, props.catalogEndDate]);

  if (!props.isOpen || items.length === 0) return null;

  return <ProductDetailModalContent {...props} items={items} />;
};

export default ProductDetailModal;
