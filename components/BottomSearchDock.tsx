import React, { useRef, useState, useEffect } from 'react';
import { Search, TrendingDown, Heart, X } from 'lucide-react';

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
}

const BottomSearchDock: React.FC<BottomSearchDockProps> = ({
  searchQuery,
  onSearchChange,
  showCheaperOnly,
  onShowCheaperOnlyChange,
  showFavorites,
  onShowFavoritesChange,
  favoritesCount
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevQueryRef = useRef<string>(searchQuery);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Auto-collapse search bar if searchQuery was cleared externally (e.g. Back button or top Geri button)
  useEffect(() => {
    if (prevQueryRef.current !== '' && searchQuery === '' && document.activeElement !== inputRef.current) {
      setIsSearchOpen(false);
    }
    prevQueryRef.current = searchQuery;
  }, [searchQuery]);

  const handleToggleSearch = () => {
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dismiss/close virtual keyboard on mobile and desktop
    inputRef.current?.blur();
  };

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] transition-all">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2">
        
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

        {/* Main Bottom Action Row: Fürsətlər, Seçilənlər, and Big Search Icon */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
          {/* Fürsətlər (Ucuzunu Tap) Düyməsi */}
          <button
            type="button"
            onClick={() => onShowCheaperOnlyChange(!showCheaperOnly)}
            className={`
              flex items-center justify-center gap-2 px-3.5 h-12 sm:h-14 rounded-2xl border text-sm sm:text-base font-bold transition-all whitespace-nowrap flex-1 cursor-pointer select-none
              ${showCheaperOnly 
                ? 'bg-green-100 border-green-400 text-green-700 shadow-inner' 
                : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-800 active:scale-95'
              }
            `}
            title="Yalnız daha ucuz alternativi olan məhsulları göstər"
          >
            <TrendingDown className={`w-5 h-5 text-green-600 ${showCheaperOnly ? 'animate-bounce' : ''}`} />
            <span>Fürsətlər</span>
          </button>

          {/* Seçilənlər (Yadda Saxla / Sevimlilər) Düyməsi */}
          <button
            type="button"
            onClick={() => onShowFavoritesChange(!showFavorites)}
            className={`
              flex items-center justify-center gap-2 px-3.5 h-12 sm:h-14 rounded-2xl border text-sm sm:text-base font-bold transition-all whitespace-nowrap relative flex-1 cursor-pointer select-none
              ${showFavorites 
                ? 'bg-red-50 border-red-300 text-red-600 shadow-inner' 
                : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-800 active:scale-95'
              }
            `}
            title="Yadda saxlanılanlar"
          >
            <Heart className={`w-5 h-5 ${showFavorites ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
            <span>Seçilənlər</span>
            {favoritesCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Böyük Axtarış İkonu Düyməsi */}
          <button
            type="button"
            onClick={handleToggleSearch}
            className={`
              relative flex items-center justify-center w-16 sm:w-20 h-12 sm:h-14 rounded-2xl border transition-all shrink-0 cursor-pointer select-none active:scale-95
              ${isSearchOpen || hasActiveSearch
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-900 text-white shadow-sm'
              }
            `}
            title={isSearchOpen ? "Axtarışı bağla" : "Məhsul axtar"}
            aria-label="Məhsul axtar"
          >
            <Search className="w-6 h-6" strokeWidth={2.5} />
            {hasActiveSearch && !isSearchOpen && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-xs" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BottomSearchDock;
