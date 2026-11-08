import React, { useRef } from 'react';
import { Search, Banknote, TrendingDown, Heart, X } from 'lucide-react';

interface BottomSearchDockProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  maxPrice: string;
  onMaxPriceChange: (price: string) => void;
  showCheaperOnly: boolean;
  onShowCheaperOnlyChange: (active: boolean) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (active: boolean) => void;
  favoritesCount: number;
}

const BottomSearchDock: React.FC<BottomSearchDockProps> = ({
  searchQuery,
  onSearchChange,
  maxPrice,
  onMaxPriceChange,
  showCheaperOnly,
  onShowCheaperOnlyChange,
  showFavorites,
  onShowFavoritesChange,
  favoritesCount
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dismiss/close virtual keyboard on mobile and desktop
    inputRef.current?.blur();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] transition-all">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col gap-1.5 sm:gap-2">
        
        {/* ROW 1 (Yuxarı cərgə): Fırsatlar / Seçilənlər düymələri və Qiymət Filtri */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
          {/* Fürsətlər (Ucuzunu Tap) Düyməsi */}
          <button
            type="button"
            onClick={() => onShowCheaperOnlyChange(!showCheaperOnly)}
            className={`
              flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 cursor-pointer select-none
              ${showCheaperOnly 
                ? 'bg-green-100 border-green-400 text-green-700 shadow-inner' 
                : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-700 active:scale-95'
              }
            `}
            title="Yalnız daha ucuz alternativi olan məhsulları göstər"
          >
            <TrendingDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 ${showCheaperOnly ? 'animate-bounce' : ''}`} />
            <span>Fürsətlər</span>
          </button>

          {/* Seçilənlər (Yadda Saxla / Sevimlilər) Düyməsi */}
          <button
            type="button"
            onClick={() => onShowFavoritesChange(!showFavorites)}
            className={`
              flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all whitespace-nowrap relative flex-1 cursor-pointer select-none
              ${showFavorites 
                ? 'bg-red-50 border-red-300 text-red-600 shadow-inner' 
                : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-700 active:scale-95'
              }
            `}
            title="Yadda saxlanılanlar"
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showFavorites ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
            <span>Seçilənlər</span>
            {favoritesCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Qiymət Filtri (Maksimum Qiymət) */}
          <div className="relative w-24 sm:w-28 h-8 sm:h-9 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Banknote className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="block w-full pl-7 pr-6 py-1 border border-gray-200 rounded-xl bg-gray-50/90 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-gray-900 text-xs sm:text-sm h-full placeholder-gray-400 font-medium"
              placeholder="Maks."
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-gray-400 text-xs font-bold">
              ₼
            </div>
          </div>
        </div>

        {/* ROW 2 (ƏN ALTDA): Məhsul Axtarış Sətri - Enter basıldıqda klaviatura itir */}
        <form 
          onSubmit={handleSearchSubmit}
          className="flex relative w-full rounded-xl border border-gray-200 bg-gray-50/90 focus-within:ring-2 focus-within:ring-green-500/30 focus-within:border-green-500 focus-within:bg-white transition-all h-9 sm:h-10"
        >
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
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
              }
            }}
            className="block w-full pl-9 pr-9 py-1.5 bg-transparent border-none focus:outline-hidden text-gray-900 placeholder-gray-400 text-xs sm:text-sm h-full rounded-xl font-medium"
            placeholder={showFavorites ? "Yadda saxlanılanları axtar..." : "Məhsul axtar..."}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              title="Axtarışı təmizlə"
              aria-label="Axtarışı təmizlə"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

      </div>
    </div>
  );
};

export default BottomSearchDock;
