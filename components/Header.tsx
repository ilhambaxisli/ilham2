
import React from 'react';
import { ShoppingCart, Plus, Search, Banknote, TrendingDown, Heart, X } from 'lucide-react';
import { MarketData } from '../types';

interface HeaderProps {
  onAdminClick?: () => void;
  isAdmin?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  maxPrice: string;
  onMaxPriceChange: (price: string) => void;
  markets: MarketData[];
  onLogoClick: () => void;
  showCheaperOnly: boolean;
  onShowCheaperOnlyChange: (active: boolean) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (active: boolean) => void;
  favoritesCount: number;
}

const Header: React.FC<HeaderProps> = ({ 
  onAdminClick, 
  isAdmin, 
  searchQuery, 
  onSearchChange,
  maxPrice,
  onMaxPriceChange,
  onLogoClick,
  showCheaperOnly,
  onShowCheaperOnlyChange,
  showFavorites,
  onShowFavoritesChange,
  favoritesCount
}) => {
  return (
    <header className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between py-3 gap-3">
          
          {/* Logo Section */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div 
              onClick={onLogoClick}
              className="flex items-center gap-2 text-green-600 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <ShoppingCart className="h-8 w-8" />
              <span className="font-bold text-xl tracking-tight text-gray-900">
                endirim<span className="text-green-600">.net</span>
              </span>
            </div>
            
            {/* Mobile Admin Button */}
            <div className="flex items-center md:hidden gap-2">
               <button 
                onClick={onAdminClick}
                className={`p-2 rounded-full transition-colors ${isAdmin ? 'bg-red-100 text-red-600' : 'text-gray-300'}`}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Section */}
          <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col gap-3">
            
            {/* ROW 1: Search Inputs */}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
                {/* Main Search Bar */}
                <div className="flex relative flex-1 rounded-lg border border-gray-200 bg-gray-50 focus-within:ring-1 focus-within:ring-green-500 focus-within:border-green-500 focus-within:bg-white transition-colors h-10">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="block w-full pl-9 pr-9 py-2 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 sm:text-sm h-full rounded-lg"
                    placeholder={showFavorites ? "Yadda saxlanılanları axtar..." : "Məhsul axtar..."}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                      title="Axtarışı təmizlə"
                      aria-label="Axtarışı təmizlə"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Price Filter */}
                <div className="relative w-full sm:w-32 h-10 hidden sm:block">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Banknote className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => onMaxPriceChange(e.target.value)}
                    className="block w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-green-500 focus:border-green-500 text-gray-900 sm:text-sm h-full placeholder-gray-400"
                    placeholder="Maks."
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 text-xs font-bold">
                    ₼
                  </div>
                </div>
            </div>

            {/* ROW 2: Action Buttons (Favorites & Cheaper) - Separated */}
            <div className="flex items-center justify-between w-full">
                {/* Left: Cheaper Filter */}
                <button
                  onClick={() => onShowCheaperOnlyChange(!showCheaperOnly)}
                  className={`
                    flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none sm:w-auto mr-2
                    ${showCheaperOnly 
                      ? 'bg-green-100 border-green-300 text-green-700 shadow-inner' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }
                  `}
                  title="Yalnız daha ucuz alternativi olan məhsulları göstər"
                >
                  <TrendingDown className={`w-4 h-4 ${showCheaperOnly ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">Ucuzunu Tap</span>
                  <span className="sm:hidden">Fürsətlər</span>
                </button>

                {/* Right: Favorites */}
                 <button
                  onClick={() => onShowFavoritesChange(!showFavorites)}
                  className={`
                    flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all whitespace-nowrap relative flex-1 sm:flex-none sm:w-auto ml-2
                    ${showFavorites 
                      ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }
                  `}
                  title="Yadda saxlanılanlar"
                >
                  <Heart className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
                  <span className="hidden sm:inline">Yadda Saxla</span>
                  <span className="sm:hidden">Seçilənlər</span>
                  {favoritesCount > 0 && (
                    <span className="ml-1 bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full">
                      {favoritesCount}
                    </span>
                  )}
                </button>
            </div>

          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4 mt-1">
             {isAdmin && (
               <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                 Admin Rejimi
               </span>
             )}
            <button 
              onClick={onAdminClick}
              className={`p-1 rounded-full transition-colors ${isAdmin ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-gray-300 hover:text-gray-400'}`}
              title={isAdmin ? "Admin Çıxışı" : "Admin Girişi"}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
