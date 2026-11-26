import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DiscountProduct, MarketData } from '../types';
import ProductCard from './ProductCard';
import { exportGeneralProductPosterPng } from './OpportunityInstagramModal';

interface SearchMarketResultCardProps {
  market: MarketData;
  filteredProducts: DiscountProduct[];
  productViewMode: 'grid' | 'two';
  isAdmin: boolean;
  isFavorite: (productName: string, marketId: string) => boolean;
  onToggleFavorite: (product: DiscountProduct, marketId: string) => void;
  onProductClick: (product: DiscountProduct) => void;
  onEditProduct: (product: DiscountProduct) => void;
  hasPrevMarket?: boolean;
  hasNextMarket?: boolean;
  onPrevMarket?: () => void;
  onNextMarket?: () => void;
  headerMode?: 'full' | 'hidden' | 'compact-name';
  maxProductsToShow?: number;
}

const INITIAL_SEARCH_BATCH = 60;

const SearchMarketResultCard: React.FC<SearchMarketResultCardProps> = ({
  market,
  filteredProducts,
  productViewMode,
  isAdmin,
  isFavorite,
  onToggleFavorite,
  onProductClick,
  onEditProduct,
  hasPrevMarket = false,
  hasNextMarket = false,
  onPrevMarket,
  onNextMarket,
  headerMode = 'full',
  maxProductsToShow,
}) => {
  const [showAllProducts, setShowAllProducts] = useState<boolean>(false);
  const marketEndDate = market.catalogs?.[0]?.endDate;

  useEffect(() => {
    setShowAllProducts(false);
  }, [filteredProducts]);

  const gridClassName = productViewMode === 'grid'
    ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4'
    : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4';

  const effectiveLimit = typeof maxProductsToShow === 'number'
    ? maxProductsToShow
    : INITIAL_SEARCH_BATCH;

  const visibleProducts = showAllProducts
    ? filteredProducts
    : filteredProducts.slice(0, effectiveLimit);

  const renderCardItem = (product: DiscountProduct, keyIdx: number) => {
    const fav = isFavorite(product.productName || '', market.id);
    return (
      <div
        key={`${market.id}-${product.productName}-${keyIdx}`}
        className="animate-[fadeIn_0.26s_ease-out]"
      >
        <ProductCard
          product={product}
          accentColor={market.themeColor}
          catalogEndDate={marketEndDate}
          isAdmin={isAdmin}
          variant="compact"
          isListMode={false}
          isThreeColMobile={productViewMode === 'grid'}
          marketName={market.name}
          showMarketTextOnly={true}
          hasCheaperAlternative={(product as any)._hasCheaper}
          onClick={() => onProductClick(product)}
          onEdit={() => onEditProduct(product)}
          isFavorite={fav}
          onToggleFavorite={() => onToggleFavorite(product, market.id)}
          onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, market, marketEndDate) : undefined}
        />
      </div>
    );
  };

  const isHiddenHeader = headerMode === 'hidden';
  const isCompactNameHeader = headerMode === 'compact-name';

  return (
    <div
      id={`search-market-card-${market.id}`}
      data-search-market-section={market.id}
      className={
        isHiddenHeader
          ? 'bg-white pt-1 pb-6 sm:pt-1.5 sm:pb-8'
          : isCompactNameHeader
            ? 'bg-white mt-2 sm:mt-3 pt-5 pb-6 sm:pt-6 sm:pb-8 border-t border-gray-200/80'
            : 'bg-white rounded-2xl px-2.5 py-3 sm:p-4 border border-gray-200/90 shadow-sm mb-5 sm:mb-6'
      }
    >
      {isCompactNameHeader ? (
        <div data-search-compact-header="true" className="flex items-center gap-3 pb-3.5 sm:pb-4 select-none">
          <div className="h-px flex-1 bg-gray-200/90" aria-hidden="true" />
          <span className="text-base sm:text-lg md:text-xl font-black text-black tracking-tight text-center">
            {market.name}
          </span>
          <div className="h-px flex-1 bg-gray-200/90" aria-hidden="true" />
        </div>
      ) : !isHiddenHeader ? (
        /* Market Logo & Name Header (Top Left above products) */
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
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs sm:text-sm font-extrabold bg-white border border-gray-200/90 text-gray-700 px-2.5 sm:px-3 py-1 rounded-full shrink-0 shadow-2xs">
              {filteredProducts.length} məhsul
            </span>
            {(hasPrevMarket || hasNextMarket) && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={!hasPrevMarket}
                  onClick={onPrevMarket}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all ${
                    hasPrevMarket
                      ? 'bg-white hover:bg-emerald-50 border-gray-200 text-gray-700 hover:text-emerald-700 active:scale-90 cursor-pointer shadow-2xs'
                      : 'bg-gray-100/70 border-gray-200/60 text-gray-300 cursor-not-allowed'
                  }`}
                  title="Əvvəlki market"
                  aria-label="Əvvəlki market"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!hasNextMarket}
                  onClick={onNextMarket}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all ${
                    hasNextMarket
                      ? 'bg-white hover:bg-emerald-50 border-gray-200 text-gray-700 hover:text-emerald-700 active:scale-90 cursor-pointer shadow-2xs'
                      : 'bg-gray-100/70 border-gray-200/60 text-gray-300 cursor-not-allowed'
                  }`}
                  title="Növbəti market"
                  aria-label="Növbəti market"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Matching Products */}
      <div className={gridClassName}>
        {visibleProducts.map((product, index) => renderCardItem(product, index))}
      </div>

      {typeof maxProductsToShow !== 'number' && !showAllProducts && filteredProducts.length > INITIAL_SEARCH_BATCH && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllProducts(true)}
            className="px-4 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-2xs cursor-pointer transition-colors"
          >
            Hamısını göstər (+{filteredProducts.length - INITIAL_SEARCH_BATCH})
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchMarketResultCard, (prev, next) => (
  prev.market === next.market &&
  prev.filteredProducts === next.filteredProducts &&
  prev.productViewMode === next.productViewMode &&
  prev.isAdmin === next.isAdmin &&
  prev.headerMode === next.headerMode &&
  prev.maxProductsToShow === next.maxProductsToShow &&
  prev.hasPrevMarket === next.hasPrevMarket &&
  prev.hasNextMarket === next.hasNextMarket &&
  prev.isFavorite === next.isFavorite &&
  prev.onToggleFavorite === next.onToggleFavorite
));
