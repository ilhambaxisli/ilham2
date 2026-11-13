import React, { useRef, useState, useEffect } from 'react';
import { Search, TrendingDown, Heart, X, GalleryVerticalEnd } from 'lucide-react';

export interface DockMarketOption {
  id: string;
  name: string;
  logoUrl?: string;
  logoPlaceholder: string;
  productCount: number;
}

interface BottomSearchDockProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  maxPrice?: string;
  onMaxPriceChange?: (price: string) => void;
  showCheaperOnly: boolean;
  onShowCheaperOnlyChange: (active: boolean) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (active: boolean) => void;
  favoritesCount: number;
  markets?: DockMarketOption[];
  onOpenMarketSwipeFeed?: (marketId: string) => void;
}

const BottomSearchDock: React.FC<BottomSearchDockProps> = ({
  searchQuery,
  onSearchChange,
  showCheaperOnly,
  onShowCheaperOnlyChange,
  showFavorites,
  onShowFavoritesChange,
  favoritesCount,
  markets = [],
  onOpenMarketSwipeFeed
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevQueryRef = useRef<string>(searchQuery);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMarketFeedOpen, setIsMarketFeedOpen] = useState<boolean>(false);

  // Auto-collapse search bar if searchQuery was cleared externally (e.g. Back button or top Geri button)
  useEffect(() => {
    if (prevQueryRef.current !== '' && searchQuery === '' && document.activeElement !== inputRef.current) {
      setIsSearchOpen(false);
    }
    prevQueryRef.current = searchQuery;
  }, [searchQuery]);

  const handleToggleSearch = () => {
    setIsMarketFeedOpen(false);
    if (isSearchOpen) {
      inputRef.current?.blur();
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  };

  const handleToggleMarketFeed = () => {
    if (!isMarketFeedOpen) {
      inputRef.current?.blur();
      setIsSearchOpen(false);
    }
    setIsMarketFeedOpen(prev => !prev);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dismiss/close virtual keyboard on mobile and desktop
    inputRef.current?.blur();
  };

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <>
      {/* Click-outside overlay when upward market chips list is open */}
      {isMarketFeedOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/15"
          onClick={() => setIsMarketFeedOpen(false)}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] transition-all">
        <div className="max-w-3xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2">
          
          {/* Expandable Search Bar (Opens when user taps the Search icon) */}
          {isSearchOpen && (
            <form 
              onSubmit={handleSearchSubmit}
              className="flex relative w-full rounded-2xl border border-emerald-400/80 bg-white ring-2 ring-emerald-500/15 shadow-sm transition-all h-11 sm:h-12 animate-[fadeIn_0.15s_ease-out]"
            >
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-emerald-600" />
              </div>
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.currentTarget.blur();
                    setIsSearchOpen(false);
                  }
                }}
                className="block w-full pl-11 pr-11 py-2 bg-transparent border-none focus:outline-hidden text-gray-900 placeholder-gray-400 text-sm sm:text-base h-full rounded-2xl font-medium"
                placeholder={showFavorites ? "Yadda saxlanılanları axtar..." : "Məhsul axtar..."}
              />
              <button
                type="button"
                onClick={() => {
                  if (searchQuery) {
                    onSearchChange('');
                    inputRef.current?.focus();
                  } else {
                    inputRef.current?.blur();
                    setIsSearchOpen(false);
                  }
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                title={searchQuery ? "Axtarışı təmizlə" : "Axtarışı bağla"}
                aria-label={searchQuery ? "Axtarışı təmizlə" : "Axtarışı bağla"}
              >
                <X className="h-5 w-5" />
              </button>
            </form>
          )}

          {/* Main Bottom Action Row: Fürsətlər, Seçilənlər, Swipe Icon, and Search Icon */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full">
            {/* Fürsətlər (Ucuzunu Tap) Düyməsi */}
            <button
              type="button"
              onClick={() => {
                setIsMarketFeedOpen(false);
                onShowCheaperOnlyChange(!showCheaperOnly);
              }}
              className={`
                flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-12 sm:h-14 rounded-2xl border text-xs sm:text-base font-bold transition-all whitespace-nowrap flex-1 min-w-0 cursor-pointer select-none
                ${showCheaperOnly 
                  ? 'bg-green-100 border-green-400 text-green-700 shadow-inner' 
                  : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-800 active:scale-95'
                }
              `}
              title="Yalnız daha ucuz alternativi olan məhsulları göstər"
            >
              <TrendingDown className={`w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0 ${showCheaperOnly ? 'animate-bounce' : ''}`} />
              <span className="truncate">Fürsətlər</span>
            </button>

            {/* Seçilənlər (Yadda Saxla / Sevimlilər) Düyməsi */}
            <button
              type="button"
              onClick={() => {
                setIsMarketFeedOpen(false);
                onShowFavoritesChange(!showFavorites);
              }}
              className={`
                flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-12 sm:h-14 rounded-2xl border text-xs sm:text-base font-bold transition-all whitespace-nowrap relative flex-1 min-w-0 cursor-pointer select-none
                ${showFavorites 
                  ? 'bg-red-50 border-red-300 text-red-600 shadow-inner' 
                  : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-800 active:scale-95'
                }
              `}
              title="Yadda saxlanılanlar"
            >
              <Heart className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${showFavorites ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
              <span className="truncate">Seçilənlər</span>
              {favoritesCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Kaydırma (TikTok Feed) İkonu — Arama ikonunun solunda */}
            <div className="relative shrink-0">
              {/* Simple vertical list of markets rising upwards (matching category dropdown style) */}
              {isMarketFeedOpen && markets.length > 0 && (
                <div className="absolute bottom-full right-0 mb-2 w-60 sm:w-68 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-72 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Marketlər</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMarketFeedOpen(false);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {markets.map((m) => {
                    const shortName = m.name.replace(/\s+Market$/i, '').trim() || m.name;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setIsMarketFeedOpen(false);
                          onOpenMarketSwipeFeed?.(m.id);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-white border border-gray-200/80 flex items-center justify-center overflow-hidden shrink-0">
                            {m.logoUrl ? (
                              <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-0.5" />
                            ) : (
                              <span className="text-emerald-700 font-bold text-[10px]">
                                {m.logoPlaceholder || shortName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="truncate font-semibold">{m.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 bg-gray-100 font-semibold px-2 py-0.5 rounded-full shrink-0">
                          {m.productCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleMarketFeed}
                className={`
                  flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-2xl border transition-all shrink-0 cursor-pointer select-none active:scale-95
                  ${isMarketFeedOpen
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 shadow-xs'
                  }
                `}
                title="Sürüşdürərək məhsullara bax"
                aria-label="Sürüşdürərək məhsullara bax"
              >
                <GalleryVerticalEnd className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
              </button>
            </div>

            {/* Böyük Axtarış İkonu Düyməsi */}
            <button
              type="button"
              onClick={handleToggleSearch}
              className={`
                relative flex items-center justify-center w-14 sm:w-16 h-12 sm:h-14 rounded-2xl border transition-all shrink-0 cursor-pointer select-none active:scale-95
                ${isSearchOpen || hasActiveSearch
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-gray-900 hover:bg-gray-800 border-gray-900 text-white shadow-sm'
                }
              `}
              title={isSearchOpen ? "Axtarışı bağla" : "Məhsul axtar"}
              aria-label="Məhsul axtar"
            >
              <Search className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              {hasActiveSearch && !isSearchOpen && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-xs" />
              )}
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default BottomSearchDock;
