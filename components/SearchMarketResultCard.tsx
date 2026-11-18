import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { DiscountProduct, MarketData } from '../types';
import ProductCard from './ProductCard';

interface SearchMarketResultCardProps {
  market: MarketData;
  filteredProducts: DiscountProduct[];
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  stickyHeaderHeight: number;
  productViewMode: 'grid' | 'list';
  isAdmin: boolean;
  isFavorite: (productName: string, marketId: string) => boolean;
  onToggleFavorite: (product: DiscountProduct, marketId: string) => void;
  onProductClick: (product: DiscountProduct) => void;
  onEditProduct: (product: DiscountProduct) => void;
  onSelectMarket?: () => void;
}

const SearchMarketResultCard: React.FC<SearchMarketResultCardProps> = ({
  market,
  filteredProducts,
  isExpanded,
  onExpand,
  onCollapse,
  stickyHeaderHeight,
  productViewMode,
  isAdmin,
  isFavorite,
  onToggleFavorite,
  onProductClick,
  onEditProduct,
  onSelectMarket,
}) => {
  const marketEndDate = market.catalogs?.[0]?.endDate;
  const hasMoreThanSix = filteredProducts.length > 6;
  const topSixProducts = filteredProducts.slice(0, 6);
  const extraProducts = filteredProducts.slice(6);

  const [renderExtra, setRenderExtra] = useState<boolean>(isExpanded);
  const [isAnimatingCollapse, setIsAnimatingCollapse] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const extraWrapperRef = useRef<HTMLDivElement | null>(null);
  const extraInnerRef = useRef<HTMLDivElement | null>(null);
  const animRafRef = useRef<number | null>(null);

  const cancelAnim = () => {
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelAnim();
  }, []);

  // Sync external state changes (e.g., search query changed resets all expanded cards)
  useEffect(() => {
    if (!isExpanded && !isAnimatingCollapse) {
      cancelAnim();
      setRenderExtra(false);
      if (extraWrapperRef.current) {
        extraWrapperRef.current.style.height = '';
        extraWrapperRef.current.style.opacity = '';
      }
      if (extraInnerRef.current) {
        extraInnerRef.current.style.transform = '';
      }
    } else if (isExpanded && !renderExtra) {
      setRenderExtra(true);
    }
  }, [isExpanded, isAnimatingCollapse, renderExtra]);

  // Animate smooth top-to-bottom reveal when expanding
  useEffect(() => {
    if (!isExpanded || !renderExtra || isAnimatingCollapse) return;
    const wrapper = extraWrapperRef.current;
    const inner = extraInnerRef.current;
    if (!wrapper || !inner) return;

    cancelAnim();
    const targetHeight = inner.scrollHeight;
    if (targetHeight <= 0) {
      wrapper.style.height = '';
      wrapper.style.opacity = '';
      return;
    }

    wrapper.style.height = '0px';
    wrapper.style.opacity = '0';
    inner.style.transform = 'translateY(-10px)';

    const duration = Math.min(340, Math.max(220, 180 + targetHeight * 0.12));
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      wrapper.style.height = `${targetHeight * eased}px`;
      wrapper.style.opacity = `${Math.min(1, progress * 1.4)}`;
      inner.style.transform = `translateY(${(1 - eased) * -10}px)`;

      if (progress < 1) {
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        wrapper.style.height = '';
        wrapper.style.opacity = '';
        inner.style.transform = '';
      }
    };

    animRafRef.current = requestAnimationFrame(step);
  }, [isExpanded, renderExtra, isAnimatingCollapse]);

  const handleToggle = () => {
    if (isAnimatingCollapse) return;

    if (!isExpanded) {
      setRenderExtra(true);
      onExpand();
      return;
    }

    const wrapper = extraWrapperRef.current;
    const inner = extraInnerRef.current;

    if (!wrapper || !inner) {
      setRenderExtra(false);
      onCollapse();
      return;
    }

    cancelAnim();
    setIsAnimatingCollapse(true);

    const startHeight = Math.round(wrapper.getBoundingClientRect().height || inner.scrollHeight);
    const startScrollY = window.scrollY;
    const htmlEl = document.documentElement;
    const prevOverflowAnchor = htmlEl.style.overflowAnchor;
    htmlEl.style.overflowAnchor = 'none';

    wrapper.style.height = `${startHeight}px`;
    wrapper.style.opacity = '1';

    const duration = Math.min(340, Math.max(220, 180 + startHeight * 0.12));
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const remainingHeight = Math.round(startHeight * (1 - eased));
      const deltaH = startHeight - remainingHeight;

      wrapper.style.height = `${remainingHeight}px`;
      wrapper.style.opacity = `${Math.max(0, 1 - progress * 1.1)}`;

      // Adjust scrollY by exact collapsed height so everything below the card stays pixel-stationary
      const nextScrollY = Math.max(0, startScrollY - deltaH);
      window.scrollTo(0, nextScrollY);

      if (progress < 1) {
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        wrapper.style.height = '0px';
        wrapper.style.opacity = '0';
        inner.style.transform = '';
        setIsAnimatingCollapse(false);
        setRenderExtra(false);
        onCollapse();
        requestAnimationFrame(() => {
          htmlEl.style.overflowAnchor = prevOverflowAnchor;
        });
      }
    };

    animRafRef.current = requestAnimationFrame(step);
  };

  const gridClassName = productViewMode === 'grid'
    ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4';

  const renderCardItem = (product: DiscountProduct, keyIdx: number) => {
    const fav = isFavorite(product.productName || '', market.id);
    return (
      <ProductCard
        key={`${market.id}-${product.productName}-${keyIdx}`}
        product={product}
        accentColor={market.themeColor}
        catalogEndDate={marketEndDate}
        isAdmin={isAdmin}
        variant="compact"
        isListMode={productViewMode === 'list'}
        isThreeColMobile={productViewMode === 'grid'}
        hasCheaperAlternative={(product as any)._hasCheaper}
        onClick={() => onProductClick(product)}
        onEdit={() => onEditProduct(product)}
        isFavorite={fav}
        onToggleFavorite={() => onToggleFavorite(product, market.id)}
      />
    );
  };

  return (
    <div
      ref={cardRef}
      id={`search-market-card-${market.id}`}
      className="bg-white rounded-2xl -mx-1.5 px-1.5 py-2 sm:mx-0 sm:p-4 border border-gray-100 shadow-xs mb-5"
    >
      {/* Sticky Market Header in search results */}
      <div
        style={{ top: `${stickyHeaderHeight}px` }}
        className="sticky z-20 bg-white/95 backdrop-blur-md -mx-1.5 sm:-mx-4 px-2.5 sm:px-4 py-2.5 mb-3.5 sm:mb-4 border-b border-gray-100 flex items-center justify-between gap-2 shadow-2xs transition-[top] duration-150 rounded-t-2xl"
      >
        <button
          type="button"
          onClick={onSelectMarket}
          title={`${market.name} məhsul siyahısına keç`}
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left rounded-xl px-1.5 py-1 -mx-1.5 -my-1 hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {market.logoUrl ? (
              <img src={market.logoUrl} alt={market.name} className="w-full h-full object-contain p-1" />
            ) : (
              <span className={`text-${market.themeColor}-700 font-bold text-sm sm:text-base`}>{market.logoPlaceholder}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-emerald-700 truncate tracking-tight transition-colors">{market.name}</h3>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 font-medium">Axtarış üzrə market nəticələri</p>
          </div>
        </button>
        <span className="text-xs sm:text-sm font-bold bg-gray-100 text-gray-600 px-2.5 sm:px-3 py-1 rounded-full shrink-0">
          {filteredProducts.length} məhsul
        </span>
      </div>

      {/* First 6 Sample Products */}
      <div className={gridClassName}>
        {topSixProducts.map((product, index) => renderCardItem(product, index))}
      </div>

      {/* Collapsible Extra Products (Items 7+) */}
      {hasMoreThanSix && renderExtra && (
        <div
          ref={extraWrapperRef}
          className="overflow-hidden flex flex-col justify-end will-change-[height,opacity]"
        >
          <div
            ref={extraInnerRef}
            className={`${gridClassName} pt-1.5 sm:pt-3.5 md:pt-4 will-change-transform`}
          >
            {extraProducts.map((product, index) => renderCardItem(product, index + 6))}
          </div>
        </div>
      )}

      {/* Expand / Collapse Button (only shown when > 6 matching products) */}
      {hasMoreThanSix && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-center">
          <button
            type="button"
            onClick={handleToggle}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 border border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700 text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
          >
            {isExpanded ? (
              <>
                <span className="leading-none">Daha az göstər</span>
                <ChevronUp className="w-4 h-4 shrink-0 text-gray-500" strokeWidth={2.5} />
              </>
            ) : (
              <>
                <span className="leading-none">Hamısına bax</span>
                <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-white border border-gray-200/80 text-emerald-700 leading-none">
                  {filteredProducts.length}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchMarketResultCard;
