import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { 
  X, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  TrendingDown, 
  Clock, 
  ArrowRight,
  Heart,
  RotateCcw,
  ShoppingBag
} from 'lucide-react';
import { DiscountProduct, MarketData } from '../types';
import { parseDateString, extractProductEndDate, calculateDaysLeft, extractQuantityAndCleanName, getExplicitProductImageUrl } from './ProductCard';
import OpportunityDetailModal, { OpportunityItem } from './OpportunityDetailModal';

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

interface ProductDetailModalContentProps extends ProductDetailModalProps {
  items: ModalProductItem[];
}

interface ZoomableProductImageProps {
  src: string;
  fallbackSrc?: string;
  secondaryFallbackSrc?: string;
  alt: string;
  isExpired: boolean;
  isActiveSlide: boolean;
  children?: (isZoomed: boolean) => React.ReactNode;
}

const ZoomableProductImage: React.FC<ZoomableProductImageProps> = ({
  src,
  fallbackSrc,
  secondaryFallbackSrc,
  alt,
  isExpired,
  isActiveSlide,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
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

  const [transform, setTransform] = useState<{
    scale: number;
    tx: number;
    ty: number;
    animating: boolean;
  }>({ scale: 1, tx: 0, ty: 0, animating: false });

  const stateRef = useRef<{ scale: number; tx: number; ty: number }>({
    scale: 1,
    tx: 0,
    ty: 0,
  });

  const gestureRef = useRef<{
    mode: 'idle' | 'pinch' | 'pan' | 'mouse-pan';
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    startMidX: number;
    startMidY: number;
    panStartX: number;
    panStartY: number;
    didPinch: boolean;
    lastTapTime: number;
    tapStart: { x: number; y: number; time: number } | null;
  }>({
    mode: 'idle',
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startMidX: 0,
    startMidY: 0,
    panStartX: 0,
    panStartY: 0,
    didPinch: false,
    lastTapTime: 0,
    tapStart: null,
  });

  const clampPan = useCallback((tx: number, ty: number, scale: number) => {
    if (scale <= 1.02) return { tx: 0, ty: 0 };
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return { tx, ty };
    const cw = container.clientWidth || 320;
    const ch = container.clientHeight || 160;
    const iw = img.offsetWidth || 136;
    const ih = img.offsetHeight || 136;

    const maxTx = Math.abs(iw * scale - cw) / 2;
    const maxTy = Math.abs(ih * scale - ch) / 2;

    return {
      tx: Math.max(-maxTx, Math.min(maxTx, tx)),
      ty: Math.max(-maxTy, Math.min(maxTy, ty)),
    };
  }, []);

  const applyTransform = useCallback((scale: number, tx: number, ty: number, animating = false) => {
    stateRef.current = { scale, tx, ty };
    setTransform({ scale, tx, ty, animating });
  }, []);

  const resetZoom = useCallback(() => {
    applyTransform(1, 0, 0, true);
  }, [applyTransform]);

  // Reset zoom when switching slides or product image changes
  useEffect(() => {
    if (!isActiveSlide) {
      stateRef.current = { scale: 1, tx: 0, ty: 0 };
      setTransform({ scale: 1, tx: 0, ty: 0, animating: false });
    }
  }, [isActiveSlide, src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getTouchPoint = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return {
        x: clientX - rect.left - rect.width / 2,
        y: clientY - rect.top - rect.height / 2,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button')) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const mid = getTouchPoint((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);
        const g = gestureRef.current;
        g.mode = 'pinch';
        g.startDist = dist;
        g.startScale = stateRef.current.scale;
        g.startTx = stateRef.current.tx;
        g.startTy = stateRef.current.ty;
        g.startMidX = mid.x;
        g.startMidY = mid.y;
        g.didPinch = true;
        g.tapStart = null;
        return;
      }

      if (e.touches.length === 1 && stateRef.current.scale > 1.02) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const g = gestureRef.current;
        g.mode = 'pan';
        g.panStartX = t0.clientX;
        g.panStartY = t0.clientY;
        g.startTx = stateRef.current.tx;
        g.startTy = stateRef.current.ty;
        g.startScale = stateRef.current.scale;
        g.didPinch = false;
        g.tapStart = { x: t0.clientX, y: t0.clientY, time: Date.now() };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;

      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const mid = getTouchPoint((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);

        if (g.mode !== 'pinch') {
          g.mode = 'pinch';
          g.startDist = dist;
          g.startScale = stateRef.current.scale;
          g.startTx = stateRef.current.tx;
          g.startTy = stateRef.current.ty;
          g.startMidX = mid.x;
          g.startMidY = mid.y;
          g.didPinch = true;
        }

        const nextScale = Math.max(0.9, Math.min(4.2, g.startScale * (dist / g.startDist)));
        const ratio = nextScale / g.startScale;
        const rawTx = mid.x - ratio * (g.startMidX - g.startTx);
        const rawTy = mid.y - ratio * (g.startMidY - g.startTy);
        const { tx, ty } = clampPan(rawTx, rawTy, nextScale);
        applyTransform(nextScale, tx, ty, false);
        return;
      }

      if (e.touches.length === 1 && g.mode === 'pan' && stateRef.current.scale > 1.02) {
        e.preventDefault();
        e.stopPropagation();
        const t0 = e.touches[0];
        const dx = t0.clientX - g.panStartX;
        const dy = t0.clientY - g.panStartY;
        const { tx, ty } = clampPan(g.startTx + dx, g.startTy + dy, stateRef.current.scale);
        applyTransform(stateRef.current.scale, tx, ty, false);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (g.mode === 'idle' && !g.didPinch) return;

      if (g.didPinch || stateRef.current.scale > 1.02) {
        e.stopPropagation();
      }

      // Transition smoothly from 2-finger pinch to 1-finger pan if 1 finger remains on screen
      if (e.touches.length === 1 && stateRef.current.scale > 1.05) {
        const t0 = e.touches[0];
        g.mode = 'pan';
        g.panStartX = t0.clientX;
        g.panStartY = t0.clientY;
        g.startTx = stateRef.current.tx;
        g.startTy = stateRef.current.ty;
        g.tapStart = null;
        return;
      }

      if (e.touches.length === 0) {
        // Double-tap while zoomed resets back to 1x
        if (g.mode === 'pan' && g.tapStart && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          const dx = Math.abs(touch.clientX - g.tapStart.x);
          const dy = Math.abs(touch.clientY - g.tapStart.y);
          const dt = Date.now() - g.tapStart.time;
          if (dx < 12 && dy < 12 && dt < 260) {
            const now = Date.now();
            if (now - g.lastTapTime < 330) {
              g.lastTapTime = 0;
              g.mode = 'idle';
              g.didPinch = false;
              g.tapStart = null;
              applyTransform(1, 0, 0, true);
              return;
            }
            g.lastTapTime = now;
          }
        }

        g.mode = 'idle';
        g.didPinch = false;
        g.tapStart = null;

        if (stateRef.current.scale < 1.05) {
          applyTransform(1, 0, 0, true);
        } else if (stateRef.current.scale > 4) {
          const { tx, ty } = clampPan(stateRef.current.tx, stateRef.current.ty, 4);
          applyTransform(4, tx, ty, true);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      // Support laptop trackpad 2-finger pinch (browsers dispatch wheel + ctrlKey)
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const pt = getTouchPoint(e.clientX, e.clientY);
      const curScale = stateRef.current.scale;
      const nextScale = Math.max(1, Math.min(4, curScale * Math.exp(-e.deltaY * 0.01)));
      if (nextScale <= 1.02) {
        applyTransform(1, 0, 0, true);
        return;
      }
      const ratio = nextScale / curScale;
      const rawTx = pt.x - ratio * (pt.x - stateRef.current.tx);
      const rawTy = pt.y - ratio * (pt.y - stateRef.current.ty);
      const { tx, ty } = clampPan(rawTx, rawTy, nextScale);
      applyTransform(nextScale, tx, ty, false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [applyTransform, clampPan]);

  // Desktop mouse drag when zoomed via trackpad pinch
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const g = gestureRef.current;
      if (g.mode !== 'mouse-pan') return;
      const dx = e.clientX - g.panStartX;
      const dy = e.clientY - g.panStartY;
      const { tx, ty } = clampPan(g.startTx + dx, g.startTy + dy, stateRef.current.scale);
      applyTransform(stateRef.current.scale, tx, ty, false);
    };
    const onMouseUp = () => {
      if (gestureRef.current.mode === 'mouse-pan') {
        gestureRef.current.mode = 'idle';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [applyTransform, clampPan]);

  const isZoomed = transform.scale > 1.02;

  return (
    <div
      ref={containerRef}
      data-zoom-image="true"
      onMouseDown={(e) => {
        if (!isZoomed) return;
        const target = e.target as HTMLElement | null;
        if (target && target.closest('button')) return;
        e.preventDefault();
        e.stopPropagation();
        const g = gestureRef.current;
        g.mode = 'mouse-pan';
        g.panStartX = e.clientX;
        g.panStartY = e.clientY;
        g.startTx = stateRef.current.tx;
        g.startTy = stateRef.current.ty;
      }}
      onDoubleClick={(e) => {
        if (isZoomed) {
          e.stopPropagation();
          resetZoom();
        }
      }}
      style={{ touchAction: isZoomed ? 'none' : 'pan-y' }}
      className={`relative w-full h-56 sm:h-64 bg-gray-50 flex items-center justify-center shrink-0 select-none overflow-hidden ${
        isZoomed ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {fallbackStep < 3 && effectiveSrc ? (
        <img
          ref={imgRef}
          src={effectiveSrc}
          alt={alt}
          draggable={false}
          onError={() => {
            if (fallbackStep === 0 && fallbackSrc && fallbackSrc !== src) {
              setFallbackStep(1);
            } else if (fallbackStep < 2 && secondaryFallbackSrc && secondaryFallbackSrc !== effectiveSrc) {
              setFallbackStep(2);
            } else {
              setFallbackStep(3);
            }
          }}
          style={{
            transform: `translate3d(${transform.tx}px, ${transform.ty}px, 0) scale(${transform.scale})`,
            transition: transform.animating ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            transformOrigin: 'center center',
            willChange: 'transform',
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
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[15] transition-opacity duration-150 ${isZoomed ? 'opacity-0' : ''}`}>
            <span className="-rotate-12 select-none uppercase font-black tracking-[0.18em] text-2xl sm:text-3xl px-5 py-1.5 text-red-600/90 bg-white/85 backdrop-blur-[1px] border-[3px] border-red-600/85 rounded-xl shadow-lg leading-none">
              BİTDİ
            </span>
          </div>
        </>
      )}

      {isZoomed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 hover:bg-black/85 text-white text-[11px] font-bold shadow-md backdrop-blur-xs transition-all active:scale-95 cursor-pointer"
          title="Ölçünü sıfırla"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{transform.scale.toFixed(1)}x</span>
        </button>
      )}

      {children?.(isZoomed)}
    </div>
  );
};

interface LeftProductRailProps {
  items: ModalProductItem[];
  activeIdx: number;
  onSelect: (targetIdx: number) => void;
}

const LeftProductRail: React.FC<LeftProductRailProps> = ({
  items,
  activeIdx,
  onSelect,
}) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef<boolean>(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const topIdx = Math.max(0, activeIdx - 1);
    const targetBtn = rail.children[topIdx] as HTMLElement | undefined;
    if (!targetBtn) return;

    // 6px top padding (py-1.5) above children
    const targetTop = Math.max(0, targetBtn.offsetTop - 6);

    if (!didMountRef.current) {
      didMountRef.current = true;
      rail.scrollTop = targetTop;
      return;
    }

    rail.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [activeIdx, items.length]);

  return (
    <div
      ref={railRef}
      data-upcoming-strip="true"
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="w-[70px] sm:w-[78px] h-full shrink-0 border-r border-gray-100 bg-gray-50/75 overflow-y-auto overscroll-y-contain scrollbar-hide py-1.5 px-1 flex flex-col gap-1.5 touch-pan-y"
    >
      {items.map((railItem, targetIdx) => {
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
  onSelectMarketInModal
}) => {
  const effectiveTotal = totalCount ?? items.length;
  const clampedPropIdx = Math.max(0, Math.min(Math.max(items.length - 1, 0), currentIndex));

  const [activeIdx, setActiveIdx] = useState<number>(clampedPropIdx);
  const [jumpTargetIdx, setJumpTargetIdx] = useState<number | null>(null);
  const [burstSlideIdx, setBurstSlideIdx] = useState<number | null>(null);
  const [heartBurstPhase, setHeartBurstPhase] = useState<'hidden' | 'pop' | 'fade'>('hidden');
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState<boolean>(false);
  const [quickOpportunityItem, setQuickOpportunityItem] = useState<OpportunityItem | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeIdxRef = useRef<number>(clampedPropIdx);
  const targetScrollIdxRef = useRef<number>(clampedPropIdx);
  const prevItemsRef = useRef<ModalProductItem[]>(items);
  const needsScrollSyncRef = useRef<boolean>(true);
  const userInteractedRef = useRef<boolean>(false);
  const isProgrammaticScrollRef = useRef<boolean>(true);
  const lastTapTimeRef = useRef<number>(0);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const smoothScrollRafRef = useRef<number | null>(null);
  const pendingDirectJumpRef = useRef<number | null>(null);

  // Lock background page scroll without collapsing window.scrollY via position: fixed (prevents scroll reset on close/history.go)
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

  // Snap scroller synchronously on mount or when product list / external index changes; StrictMode-safe via needsScrollSyncRef
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const listChanged = prevItemsRef.current !== items;
    const indexChangedExternally = clampedPropIdx !== activeIdxRef.current;

    if (listChanged || indexChangedExternally) {
      needsScrollSyncRef.current = true;
      prevItemsRef.current = items;
    }

    if (!needsScrollSyncRef.current) return;

    userInteractedRef.current = false;
    isProgrammaticScrollRef.current = true;
    targetScrollIdxRef.current = clampedPropIdx;
    activeIdxRef.current = clampedPropIdx;
    setActiveIdx(clampedPropIdx);
    setIsMarketDropdownOpen(false);

    snapToSlideInstant(clampedPropIdx);

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

      // Require multiple consecutive confirmed frames so Tailwind CDN async style injection cannot knock scrollTop back to 0
      if ((stableFrames < 5 && totalFrames < 30)) {
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
      if (smoothScrollRafRef.current !== null) {
        cancelAnimationFrame(smoothScrollRafRef.current);
      }
    };
  }, []);

  const cancelSmoothScroll = useCallback(() => {
    if (smoothScrollRafRef.current !== null) {
      cancelAnimationFrame(smoothScrollRafRef.current);
      smoothScrollRafRef.current = null;
      setJumpTargetIdx(null);
      const el = scrollerRef.current;
      if (el) {
        el.style.scrollSnapType = '';
      }
    }
  }, []);

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true;
    isProgrammaticScrollRef.current = false;
    pendingDirectJumpRef.current = null;
    cancelSmoothScroll();
  }, [cancelSmoothScroll]);

  const jumpDirectToIndex = useCallback((targetIdx: number) => {
    cancelSmoothScroll();
    const clamped = Math.max(0, Math.min(items.length - 1, targetIdx));
    userInteractedRef.current = true;
    isProgrammaticScrollRef.current = true;
    pendingDirectJumpRef.current = clamped;
    setJumpTargetIdx(null);
    setIsMarketDropdownOpen(false);
    activeIdxRef.current = clamped;
    setActiveIdx(clamped);
    snapToSlideInstant(clamped);
  }, [items.length, cancelSmoothScroll, snapToSlideInstant]);

  useLayoutEffect(() => {
    const target = pendingDirectJumpRef.current;
    if (target === null) return;

    snapToSlideInstant(target);
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      snapToSlideInstant(target);
      pendingDirectJumpRef.current = null;
      isProgrammaticScrollRef.current = false;
      onSelectIndex?.(target);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [activeIdx, snapToSlideInstant, onSelectIndex]);

  const scrollToIndex = useCallback((targetIdx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    markUserInteraction();
    const clamped = Math.max(0, Math.min(items.length - 1, targetIdx));
    const targetSlide = el.children[clamped] as HTMLElement | undefined;
    const targetTop = targetSlide && (clamped === 0 || targetSlide.offsetTop > 0)
      ? targetSlide.offsetTop
      : clamped * el.clientHeight;

    const startTop = el.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 2) {
      el.scrollTop = targetTop;
      return;
    }

    // Pre-render target slide immediately so even long jumps (10+ products ahead) glide with zero blank flash
    setJumpTargetIdx(clamped);
    el.style.scrollSnapType = 'none';
    const duration = Math.min(340, Math.max(150, 140 + Math.abs(clamped - activeIdxRef.current) * 20));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = startTop + distance * eased;

      if (el.clientHeight > 0) {
        const currentStepIdx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / el.clientHeight)));
        if (currentStepIdx !== activeIdxRef.current) {
          activeIdxRef.current = currentStepIdx;
          setActiveIdx(currentStepIdx);
        }
      }

      if (progress < 1) {
        smoothScrollRafRef.current = requestAnimationFrame(step);
      } else {
        smoothScrollRafRef.current = null;
        el.scrollTop = targetTop;
        el.style.scrollSnapType = '';
        setJumpTargetIdx(null);
        if (activeIdxRef.current !== clamped) {
          activeIdxRef.current = clamped;
          setActiveIdx(clamped);
        }
        setIsMarketDropdownOpen(false);
        onSelectIndex?.(clamped);
      }
    };

    smoothScrollRafRef.current = requestAnimationFrame(step);
  }, [items.length, markUserInteraction, onSelectIndex]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0 || items.length === 0) return;
    if (smoothScrollRafRef.current !== null || pendingDirectJumpRef.current !== null) return;
    if (isProgrammaticScrollRef.current && !userInteractedRef.current) {
      return;
    }
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (quickOpportunityItem) return;
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
  }, [items.length, scrollToIndex, onClose, quickOpportunityItem]);

  const parsePriceNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isNaN(val) ? NaN : val;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(str);
  };

  const activeItem = items[activeIdx] || items[0] || null;

  // Indexed lookup across all markets so every slide can display where a product is cheaper
  const allProductsPriceIndex = useMemo(() => {
    const map = new Map<string, Array<{
      marketId: string;
      marketName: string;
      logoUrl?: string;
      logoPlaceholder: string;
      themeColor: string;
      price: number;
      product: DiscountProduct;
    }>>();

    allMarkets.forEach(market => {
      const catalogs = market.catalogs && market.catalogs.length > 0
        ? market.catalogs
        : [{ endDate: undefined, products: market.products || [] }];
      catalogs.forEach(cat => {
        (cat.products || []).forEach(prod => {
          const cd = calculateDaysLeft(extractProductEndDate(prod, cat.endDate));
          if (cd && cd.daysLeft < 0) return;
          const key = (prod.productName || '').trim().toLowerCase();
          if (!key) return;
          const price = parsePriceNumber(prod.newPrice);
          if (isNaN(price)) return;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({
            marketId: market.id,
            marketName: market.name,
            logoUrl: market.logoUrl,
            logoPlaceholder: market.logoPlaceholder,
            themeColor: market.themeColor,
            price,
            product: prod
          });
        });
      });
    });

    return map;
  }, [allMarkets]);

  const getCheaperAlternativesForSlide = useCallback((prod: DiscountProduct, curMarketId?: string, curMarketName?: string) => {
    const key = (prod.productName || '').trim().toLowerCase();
    const currentPrice = parsePriceNumber(prod.newPrice);
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
      seenMarkets.add(cand.marketId);
      results.push({
        ...cand,
        diff: currentPrice - cand.price
      });
    });

    return results.sort((a, b) => b.diff - a.diff);
  }, [allProductsPriceIndex]);

  const openPriceComparisonPopup = useCallback((prod: DiscountProduct, explicitFallbackImg?: string) => {
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
    if (variants.length < 2) return;

    setQuickOpportunityItem({
      productName: prod.productName,
      category: prod.category,
      imageUrl: bestImg,
      variants
    });
  }, [allProductsPriceIndex]);

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
  const hasNext = activeIdx < items.length - 1;

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

      {/* Fixed Center Modal Shell: Header & Left Rail stay stationary while ONLY Right Product Column scrolls */}
      <div
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
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden h-[520px] sm:h-[560px] max-h-[90dvh] z-10 border border-gray-100"
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

                  {onSelectMarketInModal ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMarketDropdownOpen(prev => !prev);
                      }}
                      className="flex items-center gap-2 min-w-0 text-left rounded-xl px-1.5 py-1 -my-1 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group"
                      title="Başqa market seç"
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

                      <span className="font-black text-gray-900 text-base sm:text-lg tracking-tight truncate">
                        {activeMName}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-700 shrink-0 transition-transform duration-200 ${isMarketDropdownOpen ? 'rotate-180 text-gray-800' : ''}`} />
                    </button>
                  ) : (
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
                  )}
                </div>

                {/* Click-outside backdrop & Simple Market Dropdown List */}
                {isMarketDropdownOpen && onSelectMarketInModal && (
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
                      className="absolute left-3 top-full mt-1 w-60 sm:w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-30 max-h-72 overflow-y-auto animate-[fadeIn_0.15s_ease-out]"
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
                          const isCur = activeMkt?.id === m.id || m.name.trim().toLowerCase() === (activeMName || '').trim().toLowerCase();
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

                <div className="flex items-center gap-1.5 shrink-0">
                  {effectiveTotal > 0 && (
                    <div 
                      className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200/90 text-gray-700 font-extrabold text-[11px] sm:text-xs shadow-2xs tracking-tight select-none"
                      title={`Məhsul: ${activeIdx + 1} / ${effectiveTotal}`}
                    >
                      <span className="text-emerald-600 font-black">{activeIdx + 1}</span>
                      <span className="text-gray-400 font-semibold">/</span>
                      <span>{effectiveTotal}</span>
                    </div>
                  )}

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
                    activeIdx={activeIdx}
                    onSelect={jumpDirectToIndex}
                  />
                )}

                {/* Native 120Hz CSS Scroll-Snap Right Product Scroller */}
                <div
                  ref={scrollerRef}
                  onScroll={handleScroll}
                  onTouchStart={markUserInteraction}
                  onWheel={markUserInteraction}
                  onPointerDown={markUserInteraction}
                  className="flex-1 min-w-0 h-full overflow-y-auto snap-y snap-mandatory overscroll-y-none scrollbar-hide touch-pan-y [overflow-anchor:none]"
                >
                  {items.map((item, idx) => {
                    const isNearby = Math.abs(idx - activeIdx) <= 4 || (jumpTargetIdx !== null && Math.abs(idx - jumpTargetIdx) <= 1);

                    if (!isNearby) {
                      return (
                        <div
                          key={`slide-${idx}`}
                          className="w-full h-full shrink-0 snap-start snap-always bg-white"
                        />
                      );
                    }

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
                        onTouchStart={(e) => {
                          lastTouchTimeRef.current = Date.now();
                          const touch = e.touches[0];
                          tapStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                        }}
                        onTouchEnd={(e) => {
                          lastTouchTimeRef.current = Date.now();
                          const target = e.target as HTMLElement;
                          if (target.closest('button') || target.closest('a') || target.closest('[data-upcoming-strip]')) return;
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
                          if (target.closest('button') || target.closest('a') || target.closest('[data-upcoming-strip]')) return;
                          triggerHeartBurst(item, idx);
                        }}
                        className="w-full h-full shrink-0 snap-start snap-always flex flex-col justify-between overflow-hidden bg-white"
                      >
                        {/* Product Image with 2-Finger Pinch-to-Zoom */}
                        <ZoomableProductImage
                          src={imgUrl}
                          fallbackSrc={bingImgUrl300}
                          secondaryFallbackSrc={bingImgUrl200}
                          alt={cleanName}
                          isExpired={isExpired}
                          isActiveSlide={isCurrentSlide}
                        >
                          {(isZoomed) => (
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
                              <div className={`sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 transition-opacity duration-150 ${isZoomed ? 'opacity-0 pointer-events-none' : ''}`}>
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
                                {idx < items.length - 1 && (
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
                                <div className={`absolute top-2 left-2 ${isExpired ? 'bg-gray-400' : 'bg-emerald-600'} text-white px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold shadow-sm z-10 transition-opacity duration-150 ${isZoomed ? 'opacity-0 pointer-events-none' : ''}`}>
                                  {p.discountPercentage}
                                </div>
                              )}

                              {/* Quantity Badge */}
                              {quantityBadge && (
                                <div className={`absolute bottom-2 right-2 bg-black text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-sm sm:text-base font-black shadow-lg tracking-tight leading-none transition-opacity duration-150 ${isZoomed ? 'opacity-0 pointer-events-none' : ''}`}>
                                  {quantityBadge}
                                </div>
                              )}
                            </>
                          )}
                        </ZoomableProductImage>

                        {/* Product Info Content */}
                        <div className={`px-3 pt-2 pb-2 sm:px-4 sm:pt-2.5 sm:pb-2.5 flex-1 min-h-0 flex flex-col justify-between ${isCurrentSlide && showComparisons && comparisonData.length > 0 ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'}`}>
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
                              {(onToggleFavoriteItem || onToggleFavorite) && (
                                <div className="flex justify-end mb-1">
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
                                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90 cursor-pointer border ${
                                    slideIsFavorite 
                                      ? 'bg-red-50 border-red-200 text-red-500' 
                                      : 'bg-gray-50 hover:bg-red-50/70 border-gray-200 text-gray-400 hover:text-red-500'
                                  }`}
                                  title={slideIsFavorite ? "Seçilənlərdən çıxar" : "Seçilənlərə əlavə et"}
                                >
                                  <Heart 
                                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${slideIsFavorite ? 'fill-red-500 text-red-500 scale-110' : ''}`} 
                                    strokeWidth={2.2} 
                                  />
                                </button>
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h2 className="text-[15px] sm:text-base font-bold text-gray-900 leading-tight line-clamp-2">
                                  {cleanName}
                                </h2>
                              </div>

                              <div className="flex flex-col items-end shrink-0 text-right">
                                <span className={`text-2xl sm:text-[26px] font-black ${isExpired ? 'text-gray-500' : 'text-green-600'} tracking-tight leading-none whitespace-nowrap`}>
                                  {p.newPrice} <span className="text-base sm:text-lg">₼</span>
                                </span>
                                {p.oldPrice && p.oldPrice !== '---' && (
                                  <span className="text-gray-400 text-[11px] sm:text-xs line-through font-medium leading-none mt-1 whitespace-nowrap">
                                    {p.oldPrice} ₼
                                  </span>
                                )}
                              </div>
                            </div>

                            {slideComparisons.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-700 uppercase tracking-wide">
                                  <TrendingDown className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Burada daha ucuz var:</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {slideComparisons.slice(0, 2).map((compItem, cIdx) => (
                                    <button
                                      key={cIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openPriceComparisonPopup(p, explicitImgUrl);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-900 text-[10.5px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer max-w-full"
                                      title="Qiymət fərqini göstər"
                                    >
                                      {compItem.logoUrl ? (
                                        <img src={compItem.logoUrl} alt={compItem.marketName} className="w-3 h-3 object-contain rounded-xs shrink-0" />
                                      ) : (
                                        <span className="text-[8.5px] font-black text-emerald-700 shrink-0">{compItem.logoPlaceholder}</span>
                                      )}
                                      <span className="truncate">{compItem.marketName}</span>
                                      <span className="font-black text-emerald-700 shrink-0">{compItem.product.newPrice} ₼</span>
                                      <ArrowRight className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
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
              category: quickOpportunityItem?.category || items[activeIdx]?.product.category || 'Digər',
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
