import React, { useState, useEffect, useRef } from 'react';
import { DiscountProduct, MarketData } from '../types';
import ProductCard from './ProductCard';

interface SearchMarketResultCardProps {
  market: MarketData;
  filteredProducts: DiscountProduct[];
  productViewMode: 'grid' | 'two';
  isAdmin: boolean;
  isFavorite: (productName: string, marketId: string) => boolean;
  onToggleFavorite: (product: DiscountProduct, marketId: string) => void;
  onProductClick: (product: DiscountProduct) => void;
  onEditProduct: (product: DiscountProduct) => void;
}

const INITIAL_SEARCH_BATCH = 12;
const SEARCH_BATCH_STEP = 15;

const SearchMarketResultCard: React.FC<SearchMarketResultCardProps> = ({
  market,
  filteredProducts,
  productViewMode,
  isAdmin,
  isFavorite,
  onToggleFavorite,
  onProductClick,
  onEditProduct,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_SEARCH_BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const marketEndDate = market.catalogs?.[0]?.endDate;

  useEffect(() => {
    setVisibleCount(INITIAL_SEARCH_BATCH);
  }, [filteredProducts]);

  useEffect(() => {
    if (visibleCount >= filteredProducts.length) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => Math.min(filteredProducts.length, prev + SEARCH_BATCH_STEP));
        }
      },
      { rootMargin: '350px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filteredProducts.length]);

  const gridClassName = productViewMode === 'grid'
    ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4'
    : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4';

  const visibleProducts = filteredProducts.slice(0, visibleCount);

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
        isListMode={false}
        isThreeColMobile={productViewMode === 'grid'}
        marketLogoUrl={market.logoUrl}
        marketName={market.name}
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
      id={`search-market-card-${market.id}`}
      className="bg-white rounded-2xl -mx-1 px-2.5 py-3 sm:mx-0 sm:p-4 border border-gray-200/90 shadow-sm mb-5 sm:mb-6"
    >
      {/* Market Logo & Name Header (Top Left above products) */}
      <div className="flex items-center justify-between gap-2 bg-gray-50/85 -mx-2.5 sm:-mx-4 -mt-3 sm:-mt-4 px-3 sm:px-4 py-2.5 mb-3.5 sm:mb-4 border-b border-gray-200/80 rounded-t-2xl">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {market.logoUrl ? (
              <img src={market.logoUrl} alt={market.name} className="w-full h-full object-contain p-1" />
            ) : (
              <span className={`text-${market.themeColor}-700 font-black text-sm sm:text-base`}>{market.logoPlaceholder}</span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-gray-900 truncate tracking-tight">
            {market.name}
          </h3>
        </div>
        <span className="text-xs sm:text-sm font-extrabold bg-white border border-gray-200/90 text-gray-700 px-2.5 sm:px-3 py-1 rounded-full shrink-0 shadow-2xs">
          {filteredProducts.length} məhsul
        </span>
      </div>

      {/* Progressive Matching Products */}
      <div className={gridClassName}>
        {visibleProducts.map((product, index) => renderCardItem(product, index))}
      </div>

      {visibleCount < filteredProducts.length && (
        <div ref={sentinelRef} className="h-2 w-full" aria-hidden="true" />
      )}
    </div>
  );
};

export default SearchMarketResultCard;
