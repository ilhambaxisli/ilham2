import React, { useRef, useEffect } from 'react';
import { Search, Heart, X } from 'lucide-react';

interface BottomSearchDockProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (active: boolean) => void;
  favoritesCount: number;
  openSearchTrigger?: number;
}

const BottomSearchDock: React.FC<BottomSearchDockProps> = ({
  searchQuery,
  onSearchChange,
  showFavorites,
  onShowFavoritesChange,
  favoritesCount,
  openSearchTrigger = 0
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus center search bar when triggered externally (e.g. quick-search icon on Home)
  useEffect(() => {
    if (openSearchTrigger > 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [openSearchTrigger]);

  const handleRightSearchButtonClick = () => {
    if (document.activeElement === inputRef.current && searchQuery.trim().length > 0) {
      inputRef.current?.blur();
    } else {
      inputRef.current?.focus();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
  };

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] transition-all">
      <div className="max-w-3xl md:max-w-4xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-2.5 w-full">
          {/* Sol: Yalnız ürək ikonu (Seçilənlər) */}
          <button
            type="button"
            onClick={() => onShowFavoritesChange(!showFavorites)}
            className={`
              relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all shrink-0 cursor-pointer select-none
              ${showFavorites
                ? 'bg-red-50 border-red-300 text-red-600 shadow-inner'
                : 'bg-gray-50/90 hover:bg-gray-100 border-gray-200 text-gray-600 active:scale-95'
              }
            `}
            title="Seçilənlər"
            aria-label="Seçilənlər"
          >
            <Heart
              className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${
                showFavorites ? 'fill-red-500 text-red-500' : 'text-gray-600'
              }`}
            />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white leading-none shadow-xs">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Orta: Açıq, birbaşa yazıla bilən axtarış sahəsi */}
          <form
            onSubmit={handleSearchSubmit}
            className={`
              relative flex-1 min-w-0 h-12 sm:h-14 rounded-2xl border transition-all
              ${hasActiveSearch
                ? 'border-emerald-400/90 bg-white ring-2 ring-emerald-500/15 shadow-sm'
                : 'border-gray-200 bg-gray-50/90 focus-within:bg-white focus-within:border-emerald-400/90 focus-within:ring-2 focus-within:ring-emerald-500/15 focus-within:shadow-sm'
              }
            `}
          >
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.currentTarget.blur();
                }
              }}
              className={`block w-full h-full pl-3.5 sm:pl-4 ${searchQuery ? 'pr-10' : 'pr-3.5 sm:pr-4'} bg-transparent border-none focus:outline-hidden text-gray-900 placeholder-gray-400 text-sm sm:text-base rounded-2xl font-medium appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden`}
              placeholder="Məhsul axtar..."
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
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </form>

          {/* Sağ: Axtarış ikonu düyməsi */}
          <button
            type="button"
            onClick={handleRightSearchButtonClick}
            className={`
              relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all shrink-0 cursor-pointer select-none active:scale-95
              ${hasActiveSearch
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-gray-900 hover:bg-gray-800 border-gray-900 text-white shadow-sm'
              }
            `}
            title="Məhsul axtar"
            aria-label="Məhsul axtar"
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomSearchDock;
