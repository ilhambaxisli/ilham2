
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from './components/Header';
import BottomSearchDock from './components/BottomSearchDock';
import ProductCard from './components/ProductCard';
import GroupedProductCard from './components/GroupedProductCard';
import ScannerModal from './components/ScannerModal';
import AdminLoginModal from './components/AdminLoginModal';
import Banner from './components/Banner';
import BannerEditorModal from './components/BannerEditorModal';
import AddMarketModal from './components/AddMarketModal';
import EditMarketModal from './components/EditMarketModal';
import EditProductModal from './components/EditProductModal';
import DatabaseModal from './components/DatabaseModal';
import ProductDetailModal from './components/ProductDetailModal';
import SocialDealsModal from './components/SocialDealsModal';
import { MarketData, DiscountProduct, BannerData, SupabaseConfig, Catalog, FavoriteItem } from './types';
import * as supabaseService from './services/supabase';
import { RefreshCw, ShoppingBag, ArrowRight, Loader2, Plus, Trash2, Search, Database, Home, ChevronRight, Store, LayoutGrid, LayoutList, XCircle, ChevronUp, ChevronDown, Edit, Calendar, Clock, AlertTriangle, CheckCircle2, ShoppingCart, TrendingDown, ArrowLeft, Heart, RotateCcw, Instagram, X, Check, ChevronLeft, Sparkles, ExternalLink, Tag, Percent } from 'lucide-react';

const INITIAL_MARKETS: MarketData[] = [
  {
    id: 'oba',
    name: 'Oba Market',
    lastUpdated: new Date().toISOString(),
    products: [],
    catalogs: [],
    url: 'https://oba.az/endirim-jurnali/', 
    themeColor: 'green',
    logoPlaceholder: 'O',
    logoUrl: 'https://seeklogo.com/images/O/oba-market-logo-3626297371-seeklogo.com.png',
    instagramPosts: []
  },
  {
    id: 'araz',
    name: 'Araz Market',
    lastUpdated: new Date().toISOString(),
    products: [],
    catalogs: [], 
    url: 'https://b7x9kq.arazmarket.az/storage/discount-journal/file/01KADDADDGMJZ39KJDHA1R3H38.pdf',
    themeColor: 'amber', 
    logoPlaceholder: 'A',
    logoUrl: 'https://b7x9kq.arazmarket.az/storage/news/dsc_9152.jpg',
    instagramPosts: []
  }
];

// Target order: OBA, araz, bravo, al market, tamstore, bazarstore, rahat, neptun, bolmart
const getMarketSortRank = (market: MarketData): number => {
  const id = (market.id || '').toLowerCase().trim();
  const name = (market.name || '').toLowerCase().trim();

  // 1. OBA
  if (id === 'oba' || name.startsWith('oba') || name.includes('oba')) return 1;

  // 2. araz
  if (id === 'araz' || name.startsWith('araz') || name.includes('araz')) return 2;

  // 3. bravo
  if (id === 'bravo' || name.startsWith('bravo') || name.includes('bravo')) return 3;

  // 4. al market
  if (id === 'al' || id === 'almarket' || id === 'al_market' || name.startsWith('al ') || name === 'al' || name.includes('al market')) return 4;

  // 5. tamstore
  if (id === 'tamstore' || id === 'tam' || name.includes('tamstore') || name.includes('tam store')) return 5;

  // 6. bazarstore
  if (id === 'bazarstore' || name.includes('bazarstore') || name.includes('bazar store')) return 6;

  // 7. rahat
  if (id === 'rahat' || name.includes('rahat')) return 7;

  // 8. neptun
  if (id === 'neptun' || name.includes('neptun')) return 8;

  // 9. bolmart
  if (id === 'bolmart' || name.includes('bolmart') || name.includes('bol mart')) return 9;

  return 999;
};

const sortMarketsByOrder = (marketList: MarketData[]): MarketData[] => {
  return [...marketList].sort((a, b) => {
    const rankA = getMarketSortRank(a);
    const rankB = getMarketSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return (a.name || '').localeCompare(b.name || '', 'az');
  });
};

const INITIAL_BANNER_1: BannerData = {
  id: 'banner-1',
  isVisible: false,
  title: '',
  imageUrl: '',
  link: ''
};

const INITIAL_BANNER_2: BannerData = {
  id: 'banner-2',
  isVisible: false,
  title: '',
  imageUrl: '',
  link: ''
};

const DEFAULT_SUPABASE_URL = "https://rnqdjdxokcpfwsqkzrfu.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucWRqZHhva2NwZndzcWt6cmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODY0NDAsImV4cCI6MjA3OTY2MjQ0MH0.d1PsO4oMCU2SWDdey5yjVmVzet2uXwKbgbEkQJ9CJFM";

const CartLoading = () => (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
    <div className="mb-4 sm:mb-6 relative">
      <div className="absolute inset-0 bg-green-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
      <ShoppingCart className="w-14 h-14 sm:w-16 sm:h-16 text-green-600 animate-spin" strokeWidth={1.5} />
    </div>
    <h2 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">endirim<span className="text-green-600">.net</span></h2>
    <p className="text-xs text-gray-400 mt-1.5 font-semibold animate-pulse">Yüklənir...</p>
  </div>
);

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  const clean = url.split('?')[0].replace(/\/$/, '');
  return `${clean}/embed/`;
};

const formatMarketButtonName = (name: string) => {
  const trimmed = (name || '').trim();
  if (/^al(\s+market)?$/i.test(trimmed)) {
    return 'Al Market';
  }
  return trimmed.replace(/\s+Market$/i, '') || trimmed;
};

const MARKET_COLOR_STYLES: Record<string, { unselected: string; selected: string }> = {
  araz: {
    unselected: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300/80',
    selected: 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/25'
  },
  bravo: {
    unselected: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300/80',
    selected: 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/25'
  },
  bazarstore: {
    unselected: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-300/80',
    selected: 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/25'
  },
  oba: {
    unselected: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-300/80',
    selected: 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-500/25'
  },
  neptun: {
    unselected: 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-300/80',
    selected: 'bg-orange-600 text-white shadow-xs ring-2 ring-orange-500/25'
  },
  rahat: {
    unselected: 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-300/80',
    selected: 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-500/25'
  },
  bolmart: {
    unselected: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300/80',
    selected: 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/25'
  },
  al: {
    unselected: 'bg-yellow-50 text-yellow-900 hover:bg-yellow-100 border border-yellow-300/80',
    selected: 'bg-yellow-500 text-gray-900 shadow-xs ring-2 ring-yellow-400/25'
  },
  tamstore: {
    unselected: 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-300/80',
    selected: 'bg-cyan-600 text-white shadow-xs ring-2 ring-cyan-500/25'
  },
  grandmart: {
    unselected: 'bg-violet-50 text-violet-800 hover:bg-violet-100 border border-violet-300/80',
    selected: 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/25'
  },
  megastore: {
    unselected: 'bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border border-fuchsia-300/80',
    selected: 'bg-fuchsia-600 text-white shadow-xs ring-2 ring-fuchsia-500/25'
  }
};

const FALLBACK_PALETTES = [
  { unselected: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300/80', selected: 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/25' },
  { unselected: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300/80', selected: 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/25' },
  { unselected: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-300/80', selected: 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/25' },
  { unselected: 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-300/80', selected: 'bg-orange-600 text-white shadow-xs ring-2 ring-orange-500/25' },
  { unselected: 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-300/80', selected: 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-500/25' },
  { unselected: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300/80', selected: 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/25' },
  { unselected: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-300/80', selected: 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-500/25' },
  { unselected: 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-300/80', selected: 'bg-cyan-600 text-white shadow-xs ring-2 ring-cyan-500/25' },
  { unselected: 'bg-violet-50 text-violet-800 hover:bg-violet-100 border border-violet-300/80', selected: 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/25' },
  { unselected: 'bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border border-fuchsia-300/80', selected: 'bg-fuchsia-600 text-white shadow-xs ring-2 ring-fuchsia-500/25' },
  { unselected: 'bg-lime-50 text-lime-900 hover:bg-lime-100 border border-lime-300/80', selected: 'bg-lime-600 text-white shadow-xs ring-2 ring-lime-500/25' },
  { unselected: 'bg-pink-50 text-pink-800 hover:bg-pink-100 border border-pink-300/80', selected: 'bg-pink-600 text-white shadow-xs ring-2 ring-pink-500/25' },
];

const getMarketButtonStyle = (market: MarketData, index: number, isSelected: boolean) => {
  const normId = (market.id || '').toLowerCase().trim().replace(/\s+market$/i, '').replace(/\s+/g, '');
  const normName = (market.name || '').toLowerCase().trim().replace(/\s+market$/i, '').replace(/\s+/g, '');
  const theme = (market.themeColor || '').toLowerCase();

  const matched = 
    MARKET_COLOR_STYLES[normId] || 
    MARKET_COLOR_STYLES[normName] || 
    MARKET_COLOR_STYLES[theme] || 
    FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];

  return isSelected ? matched.selected : matched.unselected;
};

// Normalize Azerbaijani & Turkish letters for fuzzy search: cips == Çips, yag == yağ, e == ə, u == ü, s == ş, etc.
const normalizeTextForSearch = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c');
};

interface InstagramThumbnailProps {
  postUrl: string;
  index: number;
  marketIndex?: number;
  onClick: () => void;
}

const InstagramThumbnail: React.FC<InstagramThumbnailProps> = ({ postUrl, index, marketIndex = 0, onClick }) => {
  const isInstagram = postUrl.includes('instagram.com');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [isLoaded, setIsLoaded] = useState(false);
  // İlk 2 marketin ilk 2 postu dərhal, digərləri isə ekrana yaxınlaşdıqda yüklənsin
  const isPriority = marketIndex < 2 && index < 2;
  const [isVisible, setIsVisible] = useState(isPriority);

  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' } // ekrana 300px qalmış yükləməyə başla
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    if (!isInstagram || !containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setScale(width / 320);
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isInstagram]);

  return (
    <div 
      ref={containerRef}
      onClick={onClick}
      className="w-full aspect-square rounded-lg sm:rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-all bg-gray-100 relative group/ig border border-gray-100 shadow-2xs hover:shadow-xs hover:scale-[1.03] active:scale-95"
    >
      {/* Loading Spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 animate-spin" />
        </div>
      )}

      {isVisible ? (
        isInstagram ? (
          <div className="w-full h-full relative overflow-hidden bg-gray-100 flex items-center justify-center pointer-events-none">
            {/* Scaled Instagram Embed Viewport */}
            <div 
              className="absolute top-0 left-0 origin-top-left pointer-events-none"
              style={{
                width: '320px',
                height: '320px',
                transform: `scale(${scale})`,
              }}
            >
              {/* Shifted so top Instagram header (52px) is hidden, framing the square image */}
              <div className="absolute top-[-52px] left-0 w-[320px] h-[430px]">
                <iframe 
                  src={getEmbedUrl(postUrl)}
                  loading={isPriority ? "eager" : "lazy"}
                  className="w-full h-full border-none pointer-events-none"
                  scrolling="no"
                  title={`Instagram Fürsət ${index + 1}`}
                  onLoad={() => setIsLoaded(true)}
                />
              </div>
            </div>

            {/* Clickable overlay & hover effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-transparent to-transparent opacity-0 group-hover/ig:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ) : (
          <div className="w-full h-full relative">
            <img 
              src={postUrl} 
              alt={`Fürsət ${index + 1}`} 
              loading="lazy"
              className="w-full h-full object-cover group-hover/ig:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer"
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/174/174855.png";
                setIsLoaded(true);
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-transparent opacity-0 group-hover/ig:opacity-100 transition-opacity pointer-events-none" />
          </div>
        )
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
          <Instagram className="w-4 h-4 text-gray-300" />
        </div>
      )}

      {/* Index badge */}
      <div className="absolute bottom-1 right-1 z-10 bg-black/55 backdrop-blur-xs text-white text-[7px] sm:text-[8px] font-bold px-1 py-0.2 rounded select-none pointer-events-none">
        #{index + 1}
      </div>
    </div>
  );
};

interface InstagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: string[];
  marketName: string;
  initialIndex?: number;
}

const InstagramViewer: React.FC<InstagramModalProps> = ({ isOpen, onClose, posts, marketName, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const [showRedirectConfirm, setShowRedirectConfirm] = useState(false);

  // Modal açılanda və ya market dəyişəndə sıfırla
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsInitialLoaded(false);
      setShowRedirectConfirm(false);

      const timer = setTimeout(() => {
        setIsInitialLoaded(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, marketName, initialIndex]);

  if (!isOpen || !posts || posts.length === 0) return null;

  // Növbəti posta keçid
  const handleNext = () => {
    if (posts.length <= 1) return;
    setShowRedirectConfirm(false);
    setCurrentIndex(prev => (prev < posts.length - 1 ? prev + 1 : 0));
  };

  // Əvvəlki posta keçid
  const handlePrev = () => {
    if (posts.length <= 1) return;
    setShowRedirectConfirm(false);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : posts.length - 1));
  };

  const currentPostUrl = posts[currentIndex] || '';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Container with Floating Navigation for larger screens */}
      <div className="relative flex items-center justify-center w-full max-w-[480px] sm:max-w-[540px]">
        {/* Floating Left Button for desktop */}
        {posts.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="hidden sm:flex absolute -left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-xl items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 border border-gray-100"
            title="Əvvəlki"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}

        <div className="relative w-full bg-white rounded-2xl sm:rounded-[24px] overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out] flex flex-col border border-gray-100 max-h-[92vh]">
          
          {/* Header - Təmiz və minimal */}
          <div className="px-3.5 py-2.5 flex items-center justify-between shrink-0 bg-white border-b border-gray-50 select-none">
            <div className="flex items-center gap-1.5 min-w-0">
               <div className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></div>
               <h3 className="text-[11px] font-black text-gray-800 tracking-tight uppercase truncate">{marketName}</h3>
               {posts.length > 1 && (
                 <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                   {currentIndex + 1}/{posts.length}
                 </span>
               )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {currentPostUrl && currentPostUrl.includes('instagram.com') && (
                <button 
                  type="button"
                  onClick={() => setShowRedirectConfirm(true)}
                  className="p-1.5 hover:bg-pink-50 rounded-full text-gray-400 hover:text-pink-600 transition-colors cursor-pointer"
                  title="Instagram-da aç"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visual Content (4:5 Ratio) - Karuselə toxunmaq və şəkilləri vərəqləmək aktivdir */}
          <div className="relative w-full bg-white overflow-hidden shrink-0 select-none" style={{ aspectRatio: '4/5' }}>
            {/* Clickable overlay to ask confirmation before redirecting to Instagram */}
            <div 
              onClick={() => {
                if (currentPostUrl) {
                  setShowRedirectConfirm(true);
                }
              }}
              className="absolute inset-0 z-30 cursor-pointer"
              title="Instagram postuna baxmaq üçün toxunun"
            />

            {/* Multi-Slide Track */}
            <div className="w-full h-full relative">
              {posts.map((postUrl, idx) => {
                const offset = idx - currentIndex;
                const isCurrent = offset === 0;
                // Only mount iframe for active slide and adjacent slides (±1) to prevent lag and rate limits
                const shouldRenderContent = Math.abs(offset) <= 1;
                const isIg = postUrl.includes('instagram.com');
                return (
                  <div 
                    key={`${marketName}-${postUrl}-${idx}`}
                    className={`absolute inset-0 w-full h-full ${isCurrent ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    style={{
                      transform: `translateX(${offset * 100}%)`,
                      transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {shouldRenderContent ? (
                      isIg ? (
                        <div className="absolute top-[-52px] left-0 w-full h-[calc(100%+110px)] pointer-events-none">
                          <iframe 
                            src={getEmbedUrl(postUrl)}
                            className="w-full h-full border-none pointer-events-none"
                            scrolling="no"
                            loading={isCurrent ? "eager" : "lazy"}
                            title={`Instagram Post ${idx + 1}`}
                            onLoad={() => {
                              if (idx === currentIndex || idx === initialIndex) {
                                setIsInitialLoaded(true);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 pointer-events-none">
                          <img 
                            src={postUrl} 
                            alt={`Fürsət ${idx + 1}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onLoad={() => {
                              if (idx === currentIndex || idx === initialIndex) {
                                setIsInitialLoaded(true);
                              }
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/174/174855.png";
                              setIsInitialLoaded(true);
                            }}
                          />
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <Instagram className="w-6 h-6 text-gray-200" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Simple Loading Spinner */}
            {!isInitialLoaded && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 select-none pointer-events-none">
                <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
              </div>
            )}
            
            {/* Confirmation Overlay when clicking post */}
            {showRedirectConfirm && (
              <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xl max-w-xs w-full text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mb-3">
                    <Instagram className="w-6 h-6" />
                  </div>
                  <p className="text-sm sm:text-base font-black text-gray-900 mb-1">
                    İnstagram-a yönləndirilsin?
                  </p>
                  <p className="text-xs text-gray-500 mb-5">
                    Post İnstagram səhifəsində açılacaq
                  </p>
                  <div className="flex items-center justify-center gap-6 w-full">
                    {/* Red Icon: NO */}
                    <button
                      type="button"
                      onClick={() => setShowRedirectConfirm(false)}
                      className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer"
                      title="Xeyr"
                    >
                      <X className="w-6 h-6 stroke-[2.5]" />
                    </button>

                    {/* Green Icon: YES */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowRedirectConfirm(false);
                        if (currentPostUrl) {
                          window.open(currentPostUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer"
                      title="Bəli"
                    >
                      <Check className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edge Masks */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white z-40 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white z-40 pointer-events-none"></div>
          </div>

          {/* Navigation for multiple posts */}
          {posts.length > 1 && (
            <div className="px-4 py-2.5 bg-gray-50/90 flex items-center justify-between border-t border-gray-100 select-none">
               <button 
                 onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                 className="p-1.5 hover:bg-gray-200 active:scale-95 rounded-lg text-gray-500 transition-transform"
                 title="Sola"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
               <div className="flex items-center gap-1">
                 {posts.map((_, idx) => (
                   <button
                     key={idx}
                     onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                     className={`h-1.5 rounded-full transition-all ${
                       idx === currentIndex ? 'w-4 bg-pink-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                     }`}
                     title={`${idx + 1}-ci post`}
                   />
                 ))}
               </div>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleNext(); }}
                 className="p-1.5 hover:bg-gray-200 active:scale-95 rounded-lg text-gray-500 transition-transform"
                 title="Sağa"
               >
                 <ChevronRight className="w-4 h-4" />
               </button>
            </div>
          )}
        </div>

        {/* Floating Right Button for desktop */}
        {posts.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-800 shadow-xl items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 border border-gray-100"
            title="Növbəti"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
};

interface ViewState {
  activeMarketId: string | null;
  showCheaperOnly: boolean;
  searchQuery: string;
  showFavorites: boolean;
}

const normalizeMarketProduct = (p: DiscountProduct): DiscountProduct => {
  const exp = 
    p.expiryDate || 
    (p as any).bitis || 
    (p as any).bitisTarixi || 
    (p as any).bitis_tarixi || 
    (p as any).bitis_tarix || 
    (p as any).endDate || 
    (p as any).end_date || 
    (p as any).expiry_date || 
    (p as any).son_tarix || 
    (p as any).sonTarix;
  return {
    ...p,
    expiryDate: exp ? String(exp).trim() : undefined,
    bitis: (p as any).bitis || (exp ? String(exp).trim() : undefined)
  };
};

const migrateMarketData = (incomingMarkets: MarketData[]): MarketData[] => {
  const migrated = (incomingMarkets || []).map(m => {
    let overrideColor = m.themeColor;
    if (m.id === 'araz') overrideColor = 'amber';
    if (m.id === 'oba') overrideColor = 'green';
    
    let overrideLogoUrl = m.logoUrl;
    if (m.id === 'araz' || m.name.toLowerCase().includes('araz')) {
      overrideLogoUrl = 'https://b7x9kq.arazmarket.az/storage/news/dsc_9152.jpg';
    }
    if (m.name.toLowerCase().includes('rahat')) {
      overrideLogoUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTsEY6AAE18u9Y57PHT9fxiujtBzAMxNFVtZl7TgONVA&s=10';
    }
    
    const normProducts = (m.products || []).map(normalizeMarketProduct);
    let updatedMarket: MarketData = { 
      ...m, 
      themeColor: overrideColor, 
      logoUrl: overrideLogoUrl,
      products: normProducts
    };

    if (!updatedMarket.catalogs) updatedMarket.catalogs = [];

    // Normalize products inside existing catalogs
    updatedMarket.catalogs = updatedMarket.catalogs.map(c => {
      const cProds = (c.products || []).map(normalizeMarketProduct);
      let cEndDate = c.endDate;
      if (!cEndDate) {
        const dates = cProds.map(p => p.expiryDate || (p as any).bitis).filter(Boolean) as string[];
        if (dates.length > 0) cEndDate = dates.sort()[dates.length - 1];
      }
      return {
        ...c,
        products: cProds,
        endDate: cEndDate
      };
    });

    if (updatedMarket.catalogs.length === 0 && normProducts.length > 0) {
      const dates = normProducts.map(p => p.expiryDate || (p as any).bitis).filter(Boolean) as string[];
      const catalogEndDate = dates.length > 0 ? dates.sort()[dates.length - 1] : undefined;
      return {
        ...updatedMarket,
        catalogs: [{
          id: 'main',
          name: 'Əsas Kataloq',
          products: normProducts,
          lastUpdated: updatedMarket.lastUpdated || new Date().toISOString(),
          url: updatedMarket.url,
          endDate: catalogEndDate
        }]
      };
    }
    return updatedMarket;
  });

  return sortMarketsByOrder(migrated);
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => {
    try {
      const saved = localStorage.getItem('supabaseConfig');
      if (saved) return JSON.parse(saved);
      return { supabaseUrl: DEFAULT_SUPABASE_URL, supabaseKey: DEFAULT_SUPABASE_KEY };
    } catch { return { supabaseUrl: DEFAULT_SUPABASE_URL, supabaseKey: DEFAULT_SUPABASE_KEY }; }
  });

  const [isCloudConnected, setIsCloudConnected] = useState(() => {
    if (supabaseConfig) return supabaseService.initializeSupabase(supabaseConfig);
    return false;
  });

  const [markets, setMarkets] = useState<MarketData[]>(() => {
    try {
      const saved = localStorage.getItem('marketData_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return migrateMarketData(parsed);
        }
      }
    } catch (e) {}
    return INITIAL_MARKETS;
  });
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      const saved = localStorage.getItem('endirim_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('endirim_favorites', JSON.stringify(favorites)); }
    catch (e) {}
  }, [favorites]);
  
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  const [activeCatalogByMarket, setActiveCatalogByMarket] = useState<Record<string, string>>({});
  const [visibleDetailCount, setVisibleDetailCount] = useState(24);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const featuredCarouselRef = useRef<HTMLDivElement | null>(null);

  const [carouselActiveIndex, setCarouselActiveIndex] = useState(0);

  const scrollFeaturedCarousel = (direction: 'left' | 'right') => {
    if (featuredCarouselRef.current) {
      const scrollAmount = featuredCarouselRef.current.clientWidth * 0.75;
      featuredCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleCarouselScroll = () => {
    if (featuredCarouselRef.current) {
      const el = featuredCarouselRef.current;
      const scrollLeft = el.scrollLeft;
      const firstChild = el.firstElementChild as HTMLElement | null;
      const itemWidth = firstChild ? firstChild.offsetWidth + 8 : 150;
      const index = Math.round(scrollLeft / itemWidth);
      setCarouselActiveIndex(Math.max(0, index));
    }
  };

  const parsePriceNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isNaN(val) ? NaN : val;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(str);
  };

  const getProductDiscountPercent = (p: DiscountProduct): number => {
    if (p.discountPercentage) {
      const cleaned = String(p.discountPercentage).replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
    const oldP = parsePriceNumber(p.oldPrice);
    const newP = parsePriceNumber(p.newPrice);
    if (!isNaN(oldP) && !isNaN(newP) && oldP > newP && oldP > 0) {
      return Math.round(((oldP - newP) / oldP) * 100);
    }
    return 0;
  };

  const handleSelectMarket = (marketId: string | null) => {
    setActiveMarketId(marketId);
    setSelectedCategoryFilter(null);
    setActiveCategoryDropdown(null);
    setIsMarketSwitcherOpen(false);
    setVisibleDetailCount(24);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const [banner1, setBanner1] = useState<BannerData>(INITIAL_BANNER_1);
  const [banner2, setBanner2] = useState<BannerData>(INITIAL_BANNER_2);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(''); 
  const [maxPrice, setMaxPrice] = useState<string>(''); 
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState<string>(''); 
  const [showCheaperOnly, setShowCheaperOnly] = useState(false);
  const [deferredCheaperOnly, setDeferredCheaperOnly] = useState(false);
  const [isProcessingCheaper, setIsProcessingCheaper] = useState(false);
  const [visibleProductCount, setVisibleProductCount] = useState(20);
  const cheaperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [activeBannerId, setActiveBannerId] = useState<'banner-1' | 'banner-2'>('banner-1');
  const [isAddMarketModalOpen, setIsAddMarketModalOpen] = useState(false);
  const [isSocialDealsModalOpen, setIsSocialDealsModalOpen] = useState(false);
  const [marketToEdit, setMarketToEdit] = useState<MarketData | null>(null);
  const [productToEdit, setProductToEdit] = useState<{product: DiscountProduct, index: number, catalogId?: string} | null>(null);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  const [viewProduct, setViewProduct] = useState<{
    product: DiscountProduct;
    marketName: string;
    marketId?: string;
    catalogEndDate?: string;
    productList?: { product: DiscountProduct; marketName: string; marketId?: string; catalogEndDate?: string }[];
    currentIndex?: number;
  } | null>(null);

  const handleSelectIndexInModal = (newIdx: number) => {
    setViewProduct(prev => {
      if (!prev || !prev.productList || newIdx < 0 || newIdx >= prev.productList.length) return prev;
      const item = prev.productList[newIdx];
      return {
        ...prev,
        product: item.product,
        marketName: item.marketName,
        marketId: item.marketId,
        catalogEndDate: item.catalogEndDate,
        currentIndex: newIdx
      };
    });
  };
  const [previousViewState, setPreviousViewState] = useState<ViewState | null>(null);
  const [instagramViewerData, setInstagramViewerData] = useState<{posts: string[], name: string, initialIndex: number} | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<string | null>(null);
  const [isMarketSwitcherOpen, setIsMarketSwitcherOpen] = useState(false);

  const handleShowCheaperOnlyChange = (active: boolean) => {
    if (cheaperTimeoutRef.current) {
        clearTimeout(cheaperTimeoutRef.current);
        cheaperTimeoutRef.current = null;
    }
    setShowCheaperOnly(active);
    if (active) {
      setShowFavorites(false);
      setIsProcessingCheaper(true);
      setDeferredCheaperOnly(false);
      setVisibleProductCount(6); 
      cheaperTimeoutRef.current = setTimeout(() => { setDeferredCheaperOnly(true); }, 50); 
    } else {
      setDeferredCheaperOnly(false);
      setIsProcessingCheaper(false);
      setVisibleProductCount(20);
    }
  };
  
  const handleRefreshComparison = () => {
    setIsProcessingCheaper(true);
    setDeferredCheaperOnly(false);
    setTimeout(() => { setDeferredCheaperOnly(true); }, 500);
  };

  useEffect(() => {
    if (deferredCheaperOnly && isProcessingCheaper) { setIsProcessingCheaper(false); }
  }, [deferredCheaperOnly, isProcessingCheaper]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (showCheaperOnly && deferredCheaperOnly && !isProcessingCheaper) {
        intervalId = setInterval(() => {
            setVisibleProductCount(prev => {
                if (prev > 1000) { clearInterval(intervalId); return prev; }
                return prev + 6;
            });
        }, 50);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [showCheaperOnly, deferredCheaperOnly, isProcessingCheaper]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery || '');
      setDebouncedMaxPrice(maxPrice || '');
      setIsSearching(false);
    }, 500);
    return () => { clearTimeout(handler); };
  }, [searchQuery, maxPrice, showFavorites]); 

  useEffect(() => { 
    if (showFavorites) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
  }, [showFavorites]);

  // Reset lazy load count on market, catalog, or search query change
  useEffect(() => {
    setVisibleDetailCount(24);
  }, [activeMarketId, activeCatalogByMarket, debouncedSearchQuery]);

  // IntersectionObserver for lazy loading products as user scrolls down
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleDetailCount((prev) => prev + 24);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeMarketId, visibleDetailCount, activeCatalogByMarket]);

  // Fallback window scroll listener for reliable infinite scrolling
  useEffect(() => {
    if (!activeMarketId) return;
    const handleScroll = () => {
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 600;
      if (scrollPos >= threshold) {
        setVisibleDetailCount((prev) => prev + 24);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMarketId]);

  useEffect(() => {
    if (supabaseConfig) {
      const success = supabaseService.initializeSupabase(supabaseConfig);
      setIsCloudConnected(success);
    }
  }, [supabaseConfig]);

  useEffect(() => {
    const safetyTimer = setTimeout(() => setIsLoading(false), 2000);
    if (isCloudConnected) {
      const unsubMarkets = supabaseService.subscribeToMarkets((data) => {
        if (data && data.length > 0) {
          const migrated = migrateMarketData(data);
          setMarkets(migrated);
          try { localStorage.setItem('marketData_v2', JSON.stringify(migrated)); } catch (e) {}
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      });
      const unsubBanners = supabaseService.subscribeToBanners((b1, b2) => {
        if (b1) setBanner1(b1);
        if (b2) setBanner2(b2);
      });
      return () => { unsubMarkets(); unsubBanners(); clearTimeout(safetyTimer); };
    } else {
      try {
        const savedMarkets = localStorage.getItem('marketData_v2');
        if (savedMarkets) {
          const parsed = JSON.parse(savedMarkets);
          setMarkets(migrateMarketData(parsed));
        }
        const savedB1 = localStorage.getItem('bannerData1');
        if (savedB1) setBanner1(JSON.parse(savedB1));
        const savedB2 = localStorage.getItem('bannerData2');
        if (savedB2) setBanner2(JSON.parse(savedB2));
      } catch (e) {
        console.error(e);
      } finally { 
        setIsLoading(false); 
        clearTimeout(safetyTimer); 
      }
    }
  }, [isCloudConnected]);

  const persistData = (newMarkets: MarketData[], newB1: BannerData, newB2: BannerData) => {
    if (isCloudConnected) {
      supabaseService.saveMarkets(newMarkets);
      supabaseService.saveBanners(newB1, newB2);
    } else {
      localStorage.setItem('marketData_v2', JSON.stringify(newMarkets));
      localStorage.setItem('bannerData1', JSON.stringify(newB1));
      localStorage.setItem('bannerData2', JSON.stringify(newB2));
    }
  };

  const updateMarketsState = (fn: (prev: MarketData[]) => MarketData[]) => {
    setMarkets(prev => {
      const newState = fn(prev);
      persistData(newState, banner1, banner2);
      return newState;
    });
  };

  const updateBannerState = (b1: BannerData, b2: BannerData) => {
    setBanner1(b1);
    setBanner2(b2);
    persistData(markets, b1, b2);
  };

  const sortedMarkets = useMemo(() => sortMarketsByOrder(markets), [markets]);

  // One consistent sample product from each market, horizontally scrollable (deterministic so it doesn't jump randomly)
  const sampleFeaturedProducts = useMemo(() => {
    const list: { product: DiscountProduct; market: MarketData }[] = [];
    const usedMarkets = new Set<string>();

    for (const m of sortedMarkets) {
      const prods = (m.catalogs && m.catalogs.length > 0)
        ? m.catalogs.flatMap(c => c.products || [])
        : (m.products || []);
      
      const validProducts = prods.filter(p => p.productName && p.newPrice && p.newPrice !== '---');
      if (validProducts.length > 0) {
        // Deterministically pick the first valid product with an image (or fallback to first valid product)
        const candidate = validProducts.find(p => !!p.customImageUrl) || validProducts[0];
        list.push({ product: candidate, market: m });
        usedMarkets.add(m.id);
      }
    }

    // Default sample fallbacks ONLY if no products exist at all in any market
    if (list.length === 0) {
      const fallbackSamples = [
        {
          marketId: 'oba',
          marketName: 'Oba Market',
          themeColor: 'green',
          logoUrl: 'https://seeklogo.com/images/O/oba-market-logo-3626297371-seeklogo.com.png',
          product: {
            id: 'sample-oba',
            productName: 'Tamdad gürcü xəngəli 600 q',
            category: 'Qida & Paxlalılar' as const,
            newPrice: '4.99',
            oldPrice: '7.99',
            discountPercentage: '-38%',
            customImageUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=400&auto=format&fit=crop&q=80'
          }
        },
        {
          marketId: 'araz',
          marketName: 'Araz Market',
          themeColor: 'amber',
          logoUrl: 'https://b7x9kq.arazmarket.az/storage/news/dsc_9152.jpg',
          product: {
            id: 'sample-araz',
            productName: 'Tamdad düşbərə dana əti ilə 400 q',
            category: 'Qida & Paxlalılar' as const,
            newPrice: '3.99',
            oldPrice: '5.59',
            discountPercentage: '-29%',
            customImageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80'
          }
        },
        {
          marketId: 'bravo',
          marketName: 'Bravo',
          themeColor: 'amber',
          logoUrl: 'https://bravosupermarket.az/img/bravo-logo.png',
          product: {
            id: 'sample-bravo',
            productName: 'Tamdad gürzə dana əti ilə 400 q',
            category: 'Qida & Paxlalılar' as const,
            newPrice: '4.50',
            oldPrice: '6.25',
            discountPercentage: '-28%',
            customImageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&auto=format&fit=crop&q=80'
          }
        }
      ];

      for (const fallback of fallbackSamples) {
        const matchedMarket = sortedMarkets.find(m => m.id === fallback.marketId) || {
          id: fallback.marketId,
          name: fallback.marketName,
          lastUpdated: new Date().toISOString(),
          products: [],
          catalogs: [],
          url: '',
          themeColor: fallback.themeColor,
          logoPlaceholder: fallback.marketName[0],
          logoUrl: fallback.logoUrl,
          instagramPosts: []
        };
        list.push({ product: fallback.product, market: matchedMarket });
      }
    }

    return list;
  }, [sortedMarkets]);

  const currentMarket = activeMarketId ? sortedMarkets.find(m => m.id === activeMarketId) : null;
  const currentCatalogs = currentMarket?.catalogs || [];
  const resolvedActiveCatalogId = activeCatalogId && currentCatalogs.find(c => c.id === activeCatalogId) 
      ? activeCatalogId 
      : (currentCatalogs.length > 0 ? currentCatalogs[0].id : null);
  const currentCatalog = currentCatalogs.find(c => c.id === resolvedActiveCatalogId);
  const currentProducts = currentCatalog?.products || currentMarket?.products || [];
  const accentColor = currentMarket?.themeColor || 'green';

  const productPriceIndex = useMemo(() => {
    const index = new Map<string, { price: number; marketId: string }[]>();
    markets.forEach(m => {
        const prods = m.catalogs ? m.catalogs.flatMap(c => c.products) : (m.products || []);
        prods.forEach(p => {
            const name = (p.productName || '').trim().toLowerCase();
            const price = parsePriceNumber(p.newPrice);
            if (!isNaN(price) && name) {
                if (!index.has(name)) index.set(name, []);
                index.get(name)!.push({ price, marketId: m.id });
            }
        });
    });
    return index;
  }, [markets]);

  const checkForCheaperAlternative = (currentProduct: DiscountProduct, currentMarketId: string): boolean => {
    const name = (currentProduct.productName || '').trim().toLowerCase();
    const currentPrice = parsePriceNumber(currentProduct.newPrice);
    if (isNaN(currentPrice) || !name) return false;
    const alternatives = productPriceIndex.get(name);
    if (!alternatives) return false;
    for (const alt of alternatives) {
        if (alt.marketId !== currentMarketId && alt.price < currentPrice) return true;
    }
    return false;
  };

  const groupedOpportunities = useMemo(() => {
      if (!deferredCheaperOnly) return [];
      const groups = new Map<string, {
          productName: string,
          category: any,
          imageUrl?: string,
          variants: Array<{
              marketId: string,
              marketName: string,
              price: number,
              originalPriceStr: string,
              logoUrl?: string,
              logoPlaceholder: string,
              themeColor: string
          }>
      }>();
      markets.forEach(market => {
          const allProds = market.catalogs ? market.catalogs.flatMap(c => c.products) : (market.products || []);
          allProds.forEach(p => {
             if (debouncedSearchQuery.length > 0) {
               const pNorm = normalizeTextForSearch(p.productName || '');
               const qNorm = normalizeTextForSearch(debouncedSearchQuery);
               if (!pNorm.includes(qNorm)) return;
             }
             const normalizedName = (p.productName || '').trim().toLowerCase();
             if (!normalizedName) return;
             const priceVal = parsePriceNumber(p.newPrice);
             if (isNaN(priceVal)) return;
             if (debouncedMaxPrice) {
                 const limit = parsePriceNumber(debouncedMaxPrice);
                 if (!isNaN(limit) && priceVal > limit) return;
             }
             if (!groups.has(normalizedName)) {
                 groups.set(normalizedName, {
                     productName: p.productName,
                     category: p.category,
                     imageUrl: p.customImageUrl,
                     variants: []
                 });
             }
             const group = groups.get(normalizedName)!;
             const existingVariantIndex = group.variants.findIndex(v => v.marketId === market.id);
             const variantData = {
                 marketId: market.id,
                 marketName: market.name,
                 price: priceVal,
                 originalPriceStr: String(p.newPrice ?? ''),
                 logoUrl: market.logoUrl,
                 logoPlaceholder: market.logoPlaceholder,
                 themeColor: market.themeColor
             };
             if (existingVariantIndex !== -1) {
                 if (priceVal < group.variants[existingVariantIndex].price) {
                     group.variants[existingVariantIndex] = variantData;
                 }
             } else { group.variants.push(variantData); }
             if (p.customImageUrl && !group.imageUrl) group.imageUrl = p.customImageUrl;
          });
      });
      const results = Array.from(groups.values()).filter(g => {
          if (g.variants.length < 2) return false;
          const prices = g.variants.map(v => v.price);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          return maxP > minP;
      });
      return results.sort((a,b) => (a.productName || '').localeCompare(b.productName || ''));
  }, [markets, deferredCheaperOnly, debouncedSearchQuery, debouncedMaxPrice]);
  
  const isFavorite = (productName: string, marketId: string) => {
    return favorites.some(f => f.productName === productName && f.marketId === marketId);
  };

  const toggleFavorite = (product: DiscountProduct, marketId: string) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.productName === product.productName && f.marketId === marketId);
      let newFavorites;
      if (exists) newFavorites = prev.filter(f => !(f.productName === product.productName && f.marketId === marketId));
      else newFavorites = [...prev, { ...product, marketId, addedAt: Date.now() }];
      return newFavorites;
    });
  };

  const ensureFavorite = (product: DiscountProduct, marketId: string) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.productName === product.productName && f.marketId === marketId);
      if (exists) return prev;
      return [...prev, { ...product, marketId, addedAt: Date.now() }];
    });
  };

  const filteredMarketData = useMemo(() => {
    if (showFavorites || deferredCheaperOnly) return [];
    return sortedMarkets
      .filter(m => { if (activeMarketId) return m.id === activeMarketId; return true; })
      .map(market => {
        const allProducts = market.catalogs ? market.catalogs.flatMap(c => c.products) : (market.products || []);
        const results = allProducts.filter(product => {
            if (debouncedSearchQuery.length > 0) {
              const pNorm = normalizeTextForSearch(product.productName || '');
              const qNorm = normalizeTextForSearch(debouncedSearchQuery);
              if (!pNorm.includes(qNorm)) return false;
            }
            if (debouncedMaxPrice) {
                const price = parsePriceNumber(product.newPrice);
                const limit = parsePriceNumber(debouncedMaxPrice);
                if (!isNaN(price) && !isNaN(limit) && price > limit) return false;
            }
            return true;
        });
        const productsWithMeta = results.map(p => ({ ...p, _hasCheaper: checkForCheaperAlternative(p, market.id) }));
        return { ...market, filteredProducts: productsWithMeta };
      })
      .filter(m => m.filteredProducts.length > 0 || (activeMarketId && m.id === activeMarketId)); 
  }, [sortedMarkets, debouncedSearchQuery, debouncedMaxPrice, deferredCheaperOnly, activeMarketId, showFavorites, productPriceIndex]);

  const filterProductForDetail = (product: DiscountProduct) => {
     if (debouncedSearchQuery.length > 0) {
       const pNorm = normalizeTextForSearch(product.productName || '');
       const qNorm = normalizeTextForSearch(debouncedSearchQuery);
       if (!pNorm.includes(qNorm)) return false;
     }
     return true;
  };
  
  const filteredProductsForDetail = currentProducts.filter(filterProductForDetail);

  const getCatalogDateStatus = (catalog?: Catalog) => {
     if (!catalog || !catalog.startDate || !catalog.endDate) return { isActive: true, label: null };
     const now = new Date();
     const start = new Date(catalog.startDate);
     const end = new Date(catalog.endDate);
     end.setHours(23, 59, 59);
     if (now > end) return { isActive: false, label: 'Endirim müddəti bitdi' };
     if (now < start) return { isActive: false, label: 'Başlamayıb' };
     const diffTime = end.getTime() - now.getTime();
     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
     const label = diffDays <= 1 ? 'Bu gün bitir' : `${diffDays} gün qaldı`;
     return { isActive: true, label };
  };

  const handleStreamStart = () => { setIsStreaming(true); };

  const handleStreamUpdate = (updatedProductsList: DiscountProduct[], catalogId: string, catalogName: string, startDate?: string, endDate?: string) => {
    if (activeMarketId) {
      updateMarketsState(prev => prev.map(m => {
        if (m.id === activeMarketId) {
          const newCatalogs = m.catalogs ? [...m.catalogs] : [];
          const catIndex = newCatalogs.findIndex(c => c.id === catalogId);
          if (catIndex >= 0) {
            newCatalogs[catIndex] = {
              ...newCatalogs[catIndex],
              products: updatedProductsList,
              lastUpdated: new Date().toISOString(),
              startDate: startDate || newCatalogs[catIndex].startDate,
              endDate: endDate || newCatalogs[catIndex].endDate
            };
          } else {
            newCatalogs.push({
              id: catalogId,
              name: catalogName,
              products: updatedProductsList,
              lastUpdated: new Date().toISOString(),
              startDate,
              endDate
            });
          }
          return { ...m, catalogs: newCatalogs, lastUpdated: new Date().toISOString() };
        }
        return m;
      }));
      setActiveCatalogId(catalogId);
    }
  };

  const handleStreamEnd = (newUrl?: string, catalogId?: string) => {
    setIsStreaming(false);
    updateMarketsState(prev => {
        if (newUrl && activeMarketId && catalogId) {
             return prev.map(m => {
                if (m.id === activeMarketId) {
                     const newCatalogs = m.catalogs ? [...m.catalogs] : [];
                     const catIndex = newCatalogs.findIndex(c => c.id === catalogId);
                     if (catIndex >= 0) newCatalogs[catIndex].url = newUrl;
                     return { ...m, catalogs: newCatalogs };
                }
                return m;
             });
        }
        return prev;
    });
  };

  const handleLogoUpdate = (newLogoUrl: string) => {
    if (activeMarketId) {
      updateMarketsState(prev => prev.map(m => {
        if (m.id === activeMarketId) return { ...m, logoUrl: newLogoUrl };
        return m;
      }));
    }
  };

  const handleAdminClick = () => {
    if (isAdmin) { if(window.confirm("Çıxış etmək istəyirsiniz?")) setIsAdmin(false); }
    else setIsLoginModalOpen(true);
  };

  const handleAddMarket = (newMarket: MarketData) => {
    updateMarketsState(prev => [...prev, newMarket]);
    setActiveMarketId(newMarket.id);
  };

  const handleDeleteMarket = (marketId: string) => {
    updateMarketsState(prev => prev.filter(m => m.id !== marketId));
    if (activeMarketId === marketId) setActiveMarketId(null);
    setMarketToEdit(null);
  };

  const handleUpdateMarket = (updatedMarket: MarketData) => {
    updateMarketsState(prev => prev.map(m => {
      if (m.id === updatedMarket.id) {
        return { ...m, ...updatedMarket };
      }
      return m;
    }));
    setMarketToEdit(null);
  };

  const handleDeleteCatalog = (catalogId: string) => {
     if (!activeMarketId) return;
     if (window.confirm("Bu kataloqu silmək istədiyinizə əminsiniz?")) {
        updateMarketsState(prev => prev.map(m => {
            if (m.id === activeMarketId) return { ...m, catalogs: m.catalogs?.filter(c => c.id !== catalogId) || [] };
            return m;
        }));
        setActiveCatalogId(null); 
     }
  };

  const handleUpdateProduct = (updatedProduct: DiscountProduct) => {
    if (!productToEdit || !activeMarketId || !productToEdit.catalogId) return;
    updateMarketsState(prev => prev.map(m => {
      if (m.id === activeMarketId) {
        const newCatalogs = m.catalogs ? [...m.catalogs] : [];
        const catIndex = newCatalogs.findIndex(c => c.id === productToEdit.catalogId);
        if (catIndex >= 0) {
            const products = [...newCatalogs[catIndex].products];
            if (productToEdit.index === -1) { // -1 means adding new
                products.unshift(updatedProduct);
            } else if (products[productToEdit.index]) {
                products[productToEdit.index] = updatedProduct;
            }
            newCatalogs[catIndex] = { ...newCatalogs[catIndex], products };
        }
        return { ...m, catalogs: newCatalogs };
      }
      return m;
    }));
    setProductToEdit(null);
  };
  
  const handleAddProductManually = () => {
      if (!resolvedActiveCatalogId) return;
      setProductToEdit({
          product: { productName: '', oldPrice: '', newPrice: '', discountPercentage: '', category: 'Digər' },
          index: -1,
          catalogId: resolvedActiveCatalogId
      });
  };

  const handleEditFromSearch = (product: DiscountProduct, marketId: string) => {
      const market = markets.find(m => m.id === marketId);
      if(!market) return;
      if(market.catalogs) {
          for(const cat of market.catalogs) {
              const idx = cat.products.findIndex(p => p.productName === product.productName && p.newPrice === product.newPrice);
              if(idx !== -1) {
                  setActiveMarketId(marketId);
                  setProductToEdit({ product, index: idx, catalogId: cat.id });
                  return;
              }
          }
      }
  };

  const saveDatabaseConfig = (config: SupabaseConfig) => {
    localStorage.setItem('supabaseConfig', JSON.stringify(config));
    setSupabaseConfig(config);
    window.location.reload(); 
  };

  const handleCompareClick = (targetMarketId: string, productName: string) => {
    setPreviousViewState({ activeMarketId, showCheaperOnly, searchQuery, showFavorites });
    handleShowCheaperOnlyChange(false);
    setShowFavorites(false);
    setSearchQuery(productName);
    setDebouncedSearchQuery(productName);
    setActiveMarketId(targetMarketId);
    setViewProduct(null);
  };

  const handleRestorePreviousView = () => {
      if (previousViewState) {
          setActiveMarketId(previousViewState.activeMarketId);
          handleShowCheaperOnlyChange(previousViewState.showCheaperOnly);
          setShowFavorites(previousViewState.showFavorites);
          setSearchQuery(previousViewState.searchQuery);
          setDebouncedSearchQuery(previousViewState.searchQuery);
          setPreviousViewState(null);
      } else {
        setSearchQuery('');
        setDebouncedSearchQuery('');
        setActiveMarketId(null);
      }
  };

  const handleResetApp = () => {
    setActiveMarketId(null);
    setSelectedCategoryFilter(null);
    setActiveCategoryDropdown(null);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setMaxPrice('');
    setDebouncedMaxPrice('');
    handleShowCheaperOnlyChange(false);
    setShowFavorites(false);
    setIsSearching(false);
    setViewProduct(null);
    setPreviousViewState(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- MOBILE BROWSER & HARDWARE BACK BUTTON NAVIGATION SUPPORT ---
  const currentDepthRef = useRef<number>(0);
  const isInternalNavRef = useRef<boolean>(false);

  // Dynamic sticky header height measurement for sticky category headers
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState<number>(115);

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (stickyHeaderRef.current) {
        const h = stickyHeaderRef.current.offsetHeight;
        if (h > 0) setStickyHeaderHeight(h);
      }
    };
    updateHeaderHeight();
    const ro = new ResizeObserver(updateHeaderHeight);
    if (stickyHeaderRef.current) ro.observe(stickyHeaderRef.current);
    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [activeMarketId, isLoading, showFavorites]);

  // Check if any modal is currently open
  const hasOpenModal = Boolean(
    viewProduct ||
    instagramViewerData ||
    isScannerOpen ||
    isLoginModalOpen ||
    isBannerModalOpen ||
    isAddMarketModalOpen ||
    isSocialDealsModalOpen ||
    marketToEdit ||
    productToEdit ||
    isDatabaseModalOpen
  );

  // Check if search or any subpage view is active
  const isSearchActive = searchQuery.trim() !== '';
  const isSubpageActive = activeMarketId !== null || showFavorites || showCheaperOnly;
  const hasActiveSubpage = Boolean(isSubpageActive || isSearchActive);

  // Target history depth:
  // 0: Root Home page
  // 1: Subpage (market / favorites / cheaper)
  // +1 if Search query is active
  // +1 if Modal is open
  let targetDepth = 0;
  if (isSubpageActive) targetDepth += 1;
  if (isSearchActive) targetDepth += 1;
  if (hasOpenModal) targetDepth += 1;

  const closeAllModals = useCallback(() => {
    setViewProduct(null);
    setInstagramViewerData(null);
    setIsScannerOpen(false);
    setIsLoginModalOpen(false);
    setIsBannerModalOpen(false);
    setIsAddMarketModalOpen(false);
    setIsSocialDealsModalOpen(false);
    setMarketToEdit(null);
    setProductToEdit(null);
    setIsDatabaseModalOpen(false);
  }, []);

  const hasOpenModalRef = useRef(hasOpenModal);
  hasOpenModalRef.current = hasOpenModal;

  const hasActiveSubpageRef = useRef(hasActiveSubpage);
  hasActiveSubpageRef.current = hasActiveSubpage;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const handleResetAppRef = useRef(handleResetApp);
  handleResetAppRef.current = handleResetApp;

  const closeAllModalsRef = useRef(closeAllModals);
  closeAllModalsRef.current = closeAllModals;

  // Initialize and listen for popstate (mobile hardware back button / swipe back gesture)
  useEffect(() => {
    if (!window.history.state || typeof window.history.state.depth !== 'number') {
      window.history.replaceState({ depth: 0 }, '');
      currentDepthRef.current = 0;
    } else {
      currentDepthRef.current = window.history.state.depth;
    }

    const handlePopState = (event: PopStateEvent) => {
      // If navigation was triggered programmatically by in-app button, sync depth and exit
      if (isInternalNavRef.current) {
        isInternalNavRef.current = false;
        currentDepthRef.current = typeof event.state?.depth === 'number' ? event.state.depth : 0;
        return;
      }

      const newDepth = typeof event.state?.depth === 'number' ? event.state.depth : 0;
      const prevDepth = currentDepthRef.current;
      currentDepthRef.current = newDepth;

      // When user presses phone back button (popped from higher depth to lower depth)
      if (newDepth < prevDepth) {
        // 1. If any modal is open, close modal first
        if (hasOpenModalRef.current) {
          closeAllModalsRef.current();
          return;
        }
        // 2. If search is active, clear search field on first back button click!
        if (searchQueryRef.current.trim() !== '') {
          setSearchQuery('');
          setDebouncedSearchQuery('');
          setIsSearching(false);
          return;
        }
        // 3. Otherwise exit market or subpage to root home
        if (hasActiveSubpageRef.current) {
          handleResetAppRef.current();
          return;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize browser history stack with app target depth
  useEffect(() => {
    if (targetDepth > currentDepthRef.current) {
      window.history.pushState({ depth: targetDepth }, '');
      currentDepthRef.current = targetDepth;
    } else if (targetDepth < currentDepthRef.current) {
      const diff = currentDepthRef.current - targetDepth;
      isInternalNavRef.current = true;
      currentDepthRef.current = targetDepth;
      window.history.go(-diff);
    }
  }, [targetDepth]);

  const activeMarketObj = activeMarketId ? (markets.find(m => m.id === activeMarketId) || null) : null;
  const activeMarketCatalogs = activeMarketObj?.catalogs || [];
  const activeSelectedCatId = activeMarketObj ? (activeCatalogByMarket[activeMarketObj.id] || (activeMarketCatalogs[0]?.id || null)) : null;
  const activeMarketCatalog = activeMarketObj ? (activeMarketCatalogs.find(c => c.id === activeSelectedCatId) || (activeMarketCatalogs[0] || null)) : null;
  const activeDateStatus = getCatalogDateStatus(activeMarketCatalog || undefined);
  const activeMarketProducts = activeMarketCatalog ? (activeMarketCatalog.products || []) : (activeMarketObj?.products || []);
  const activeMarketFilteredProducts = activeMarketProducts.filter(filterProductForDetail);

  return (
    <>
      {isLoading && <CartLoading />}

      <div className={`min-h-screen bg-white pb-36 sm:pb-40 font-sans flex flex-col transition-opacity duration-200 ${isLoading ? 'opacity-0 pointer-events-none overflow-hidden h-screen' : 'opacity-100'}`}>
        {/* --- UNIFIED STICKY HEADER & MARKET SWITCHER --- */}
        <div ref={stickyHeaderRef} className="sticky top-0 z-50 bg-white shadow-xs">
          <Header 
            onAdminClick={handleAdminClick} 
            isAdmin={isAdmin} 
            onLogoClick={handleResetApp}
          />

          {/* --- ACTIVE MARKET HEADER (Only when a market is selected) --- */}
          {!isLoading && !showFavorites && activeMarketId !== null && activeMarketObj ? (
            <>
              {isMarketSwitcherOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMarketSwitcherOpen(false);
                  }} 
                />
              )}
              <div className="relative z-50 bg-white/95 backdrop-blur-md border-t border-b border-gray-100 py-1.5 sm:py-2 px-2.5 sm:px-4 shadow-xs">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                  {/* Left: Back to Home + Clickable Market Logo & Name Dropdown */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMarketSwitcherOpen(false);
                        if (searchQuery.trim() !== '') {
                          setSearchQuery('');
                          setDebouncedSearchQuery('');
                          setIsSearching(false);
                        } else {
                          handleSelectMarket(null);
                        }
                      }}
                      className="p-1.5 sm:p-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 rounded-lg sm:rounded-xl border border-gray-200 transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                      title="Geri qayıt"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" strokeWidth={2.5} />
                      <span className="hidden sm:inline text-xs font-bold text-gray-700">Geri</span>
                    </button>

                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategoryDropdown(null);
                          setIsMarketSwitcherOpen(prev => !prev);
                        }}
                        title="Bütün marketləri gör və seç"
                        className="flex items-center gap-2 sm:gap-2.5 min-w-0 text-left rounded-xl px-1.5 py-1 -my-1 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border border-gray-100 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                          {activeMarketObj.logoUrl ? (
                            <img src={activeMarketObj.logoUrl} alt={activeMarketObj.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <span className={`text-${activeMarketObj.themeColor || 'green'}-700 font-bold text-sm sm:text-lg`}>{activeMarketObj.logoPlaceholder}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <h2 className="text-sm sm:text-base md:text-lg font-black text-gray-900 truncate tracking-tight">{activeMarketObj.name}</h2>
                            <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-700 shrink-0 transition-transform duration-200 ${isMarketSwitcherOpen ? 'rotate-180 text-gray-800' : ''}`} />
                            {activeDateStatus.label && (
                              <span className={`hidden sm:inline-block text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${activeDateStatus.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                                {activeDateStatus.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
                              {activeMarketFilteredProducts.length} məhsul
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Market Switcher Dropdown (Category-style list) */}
                      {isMarketSwitcherOpen && (
                        <div className="absolute left-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>Marketlər</span>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setIsMarketSwitcherOpen(false); }}
                              className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {sortedMarkets.map(m => {
                            const mC = m.catalogs || [];
                            const mCatId = activeCatalogByMarket[m.id] || mC[0]?.id;
                            const mCat = mC.find(c => c.id === mCatId) || mC[0];
                            const mProds = mCat ? (mCat.products || []) : (m.products || []);
                            const mCount = mProds.filter(filterProductForDetail).length;
                            const isCurrent = m.id === activeMarketId;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsMarketSwitcherOpen(false);
                                  handleSelectMarket(m.id);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isCurrent 
                                    ? 'bg-gray-100 font-bold text-gray-900' 
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-white border border-gray-200/80 flex items-center justify-center overflow-hidden shrink-0">
                                    {m.logoUrl ? (
                                      <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-0.5" />
                                    ) : (
                                      <span className={`text-${m.themeColor || 'green'}-700 font-bold text-[10px]`}>{m.logoPlaceholder}</span>
                                    )}
                                  </div>
                                  <span className="truncate">{m.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 bg-gray-100 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                  {mCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Admin buttons + View Mode Toggle */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => { setActiveMarketId(activeMarketObj.id); handleAddProductManually(); }} 
                          className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] sm:text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" /> <span className="hidden md:inline">Əllə Əlavə et</span>
                        </button>
                        <button 
                          onClick={() => { setActiveMarketId(activeMarketObj.id); setIsScannerOpen(true); }} 
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] sm:text-xs shadow-2xs transition-all bg-${activeMarketObj.themeColor || 'green'}-600 hover:bg-${activeMarketObj.themeColor || 'green'}-700 text-white active:scale-95`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isStreaming && activeMarketId === activeMarketObj.id ? 'animate-spin' : ''}`} /> <span className="hidden md:inline">Kataloqu Yenilə</span>
                        </button>
                      </>
                    )}

                    {/* View Mode Toggle: 3-column Grid (default) vs 1-column List */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 shrink-0" role="group" aria-label="Görünüş rejimi">
                      <button
                        type="button"
                        onClick={() => setProductViewMode('grid')}
                        className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${
                          productViewMode === 'grid'
                            ? 'bg-white text-emerald-600 shadow-2xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="3-lü cərgə (Grid)"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductViewMode('list')}
                        className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${
                          productViewMode === 'list'
                            ? 'bg-white text-emerald-600 shadow-2xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="Alt-alta siyahı (List)"
                      >
                        <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
        
        {previousViewState && (
           <div className="bg-blue-600 text-white sticky top-[200px] sm:top-[190px] z-40 shadow-md">
               <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-sm font-medium">
                       <ShoppingCart className="w-4 h-4" />
                       <span>Seçilmiş məhsula baxırsınız.</span>
                   </div>
                   <button 
                     onClick={handleRestorePreviousView}
                     className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                   >
                       <ArrowLeft className="w-4 h-4" />
                       Geri Qayıt
                   </button>
               </div>
           </div>
        )}
        
        {isAdmin && (
          <div className="px-4 py-1 text-xs text-center font-bold bg-gray-900 text-white">
            {isCloudConnected ? "Supabase Canlı Bağlantı" : "Lokal Rejim"}
          </div>
        )}

        {isAdmin && (
          <div className="max-w-7xl mx-auto px-4 mt-2 flex justify-end gap-2 flex-wrap">
            <button 
              onClick={() => setIsSocialDealsModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-lg hover:bg-pink-100 transition-colors border border-pink-100 shadow-sm"
            >
              <Instagram className="w-3 h-3" />
              İnstagram Son Paylaşımlar
            </button>
            <button 
              onClick={() => setIsAddMarketModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors border border-green-100"
            >
              <Plus className="w-3 h-3" />
              Yeni Market
            </button>
            <button 
              onClick={() => setIsDatabaseModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
            >
              <Database className="w-3 h-3" />
              Supabase Ayarları
            </button>
          </div>
        )}

        {isStreaming && (
          <div className={`bg-${accentColor}-600 text-white px-4 py-3 shadow-md sticky top-[200px] md:top-[190px] z-50 transition-all`}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Kataloq Taranır...</span>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 md:px-6 pt-1.5 pb-6 md:pt-3 md:pb-8">
          <main className="w-full">
            {!showFavorites && (banner1.isVisible || isAdmin) && (
              <div className="xl:hidden mb-4">
                <Banner banner={banner1} isAdmin={isAdmin} onEdit={() => { setActiveBannerId('banner-1'); setIsBannerModalOpen(true); }} variant="horizontal" />
              </div>
            )}

            {showFavorites ? (
               <div className="animate-[fadeIn_0.5s_ease-out]">
                  <div className="mb-6 flex items-center justify-between gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                       <Heart className="w-6 h-6 text-red-500 fill-current" />
                       Yadda Saxlanılanlar
                    </h2>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80" role="group" aria-label="Görünüş rejimi">
                        <button
                          type="button"
                          onClick={() => setProductViewMode('grid')}
                          className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'grid' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                          title="3-lü cərgə (Grid)"
                        >
                          <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductViewMode('list')}
                          className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'list' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                          title="Alt-alta siyahı (List)"
                        >
                          <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{favorites.length} məhsul</span>
                    </div>
                  </div>
                  {favorites.length > 0 ? (
                    <div className={`${productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4'} transition-all duration-300 ${isSearching ? 'blur-sm opacity-60' : ''}`}>
                       {favorites.map((product, index) => {
                          const market = markets.find(m => m.id === product.marketId);
                          const marketName = market?.name || 'Naməlum Market';
                          const hasCheaper = market ? checkForCheaperAlternative(product, market.id) : false;
                          return (
                            <div key={`${product.marketId}-${product.productName}-${index}`} className="relative h-full">
                               <div className="absolute top-0 left-0 right-0 bg-gray-900/5 text-[10px] font-bold text-center py-0.5 rounded-t-xl z-0 text-gray-500 truncate px-2">{marketName}</div>
                               <div className="pt-4 h-full">
                                  <ProductCard 
                                    product={product}
                                    accentColor={market?.themeColor || 'gray'}
                                    catalogEndDate={market?.catalogs?.[0]?.endDate}
                                    isAdmin={isAdmin}
                                    variant="compact"
                                    isListMode={productViewMode === 'list'}
                                    isThreeColMobile={productViewMode === 'grid'}
                                    hasCheaperAlternative={hasCheaper}
                                    onClick={() => {
                                      if (!isAdmin) {
                                        const favList = favorites.map(f => {
                                          const fMkt = markets.find(m => m.id === f.marketId);
                                          return {
                                            product: f,
                                            marketName: fMkt?.name || 'Naməlum Market',
                                            marketId: f.marketId,
                                            catalogEndDate: fMkt?.catalogs?.[0]?.endDate
                                          };
                                        });
                                        setViewProduct({
                                          product,
                                          marketName,
                                          marketId: product.marketId,
                                          catalogEndDate: market?.catalogs?.[0]?.endDate,
                                          productList: favList,
                                          currentIndex: index
                                        });
                                      }
                                    }}
                                    isFavorite={true}
                                    onToggleFavorite={() => toggleFavorite(product, product.marketId)}
                                  />
                               </div>
                            </div>
                          );
                       })}
                    </div>
                  ) : (
                    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                      <Heart className="w-16 h-16 mx-auto text-gray-100 mb-4" />
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Heç bir məhsul seçilməyib</h3>
                      <button onClick={handleResetApp} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors">Kəşf et</button>
                    </div>
                  )}
               </div>
            ) : (
              <>
                 {(debouncedSearchQuery.length > 0 || debouncedMaxPrice.length > 0 || showCheaperOnly) ? (
                  <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] relative min-h-[500px]">
                    {isProcessingCheaper && (
                       <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex flex-col items-center justify-center">
                          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-sm mx-4 border border-gray-100">
                              <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
                              <p className="font-bold text-gray-800 text-xl mb-2">Müqayisə aparılır...</p>
                          </div>
                       </div>
                    )}
                    <div className={`transition-all duration-300 ${isProcessingCheaper ? 'opacity-20 blur-sm' : ''}`}>
                        {/* Geri düyməsi və Görünüş seçimi - Axtarış nəticələrində */}
                        <div className="flex items-center justify-between bg-gray-50/90 border border-gray-200/90 rounded-xl px-3.5 py-2 mb-3 shadow-2xs gap-2">
                          {debouncedSearchQuery.trim().length > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setDebouncedSearchQuery('');
                                setIsSearching(false);
                              }}
                              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 hover:text-green-700 active:scale-95 transition-all cursor-pointer min-w-0"
                              title="Axtarışı təmizlə və geri qayıt"
                            >
                              <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-2xs shrink-0">
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate">Geri («{debouncedSearchQuery}»)</span>
                            </button>
                          ) : (
                            <span className="text-xs sm:text-sm font-bold text-gray-700">Nəticələr</span>
                          )}

                          {!showCheaperOnly && (
                            <div className="flex items-center bg-white p-0.5 rounded-lg border border-gray-200/90 shrink-0" role="group" aria-label="Görünüş rejimi">
                              <button
                                type="button"
                                onClick={() => setProductViewMode('grid')}
                                className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'grid' ? 'bg-emerald-50 text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                title="3-lü cərgə (Grid)"
                              >
                                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setProductViewMode('list')}
                                className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'list' ? 'bg-emerald-50 text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Alt-alta siyahı (List)"
                              >
                                <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                        {showCheaperOnly && (
                            <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl border border-green-200">
                            <TrendingDown className="w-4 h-4" />
                            <span className="font-bold">Fürsətlər</span>
                            {isAdmin && <button onClick={handleRefreshComparison} className="hover:rotate-180 transition-transform"><RotateCcw className="w-3 h-3" /></button>}
                            </div>
                        )}
                        </div>
                        {showCheaperOnly ? (
                            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 mt-4 sm:mt-6`}>
                                {groupedOpportunities.slice(0, visibleProductCount).map((group, idx) => (
                                    <GroupedProductCard key={`${group.productName}-${idx}`} productName={group.productName} category={group.category} imageUrl={group.imageUrl} variants={group.variants} />
                                ))}
                            </div>
                        ) : (
                            filteredMarketData.map((market) => {
                              const marketEndDate = market.catalogs?.[0]?.endDate;
                              return (
                                <div key={market.id} className="bg-white rounded-2xl p-2 sm:p-5 border border-gray-100 shadow-xs mb-5">
                                    {/* Sticky Market Header in search results */}
                                    <div 
                                      style={{ top: `${stickyHeaderHeight}px` }}
                                      className="sticky z-20 bg-white/95 backdrop-blur-md -mx-2 sm:-mx-5 px-3 sm:px-5 py-2.5 mb-4 border-b border-gray-100 flex items-center justify-between shadow-2xs transition-[top] duration-150 rounded-t-2xl"
                                    >
                                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                              {market.logoUrl ? <img src={market.logoUrl} alt={market.name} className="w-full h-full object-contain p-1" /> : <span className={`text-${market.themeColor}-700 font-bold text-sm sm:text-base`}>{market.logoPlaceholder}</span>}
                                          </div>
                                          <div className="min-w-0">
                                              <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate tracking-tight">{market.name}</h3>
                                              <p className="text-[10px] sm:text-xs text-gray-400 font-medium">Axtarış üzrə market nəticələri</p>
                                          </div>
                                      </div>
                                      <span className="text-xs sm:text-sm font-bold bg-gray-100 text-gray-600 px-2.5 sm:px-3 py-1 rounded-full shrink-0">
                                        {market.filteredProducts.length} məhsul
                                      </span>
                                    </div>
                                    <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4'}>
                                    {market.filteredProducts.slice(0, visibleProductCount).map((product, index) => {
                                        const fav = isFavorite(product.productName || '', market.id);
                                        return (
                                          <ProductCard 
                                            key={`${market.id}-${product.productName}-${index}`} 
                                            product={product} 
                                            accentColor={market.themeColor} 
                                            catalogEndDate={marketEndDate}
                                            isAdmin={isAdmin} 
                                            variant="compact" 
                                            isListMode={productViewMode === 'list'}
                                            isThreeColMobile={productViewMode === 'grid'}
                                            hasCheaperAlternative={(product as any)._hasCheaper} 
                                            onClick={() => {
                                              if (!isAdmin) {
                                                const sList = market.filteredProducts.map(p => ({
                                                  product: p,
                                                  marketName: market.name,
                                                  marketId: market.id,
                                                  catalogEndDate: marketEndDate
                                                }));
                                                setViewProduct({
                                                  product,
                                                  marketName: market.name,
                                                  marketId: market.id,
                                                  catalogEndDate: marketEndDate,
                                                  productList: sList,
                                                  currentIndex: index
                                                });
                                              }
                                            }} 
                                            onEdit={() => handleEditFromSearch(product, market.id)} 
                                            isFavorite={fav} 
                                            onToggleFavorite={() => toggleFavorite(product, market.id)} 
                                          />
                                        );
                                    })}
                                    </div>
                                </div>
                              );
                            })
                        )}
                    </div>
                  </div>
                ) : (
                  <>
                    {activeMarketId === null ? (
                      <div className="space-y-6 sm:space-y-8 animate-[fadeIn_0.4s_ease-out] max-w-2xl sm:max-w-3xl mx-auto">
                        {/* Horizontally scrollable row of featured products: 1 product from each market */}
                        {sampleFeaturedProducts.length > 0 && (
                          <div className="space-y-2">
                            {/* Dots Indicator Above the Carousel */}
                            <div className="flex items-center justify-center gap-1.5 py-1 select-none">
                              {sampleFeaturedProducts.map((_, dotIdx) => {
                                // Visible window is typically 3 products on mobile/tablet
                                const isVisibleInWindow = dotIdx >= carouselActiveIndex && dotIdx < carouselActiveIndex + 3;
                                return (
                                  <button
                                    key={`carousel-dot-${dotIdx}`}
                                    type="button"
                                    onClick={() => {
                                      if (featuredCarouselRef.current) {
                                        const el = featuredCarouselRef.current;
                                        const firstChild = el.firstElementChild as HTMLElement | null;
                                        const itemWidth = firstChild ? firstChild.offsetWidth + 8 : 150;
                                        el.scrollTo({
                                          left: dotIdx * itemWidth,
                                          behavior: 'smooth'
                                        });
                                      }
                                    }}
                                    className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                                      isVisibleInWindow
                                        ? 'w-5 bg-blue-600 shadow-xs'
                                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                                    }`}
                                    title={`${dotIdx + 1}-ci nümunə məhsul`}
                                  />
                                );
                              })}
                            </div>

                            <div className="relative group/carousel">
                              {/* Left scroll arrow (desktop) */}
                              <button
                                type="button"
                                onClick={() => scrollFeaturedCarousel('left')}
                                className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                title="Əvvəlki"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>

                              <div 
                                ref={featuredCarouselRef}
                                onScroll={handleCarouselScroll}
                                className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide scroll-smooth py-1 px-0.5"
                              >
                                {sampleFeaturedProducts.map(({ product, market }, idx) => (
                                  <div 
                                    key={`sample-hero-${market.id}-${idx}`}
                                    className="w-[calc((100%-16px)/3)] min-w-[110px] sm:min-w-[140px] md:min-w-[160px] max-w-[190px] shrink-0"
                                  >
                                    <ProductCard
                                      product={product}
                                      accentColor={market.themeColor || 'green'}
                                      marketLogoUrl={market.logoUrl}
                                      marketName={market.name}
                                      showMarketRibbon={true}
                                      catalogEndDate={market.catalogs?.[0]?.endDate}
                                      hideCountdown={true}
                                      isAdmin={isAdmin}
                                      variant="compact"
                                      onClick={() => {
                                        if (!isAdmin) {
                                          const featuredList = sampleFeaturedProducts.map(s => ({
                                            product: s.product,
                                            marketName: s.market.name,
                                            marketId: s.market.id,
                                            catalogEndDate: s.market.catalogs?.[0]?.endDate
                                          }));
                                          setViewProduct({ 
                                            product, 
                                            marketName: market.name, 
                                            marketId: market.id,
                                            catalogEndDate: market.catalogs?.[0]?.endDate,
                                            productList: featuredList,
                                            currentIndex: idx
                                          });
                                        }
                                      }}
                                      isFavorite={isFavorite(product.productName || '', market.id)}
                                      onToggleFavorite={() => toggleFavorite(product, market.id)}
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Right scroll arrow (desktop) */}
                              <button
                                type="button"
                                onClick={() => scrollFeaturedCarousel('right')}
                                className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                title="Növbəti"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Markets List - Alt alta (vertically stacked) with icon, name, and red product count */}
                        <div className="flex flex-col gap-2 sm:gap-2.5">
                          {sortedMarkets.map((market) => {
                            const previewCatalog = market.catalogs && market.catalogs.length > 0 ? market.catalogs[0] : null;
                            const allMarketProducts = (market.catalogs && market.catalogs.length > 0)
                              ? market.catalogs.flatMap(c => c.products || [])
                              : (market.products || []);
                            const catalogProductsCount = previewCatalog ? (previewCatalog.products?.length || 0) : allMarketProducts.length;

                            return (
                              <div
                                key={market.id}
                                onClick={() => handleSelectMarket(market.id)}
                                role="button"
                                tabIndex={0}
                                className="w-full bg-white hover:bg-gray-50/80 active:bg-gray-100 border border-gray-100 hover:border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between cursor-pointer group select-none"
                              >
                                {/* Left: Market Logo + Market Name + Red Product Count */}
                                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-100 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                    {market.logoUrl ? (
                                      <img src={market.logoUrl} alt={market.name} className="w-full h-full object-contain p-1" />
                                    ) : (
                                      <span className={`text-${market.themeColor || 'green'}-700 font-black text-base sm:text-lg`}>
                                        {market.logoPlaceholder}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
                                    <h3 className="text-sm sm:text-base md:text-lg font-black text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                                      {market.name}
                                    </h3>
                                    {/* Red product count right next to market name */}
                                    <span className="inline-flex items-center text-xs sm:text-sm font-black text-red-600 bg-red-50 border border-red-200/80 px-2 sm:px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                                      {catalogProductsCount}
                                    </span>
                                  </div>
                                </div>

                                {/* Right: Admin edit + Chevron Arrow */}
                                <div className="flex items-center gap-1 shrink-0 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                                  {isAdmin && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setMarketToEdit(market); }}
                                      className="p-1.5 sm:p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all mr-1"
                                      title="Marketi Düzəlt"
                                    >
                                      <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                  )}
                                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="animate-[fadeIn_0.3s_ease-out]">
                        {(() => {
                          const mkt = sortedMarkets.find(m => m.id === activeMarketId) || sortedMarkets[0];
                          if (!mkt) return null;
                          const mktCatalogs = mkt.catalogs || [];
                          const selectedCatId = activeCatalogByMarket[mkt.id] || (mktCatalogs[0]?.id || null);
                          const mktCatalog = mktCatalogs.find(c => c.id === selectedCatId) || (mktCatalogs.length > 0 ? mktCatalogs[0] : null);
                          const mktDateStatus = getCatalogDateStatus(mktCatalog || undefined);
                          const mktProducts = mktCatalog ? mktCatalog.products : (mkt.products || []);
                          const mktFilteredProducts = mktProducts.filter(filterProductForDetail);
                          const mktAccent = mkt.themeColor || 'green';

                          // All categories with their product counts in this catalog
                          const allCategoriesWithCounts = (() => {
                            const map = new Map<string, number>();
                            mktFilteredProducts.forEach(p => {
                              const cat = (p.category || 'Digər').trim() || 'Digər';
                              map.set(cat, (map.get(cat) || 0) + 1);
                            });
                            return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
                          })();
                          const hasCategories = allCategoriesWithCounts.length > 0 && !(allCategoriesWithCounts.length === 1 && allCategoriesWithCounts[0].name.toLowerCase() === 'digər');

                          // Filter by selected category if user selected one
                          const effectiveProducts = (selectedCategoryFilter && hasCategories)
                            ? mktFilteredProducts.filter(p => (p.category || 'Digər').trim() === selectedCategoryFilter)
                            : mktFilteredProducts;

                          const displayedProducts = effectiveProducts.slice(0, visibleDetailCount);
                          const hasMore = visibleDetailCount < effectiveProducts.length;

                          // Build complete ordered market product list (ALL products in this market catalog, regardless of category filter/pagination)
                          // so the modal counter always reflects TOTAL market products (e.g. 4 / 72, NOT category subtotal)
                          const fullMarketOrderedProducts: DiscountProduct[] = (() => {
                            if (hasCategories) {
                              const catOrderMap = new Map<string, DiscountProduct[]>();
                              mktFilteredProducts.forEach(p => {
                                const cat = (p.category || 'Digər').trim() || 'Digər';
                                if (!catOrderMap.has(cat)) catOrderMap.set(cat, []);
                                catOrderMap.get(cat)!.push(p);
                              });
                              return Array.from(catOrderMap.values()).flat();
                            }
                            return mktFilteredProducts;
                          })();

                          const fullMarketModalList = fullMarketOrderedProducts.map(p => ({
                            product: p,
                            marketName: mkt.name,
                            marketId: mkt.id,
                            catalogEndDate: mktCatalog?.endDate
                          }));

                          // Grouping by category when all categories are shown
                          const groupedProductsByCategory: { category: string; products: { product: DiscountProduct; originalIndex: number }[] }[] = [];
                          if (hasCategories && !selectedCategoryFilter) {
                            const catMap = new Map<string, { category: string; products: { product: DiscountProduct; originalIndex: number }[] }>();
                            displayedProducts.forEach((product, idx) => {
                              const cat = (product.category || 'Digər').trim() || 'Digər';
                              if (!catMap.has(cat)) {
                                const newGroup = { category: cat, products: [] };
                                catMap.set(cat, newGroup);
                                groupedProductsByCategory.push(newGroup);
                              }
                              catMap.get(cat)!.products.push({ product, originalIndex: idx });
                            });
                          }

                          return (
                            <div 
                              key={mkt.id} 
                              id={`market-detail-${mkt.id}`}
                              className="scroll-mt-24 sm:scroll-mt-28"
                            >

                              {/* Multi-Catalog Tabs ONLY if there are multiple catalogs (> 1) - eliminates single "Əsas Kataloq" tab */}
                              {mktCatalogs.length > 1 && (
                                <div className="mb-3 border-b border-gray-200 overflow-x-auto scrollbar-hide">
                                  <div className="flex space-x-2">
                                    {mktCatalogs.map(catalog => {
                                      const status = getCatalogDateStatus(catalog);
                                      const isCatActive = selectedCatId === catalog.id;
                                      return (
                                        <button
                                          key={catalog.id}
                                          onClick={() => {
                                            setActiveCatalogByMarket(prev => ({ ...prev, [mkt.id]: catalog.id }));
                                            setSelectedCategoryFilter(null);
                                            setVisibleDetailCount(24);
                                          }}
                                          className={`whitespace-nowrap px-4 py-2 rounded-t-xl font-bold text-xs transition-all flex items-center gap-2 ${isCatActive ? `bg-white text-${mktAccent}-700 border border-gray-200 border-b-white shadow-xs` : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                          {status.label && <span className={`w-2 h-2 rounded-full ${status.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>}
                                          {catalog.name}
                                          {isAdmin && (
                                            <span onClick={(e) => { e.stopPropagation(); handleDeleteCatalog(catalog.id); }} className="ml-1 p-0.5 rounded-full hover:bg-red-100 text-red-400 opacity-60 hover:opacity-100">
                                              <Trash2 className="w-3 h-3" />
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Products Grid for this market */}
                              {displayedProducts.length > 0 ? (
                                hasCategories ? (
                                  selectedCategoryFilter ? (
                                    /* Single Category Filtered View */
                                    <div className="space-y-3">
                                      {/* Category Header (Sticky right below market header, clickable to toggle categories list) */}
                                      <div className="relative">
                                        <div 
                                          style={{ top: `${stickyHeaderHeight}px` }}
                                          onClick={() => setActiveCategoryDropdown(prev => prev === 'filter' ? null : 'filter')}
                                          role="button"
                                          tabIndex={0}
                                          title="Kateqoriyanı dəyişmək üçün klikləyin"
                                          className="sticky z-20 bg-white/95 backdrop-blur-md -mx-2 sm:-mx-4 px-2 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-center relative shadow-2xs transition-[top] duration-150 cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 select-none group"
                                        >
                                          <div className="flex items-center justify-center gap-2 min-w-0 max-w-[80%] text-center">
                                            <div className={`w-2.5 sm:w-3 h-7 sm:h-8 rounded-full bg-${mktAccent}-600 shrink-0 group-hover:scale-y-110 transition-transform`}></div>
                                            <h3 className="font-black text-lg sm:text-2xl text-gray-900 tracking-tight truncate flex items-center gap-2">
                                              <span>{selectedCategoryFilter}</span>
                                              <ChevronDown className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-gray-700 transition-transform duration-200 ${activeCategoryDropdown === 'filter' ? 'rotate-180 text-gray-800' : ''}`} />
                                            </h3>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedCategoryFilter(null);
                                              setActiveCategoryDropdown(null);
                                              setVisibleDetailCount(24);
                                            }}
                                            className="absolute right-2 sm:right-4 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Bütün kateqoriyaları göstər"
                                          >
                                            <X className="w-3 h-3" /> Hamısı
                                          </button>
                                        </div>

                                        {/* Simple vertical list of category names right underneath the clicked text */}
                                        {activeCategoryDropdown === 'filter' && (
                                          <div className="relative z-30">
                                            {/* Click outside to close (transparent, non-blocking backdrop) */}
                                            <div 
                                              className="fixed inset-0 z-20" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveCategoryDropdown(null);
                                              }} 
                                            />
                                            <div className="absolute left-0 top-1 w-full max-w-xs sm:max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-30 max-h-72 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                                              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                <span>Kateqoriyalar</span>
                                                <button 
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); setActiveCategoryDropdown(null); }}
                                                  className="text-gray-400 hover:text-gray-600 p-0.5"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                              
                                              {/* Hamısı Option */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedCategoryFilter(null);
                                                  setActiveCategoryDropdown(null);
                                                  setVisibleDetailCount(24);
                                                }}
                                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer border-b border-gray-50"
                                              >
                                                <span className="font-bold text-blue-600">Hamısı (Bütün məhsullar)</span>
                                                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                                  {mktFilteredProducts.length}
                                                </span>
                                              </button>

                                              {/* Individual categories alt alta */}
                                              {allCategoriesWithCounts.map(cat => {
                                                const isCurrent = selectedCategoryFilter === cat.name;
                                                return (
                                                  <button
                                                    key={cat.name}
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedCategoryFilter(cat.name);
                                                      setActiveCategoryDropdown(null);
                                                      setVisibleDetailCount(24);
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                                      isCurrent 
                                                        ? 'bg-gray-100 font-bold text-gray-900' 
                                                        : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                  >
                                                    <span className="truncate">{cat.name}</span>
                                                    <span className="text-[10px] text-gray-500 bg-gray-100 font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0">
                                                      {cat.count}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4'}>
                                        {displayedProducts.map((product, idx) => (
                                          <ProductCard 
                                            key={`${mkt.id}-${product.productName}-${idx}`} 
                                            product={product} 
                                            accentColor={mktAccent} 
                                            catalogEndDate={mktCatalog?.endDate}
                                            isAdmin={isAdmin} 
                                            variant="compact"
                                            isListMode={productViewMode === 'list'}
                                            isThreeColMobile={productViewMode === 'grid'}
                                            hasCheaperAlternative={checkForCheaperAlternative(product, mkt.id)} 
                                            onClick={() => {
                                              if (!isAdmin) {
                                                const fullIdx = fullMarketModalList.findIndex(item => item.product === product);
                                                setViewProduct({ 
                                                  product, 
                                                  marketName: mkt.name, 
                                                  marketId: mkt.id,
                                                  catalogEndDate: mktCatalog?.endDate,
                                                  productList: fullMarketModalList,
                                                  currentIndex: fullIdx >= 0 ? fullIdx : 0
                                                });
                                              }
                                            }} 
                                            onEdit={() => { setActiveMarketId(mkt.id); setProductToEdit({ product, index: idx, catalogId: selectedCatId || undefined }); }} 
                                            isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                            onToggleFavorite={() => toggleFavorite(product, mkt.id)} 
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    /* Grouped by Categories View (Sticky category headers, clickable to toggle categories list) */
                                    <div className="space-y-6 sm:space-y-8">
                                      {groupedProductsByCategory.map((group) => {
                                        const isThisDropdownOpen = activeCategoryDropdown === group.category;
                                        return (
                                          <div key={group.category} className="space-y-2.5 sm:space-y-3">
                                            {/* Category Header (Sticky right below market header, clickable to toggle categories list) */}
                                            <div className="relative">
                                              <div 
                                                style={{ top: `${stickyHeaderHeight}px` }}
                                                onClick={() => setActiveCategoryDropdown(prev => prev === group.category ? null : group.category)}
                                                role="button"
                                                tabIndex={0}
                                                title="Bütün kateqoriyaları gör və seç"
                                                className="sticky z-20 bg-white/95 backdrop-blur-md -mx-2 sm:-mx-4 px-2 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-center relative shadow-2xs transition-[top] duration-150 cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 select-none group"
                                              >
                                                <div className="flex items-center justify-center gap-2 min-w-0 max-w-[85%] text-center">
                                                  <div className={`w-2.5 sm:w-3 h-7 sm:h-8 rounded-full bg-${mktAccent}-600 shrink-0 group-hover:scale-y-110 transition-transform`}></div>
                                                  <h3 className="font-black text-lg sm:text-2xl text-gray-900 tracking-tight truncate flex items-center gap-2">
                                                    <span>{group.category}</span>
                                                    <ChevronDown className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-gray-700 transition-transform duration-200 ${isThisDropdownOpen ? 'rotate-180 text-gray-800' : ''}`} />
                                                  </h3>
                                                </div>
                                              </div>

                                              {/* Simple vertical list of category names right underneath the clicked text */}
                                              {isThisDropdownOpen && (
                                                <div className="relative z-30">
                                                  {/* Click outside to close (transparent, non-blocking backdrop) */}
                                                  <div 
                                                    className="fixed inset-0 z-20" 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActiveCategoryDropdown(null);
                                                    }} 
                                                  />
                                                  <div className="absolute left-0 top-1 w-full max-w-xs sm:max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-30 max-h-72 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                                                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                      <span>Kateqoriyalar</span>
                                                      <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setActiveCategoryDropdown(null); }}
                                                        className="text-gray-400 hover:text-gray-600 p-0.5"
                                                      >
                                                        <X className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                    
                                                    {/* Hamısı Option */}
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCategoryFilter(null);
                                                        setActiveCategoryDropdown(null);
                                                        setVisibleDetailCount(24);
                                                      }}
                                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer border-b border-gray-50"
                                                    >
                                                      <span className="font-bold text-blue-600">Hamısı (Bütün məhsullar)</span>
                                                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                                        {mktFilteredProducts.length}
                                                      </span>
                                                    </button>

                                                    {/* Individual categories alt alta */}
                                                    {allCategoriesWithCounts.map(cat => {
                                                      const isCurrent = group.category === cat.name;
                                                      return (
                                                        <button
                                                          key={cat.name}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedCategoryFilter(cat.name);
                                                            setActiveCategoryDropdown(null);
                                                            setVisibleDetailCount(24);
                                                          }}
                                                          className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                                            isCurrent 
                                                              ? 'bg-gray-100 font-bold text-gray-900' 
                                                              : 'text-gray-700 hover:bg-gray-50'
                                                          }`}
                                                        >
                                                          <span className="truncate">{cat.name}</span>
                                                          <span className="text-[10px] text-gray-500 bg-gray-100 font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0">
                                                            {cat.count}
                                                          </span>
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                            <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4'}>
                                              {group.products.map(({ product, originalIndex }) => (
                                                <ProductCard 
                                                  key={`${mkt.id}-${product.productName}-${originalIndex}`} 
                                                  product={product} 
                                                  accentColor={mktAccent} 
                                                  catalogEndDate={mktCatalog?.endDate}
                                                  isAdmin={isAdmin} 
                                                  variant="compact"
                                                  isListMode={productViewMode === 'list'}
                                                  isThreeColMobile={productViewMode === 'grid'}
                                                  hasCheaperAlternative={checkForCheaperAlternative(product, mkt.id)} 
                                                  onClick={() => {
                                                    if (!isAdmin) {
                                                      const fullIdx = fullMarketModalList.findIndex(item => item.product === product);
                                                      setViewProduct({ 
                                                        product, 
                                                        marketName: mkt.name, 
                                                        marketId: mkt.id,
                                                        catalogEndDate: mktCatalog?.endDate,
                                                        productList: fullMarketModalList,
                                                        currentIndex: fullIdx >= 0 ? fullIdx : 0
                                                      });
                                                    }
                                                  }} 
                                                  onEdit={() => { setActiveMarketId(mkt.id); setProductToEdit({ product, index: originalIndex, catalogId: selectedCatId || undefined }); }} 
                                                  isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                                  onToggleFavorite={() => toggleFavorite(product, mkt.id)} 
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )
                                ) : (
                                  <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4'}>
                                    {displayedProducts.map((product, index) => (
                                      <ProductCard 
                                        key={`${mkt.id}-${product.productName}-${index}`} 
                                        product={product} 
                                        accentColor={mktAccent} 
                                        catalogEndDate={mktCatalog?.endDate}
                                        isAdmin={isAdmin} 
                                        variant="compact"
                                        isListMode={productViewMode === 'list'}
                                        isThreeColMobile={productViewMode === 'grid'}
                                        hasCheaperAlternative={checkForCheaperAlternative(product, mkt.id)} 
                                        onClick={() => {
                                          if (!isAdmin) {
                                            const fullIdx = fullMarketModalList.findIndex(item => item.product === product);
                                            setViewProduct({ 
                                              product, 
                                              marketName: mkt.name, 
                                              marketId: mkt.id,
                                              catalogEndDate: mktCatalog?.endDate,
                                              productList: fullMarketModalList,
                                              currentIndex: fullIdx >= 0 ? fullIdx : 0
                                            });
                                          }
                                        }} 
                                        onEdit={() => { setActiveMarketId(mkt.id); setProductToEdit({ product, index, catalogId: selectedCatId || undefined }); }} 
                                        isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                        onToggleFavorite={() => toggleFavorite(product, mkt.id)} 
                                      />
                                    ))}
                                  </div>
                                )
                              ) : (
                                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
                                  <p className="text-sm font-medium">Bu kateqoriyada heç bir məhsul tapılmadı.</p>
                                  {selectedCategoryFilter && (
                                    <button
                                      onClick={() => setSelectedCategoryFilter(null)}
                                      className="mt-3 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                                    >
                                      Bütün kateqoriyaları göstər
                                    </button>
                                  )}
                                </div>
                              )}


                              {/* Infinite Scroll / Lazy Load Sentinel */}
                              {hasMore && (
                                <div ref={loadMoreSentinelRef} className="py-6 sm:py-8 flex flex-col items-center justify-center">
                                  <button
                                    onClick={() => setVisibleDetailCount(prev => prev + 24)}
                                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-full border border-gray-200 transition-colors shadow-xs active:scale-95"
                                  >
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                    <span>Digər məhsullar yüklənir... ({displayedProducts.length} / {mktFilteredProducts.length})</span>
                                  </button>
                                </div>
                              )}
                              {!hasMore && mktFilteredProducts.length > 24 && (
                                <div className="py-6 text-center text-xs font-medium text-gray-400">
                                  Bütün {mktFilteredProducts.length} məhsul göstərildi
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
            </>
            )}
          </main>
        </div>
      </div>

      {/* Bottom Fixed Search & Filter Dock (Pinned at the very bottom of the screen) */}
      {!isLoading && (
        <BottomSearchDock 
          searchQuery={searchQuery}
          onSearchChange={(q) => { setSearchQuery(q); setIsSearching(true); }}
          maxPrice={maxPrice}
          onMaxPriceChange={(p) => { setMaxPrice(p); setIsSearching(true); }}
          showCheaperOnly={showCheaperOnly}
          onShowCheaperOnlyChange={handleShowCheaperOnlyChange}
          showFavorites={showFavorites}
          onShowFavoritesChange={(active) => {
             setIsSearching(true);
             setShowFavorites(active);
             if (active) { handleShowCheaperOnlyChange(false); setActiveMarketId(null); }
          }}
          favoritesCount={favorites.length}
        />
      )}

        <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} selectedMarket={currentMarket?.name || ''} marketUrl={currentMarket?.url || ''} currentLogoUrl={currentMarket?.logoUrl} existingCatalogs={currentMarket?.catalogs} onStreamStart={handleStreamStart} onStreamUpdate={handleStreamUpdate} onStreamEnd={handleStreamEnd} onLogoUpdate={handleLogoUpdate} />
        <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={() => setIsAdmin(true)} />
        <BannerEditorModal isOpen={isBannerModalOpen} onClose={() => setIsBannerModalOpen(false)} banner={activeBannerId === 'banner-1' ? banner1 : banner2} onSave={(b) => { if (activeBannerId === 'banner-1') updateBannerState(b, banner2); else updateBannerState(banner1, b); }} />
        <AddMarketModal isOpen={isAddMarketModalOpen} onClose={() => setIsAddMarketModalOpen(false)} onAdd={handleAddMarket} />
        <SocialDealsModal isOpen={isSocialDealsModalOpen} onClose={() => setIsSocialDealsModalOpen(false)} markets={markets} onUpdateMarkets={updateMarketsState} />
        {marketToEdit && <EditMarketModal isOpen={!!marketToEdit} onClose={() => setMarketToEdit(null)} market={marketToEdit} onSave={handleUpdateMarket} onDelete={handleDeleteMarket} />}
        {productToEdit && activeMarketId && <EditProductModal isOpen={!!productToEdit} onClose={() => setProductToEdit(null)} product={productToEdit.product} onSave={handleUpdateProduct} />}
        <DatabaseModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} onSave={saveDatabaseConfig} currentConfig={supabaseConfig} />
        {(() => {
          const resolveModalMarketId = (item?: { product: DiscountProduct; marketName: string; marketId?: string } | null) => {
            if (!item) return '';
            return (
              item.marketId ||
              (item.product as any)?.marketId ||
              markets.find(m => m.name.trim().toLowerCase() === (item.marketName || '').trim().toLowerCase())?.id ||
              ''
            );
          };
          const modalMarketId = resolveModalMarketId(viewProduct);

          return (
            <ProductDetailModal 
              isOpen={!!viewProduct} 
              onClose={() => setViewProduct(null)} 
              product={viewProduct?.product || null} 
              marketName={viewProduct?.marketName || ''} 
              allMarkets={markets} 
              onCompareClick={handleCompareClick} 
              canGoBack={!!previousViewState} 
              onBack={handleRestorePreviousView} 
              showComparisons={showCheaperOnly} 
              catalogEndDate={viewProduct?.catalogEndDate} 
              currentIndex={viewProduct?.currentIndex}
              totalCount={viewProduct?.productList?.length}
              productList={viewProduct?.productList}
              onSelectIndex={handleSelectIndexInModal}
              isFavorite={Boolean(viewProduct && modalMarketId && isFavorite(viewProduct.product.productName || '', modalMarketId))}
              onToggleFavorite={viewProduct && modalMarketId ? () => toggleFavorite(viewProduct.product, modalMarketId) : undefined}
              onEnsureFavorite={viewProduct && modalMarketId ? () => ensureFavorite(viewProduct.product, modalMarketId) : undefined}
              checkIsFavorite={(item) => {
                const mId = resolveModalMarketId(item);
                return Boolean(mId && isFavorite(item.product.productName || '', mId));
              }}
              onToggleFavoriteItem={(item) => {
                const mId = resolveModalMarketId(item);
                if (mId) toggleFavorite(item.product, mId);
              }}
              onEnsureFavoriteItem={(item) => {
                const mId = resolveModalMarketId(item);
                if (mId) ensureFavorite(item.product, mId);
              }}
            />
          );
        })()}
        
        <InstagramViewer 
          isOpen={!!instagramViewerData} 
          onClose={() => setInstagramViewerData(null)} 
          posts={instagramViewerData?.posts || []} 
          marketName={instagramViewerData?.name || ''} 
          initialIndex={instagramViewerData?.initialIndex || 0}
        />

    </>
  );
};

export default App;
