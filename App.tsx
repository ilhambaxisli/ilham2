
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import Header from './components/Header';
import BottomSearchDock from './components/BottomSearchDock';
import ProductCard, { extractProductEndDate, calculateDaysLeft } from './components/ProductCard';
import GroupedProductCard from './components/GroupedProductCard';
import SearchMarketResultCard from './components/SearchMarketResultCard';
import ScannerModal from './components/ScannerModal';
import AdminLoginModal from './components/AdminLoginModal';
import AddMarketModal from './components/AddMarketModal';
import EditMarketModal from './components/EditMarketModal';
import EditProductModal from './components/EditProductModal';
import DatabaseModal from './components/DatabaseModal';
import ProductDetailModal from './components/ProductDetailModal';
import OpportunityDetailModal from './components/OpportunityDetailModal';
import OpportunityInstagramModal, { exportOpportunityPosterPng, exportGeneralProductPosterPng } from './components/OpportunityInstagramModal';
import BannerEditorModal, { normalizeAdLinkUrl } from './components/BannerEditorModal';
import { MarketData, DiscountProduct, SupabaseConfig, Catalog, FavoriteItem, BannerData } from './types';
import * as supabaseService from './services/supabase';
import { RefreshCw, ShoppingBag, ArrowRight, Loader2, Plus, Trash2, Search, Database, Home, ChevronRight, Store, Grid3x3, Grid2x2, XCircle, ChevronUp, ChevronDown, Edit, Calendar, Clock, AlertTriangle, CheckCircle2, ShoppingCart, TrendingDown, ArrowLeft, Heart, RotateCcw, X, Check, ChevronLeft, Sparkles, Tag, Percent, Download, Megaphone } from 'lucide-react';

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

const isOmidMarket = (market: MarketData): boolean => {
  const id = (market.id || '').toLowerCase().trim();
  const name = (market.name || '').toLowerCase().trim();
  return id === 'omid' || name === 'omid' || name.includes('omid');
};

// Target order: OBA, araz, bravo, al market, tamstore, bazarstore, rahat, neptun, bolmart, ..., omid
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

  // Last: omid
  if (id === 'omid' || name === 'omid' || name.includes('omid')) return 9999;

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

const isMarketFullyExpired = (market: MarketData): boolean => {
  const catalogs = market.catalogs || [];

  if (catalogs.length > 0) {
    let totalProducts = 0;
    for (const cat of catalogs) {
      const prods = cat.products || [];
      totalProducts += prods.length;
      for (const prod of prods) {
        const cd = calculateDaysLeft(extractProductEndDate(prod, cat.endDate));
        if (!cd || cd.daysLeft >= 0) {
          return false;
        }
      }
    }
    if (totalProducts > 0) return true;

    return catalogs.every(cat => {
      const cd = cat.endDate ? calculateDaysLeft(cat.endDate) : null;
      return Boolean(cd && cd.daysLeft < 0);
    });
  }

  const prods = market.products || [];
  if (prods.length === 0) return false;
  for (const prod of prods) {
    const cd = calculateDaysLeft(extractProductEndDate(prod, undefined));
    if (!cd || cd.daysLeft >= 0) {
      return false;
    }
  }
  return true;
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
  const rawImageUrl = typeof (p as any).imageUrl === 'string' ? (p as any).imageUrl.trim() : '';
  const rawCustomImageUrl = typeof p.customImageUrl === 'string' ? p.customImageUrl.trim() : '';
  return {
    ...p,
    imageUrl: rawImageUrl || undefined,
    customImageUrl: rawCustomImageUrl || undefined,
    expiryDate: exp ? String(exp).trim() : undefined,
    bitis: (p as any).bitis || (exp ? String(exp).trim() : undefined)
  };
};

const migrateMarketData = (incomingMarkets: MarketData[]): MarketData[] => {
  const seenById = new Map<string, MarketData>();

  for (const m of (incomingMarkets || [])) {
    if (!m || typeof m !== 'object') continue;
    const rawId = (m.id || m.name || '').trim();
    if (!rawId) continue;
    const canonId = rawId.toLowerCase();

    let overrideColor = m.themeColor;
    if (canonId === 'araz') overrideColor = 'amber';
    if (canonId === 'oba') overrideColor = 'green';

    let overrideLogoUrl = m.logoUrl;
    if (canonId === 'araz' || (m.name || '').toLowerCase().includes('araz')) {
      overrideLogoUrl = 'https://b7x9kq.arazmarket.az/storage/news/dsc_9152.jpg';
    }
    if ((m.name || '').toLowerCase().includes('rahat')) {
      overrideLogoUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTsEY6AAE18u9Y57PHT9fxiujtBzAMxNFVtZl7TgONVA&s=10';
    }
    if (canonId === 'omid' || (m.name || '').toLowerCase().includes('omid')) {
      overrideLogoUrl = overrideLogoUrl || 'https://omid.az/cdn/shop/files/logo-square-bg_b02cc3d7-332a-4af5-af81-cbe0f6b16235.png?v=1742375886';
    }

    const normProducts = Array.isArray(m.products) ? m.products.map(normalizeMarketProduct) : [];
    const rawCatalogs = Array.isArray(m.catalogs) ? m.catalogs : [];

    // Normalize products inside existing catalogs
    let normalizedCatalogs = rawCatalogs.map(c => {
      const cProds = Array.isArray(c.products) ? c.products.map(normalizeMarketProduct) : [];
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

    if (normalizedCatalogs.length === 0 && normProducts.length > 0) {
      const dates = normProducts.map(p => p.expiryDate || (p as any).bitis).filter(Boolean) as string[];
      const catalogEndDate = dates.length > 0 ? dates.sort()[dates.length - 1] : undefined;
      normalizedCatalogs = [{
        id: 'main',
        name: 'Əsas Kataloq',
        products: normProducts,
        lastUpdated: m.lastUpdated || new Date().toISOString(),
        url: m.url,
        endDate: catalogEndDate
      }];
    }

    // Keep root m.products strictly mirrored to primary catalog so manual Supabase deletes
    // in either catalogs[0].products or an empty catalog cannot be resurrected by stale root products
    const canonicalProducts = normalizedCatalogs.length > 0
      ? normalizedCatalogs[0].products
      : normProducts;

    const updatedMarket: MarketData = {
      ...m,
      themeColor: overrideColor,
      logoUrl: overrideLogoUrl,
      catalogs: normalizedCatalogs,
      products: canonicalProducts
    };

    const existing = seenById.get(canonId);
    if (!existing) {
      seenById.set(canonId, updatedMarket);
    } else {
      // Deduplicate any duplicate market entry keeping the fuller/newer record
      const existingCount = (existing.catalogs || []).reduce((acc, c) => acc + (c.products?.length || 0), 0) || (existing.products?.length || 0);
      const nextCount = (updatedMarket.catalogs || []).reduce((acc, c) => acc + (c.products?.length || 0), 0) || (updatedMarket.products?.length || 0);
      const existingTs = Date.parse(existing.lastUpdated || '') || 0;
      const nextTs = Date.parse(updatedMarket.lastUpdated || '') || 0;
      if (nextTs > existingTs || (nextTs === existingTs && nextCount > existingCount)) {
        seenById.set(canonId, updatedMarket);
      }
    }
  }

  return sortMarketsByOrder(Array.from(seenById.values()));
};

const CATEGORY_TAG_COLORS = [
  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', count: 'bg-emerald-100/90 text-emerald-800' },
  { chip: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100', count: 'bg-sky-100/90 text-sky-800' },
  { chip: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', count: 'bg-amber-100/90 text-amber-900' },
  { chip: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', count: 'bg-rose-100/90 text-rose-800' },
  { chip: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100', count: 'bg-violet-100/90 text-violet-800' },
  { chip: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', count: 'bg-teal-100/90 text-teal-800' },
  { chip: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', count: 'bg-orange-100/90 text-orange-800' },
  { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', count: 'bg-indigo-100/90 text-indigo-800' },
  { chip: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100', count: 'bg-pink-100/90 text-pink-800' },
  { chip: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100', count: 'bg-cyan-100/90 text-cyan-800' },
];

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
  const featuredCarouselTopRef = useRef<HTMLDivElement | null>(null);
  const featuredCarouselBottomRef = useRef<HTMLDivElement | null>(null);
  const marqueePauseUntilRef = useRef<{ top: number; bottom: number }>({ top: 0, bottom: 0 });
  const marqueePointerDownRef = useRef<{ top: boolean; bottom: boolean }>({ top: false, bottom: false });
  const marqueeStateRef = useRef<{
    top: { pos: number; dir: 1 | -1; lastWritten: number; initialized: boolean };
    bottom: { pos: number; dir: 1 | -1; lastWritten: number; initialized: boolean };
  }>({
    top: { pos: 0, dir: 1, lastWritten: 0, initialized: false },
    bottom: { pos: 0, dir: -1, lastWritten: 0, initialized: false },
  });

  const scrollFeaturedRow = (rowKey: 'top' | 'bottom', rowRef: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (rowRef.current) {
      marqueePauseUntilRef.current[rowKey] = performance.now() + 2800;
      const scrollAmount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
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

  const getProductDiscountSortScore = (p: DiscountProduct): { pct: number; diff: number } => {
    const oldP = parsePriceNumber(p.oldPrice);
    const newP = parsePriceNumber(p.newPrice);
    const diff = !isNaN(oldP) && !isNaN(newP) && oldP > newP ? oldP - newP : 0;
    let pct = 0;
    if (!isNaN(oldP) && !isNaN(newP) && oldP > newP && oldP > 0) {
      pct = ((oldP - newP) / oldP) * 100;
    }
    if (pct <= 0 && p.discountPercentage) {
      const parsed = parseFloat(String(p.discountPercentage).replace(/[^0-9.,]/g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) pct = parsed;
    }
    return { pct, diff };
  };

  const handleSelectMarket = (marketId: string | null, options?: { preserveSearchReturn?: boolean }) => {
    if (marketId !== null) {
      captureHomeScrollBeforeLeave();
    }
    if (!options?.preserveSearchReturn) {
      setSearchReturnState(null);
    }
    setActiveMarketId(marketId);
    setSelectedCategoryFilter(null);
    setActiveCategoryDropdown(null);
    setIsMarketSwitcherOpen(false);
    setVisibleDetailCount(24);
    if (marketId !== null) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };
  const marketsRef = useRef<MarketData[]>(markets);
  marketsRef.current = markets;
  const [adminSortByDiscount, setAdminSortByDiscount] = useState(false);
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
  const [expandedSearchMarkets, setExpandedSearchMarkets] = useState<Record<string, boolean>>({});
  const cheaperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [openSearchTrigger, setOpenSearchTrigger] = useState(0);
  const [isAddMarketModalOpen, setIsAddMarketModalOpen] = useState(false);
  const [marketToEdit, setMarketToEdit] = useState<MarketData | null>(null);
  const [productToEdit, setProductToEdit] = useState<{product: DiscountProduct, index: number, catalogId?: string} | null>(null);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [featuredAd, setFeaturedAd] = useState<BannerData>(() => {
    try {
      const saved = localStorage.getItem('featuredAd_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            id: parsed.id || 'featured-ad',
            title: parsed.title || '',
            imageUrl: parsed.imageUrl || '',
            link: parsed.link || '',
            isVisible: Boolean(parsed.isVisible),
            fitMode: parsed.fitMode === 'contain' ? 'contain' : 'cover',
          };
        }
      }
    } catch (e) {}
    return { id: 'featured-ad', title: '', imageUrl: '', link: '', isVisible: false, fitMode: 'cover' };
  });
  const [isFeaturedAdModalOpen, setIsFeaturedAdModalOpen] = useState(false);
  const [featuredAdImgError, setFeaturedAdImgError] = useState(false);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'two'>('grid');
  const [viewProduct, setViewProduct] = useState<{
    product: DiscountProduct;
    marketName: string;
    marketId?: string;
    catalogEndDate?: string;
    productList?: { product: DiscountProduct; marketName: string; marketId?: string; catalogEndDate?: string }[];
    currentIndex?: number;
  } | null>(null);
  const [opportunityModalIndex, setOpportunityModalIndex] = useState<number | null>(null);
  const [opportunityInstagramIndex, setOpportunityInstagramIndex] = useState<number | null>(null);
  const [opportunityCols, setOpportunityCols] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    const w = window.innerWidth;
    if (w >= 1024) return 5;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  });

  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      const next = w >= 1024 ? 5 : w >= 768 ? 4 : w >= 640 ? 3 : 2;
      setOpportunityCols(prev => (prev === next ? prev : next));
    };
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

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

  const handleOpenMarketSwipeFeed = (marketId: string) => {
    const market = sortedMarkets.find(m => m.id === marketId);
    if (!market) return;
    const mktCatalogs = market.catalogs || [];
    const selectedCatId = activeCatalogByMarket[market.id] || (mktCatalogs[0]?.id || null);
    const defaultCatalog = mktCatalogs.find(c => c.id === selectedCatId) || (mktCatalogs.length > 0 ? mktCatalogs[0] : null);
    const targetCatalog = defaultCatalog && (defaultCatalog.products || []).length > 0
      ? defaultCatalog
      : (mktCatalogs.find(c => (c.products || []).length > 0) || defaultCatalog);
    const rawMarketProds = targetCatalog ? (targetCatalog.products || []) : (market.products || []);
    if (rawMarketProds.length === 0) return;

    const catMap = new Map<string, DiscountProduct[]>();
    rawMarketProds.forEach(p => {
      const cat = (p.category || 'Digər').trim() || 'Digər';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    });
    const orderedMarketProds = catMap.size > 1 ? Array.from(catMap.values()).flat() : rawMarketProds;

    const marketModalList = orderedMarketProds.map(p => ({
      product: p,
      marketName: market.name,
      marketId: market.id,
      catalogEndDate: targetCatalog?.endDate
    }));

    setViewProduct({
      product: marketModalList[0].product,
      marketName: market.name,
      marketId: market.id,
      catalogEndDate: targetCatalog?.endDate,
      productList: marketModalList,
      currentIndex: 0
    });
  };

  const handleNavigateToMarketFromModal = (marketId: string) => {
    const isFromSearch = searchQuery.trim().length >= 2 || debouncedSearchQuery.trim().length >= 2;
    if (isFromSearch) {
      setSearchReturnState({
        searchQuery: searchQuery || debouncedSearchQuery,
        maxPrice: maxPrice || debouncedMaxPrice,
        expandedSearchMarkets: { ...expandedSearchMarkets },
        scrollY: window.scrollY
      });
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setMaxPrice('');
      setDebouncedMaxPrice('');
      setIsSearching(false);
    }
    setViewProduct(null);
    setShowFavorites(false);
    setShowCheaperOnly(false);
    handleSelectMarket(marketId, isFromSearch ? { preserveSearchReturn: true } : undefined);
  };
  const [previousViewState, setPreviousViewState] = useState<ViewState | null>(null);
  const [searchReturnState, setSearchReturnState] = useState<{
    searchQuery: string;
    maxPrice: string;
    expandedSearchMarkets: Record<string, boolean>;
    scrollY: number;
  } | null>(null);
  const skipSearchResetRef = useRef<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<string | null>(null);
  const [isMarketSwitcherOpen, setIsMarketSwitcherOpen] = useState(false);
  const pendingCategoryScrollRef = useRef<{ marketId: string; category: string } | null>(null);

  useEffect(() => {
    const pending = pendingCategoryScrollRef.current;
    if (!pending || pending.marketId !== activeMarketId) return;
    const targetId = `category-section-${pending.marketId}-${encodeURIComponent(pending.category)}`;
    const timer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        const headerOffset = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
        const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset - 8;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
        pendingCategoryScrollRef.current = null;
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [visibleDetailCount, activeMarketId]);

  const handleShowCheaperOnlyChange = (active: boolean) => {
    if (cheaperTimeoutRef.current) {
        clearTimeout(cheaperTimeoutRef.current);
        cheaperTimeoutRef.current = null;
    }
    if (active) {
      captureHomeScrollBeforeLeave();
    }
    setShowCheaperOnly(active);
    if (active) {
      setSearchReturnState(null);
      setActiveMarketId(null);
      setSelectedCategoryFilter(null);
      setActiveCategoryDropdown(null);
      setIsMarketSwitcherOpen(false);
      setShowFavorites(false);
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setIsSearching(false);
      setIsProcessingCheaper(true);
      setDeferredCheaperOnly(false);
      setVisibleProductCount(6);
      window.scrollTo({ top: 0, behavior: 'auto' });
      cheaperTimeoutRef.current = setTimeout(() => { setDeferredCheaperOnly(true); }, 50); 
    } else {
      setDeferredCheaperOnly(false);
      setIsProcessingCheaper(false);
      setVisibleProductCount(20);
    }
  };

  const handleSearchQueryChange = (q: string) => {
    const wasSearchable = searchQuery.trim().length >= 2;
    const isNowSearchable = q.trim().length >= 2;
    if (isNowSearchable && !wasSearchable) {
      captureHomeScrollBeforeLeave();
    }
    setSearchQuery(q);
    if (isNowSearchable) {
      setSearchReturnState(null);
      setActiveMarketId(null);
      setSelectedCategoryFilter(null);
      setActiveCategoryDropdown(null);
      setIsMarketSwitcherOpen(false);
      if (showFavorites) setShowFavorites(false);
      if (showCheaperOnly) handleShowCheaperOnlyChange(false);
      if (!wasSearchable || debouncedSearchQuery.trim().length < 2) {
        setDebouncedSearchQuery(q);
        setIsSearching(false);
      } else {
        setIsSearching(true);
      }
      if (!wasSearchable) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } else {
      setDebouncedSearchQuery('');
      setIsSearching(false);
    }
  };

  const handleQuickSearch = (q: string) => {
    const wasSearchable = searchQuery.trim().length >= 2;
    const isNowSearchable = q.trim().length >= 2;
    if (isNowSearchable && !wasSearchable) {
      captureHomeScrollBeforeLeave();
    }
    setSearchQuery(q);
    setDebouncedSearchQuery(isNowSearchable ? q : '');
    setIsSearching(false);
    if (isNowSearchable) {
      setSearchReturnState(null);
      setActiveMarketId(null);
      setSelectedCategoryFilter(null);
      setActiveCategoryDropdown(null);
      setIsMarketSwitcherOpen(false);
      if (showFavorites) setShowFavorites(false);
      if (showCheaperOnly) handleShowCheaperOnlyChange(false);
      if (!wasSearchable) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
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
      setDebouncedSearchQuery(searchQuery.trim().length >= 2 ? searchQuery : '');
      setDebouncedMaxPrice(maxPrice || '');
      setIsSearching(false);
    }, 180);
    return () => { clearTimeout(handler); };
  }, [searchQuery, maxPrice]); 

  useEffect(() => { 
    if (showFavorites) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
  }, [showFavorites]);

  // Reset lazy load count & expanded search markets on market, catalog, or search query change
  useEffect(() => {
    setVisibleDetailCount(24);
    if (skipSearchResetRef.current) {
      skipSearchResetRef.current = false;
      return;
    }
    setExpandedSearchMarkets({});
  }, [activeMarketId, activeCatalogByMarket, debouncedSearchQuery, debouncedMaxPrice]);

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
        if (Array.isArray(data) && data.length > 0) {
          const migrated = migrateMarketData(data);
          marketsRef.current = migrated;
          setMarkets(migrated);
          try { localStorage.setItem('marketData_v2', JSON.stringify(migrated)); } catch (e) {}
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      });
      const unsubBanners = supabaseService.subscribeToBanners((b1) => {
        if (b1 && typeof b1 === 'object') {
          const nextAd: BannerData = {
            id: b1.id || 'featured-ad',
            title: b1.title || '',
            imageUrl: b1.imageUrl || '',
            link: b1.link || '',
            isVisible: Boolean(b1.isVisible),
            fitMode: b1.fitMode === 'contain' ? 'contain' : 'cover',
          };
          setFeaturedAd(nextAd);
          setFeaturedAdImgError(false);
          try { localStorage.setItem('featuredAd_v1', JSON.stringify(nextAd)); } catch (e) {}
        }
      });
      return () => { unsubMarkets(); unsubBanners(); clearTimeout(safetyTimer); };
    } else {
      try {
        const savedMarkets = localStorage.getItem('marketData_v2');
        if (savedMarkets) {
          const parsed = JSON.parse(savedMarkets);
          const migrated = migrateMarketData(parsed);
          marketsRef.current = migrated;
          setMarkets(migrated);
        }
      } catch (e) {
        console.error(e);
      } finally { 
        setIsLoading(false); 
        clearTimeout(safetyTimer); 
      }
    }
  }, [isCloudConnected]);

  const handleSaveFeaturedAd = (nextBanner: BannerData) => {
    const normalized: BannerData = {
      id: nextBanner.id || 'featured-ad',
      title: (nextBanner.title || '').trim(),
      imageUrl: (nextBanner.imageUrl || '').trim(),
      link: normalizeAdLinkUrl(nextBanner.link),
      isVisible: Boolean(nextBanner.isVisible && ((nextBanner.imageUrl || '').trim() || (nextBanner.title || '').trim())),
      fitMode: nextBanner.fitMode === 'contain' ? 'contain' : 'cover',
    };
    setFeaturedAd(normalized);
    setFeaturedAdImgError(false);
    try { localStorage.setItem('featuredAd_v1', JSON.stringify(normalized)); } catch (e) {}
    if (isCloudConnected) {
      supabaseService.saveBanners(normalized, normalized);
    }
  };

  const persistMarketsOnly = (nextMarkets: MarketData[]) => {
    try {
      localStorage.setItem('marketData_v2', JSON.stringify(nextMarkets));
    } catch (e) {}
    if (isCloudConnected) {
      supabaseService.saveMarkets(nextMarkets);
    }
  };

  const updateMarketsState = (fn: (prev: MarketData[]) => MarketData[]) => {
    const rawNext = fn(marketsRef.current);
    const normalizedNext = migrateMarketData(rawNext);
    marketsRef.current = normalizedNext;
    setMarkets(normalizedNext);
    persistMarketsOnly(normalizedNext);
  };

  const sortedMarkets = useMemo(() => {
    const visibleMarkets = markets.filter(m => !isOmidMarket(m));
    const baseSorted = sortMarketsByOrder(visibleMarkets);
    return [...baseSorted].sort((a, b) => {
      const expiredA = isMarketFullyExpired(a) ? 1 : 0;
      const expiredB = isMarketFullyExpired(b) ? 1 : 0;
      return expiredA - expiredB;
    });
  }, [markets]);

  const totalHomeProductsCount = useMemo(() => {
    return sortedMarkets.reduce((sum, m) => {
      if (isMarketFullyExpired(m)) return sum;
      const previewCat = m.catalogs && m.catalogs.length > 0 ? m.catalogs[0] : null;
      const prods = previewCat ? (previewCat.products || []) : (m.products || []);
      const activeCount = prods.reduce((acc, p) => {
        const cd = calculateDaysLeft(extractProductEndDate(p, previewCat?.endDate));
        return cd && cd.daysLeft < 0 ? acc : acc + 1;
      }, 0);
      return sum + activeCount;
    }, 0);
  }, [sortedMarkets]);

  // One consistent sample product from each active (non-expired) market, horizontally scrollable
  const sampleFeaturedProducts = useMemo(() => {
    const list: { product: DiscountProduct; market: MarketData }[] = [];
    const usedMarkets = new Set<string>();

    for (const m of sortedMarkets) {
      if (isMarketFullyExpired(m)) continue;

      const catalogsToCheck = (m.catalogs && m.catalogs.length > 0)
        ? m.catalogs
        : [{ endDate: undefined as string | undefined, products: m.products || [] }];

      const validProducts: DiscountProduct[] = [];
      for (const cat of catalogsToCheck) {
        for (const p of (cat.products || [])) {
          if (!p.productName || !p.newPrice || p.newPrice === '---') continue;
          const cd = calculateDaysLeft(extractProductEndDate(p, cat.endDate));
          if (cd && cd.daysLeft < 0) continue;
          validProducts.push(p);
        }
      }

      if (validProducts.length > 0) {
        // Deterministically pick the first valid product with an image (or fallback to first valid product)
        const candidate = validProducts.find(p => !!(p.imageUrl || p.customImageUrl)) || validProducts[0];
        list.push({ product: candidate, market: m });
        usedMarkets.add(m.id);
      }
    }

    const hasAnyProductsAnywhere = sortedMarkets.some(m =>
      (m.catalogs && m.catalogs.length > 0)
        ? m.catalogs.some(c => (c.products || []).length > 0)
        : (m.products || []).length > 0
    );

    // Default sample fallbacks ONLY if no products exist at all in any market
    if (list.length === 0 && !hasAnyProductsAnywhere) {
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
        if (isOmidMarket(m)) return;
        const catalogs = m.catalogs && m.catalogs.length > 0
          ? m.catalogs
          : [{ endDate: undefined, products: m.products || [] }];
        catalogs.forEach(cat => {
            (cat.products || []).forEach(p => {
                const cd = calculateDaysLeft(extractProductEndDate(p, cat.endDate));
                if (cd && cd.daysLeft < 0) return;
                const name = (p.productName || '').trim().toLowerCase();
                const price = parsePriceNumber(p.newPrice);
                if (!isNaN(price) && name) {
                    if (!index.has(name)) index.set(name, []);
                    index.get(name)!.push({ price, marketId: m.id });
                }
            });
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

  const isOpportunityExportOpen = opportunityInstagramIndex !== null;

  const groupedOpportunities = useMemo(() => {
      if (!deferredCheaperOnly && !isOpportunityExportOpen) return [];
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
          if (isOmidMarket(market)) return;
          const catalogs = market.catalogs && market.catalogs.length > 0
            ? market.catalogs
            : [{ endDate: undefined, products: market.products || [] }];
          catalogs.forEach(cat => {
              (cat.products || []).forEach(p => {
                 const cd = calculateDaysLeft(extractProductEndDate(p, cat.endDate));
                 if (cd && cd.daysLeft < 0) return;
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
                 const explicitImg = (p.imageUrl && p.imageUrl.trim()) || (p.customImageUrl && p.customImageUrl.trim()) || undefined;
                 if (!groups.has(normalizedName)) {
                     groups.set(normalizedName, {
                         productName: p.productName,
                         category: p.category,
                         imageUrl: explicitImg,
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
                 if (explicitImg && !group.imageUrl) group.imageUrl = explicitImg;
              });
          });
      });
      const results = Array.from(groups.values())
          .map(g => {
              if (g.variants.length < 2) return { group: g, saving: 0 };
              let minP = Infinity;
              let maxP = -Infinity;
              for (const v of g.variants) {
                  if (v.price < minP) minP = v.price;
                  if (v.price > maxP) maxP = v.price;
              }
              return { group: g, saving: maxP - minP };
          })
          .filter(item => item.saving > 0.0001);

      results.sort((a, b) => {
          if (Math.abs(b.saving - a.saving) > 0.0001) return b.saving - a.saving;
          return (a.group.productName || '').localeCompare(b.group.productName || '');
      });

      return results.map(item => item.group);
  }, [markets, deferredCheaperOnly, isOpportunityExportOpen, debouncedSearchQuery, debouncedMaxPrice]);
  
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
    const isGlobalSearch = debouncedSearchQuery.trim().length > 0;
    return sortedMarkets
      .filter(m => { if (!isGlobalSearch && activeMarketId) return m.id === activeMarketId; return true; })
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
      .filter(m => m.filteredProducts.length > 0 || (!isGlobalSearch && activeMarketId && m.id === activeMarketId)); 
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
          return {
            ...m,
            catalogs: newCatalogs,
            products: newCatalogs[0]?.products || updatedProductsList,
            lastUpdated: new Date().toISOString()
          };
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
        return { ...m, ...updatedMarket, lastUpdated: new Date().toISOString() };
      }
      return m;
    }));
    setMarketToEdit(null);
  };

  const handleDeleteCatalog = (catalogId: string) => {
     if (!activeMarketId) return;
     if (window.confirm("Bu kataloqu silmək istədiyinizə əminsiniz?")) {
        updateMarketsState(prev => prev.map(m => {
            if (m.id === activeMarketId) {
              const remainingCatalogs = m.catalogs?.filter(c => c.id !== catalogId) || [];
              return {
                ...m,
                catalogs: remainingCatalogs,
                products: remainingCatalogs[0]?.products || [],
                lastUpdated: new Date().toISOString()
              };
            }
            return m;
        }));
        setActiveCatalogId(null); 
     }
  };

  const handleUpdateProduct = (updatedProduct: DiscountProduct) => {
    if (!productToEdit || !activeMarketId) return;
    updateMarketsState(prev => prev.map(m => {
      if (m.id !== activeMarketId) return m;
      const newCatalogs = m.catalogs ? [...m.catalogs] : [];
      if (newCatalogs.length === 0) {
        const products = [...(m.products || [])];
        if (productToEdit.index === -1) {
          products.unshift(updatedProduct);
        } else if (products[productToEdit.index]) {
          products[productToEdit.index] = updatedProduct;
        }
        return { ...m, products, lastUpdated: new Date().toISOString() };
      }
      const catIndex = productToEdit.catalogId
        ? newCatalogs.findIndex(c => c.id === productToEdit.catalogId)
        : 0;
      const targetIdx = catIndex >= 0 ? catIndex : 0;
      const products = [...(newCatalogs[targetIdx].products || [])];
      if (productToEdit.index === -1) {
        products.unshift(updatedProduct);
      } else if (products[productToEdit.index]) {
        products[productToEdit.index] = updatedProduct;
      }
      newCatalogs[targetIdx] = {
        ...newCatalogs[targetIdx],
        products,
        lastUpdated: new Date().toISOString()
      };
      return {
        ...m,
        catalogs: newCatalogs,
        products: newCatalogs[0]?.products || [],
        lastUpdated: new Date().toISOString()
      };
    }));
    setProductToEdit(null);
  };
  
  const handleAddProductManually = () => {
      const targetCatalogId = resolvedActiveCatalogId || currentMarket?.catalogs?.[0]?.id;
      setProductToEdit({
          product: { productName: '', oldPrice: '', newPrice: '', discountPercentage: '', category: 'Digər' },
          index: -1,
          catalogId: targetCatalogId || undefined
      });
  };

  const handleEditFromSearch = (product: DiscountProduct, marketId: string) => {
      const market = markets.find(m => m.id === marketId);
      if(!market) return;
      if(market.catalogs && market.catalogs.length > 0) {
          for(const cat of market.catalogs) {
              const idx = (cat.products || []).findIndex(p => p.productName === product.productName && p.newPrice === product.newPrice);
              if(idx !== -1) {
                  setActiveMarketId(marketId);
                  setProductToEdit({ product, index: idx, catalogId: cat.id });
                  return;
              }
          }
      }
      const rootIdx = (market.products || []).findIndex(p => p.productName === product.productName && p.newPrice === product.newPrice);
      if (rootIdx !== -1) {
          setActiveMarketId(marketId);
          setProductToEdit({ product, index: rootIdx, catalogId: market.catalogs?.[0]?.id });
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
    setOpportunityModalIndex(null);
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
    homeScrollYRef.current = 0;
    suspendHomeCaptureRef.current = true;
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
    setOpportunityModalIndex(null);
    setPreviousViewState(null);
    setSearchReturnState(null);
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

  const searchTopBarRef = useRef<HTMLDivElement | null>(null);
  const [searchTopBarHeight, setSearchTopBarHeight] = useState<number>(0);

  const isSearchViewActive =
    searchQuery.trim().length >= 2 ||
    debouncedSearchQuery.trim().length >= 2 ||
    debouncedMaxPrice.length > 0 ||
    showCheaperOnly;

  const isHomeView = !isLoading && activeMarketId === null && !showFavorites && !isSearchViewActive;
  const homeScrollYRef = useRef<number>(0);
  const wasHomeViewRef = useRef<boolean>(false);
  const suspendHomeCaptureRef = useRef<boolean>(false);

  const [displayedHomeProductsCount, setDisplayedHomeProductsCount] = useState<number>(totalHomeProductsCount);
  const displayedHomeCountRef = useRef<number>(totalHomeProductsCount);
  const hasHomeCountBaselineRef = useRef<boolean>(totalHomeProductsCount > 0);

  useEffect(() => {
    if (isLoading || !isHomeView) return;

    const target = totalHomeProductsCount;
    const start = displayedHomeCountRef.current;

    // First real load from empty placeholder (no cached localStorage): snap immediately without 0 -> N animation
    if (!hasHomeCountBaselineRef.current) {
      hasHomeCountBaselineRef.current = true;
      if (start !== target) {
        displayedHomeCountRef.current = target;
        setDisplayedHomeProductsCount(target);
      }
      return;
    }

    // If count didn't change at all, do not run any animation
    if (start === target) return;

    const diff = Math.abs(target - start);
    const duration = diff === 1 ? 150 : Math.min(1150, Math.max(320, diff * 55));

    let rafId = 0;
    const startTimer = window.setTimeout(() => {
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = diff <= 25
          ? 1 - Math.pow(1 - progress, 1.5)
          : 1 - Math.pow(1 - progress, 2.6);

        const nextVal = progress >= 1
          ? target
          : Math.round(start + (target - start) * eased);

        if (nextVal !== displayedHomeCountRef.current) {
          displayedHomeCountRef.current = nextVal;
          setDisplayedHomeProductsCount(nextVal);
        }

        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        }
      };

      rafId = requestAnimationFrame(step);
    }, 120);

    return () => {
      window.clearTimeout(startTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [totalHomeProductsCount, isLoading, isHomeView]);

  const captureHomeScrollBeforeLeave = () => {
    if (!isLoading && activeMarketId === null && !showFavorites && !isSearchViewActive) {
      homeScrollYRef.current = window.scrollY;
      suspendHomeCaptureRef.current = true;
    }
  };

  useLayoutEffect(() => {
    let r1 = 0;
    let r2 = 0;
    if (isHomeView && !wasHomeViewRef.current) {
      const targetY = homeScrollYRef.current || 0;
      suspendHomeCaptureRef.current = true;
      window.scrollTo({ top: targetY, behavior: 'auto' });
      r1 = requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'auto' });
        r2 = requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'auto' });
          suspendHomeCaptureRef.current = false;
        });
      });
    } else if (isHomeView) {
      suspendHomeCaptureRef.current = false;
    }
    wasHomeViewRef.current = isHomeView;
    return () => {
      if (r1) cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, [isHomeView]);

  useEffect(() => {
    if (!isHomeView) return;
    const onHomeScroll = () => {
      if (suspendHomeCaptureRef.current) return;
      homeScrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onHomeScroll, { passive: true });
    return () => window.removeEventListener('scroll', onHomeScroll);
  }, [isHomeView]);

  useEffect(() => {
    if (!isSearchViewActive || activeMarketId !== null || showFavorites) {
      setSearchTopBarHeight(0);
      return;
    }
    const updateSearchTopBarHeight = () => {
      if (searchTopBarRef.current) {
        const h = searchTopBarRef.current.offsetHeight;
        setSearchTopBarHeight(h > 0 ? h : 0);
      } else {
        setSearchTopBarHeight(0);
      }
    };
    updateSearchTopBarHeight();
    const ro = new ResizeObserver(updateSearchTopBarHeight);
    if (searchTopBarRef.current) ro.observe(searchTopBarRef.current);
    window.addEventListener('resize', updateSearchTopBarHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSearchTopBarHeight);
    };
  }, [isSearchViewActive, activeMarketId, showFavorites, showCheaperOnly, filteredMarketData.length, debouncedSearchQuery]);

  // Dual billboard auto-marquee for Home featured sample rows: starts 1s after render, opposite directions, ping-pongs at ends, pauses on touch
  useEffect(() => {
    const isHomeFeaturedVisible =
      !isLoading &&
      activeMarketId === null &&
      !showFavorites &&
      !showCheaperOnly &&
      !isSearchViewActive &&
      !viewProduct &&
      sampleFeaturedProducts.length > 0;

    if (!isHomeFeaturedVisible) return;

    const topEl = featuredCarouselTopRef.current;
    const bottomEl = featuredCarouselBottomRef.current;

    // Initialize positions on first mount of Home rows (bottom starts at far right to glide left)
    const initRaf = requestAnimationFrame(() => {
      if (topEl && !marqueeStateRef.current.top.initialized) {
        marqueeStateRef.current.top.pos = topEl.scrollLeft;
        marqueeStateRef.current.top.lastWritten = topEl.scrollLeft;
        marqueeStateRef.current.top.dir = 1;
        marqueeStateRef.current.top.initialized = true;
      }
      if (bottomEl && !marqueeStateRef.current.bottom.initialized) {
        const bottomMax = Math.max(0, bottomEl.scrollWidth - bottomEl.clientWidth);
        if (bottomMax > 2) {
          bottomEl.scrollLeft = bottomMax;
          marqueeStateRef.current.bottom.pos = bottomMax;
          marqueeStateRef.current.bottom.lastWritten = bottomMax;
        } else {
          marqueeStateRef.current.bottom.pos = bottomEl.scrollLeft;
          marqueeStateRef.current.bottom.lastWritten = bottomEl.scrollLeft;
        }
        marqueeStateRef.current.bottom.dir = -1;
        marqueeStateRef.current.bottom.initialized = true;
      }
    });

    let rafId: number | null = null;
    let lastTime = 0;
    const SPEED_PX_PER_SEC = 26;

    const step = (now: number) => {
      if (lastTime === 0) lastTime = now;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const rows: Array<{ key: 'top' | 'bottom'; el: HTMLDivElement | null }> = [
        { key: 'top', el: featuredCarouselTopRef.current },
        { key: 'bottom', el: featuredCarouselBottomRef.current },
      ];

      for (const { key, el } of rows) {
        if (!el) continue;
        const st = marqueeStateRef.current[key];
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        if (maxScroll <= 2) continue;

        if (marqueePointerDownRef.current[key] || now < marqueePauseUntilRef.current[key]) {
          st.pos = el.scrollLeft;
          st.lastWritten = el.scrollLeft;
          continue;
        }

        // Sync if browser scrolled unexpectedly
        if (Math.abs(el.scrollLeft - st.lastWritten) > 3) {
          st.pos = el.scrollLeft;
        }

        st.pos += st.dir * SPEED_PX_PER_SEC * dt;
        if (st.pos >= maxScroll) {
          st.pos = maxScroll;
          st.dir = -1;
        } else if (st.pos <= 0) {
          st.pos = 0;
          st.dir = 1;
        }
        st.lastWritten = st.pos;
        el.scrollLeft = st.pos;
      }

      rafId = requestAnimationFrame(step);
    };

    const startTimer = window.setTimeout(() => {
      lastTime = 0;
      rafId = requestAnimationFrame(step);
    }, 1000);

    return () => {
      cancelAnimationFrame(initRaf);
      window.clearTimeout(startTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isLoading, activeMarketId, showFavorites, showCheaperOnly, isSearchViewActive, viewProduct, sampleFeaturedProducts.length]);

  const [activeSearchMarketId, setActiveSearchMarketId] = useState<string | null>(null);
  const searchChipsRowRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollTimerRef = useRef<number | null>(null);
  const isProgrammaticSearchScrollRef = useRef<boolean>(false);
  const clickedSearchMarketRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSearchViewActive || activeMarketId !== null || showFavorites || showCheaperOnly || filteredMarketData.length === 0) {
      clickedSearchMarketRef.current = null;
      isProgrammaticSearchScrollRef.current = false;
      setActiveSearchMarketId(null);
      return;
    }

    const cancelProgrammaticAndUnlockOnManualInput = () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
        programmaticScrollTimerRef.current = null;
      }
      isProgrammaticSearchScrollRef.current = false;
    };

    const handleScrollEnd = () => {
      if (isProgrammaticSearchScrollRef.current) {
        cancelProgrammaticAndUnlockOnManualInput();
      }
    };

    const updateActiveSearchMarket = () => {
      if (isProgrammaticSearchScrollRef.current) return;
      const headerH = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
      const barH = searchTopBarRef.current?.offsetHeight || searchTopBarHeight;
      const stickyBottom = headerH + barH;
      const focusY = stickyBottom + 96;

      // If the user explicitly clicked a market chip, keep it active while at its section or near page bottom
      const lockedId = clickedSearchMarketRef.current;
      if (lockedId) {
        const lockedEl = document.getElementById(`search-market-card-${lockedId}`);
        if (lockedEl) {
          const lRect = lockedEl.getBoundingClientRect();
          const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 40;
          const matchesTopFocus = lRect.top <= focusY && lRect.bottom > stickyBottom + 40;
          const visibleAtPageBottom = atPageBottom && lRect.top < window.innerHeight - 40 && lRect.bottom > stickyBottom + 40;
          if (matchesTopFocus || visibleAtPageBottom) {
            setActiveSearchMarketId(prev => (prev === lockedId ? prev : lockedId));
            return;
          }
        }
        clickedSearchMarketRef.current = null;
      }

      let currentId = filteredMarketData[0]?.id ?? null;
      for (const m of filteredMarketData) {
        const el = document.getElementById(`search-market-card-${m.id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= focusY && rect.bottom > stickyBottom + 40) {
          currentId = m.id;
        }
      }
      setActiveSearchMarketId(prev => (prev === currentId ? prev : currentId));
    };

    updateActiveSearchMarket();
    window.addEventListener('scroll', updateActiveSearchMarket, { passive: true });
    window.addEventListener('scrollend', handleScrollEnd, { passive: true });
    window.addEventListener('wheel', cancelProgrammaticAndUnlockOnManualInput, { passive: true });
    window.addEventListener('touchstart', cancelProgrammaticAndUnlockOnManualInput, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateActiveSearchMarket);
      window.removeEventListener('scrollend', handleScrollEnd);
      window.removeEventListener('wheel', cancelProgrammaticAndUnlockOnManualInput);
      window.removeEventListener('touchstart', cancelProgrammaticAndUnlockOnManualInput);
    };
  }, [isSearchViewActive, activeMarketId, showFavorites, showCheaperOnly, filteredMarketData, stickyHeaderHeight, searchTopBarHeight]);

  useEffect(() => {
    if (activeSearchMarketId && searchChipsRowRef.current) {
      searchChipsRowRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [activeSearchMarketId]);

  const topCategoryPillsRef = useRef<HTMLDivElement | null>(null);
  const clickedCategoryRef = useRef<string | null>(null);
  const [scrolledCategoryInfo, setScrolledCategoryInfo] = useState<{
    name: string;
    count: number;
    colorIdx: number;
  } | null>(null);

  useEffect(() => {
    if (!activeMarketId || showFavorites || showCheaperOnly) {
      clickedCategoryRef.current = null;
      setScrolledCategoryInfo(null);
      return;
    }

    const clearClickedCategory = () => {
      clickedCategoryRef.current = null;
    };

    const updateScrolledCategory = () => {
      const pillsEl = topCategoryPillsRef.current;
      const headerEl = stickyHeaderRef.current;
      if (!pillsEl || !headerEl) {
        setScrolledCategoryInfo(null);
        return;
      }

      const headerBottom = headerEl.getBoundingClientRect().bottom;
      const pillsBottom = pillsEl.getBoundingClientRect().bottom;

      // Keep category pills strictly single-instance: hide sticky header badge while top pills are still visible
      if (pillsBottom > headerBottom + 4) {
        setScrolledCategoryInfo(null);
        return;
      }

      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-category-section="true"]'));
      if (sections.length === 0) {
        setScrolledCategoryInfo(null);
        return;
      }

      let activeSection = sections[0];
      for (const sec of sections) {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= headerBottom + 24) {
          activeSection = sec;
        } else {
          break;
        }
      }

      if (clickedCategoryRef.current) {
        const clickedSec = sections.find(s => s.dataset.categoryName === clickedCategoryRef.current);
        if (clickedSec) {
          const clickedRect = clickedSec.getBoundingClientRect();
          if (clickedRect.top >= headerBottom - 20 && clickedRect.top < window.innerHeight) {
            activeSection = clickedSec;
          }
        }
      }

      const catName = activeSection.dataset.categoryName || '';
      const catCount = Number(activeSection.dataset.categoryCount || '0');
      const colorIdx = Number(activeSection.dataset.categoryColorIdx || '0');

      if (!catName) {
        setScrolledCategoryInfo(null);
        return;
      }

      setScrolledCategoryInfo(prev =>
        prev && prev.name === catName && prev.count === catCount && prev.colorIdx === colorIdx
          ? prev
          : { name: catName, count: catCount, colorIdx }
      );
    };

    updateScrolledCategory();
    window.addEventListener('scroll', updateScrolledCategory, { passive: true });
    window.addEventListener('resize', updateScrolledCategory);
    window.addEventListener('wheel', clearClickedCategory, { passive: true });
    window.addEventListener('touchstart', clearClickedCategory, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScrolledCategory);
      window.removeEventListener('resize', updateScrolledCategory);
      window.removeEventListener('wheel', clearClickedCategory);
      window.removeEventListener('touchstart', clearClickedCategory);
    };
  }, [activeMarketId, showFavorites, showCheaperOnly, visibleDetailCount, activeCatalogByMarket, debouncedSearchQuery, debouncedMaxPrice]);

  // Check if any modal is currently open
  const hasOpenModal = Boolean(
    viewProduct ||
    opportunityModalIndex !== null ||
    opportunityInstagramIndex !== null ||
    isScannerOpen ||
    isLoginModalOpen ||
    isAddMarketModalOpen ||
    marketToEdit ||
    productToEdit ||
    isDatabaseModalOpen ||
    isFeaturedAdModalOpen
  );

  // Check if search or any subpage view is active
  const isSearchActive = searchQuery.trim().length >= 2;
  const isSubpageActive = activeMarketId !== null || showFavorites || showCheaperOnly;
  const hasActiveSubpage = Boolean(isSubpageActive || isSearchActive);

  // Target history depth:
  // 0: Root Home page
  // 1: Subpage (market / favorites / cheaper)
  // +1 if Search query is active
  // +1 if navigated into a market from Search (so Back returns to Search first)
  // +1 if Modal is open
  let targetDepth = 0;
  if (isSubpageActive) targetDepth += 1;
  if (isSearchActive) targetDepth += 1;
  if (searchReturnState && isSubpageActive && !isSearchActive) targetDepth += 1;
  if (hasOpenModal) targetDepth += 1;

  const closeAllModals = useCallback(() => {
    setViewProduct(null);
    setOpportunityModalIndex(null);
    setOpportunityInstagramIndex(null);
    setIsScannerOpen(false);
    setIsLoginModalOpen(false);
    setIsAddMarketModalOpen(false);
    setMarketToEdit(null);
    setProductToEdit(null);
    setIsDatabaseModalOpen(false);
    setIsFeaturedAdModalOpen(false);
  }, []);

  const hasOpenModalRef = useRef(hasOpenModal);
  hasOpenModalRef.current = hasOpenModal;

  const hasActiveSubpageRef = useRef(hasActiveSubpage);
  hasActiveSubpageRef.current = hasActiveSubpage;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const searchReturnStateRef = useRef(searchReturnState);
  searchReturnStateRef.current = searchReturnState;

  const restoreFromSearchReturn = useCallback(() => {
    const saved = searchReturnStateRef.current;
    if (!saved) return;
    skipSearchResetRef.current = true;
    setSearchReturnState(null);
    setActiveMarketId(null);
    setSelectedCategoryFilter(null);
    setActiveCategoryDropdown(null);
    setIsMarketSwitcherOpen(false);
    setShowFavorites(false);
    setDeferredCheaperOnly(false);
    setIsProcessingCheaper(false);
    setShowCheaperOnly(false);
    setSearchQuery(saved.searchQuery);
    setDebouncedSearchQuery(saved.searchQuery);
    setMaxPrice(saved.maxPrice);
    setDebouncedMaxPrice(saved.maxPrice);
    setExpandedSearchMarkets(saved.expandedSearchMarkets || {});
    setIsSearching(false);
    const targetY = saved.scrollY || 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      });
    });
  }, []);

  const restoreFromSearchReturnRef = useRef(restoreFromSearchReturn);
  restoreFromSearchReturnRef.current = restoreFromSearchReturn;

  const handleResetAppRef = useRef(handleResetApp);
  handleResetAppRef.current = handleResetApp;

  const closeAllModalsRef = useRef(closeAllModals);
  closeAllModalsRef.current = closeAllModals;

  // Initialize and listen for popstate (mobile hardware back button / swipe back gesture)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
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
        if (searchQueryRef.current.trim().length >= 2) {
          setSearchQuery('');
          setDebouncedSearchQuery('');
          setIsSearching(false);
          return;
        }
        // 3. If user navigated to a market from Search Results, return to Search Results first!
        if (searchReturnStateRef.current) {
          restoreFromSearchReturnRef.current();
          return;
        }
        // 4. Otherwise exit market or subpage to root home
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

  const activeMarketCategoriesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    activeMarketFilteredProducts.forEach(p => {
      const cat = (p.category || 'Digər').trim() || 'Digər';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [activeMarketFilteredProducts]);

  const activeMarketHasCategories =
    activeMarketCategoriesWithCounts.length > 0 &&
    !(activeMarketCategoriesWithCounts.length === 1 && activeMarketCategoriesWithCounts[0].name.toLowerCase() === 'digər');

  const activeMarketCategoryColorIndexMap = useMemo(
    () => new Map(activeMarketCategoriesWithCounts.map((c, idx) => [c.name, idx % CATEGORY_TAG_COLORS.length])),
    [activeMarketCategoriesWithCounts]
  );

  const activeMarketFullOrderedProducts = useMemo(() => {
    if (!activeMarketHasCategories) return activeMarketFilteredProducts;
    const catOrderMap = new Map<string, DiscountProduct[]>();
    activeMarketFilteredProducts.forEach(p => {
      const cat = (p.category || 'Digər').trim() || 'Digər';
      if (!catOrderMap.has(cat)) catOrderMap.set(cat, []);
      catOrderMap.get(cat)!.push(p);
    });
    return Array.from(catOrderMap.values()).flat();
  }, [activeMarketHasCategories, activeMarketFilteredProducts]);

  const scrollToActiveCategorySection = (categoryName: string) => {
    if (!activeMarketObj) return;
    clickedCategoryRef.current = categoryName;
    const startIdx = activeMarketFullOrderedProducts.findIndex(
      p => ((p.category || 'Digər').trim() || 'Digər') === categoryName
    );
    const catInfo = activeMarketCategoriesWithCounts.find(c => c.name === categoryName);
    const neededCount = startIdx >= 0 ? startIdx + (catInfo?.count || 1) + 12 : visibleDetailCount;

    if (neededCount > visibleDetailCount) {
      pendingCategoryScrollRef.current = { marketId: activeMarketObj.id, category: categoryName };
      setVisibleDetailCount(neededCount);
    } else {
      pendingCategoryScrollRef.current = null;
      requestAnimationFrame(() => {
        const targetId = `category-section-${activeMarketObj.id}-${encodeURIComponent(categoryName)}`;
        const el = document.getElementById(targetId);
        if (el) {
          const headerOffset = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
          const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset - 8;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
        }
      });
    }
  };

  // Non-visual SEO metadata, canonical URL, OpenGraph & Schema.org JSON-LD synchronization
  useEffect(() => {
    const baseTitle = 'endirim.net – Market Endirimləri və Qiymət Müqayisəsi';
    const baseDescription = 'Oba, Araz, Bravo, Bazarstore, Rahat, Bolmart və digər marketlərin endirim kataloqlarını izləyin, ərzaq qiymətlərini müqayisə edib qənaət edin.';

    let pageTitle = baseTitle;
    let pageDescription = baseDescription;

    if (viewProduct?.product) {
      const pName = viewProduct.product.productName;
      const mName = viewProduct.marketName;
      pageTitle = `${pName} (${viewProduct.product.newPrice} ₼) – ${mName} | endirim.net`;
      pageDescription = `${mName} mağazasında ${pName} endirimli qiyməti ${viewProduct.product.newPrice} ₼. Digər marketlərlə qiyməti müqayisə edin.`;
    } else if (debouncedSearchQuery.trim().length > 0) {
      const q = debouncedSearchQuery.trim();
      pageTitle = `«${q}» axtarış nəticələri – endirim.net`;
      pageDescription = `«${q}» üzrə Oba, Araz, Bravo, Bazarstore və digər marketlərdəki ən sərfəli endirim qiymətlərini müqayisə edin.`;
    } else if (showCheaperOnly) {
      pageTitle = 'Fürsətlər – Ən Ucuz Market Qiymətləri | endirim.net';
      pageDescription = 'Müxtəlif marketlər arasında eyni məhsulların ən sərfəli qiymətlərini və endirim fürsətlərini müqayisə edin.';
    } else if (showFavorites) {
      pageTitle = 'Seçilənlər – endirim.net';
      pageDescription = 'Yadda saxladığınız endirimli məhsulları bir yerdə izləyin.';
    } else if (activeMarketObj) {
      pageTitle = `${activeMarketObj.name} Endirim Kataloqu – endirim.net`;
      pageDescription = `${activeMarketObj.name} üzrə ${activeMarketFilteredProducts.length} endirimli məhsulu və aktual kampaniya qiymətlərini izləyin.`;
    }

    document.title = pageTitle;

    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    upsertMeta('name', 'description', pageDescription);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:title', pageTitle);
    upsertMeta('property', 'og:description', pageDescription);
    upsertMeta('name', 'twitter:title', pageTitle);
    upsertMeta('name', 'twitter:description', pageDescription);

    let ldScript = document.getElementById('dynamic-seo-jsonld') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.id = 'dynamic-seo-jsonld';
      ldScript.type = 'application/ld+json';
      document.head.appendChild(ldScript);
    }

    const structuredData = viewProduct?.product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: viewProduct.product.productName,
          category: viewProduct.product.category,
          offers: {
            '@type': 'Offer',
            price: String(viewProduct.product.newPrice).replace(',', '.').replace(/[^0-9.]/g, '') || '0',
            priceCurrency: 'AZN',
            seller: {
              '@type': 'Organization',
              name: viewProduct.marketName
            }
          }
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: pageTitle,
          description: pageDescription,
          url: canonicalUrl,
          inLanguage: 'az'
        };

    ldScript.textContent = JSON.stringify(structuredData);
  }, [
    viewProduct,
    debouncedSearchQuery,
    showCheaperOnly,
    showFavorites,
    activeMarketObj,
    activeMarketFilteredProducts.length
  ]);

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
          {!isLoading && !showFavorites && !showCheaperOnly && activeMarketId !== null && activeMarketObj ? (
            <>
              {(isMarketSwitcherOpen || activeCategoryDropdown === activeMarketObj.id) && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMarketSwitcherOpen(false);
                    setActiveCategoryDropdown(null);
                  }} 
                />
              )}
              <div className="relative z-50 bg-white/95 backdrop-blur-md border-t border-b border-gray-100 py-1.5 sm:py-2 px-2.5 sm:px-4 shadow-xs">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                  {/* Left: Back to Home + Market Switcher & Category Dropdown */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMarketSwitcherOpen(false);
                        setActiveCategoryDropdown(null);
                        if (searchQuery.trim().length >= 2) {
                          setSearchQuery('');
                          setDebouncedSearchQuery('');
                          setIsSearching(false);
                        } else if (searchReturnState) {
                          restoreFromSearchReturn();
                        } else {
                          handleSelectMarket(null);
                        }
                      }}
                      className="p-1.5 sm:p-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 rounded-lg sm:rounded-xl border border-gray-200 transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                      title={searchReturnState ? "Axtarış nəticələrinə qayıt" : "Geri qayıt"}
                    >
                      <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" strokeWidth={2.5} />
                      <span className="hidden sm:inline text-xs font-bold text-gray-700">Geri</span>
                    </button>

                    <div className="relative min-w-0">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategoryDropdown(null);
                            setIsMarketSwitcherOpen(prev => !prev);
                          }}
                          title="Bütün marketləri gör və seç"
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border border-gray-100 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
                        >
                          {activeMarketObj.logoUrl ? (
                            <img src={activeMarketObj.logoUrl} alt={activeMarketObj.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <span className={`text-${activeMarketObj.themeColor || 'green'}-700 font-bold text-sm sm:text-lg`}>{activeMarketObj.logoPlaceholder}</span>
                          )}
                        </button>

                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryDropdown(null);
                              setIsMarketSwitcherOpen(prev => !prev);
                            }}
                            title="Bütün marketləri gör və seç"
                            className="flex items-center gap-1 sm:gap-1.5 min-w-0 text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group"
                          >
                            <h2 className="text-sm sm:text-base md:text-lg font-black text-gray-900 truncate tracking-tight">{activeMarketObj.name}</h2>
                            <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-700 shrink-0 transition-transform duration-200 ${isMarketSwitcherOpen ? 'rotate-180 text-gray-800' : ''}`} />
                            {activeDateStatus.label && (
                              <span className={`hidden sm:inline-block text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${activeDateStatus.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                {activeDateStatus.label}
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap mt-0.5">
                            <span className="text-[10px] sm:text-xs text-gray-400 font-medium shrink-0">
                              {activeMarketFilteredProducts.length} məhsul
                            </span>
                            {scrolledCategoryInfo && activeMarketHasCategories && (() => {
                              const scColor = CATEGORY_TAG_COLORS[scrolledCategoryInfo.colorIdx % CATEGORY_TAG_COLORS.length] || CATEGORY_TAG_COLORS[0];
                              const isCatOpen = activeCategoryDropdown === activeMarketObj.id;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMarketSwitcherOpen(false);
                                    setActiveCategoryDropdown(prev => prev === activeMarketObj.id ? null : activeMarketObj.id);
                                  }}
                                  title="Kateqoriyaları aç və seç"
                                  className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md border text-[10px] sm:text-xs font-extrabold min-w-0 max-w-[175px] sm:max-w-[270px] cursor-pointer active:scale-95 transition-all shadow-2xs ${scColor.chip}`}
                                >
                                  <span className="truncate">{scrolledCategoryInfo.name}</span>
                                  <span className={`text-[9px] sm:text-[10px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${scColor.count}`}>
                                    {scrolledCategoryInfo.count}
                                  </span>
                                  <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isCatOpen ? 'rotate-180' : ''}`} />
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Market Switcher Dropdown (Category-style list) */}
                      {isMarketSwitcherOpen && (
                        <div className="absolute left-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 bg-white z-10">
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

                      {/* Vertical Categories Dropdown */}
                      {activeCategoryDropdown === activeMarketObj.id && activeMarketHasCategories && (
                        <div className="absolute left-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto animate-[fadeIn_0.15s_ease-out]">
                          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 bg-white z-10">
                            <span>Kateqoriyalar</span>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActiveCategoryDropdown(null); }}
                              className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {activeMarketCategoriesWithCounts.map((cat) => {
                            const cIdx = activeMarketCategoryColorIndexMap.get(cat.name) ?? 0;
                            const cColor = CATEGORY_TAG_COLORS[cIdx] || CATEGORY_TAG_COLORS[0];
                            const isCurrentCat = scrolledCategoryInfo?.name === cat.name;
                            return (
                              <button
                                key={`sticky-cat-${cat.name}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCategoryDropdown(null);
                                  scrollToActiveCategorySection(cat.name);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isCurrentCat
                                    ? 'bg-gray-100 font-bold text-gray-900'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 border ${cColor.chip}`} />
                                  <span className="truncate">{cat.name}</span>
                                </div>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${cColor.count}`}>
                                  {cat.count}
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
                          type="button"
                          onClick={() => {
                            setAdminSortByDiscount(prev => !prev);
                            setVisibleDetailCount(24);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[11px] sm:text-xs border transition-all cursor-pointer active:scale-95 ${
                            adminSortByDiscount
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Məhsulları ən yüksək endirim faizinə görə sırala"
                        >
                          <Percent className="w-3.5 h-3.5" />
                          <span className="sm:hidden">Endirim</span>
                          <span className="hidden sm:inline">Ən yüksək endirim</span>
                        </button>
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

                    {/* View Mode Toggle: 3-column Grid (default) vs 2-column Grid */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 shrink-0" role="group" aria-label="Görünüş rejimi">
                      <button
                        type="button"
                        onClick={() => setProductViewMode('grid')}
                        className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${
                          productViewMode === 'grid'
                            ? 'bg-white text-emerald-600 shadow-2xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="3-lü cərgə"
                      >
                        <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductViewMode('two')}
                        className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${
                          productViewMode === 'two'
                            ? 'bg-white text-emerald-600 shadow-2xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="2-li cərgə"
                      >
                        <Grid2x2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
              onClick={() => setIsFeaturedAdModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 shadow-sm cursor-pointer"
              title="Örnəklər sırasındakı reklam görsəlini və linkini düzəlt"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Reklam (Örnək)
            </button>
            <button 
              onClick={() => setOpportunityInstagramIndex(0)}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm cursor-pointer"
              title="Fürsətlər üçün Instagram şəklini hazırla və indir"
            >
              <Download className="w-3.5 h-3.5" />
              Fürsət Şəkli (IG)
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
            <h1 className="sr-only">endirim.net – Market Endirimləri və Qiymət Müqayisəsi</h1>

            {showFavorites ? (
               <div className="animate-[fadeIn_0.5s_ease-out]">
                  <div
                    style={{ top: `${stickyHeaderHeight}px` }}
                    className="sticky z-30 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl px-2.5 sm:px-3.5 py-2 mb-4 sm:mb-6 shadow-xs flex items-center justify-between gap-2 transition-[top] duration-150"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setShowFavorites(false)}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-700 hover:text-green-700 active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Ana səhifəyə qayıt"
                      >
                        <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shadow-2xs shrink-0">
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </div>
                        <span>Geri</span>
                      </button>
                      <span className="h-4 w-px bg-gray-200 shrink-0" aria-hidden="true" />
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 truncate">
                         <Heart className="w-4 h-4 text-red-500 fill-current shrink-0" />
                         <span className="truncate">Yadda Saxlanılanlar</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80" role="group" aria-label="Görünüş rejimi">
                        <button
                          type="button"
                          onClick={() => setProductViewMode('grid')}
                          className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'grid' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                          title="3-lü cərgə"
                        >
                          <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductViewMode('two')}
                          className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'two' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                          title="2-li cərgə"
                        >
                          <Grid2x2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">{favorites.length} məhsul</span>
                    </div>
                  </div>
                  {favorites.length > 0 ? (
                    <div className={`${productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-4' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4'} transition-all duration-300 ${isSearching ? 'blur-sm opacity-60' : ''}`}>
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
                                    isListMode={false}
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
                                    onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(
                                      product,
                                      {
                                        id: market?.id || product.marketId,
                                        name: marketName,
                                        logoUrl: market?.logoUrl,
                                        logoPlaceholder: market?.logoPlaceholder || marketName[0] || 'M'
                                      },
                                      market?.catalogs?.[0]?.endDate
                                    ) : undefined}
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
                 {(searchQuery.trim().length >= 2 || debouncedSearchQuery.trim().length >= 2 || debouncedMaxPrice.length > 0 || showCheaperOnly) ? (
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
                        {/* Sabit (Sticky) Geri düyməsi, Görünüş seçimi və sürüşdürülən Market çipləri */}
                        <div
                          ref={searchTopBarRef}
                          style={{ top: `${stickyHeaderHeight}px` }}
                          className="sticky z-30 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl px-2.5 sm:px-3.5 py-2 mb-3 shadow-xs space-y-2 transition-[top] duration-150"
                        >
                          <div className="flex items-center justify-between gap-2">
                            {debouncedSearchQuery.trim().length > 0 ? (
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setDebouncedSearchQuery('');
                                    setIsSearching(false);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-700 hover:text-green-700 active:scale-95 transition-all cursor-pointer shrink-0"
                                  title="Axtarışı təmizlə və geri qayıt"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shadow-2xs shrink-0">
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </div>
                                  <span>Geri</span>
                                </button>
                                <span className="h-4 w-px bg-gray-200 shrink-0" aria-hidden="true" />
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                    {debouncedSearchQuery}
                                  </span>
                                </div>
                              </div>
                            ) : showCheaperOnly ? (
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => handleShowCheaperOnlyChange(false)}
                                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-700 hover:text-green-700 active:scale-95 transition-all cursor-pointer shrink-0"
                                  title="Fürsətlərdən çıx və geri qayıt"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shadow-2xs shrink-0">
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </div>
                                  <span>Geri</span>
                                </button>
                                <span className="h-4 w-px bg-gray-200 shrink-0" aria-hidden="true" />
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                    Ümumi fürsətlər
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs sm:text-sm font-bold text-gray-700">Nəticələr</span>
                            )}

                            {!showCheaperOnly && (
                              <div className="flex items-center bg-gray-100/90 p-0.5 rounded-lg border border-gray-200/90 shrink-0" role="group" aria-label="Görünüş rejimi">
                                <button
                                  type="button"
                                  onClick={() => setProductViewMode('grid')}
                                  className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'grid' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                  title="3-lü cərgə"
                                >
                                  <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProductViewMode('two')}
                                  className={`p-1 sm:p-1.5 rounded-md transition-all cursor-pointer ${productViewMode === 'two' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                  title="2-li cərgə"
                                >
                                  <Grid2x2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {!showCheaperOnly && filteredMarketData.length > 0 && (() => {
                            const effectiveActiveId = (
                              activeSearchMarketId && filteredMarketData.some(m => m.id === activeSearchMarketId)
                                ? activeSearchMarketId
                                : filteredMarketData[0]?.id
                            );
                            const orderedChipMarkets = effectiveActiveId
                              ? [
                                  ...filteredMarketData.filter(m => m.id === effectiveActiveId),
                                  ...filteredMarketData.filter(m => m.id !== effectiveActiveId)
                                ]
                              : filteredMarketData;

                            return (
                              <div
                                ref={searchChipsRowRef}
                                className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide pt-2 border-t border-gray-100"
                              >
                                {orderedChipMarkets.map((m) => {
                                  const shortName = m.name.replace(/\s+market$/i, '').trim().split(/\s+/)[0] || m.name;
                                  const isActiveChip = effectiveActiveId === m.id;
                                  return (
                                    <button
                                      key={`search-jump-${m.id}`}
                                      type="button"
                                      onClick={() => {
                                        const targetEl = document.getElementById(`search-market-card-${m.id}`);
                                        if (targetEl) {
                                          if (programmaticScrollTimerRef.current !== null) {
                                            window.clearTimeout(programmaticScrollTimerRef.current);
                                          }
                                          isProgrammaticSearchScrollRef.current = true;
                                          clickedSearchMarketRef.current = m.id;
                                          setActiveSearchMarketId(m.id);
                                          if (searchChipsRowRef.current) {
                                            searchChipsRowRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                                          }
                                          const headerH = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
                                          const barH = searchTopBarRef.current?.offsetHeight || searchTopBarHeight;
                                          const y = targetEl.getBoundingClientRect().top + window.scrollY - headerH - barH - 6;
                                          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                                          programmaticScrollTimerRef.current = window.setTimeout(() => {
                                            isProgrammaticSearchScrollRef.current = false;
                                          }, 1300);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all active:scale-95 shrink-0 cursor-pointer select-none shadow-2xs ${
                                        isActiveChip
                                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                                          : 'bg-white hover:bg-gray-50 border-gray-200/90 text-gray-900'
                                      }`}
                                      title={`${m.name} (${m.filteredProducts.length} məhsul)`}
                                    >
                                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white border border-gray-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                        {m.logoUrl ? (
                                          <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-0.5 sm:p-1" />
                                        ) : (
                                          <span className={`text-${m.themeColor || 'green'}-700 font-black text-xs sm:text-sm`}>
                                            {m.logoPlaceholder}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-sm sm:text-base font-black tracking-tight">{shortName}</span>
                                      <span className={`inline-flex items-center justify-center min-w-[22px] px-2 py-0.5 rounded-full text-xs sm:text-sm font-black leading-none ${
                                        isActiveChip
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {m.filteredProducts.length}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                        {showCheaperOnly && (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl border border-green-200">
                              <TrendingDown className="w-4 h-4" />
                              <span className="font-bold">Fürsətlər</span>
                              {isAdmin && <button onClick={handleRefreshComparison} className="hover:rotate-180 transition-transform"><RotateCcw className="w-3 h-3" /></button>}
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setOpportunityInstagramIndex(0)}
                                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                                <span>Instagram Şəkli İndir</span>
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                        {showCheaperOnly ? (() => {
                            const visibleGroups = groupedOpportunities.slice(0, visibleProductCount);
                            const colBuckets: Array<Array<{ group: typeof visibleGroups[number]; idx: number }>> = Array.from(
                              { length: opportunityCols },
                              () => []
                            );
                            const colHeights = new Array(opportunityCols).fill(0);
                            visibleGroups.forEach((group, idx) => {
                              let shortestCol = 0;
                              for (let c = 1; c < opportunityCols; c++) {
                                if (colHeights[c] < colHeights[shortestCol]) {
                                  shortestCol = c;
                                }
                              }
                              colBuckets[shortestCol].push({ group, idx });
                              colHeights[shortestCol] += 220 + group.variants.length * 42;
                            });
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 items-start mt-4 sm:mt-6">
                                {colBuckets.map((colItems, colIdx) => (
                                  <div key={`opp-col-${colIdx}`} className="flex flex-col gap-2 sm:gap-4 min-w-0">
                                    {colItems.map(({ group, idx }) => (
                                      <GroupedProductCard
                                        key={`${group.productName}-${idx}`}
                                        productName={group.productName}
                                        category={group.category}
                                        imageUrl={group.imageUrl}
                                        variants={group.variants}
                                        onClick={() => setOpportunityModalIndex(idx)}
                                        isAdmin={isAdmin}
                                        onExportInstagram={() => exportOpportunityPosterPng(group)}
                                      />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            );
                        })() : (() => {
                            const allSearchModalList = filteredMarketData.flatMap(m => {
                              const mEndDate = m.catalogs?.[0]?.endDate;
                              return m.filteredProducts.map(p => ({
                                product: p,
                                marketName: m.name,
                                marketId: m.id,
                                catalogEndDate: mEndDate
                              }));
                            });

                            return filteredMarketData.map((market) => {
                              const marketEndDate = market.catalogs?.[0]?.endDate;
                              return (
                                <SearchMarketResultCard
                                  key={market.id}
                                  market={market}
                                  filteredProducts={market.filteredProducts}
                                  productViewMode={productViewMode}
                                  isAdmin={isAdmin}
                                  isFavorite={isFavorite}
                                  onToggleFavorite={toggleFavorite}
                                  onProductClick={(product) => {
                                    if (!isAdmin) {
                                      const clickedIdx = allSearchModalList.findIndex(
                                        item => item.product === product && item.marketId === market.id
                                      );
                                      setViewProduct({
                                        product,
                                        marketName: market.name,
                                        marketId: market.id,
                                        catalogEndDate: marketEndDate,
                                        productList: allSearchModalList,
                                        currentIndex: clickedIdx >= 0 ? clickedIdx : 0
                                      });
                                    }
                                  }}
                                  onEditProduct={(product) => handleEditFromSearch(product, market.id)}
                                />
                              );
                            });
                        })()}
                    </div>
                  </div>
                ) : (
                  <>
                    {activeMarketId === null ? (
                      <div className="space-y-4 sm:space-y-5 animate-[fadeIn_0.4s_ease-out] max-w-2xl sm:max-w-3xl mx-auto">
                        {/* Two independent horizontally scrollable rows of wide horizontal featured cards */}
                        {sampleFeaturedProducts.length > 0 && (() => {
                          type MarqueeRowItem =
                            | { type: 'product'; product: DiscountProduct; market: MarketData }
                            | { type: 'ad' };
                          const topRowProducts: MarqueeRowItem[] = sampleFeaturedProducts
                            .filter((_, i) => i % 2 === 0)
                            .map(entry => ({ type: 'product', ...entry }));
                          const bottomRowProducts: MarqueeRowItem[] = sampleFeaturedProducts
                            .filter((_, i) => i % 2 === 1)
                            .map(entry => ({ type: 'product', ...entry }));

                          topRowProducts.splice(Math.min(1, topRowProducts.length), 0, { type: 'ad' });

                          const sampleRows = [
                            { key: 'top', items: topRowProducts, ref: featuredCarouselTopRef },
                            ...(bottomRowProducts.length > 0
                              ? [{ key: 'bottom', items: bottomRowProducts, ref: featuredCarouselBottomRef }]
                              : [])
                          ];

                          return (
                            <div className="space-y-2 sm:space-y-2.5">
                              {sampleRows.map((row) => {
                                const rowKey = row.key as 'top' | 'bottom';
                                return (
                                <div key={`sample-row-${row.key}`} className="relative group/carousel">
                                  {/* Left scroll arrow (desktop) */}
                                  <button
                                    type="button"
                                    onClick={() => scrollFeaturedRow(rowKey, row.ref, 'left')}
                                    className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    title="Əvvəlki"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>

                                  <div
                                    ref={row.ref}
                                    data-marquee-row={rowKey}
                                    onTouchStart={() => {
                                      marqueePointerDownRef.current[rowKey] = true;
                                      marqueePauseUntilRef.current[rowKey] = Infinity;
                                    }}
                                    onTouchEnd={() => {
                                      marqueePointerDownRef.current[rowKey] = false;
                                      marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                    }}
                                    onTouchCancel={() => {
                                      marqueePointerDownRef.current[rowKey] = false;
                                      marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                    }}
                                    onPointerDown={(e) => {
                                      if (e.pointerType !== 'touch') {
                                        marqueePointerDownRef.current[rowKey] = true;
                                        marqueePauseUntilRef.current[rowKey] = Infinity;
                                      }
                                    }}
                                    onPointerUp={(e) => {
                                      if (e.pointerType !== 'touch') {
                                        marqueePointerDownRef.current[rowKey] = false;
                                        marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                      }
                                    }}
                                    onPointerCancel={(e) => {
                                      if (e.pointerType !== 'touch') {
                                        marqueePointerDownRef.current[rowKey] = false;
                                        marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                      }
                                    }}
                                    onPointerLeave={(e) => {
                                      if (e.pointerType !== 'touch' && marqueePointerDownRef.current[rowKey]) {
                                        marqueePointerDownRef.current[rowKey] = false;
                                        marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                      }
                                    }}
                                    onWheel={() => {
                                      marqueePauseUntilRef.current[rowKey] = performance.now() + 3000;
                                    }}
                                    onScroll={(e) => {
                                      const el = e.currentTarget;
                                      const st = marqueeStateRef.current[rowKey];
                                      if (Math.abs(el.scrollLeft - st.lastWritten) > 3) {
                                        st.pos = el.scrollLeft;
                                        st.lastWritten = el.scrollLeft;
                                        marqueePauseUntilRef.current[rowKey] = performance.now() + 2600;
                                      }
                                    }}
                                    className="flex gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide py-0.5 px-0.5"
                                  >
                                    {row.items.map((item, idx) => {
                                      if (item.type === 'ad') {
                                        const adImg = (featuredAd.imageUrl || '').trim();
                                        const adTitle = (featuredAd.title || '').trim();
                                        const adLink = normalizeAdLinkUrl(featuredAd.link);
                                        const adFitMode = featuredAd.fitMode === 'contain' ? 'contain' : 'cover';
                                        const hasActiveAd = Boolean(featuredAd.isVisible && (adImg || adTitle));
                                        const showAdImage = Boolean(hasActiveAd && adImg && !featuredAdImgError);

                                        const cardInner = (
                                          <div className={`bg-white rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full h-full relative z-10 shadow-2xs border border-amber-200/90 ${showAdImage ? 'p-0' : 'p-1.5'}`}>
                                            {showAdImage ? (
                                              adFitMode === 'cover' ? (
                                                <img
                                                  src={adImg}
                                                  alt={adTitle || 'Reklam'}
                                                  referrerPolicy="no-referrer"
                                                  onError={() => setFeaturedAdImgError(true)}
                                                  className="w-full h-full object-cover object-center scale-[1.02] pointer-events-none select-none"
                                                />
                                              ) : (
                                                <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gray-100">
                                                  <img
                                                    src={adImg}
                                                    alt=""
                                                    aria-hidden="true"
                                                    referrerPolicy="no-referrer"
                                                    className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-45 pointer-events-none select-none"
                                                  />
                                                  <img
                                                    src={adImg}
                                                    alt={adTitle || 'Reklam'}
                                                    referrerPolicy="no-referrer"
                                                    onError={() => setFeaturedAdImgError(true)}
                                                    className="relative z-10 w-full h-full object-contain pointer-events-none select-none"
                                                  />
                                                </div>
                                              )
                                            ) : hasActiveAd && adTitle ? (
                                              <div className="w-full h-full rounded-[9px] sm:rounded-xl border border-dashed border-amber-300/90 bg-amber-50/35 flex items-center justify-center px-2 text-center">
                                                <p className="text-[11.5px] min-[380px]:text-xs sm:text-[13px] font-bold text-gray-800 leading-snug line-clamp-2">
                                                  {adTitle}
                                                </p>
                                              </div>
                                            ) : (
                                              <div className="w-full h-full rounded-[9px] sm:rounded-xl border border-dashed border-amber-300/90 bg-white flex items-center justify-center px-2 text-center">
                                                <p className="text-[11.5px] min-[380px]:text-xs sm:text-[13px] font-bold text-gray-600 leading-snug">
                                                  Burda sizin reklamınız ola bilər
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );

                                        return (
                                          <div
                                            key={`sample-hero-${row.key}-ad-${idx}`}
                                            className="w-[calc((100%-8px)/1.85)] sm:w-[calc((100%-16px)/2.5)] md:w-[calc((100%-20px)/3.1)] shrink-0 h-[96px] sm:h-[108px]"
                                          >
                                            <div
                                              style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                              className="relative flex flex-col h-full select-none pt-3.5 sm:pt-4 group/adcard"
                                            >
                                              <div
                                                className="absolute top-0 left-0 z-0 bg-amber-500 text-white px-2 pt-[3px] rounded-t-lg sm:rounded-t-xl flex items-start justify-center pointer-events-none select-none max-w-[88%] shadow-xs"
                                                style={{ height: '34px', backgroundColor: '#f59e0b' }}
                                                title="Reklam"
                                              >
                                                <span className="text-[9px] sm:text-[10.5px] font-black tracking-tight whitespace-nowrap leading-none">
                                                  Reklam
                                                </span>
                                              </div>

                                              {isAdmin && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setIsFeaturedAdModalOpen(true);
                                                  }}
                                                  className="absolute top-0 right-1 z-20 inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shadow-sm cursor-pointer transition-colors"
                                                  title="Reklamı düzəlt"
                                                >
                                                  <Edit className="w-2.5 h-2.5" />
                                                  Düzəlt
                                                </button>
                                              )}

                                              {hasActiveAd && adLink ? (
                                                <a
                                                  href={adLink}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  draggable={false}
                                                  className="flex flex-1 min-h-0 w-full cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
                                                  title={adTitle || adLink}
                                                >
                                                  {cardInner}
                                                </a>
                                              ) : isAdmin ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setIsFeaturedAdModalOpen(true)}
                                                  className="flex flex-1 min-h-0 w-full cursor-pointer text-left"
                                                  title="Reklam əlavə et"
                                                >
                                                  {cardInner}
                                                </button>
                                              ) : (
                                                cardInner
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }

                                      const { product, market } = item;
                                      return (
                                        <div
                                          key={`sample-hero-${row.key}-${market.id}-${idx}`}
                                          className="w-[calc((100%-8px)/1.85)] sm:w-[calc((100%-16px)/2.5)] md:w-[calc((100%-20px)/3.1)] shrink-0 h-[96px] sm:h-[108px]"
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
                                            variant="mini"
                                            isListMode={true}
                                            onClick={() => {
                                              if (!isAdmin) {
                                                const mktCatalogs = market.catalogs || [];
                                                const selectedCatId = activeCatalogByMarket[market.id] || (mktCatalogs[0]?.id || null);
                                                const defaultCatalog = mktCatalogs.find(c => c.id === selectedCatId) || (mktCatalogs.length > 0 ? mktCatalogs[0] : null);
                                                const targetCatalog = mktCatalogs.find(c => (c.products || []).includes(product)) || defaultCatalog;
                                                const rawMarketProds = targetCatalog ? (targetCatalog.products || []) : (market.products || []);

                                                const catMap = new Map<string, DiscountProduct[]>();
                                                rawMarketProds.forEach(p => {
                                                  const cat = (p.category || 'Digər').trim() || 'Digər';
                                                  if (!catMap.has(cat)) catMap.set(cat, []);
                                                  catMap.get(cat)!.push(p);
                                                });
                                                const orderedMarketProds = catMap.size > 1 ? Array.from(catMap.values()).flat() : rawMarketProds;

                                                const marketModalList = (orderedMarketProds.length > 0 ? orderedMarketProds : [product]).map(p => ({
                                                  product: p,
                                                  marketName: market.name,
                                                  marketId: market.id,
                                                  catalogEndDate: targetCatalog?.endDate
                                                }));
                                                const clickedIdx = marketModalList.findIndex(item => item.product === product);

                                                setViewProduct({
                                                  product,
                                                  marketName: market.name,
                                                  marketId: market.id,
                                                  catalogEndDate: targetCatalog?.endDate,
                                                  productList: marketModalList,
                                                  currentIndex: clickedIdx >= 0 ? clickedIdx : 0
                                                });
                                              }
                                            }}
                                            isFavorite={isFavorite(product.productName || '', market.id)}
                                            onToggleFavorite={() => toggleFavorite(product, market.id)}
                                            onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, market, market.catalogs?.[0]?.endDate) : undefined}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Right scroll arrow (desktop) */}
                                  <button
                                    type="button"
                                    onClick={() => scrollFeaturedRow(rowKey, row.ref, 'right')}
                                    className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    title="Növbəti"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Quick-Search Row below sample products */}
                        <div className="flex flex-wrap items-center gap-2 px-0.5">
                          <button
                            type="button"
                            onClick={() => setOpenSearchTrigger(prev => prev + 1)}
                            className="inline-flex items-center justify-center w-7 h-7 sm:w-[30px] sm:h-[30px] p-0 bg-transparent border-0 text-black hover:opacity-75 active:scale-90 transition-all cursor-pointer shrink-0"
                            title="Məhsul axtar"
                            aria-label="Məhsul axtar"
                          >
                            <Search className="w-[18px] h-[18px] sm:w-5 sm:h-5 stroke-[2.4]" />
                          </button>
                          {['yağ', 'kolbasa', 'cips'].map((term, idx) => {
                            const tagColor = CATEGORY_TAG_COLORS[idx % CATEGORY_TAG_COLORS.length] || CATEGORY_TAG_COLORS[0];
                            return (
                              <button
                                key={term}
                                type="button"
                                onClick={() => handleQuickSearch(term)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-[13px] font-bold transition-all active:scale-95 cursor-pointer select-none shadow-2xs ${tagColor.chip}`}
                              >
                                <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                <span className="leading-none">{term}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Total product count above the Markets List (active / non-expired products only) */}
                        <div className="flex items-center justify-between px-1 pt-0.5">
                          <span className="text-xs sm:text-sm font-extrabold text-gray-500 uppercase tracking-wider">
                            Marketlər
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 sm:px-3 py-1 rounded-full shadow-2xs tabular-nums">
                            Cəmi {displayedHomeProductsCount} məhsul
                          </span>
                        </div>

                        {/* Markets List - Alt alta (vertically stacked) with icon, name, and green (active) or gray (expired) product count */}
                        <div className="flex flex-col gap-2 sm:gap-2.5">
                          {sortedMarkets.map((market) => {
                            const previewCatalog = market.catalogs && market.catalogs.length > 0 ? market.catalogs[0] : null;
                            const allMarketProducts = (market.catalogs && market.catalogs.length > 0)
                              ? market.catalogs.flatMap(c => c.products || [])
                              : (market.products || []);
                            const previewProducts = previewCatalog ? (previewCatalog.products || []) : allMarketProducts;
                            const catalogProductsCount = previewProducts.length;
                            const isMarketExpired = isMarketFullyExpired(market);

                            return (
                              <div
                                key={market.id}
                                onClick={() => handleSelectMarket(market.id)}
                                role="button"
                                tabIndex={0}
                                className="w-full bg-white hover:bg-gray-50/80 active:bg-gray-100 border border-gray-100 hover:border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between cursor-pointer group select-none"
                              >
                                {/* Left: Market Logo + Market Name + Product Count */}
                                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-100 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                    {market.logoUrl ? (
                                      <img src={market.logoUrl} alt={market.name} className={`w-full h-full object-contain p-1 ${isMarketExpired ? 'grayscale-[55%] opacity-85' : ''}`} />
                                    ) : (
                                      <span className={`${isMarketExpired ? 'text-gray-400' : `text-${market.themeColor || 'green'}-700`} font-black text-base sm:text-lg`}>
                                        {market.logoPlaceholder}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
                                    <h3 className={`text-sm sm:text-base md:text-lg font-black ${isMarketExpired ? 'text-gray-500' : 'text-gray-800'} group-hover:text-blue-600 transition-colors truncate`}>
                                      {market.name}
                                    </h3>
                                    {/* Green product count for active markets, gray for expired */}
                                    <span
                                      className={`inline-flex items-center text-xs sm:text-sm font-black px-2 sm:px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs border ${
                                        isMarketExpired
                                          ? 'text-gray-500 bg-gray-100 border-gray-200'
                                          : 'text-emerald-700 bg-emerald-50 border-emerald-200/90'
                                      }`}
                                    >
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
                          const mktFilteredRaw = mktProducts.filter(filterProductForDetail);
                          const isDiscountSorted = isAdmin && adminSortByDiscount;
                          const mktFilteredProducts = isDiscountSorted
                            ? [...mktFilteredRaw].sort((a, b) => {
                                const sa = getProductDiscountSortScore(a);
                                const sb = getProductDiscountSortScore(b);
                                if (Math.abs(sb.pct - sa.pct) > 0.01) return sb.pct - sa.pct;
                                if (Math.abs(sb.diff - sa.diff) > 0.01) return sb.diff - sa.diff;
                                return 0;
                              })
                            : mktFilteredRaw;
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
                          const effectiveHasCategories = hasCategories && !isDiscountSorted;

                          const categoryColorIndexMap = new Map(
                            allCategoriesWithCounts.map((c, cIdx) => [c.name, cIdx % CATEGORY_TAG_COLORS.length])
                          );

                          // Build complete ordered market product list
                          const fullMarketOrderedProducts: DiscountProduct[] = (() => {
                            if (effectiveHasCategories) {
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

                          const orderedForDisplay = effectiveHasCategories ? fullMarketOrderedProducts : mktFilteredProducts;
                          const displayedProducts = orderedForDisplay.slice(0, visibleDetailCount);
                          const hasMore = visibleDetailCount < orderedForDisplay.length;

                          const fullMarketModalList = fullMarketOrderedProducts.map(p => ({
                            product: p,
                            marketName: mkt.name,
                            marketId: mkt.id,
                            catalogEndDate: mktCatalog?.endDate
                          }));

                          const scrollToCategorySection = (categoryName: string) => {
                            clickedCategoryRef.current = categoryName;
                            const startIdx = fullMarketOrderedProducts.findIndex(
                              p => ((p.category || 'Digər').trim() || 'Digər') === categoryName
                            );
                            const catInfo = allCategoriesWithCounts.find(c => c.name === categoryName);
                            const neededCount = startIdx >= 0 ? startIdx + (catInfo?.count || 1) + 12 : visibleDetailCount;

                            if (neededCount > visibleDetailCount) {
                              pendingCategoryScrollRef.current = { marketId: mkt.id, category: categoryName };
                              setVisibleDetailCount(neededCount);
                            } else {
                              pendingCategoryScrollRef.current = null;
                              requestAnimationFrame(() => {
                                const targetId = `category-section-${mkt.id}-${encodeURIComponent(categoryName)}`;
                                const el = document.getElementById(targetId);
                                if (el) {
                                  const headerOffset = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
                                  const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset - 8;
                                  window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
                                }
                              });
                            }
                          };

                          // Grouping by category (all categories stay visible)
                          const groupedProductsByCategory: { category: string; products: { product: DiscountProduct; originalIndex: number }[] }[] = [];
                          if (effectiveHasCategories) {
                            const catMap = new Map<string, { category: string; products: { product: DiscountProduct; originalIndex: number }[] }>();
                            displayedProducts.forEach((product) => {
                              const cat = (product.category || 'Digər').trim() || 'Digər';
                              if (!catMap.has(cat)) {
                                const newGroup = { category: cat, products: [] };
                                catMap.set(cat, newGroup);
                                groupedProductsByCategory.push(newGroup);
                              }
                              const rawIdx = mktProducts.indexOf(product);
                              catMap.get(cat)!.products.push({ product, originalIndex: rawIdx >= 0 ? rawIdx : 0 });
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
                                effectiveHasCategories ? (
                                    /* Grouped by Categories View (Wrapping hashtag chips at top + compact sticky category indicator bar on scroll) */
                                    <div className="space-y-5 sm:space-y-7 relative">
                                      {/* Wrapping Category Pills (side-by-side, wraps onto next line, no horizontal scroll) */}
                                      <div ref={topCategoryPillsRef} className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-1">
                                        {allCategoriesWithCounts.map((cat) => {
                                          const colorIdx = categoryColorIndexMap.get(cat.name) ?? 0;
                                          const tagColor = CATEGORY_TAG_COLORS[colorIdx];
                                          return (
                                            <button
                                              key={`cat-tag-${cat.name}`}
                                              type="button"
                                              onClick={() => scrollToCategorySection(cat.name)}
                                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs font-bold transition-all active:scale-95 cursor-pointer ${tagColor.chip}`}
                                            >
                                              <span>{cat.name}</span>
                                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 leading-none rounded-md ${tagColor.count}`}>
                                                {cat.count}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {groupedProductsByCategory.map((group, groupIdx) => {
                                        const catColorIdx = categoryColorIndexMap.get(group.category) ?? 0;
                                        const tagColor = CATEGORY_TAG_COLORS[catColorIdx] || CATEGORY_TAG_COLORS[0];
                                        const catTotalCount = allCategoriesWithCounts.find(c => c.name === group.category)?.count ?? group.products.length;
                                        return (
                                          <div
                                            key={group.category}
                                            id={`category-section-${mkt.id}-${encodeURIComponent(group.category)}`}
                                            data-category-section="true"
                                            data-category-name={group.category}
                                            data-category-count={catTotalCount}
                                            data-category-color-idx={catColorIdx}
                                            className={`space-y-2.5 sm:space-y-3 ${groupIdx > 0 ? 'pt-3.5 border-t border-gray-100' : ''}`}
                                          >
                                            {groupIdx > 0 && (
                                              <div className="flex items-center justify-start">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-extrabold shadow-2xs select-none ${tagColor.chip}`}>
                                                  <span>{group.category}</span>
                                                  <span className={`text-[10px] sm:text-xs font-black px-1.5 py-0.5 leading-none rounded-md ${tagColor.count}`}>
                                                    {catTotalCount}
                                                  </span>
                                                </div>
                                              </div>
                                            )}

                                            <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4'}>
                                              {group.products.map(({ product, originalIndex }) => (
                                                <ProductCard 
                                                  key={`${mkt.id}-${product.productName}-${originalIndex}`} 
                                                  product={product} 
                                                  accentColor={mktAccent} 
                                                  catalogEndDate={mktCatalog?.endDate}
                                                  isAdmin={isAdmin} 
                                                  variant="compact"
                                                  isListMode={false}
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
                                                  onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, mkt, mktCatalog?.endDate) : undefined}
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                ) : (
                                  <div className="space-y-3">
                                    {isDiscountSorted && (
                                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800">
                                        <span className="flex items-center gap-1.5">
                                          <Percent className="w-3.5 h-3.5 text-emerald-600" />
                                          Məhsullar ən yüksək endirim faizinə görə sıralanıb
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setAdminSortByDiscount(false)}
                                          className="text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                                        >
                                          Sıralamanı sıfırla
                                        </button>
                                      </div>
                                    )}
                                    <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4'}>
                                      {displayedProducts.map((product, index) => {
                                        const rawIdx = mktProducts.indexOf(product);
                                        const resolvedIdx = rawIdx >= 0 ? rawIdx : index;
                                        return (
                                          <ProductCard 
                                            key={`${mkt.id}-${product.productName}-${resolvedIdx}`} 
                                            product={product} 
                                            accentColor={mktAccent} 
                                            catalogEndDate={mktCatalog?.endDate}
                                            isAdmin={isAdmin} 
                                            variant="compact"
                                            isListMode={false}
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
                                            onEdit={() => { setActiveMarketId(mkt.id); setProductToEdit({ product, index: resolvedIdx, catalogId: selectedCatId || undefined }); }} 
                                            isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                            onToggleFavorite={() => toggleFavorite(product, mkt.id)}
                                            onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, mkt, mktCatalog?.endDate) : undefined}
                                          />
                                        );
                                      })}
                                    </div>
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
          onSearchChange={handleSearchQueryChange}
          onQuickSearch={handleQuickSearch}
          maxPrice={maxPrice}
          onMaxPriceChange={(p) => {
            if (!maxPrice && p.trim().length > 0) {
              captureHomeScrollBeforeLeave();
              window.scrollTo({ top: 0, behavior: 'auto' });
            }
            setMaxPrice(p);
            setIsSearching(true);
          }}
          showCheaperOnly={showCheaperOnly}
          onShowCheaperOnlyChange={handleShowCheaperOnlyChange}
          showFavorites={showFavorites}
          onShowFavoritesChange={(active) => {
             if (active) {
               captureHomeScrollBeforeLeave();
             }
             setShowFavorites(active);
             if (active) {
               setSearchReturnState(null);
               handleShowCheaperOnlyChange(false);
               setActiveMarketId(null);
               setSearchQuery('');
               setDebouncedSearchQuery('');
               setIsSearching(false);
             }
          }}
          favoritesCount={favorites.length}
          markets={sortedMarkets
            .map(m => {
              const mC = m.catalogs || [];
              const mCatId = activeCatalogByMarket[m.id] || mC[0]?.id;
              const mCat = mC.find(c => c.id === mCatId) || mC[0];
              const mProds = mCat ? (mCat.products || []) : (m.products || []);
              return {
                id: m.id,
                name: m.name,
                logoUrl: m.logoUrl,
                logoPlaceholder: m.logoPlaceholder,
                productCount: mProds.length
              };
            })
            .filter(m => m.productCount > 0)}
          onOpenMarketSwipeFeed={handleOpenMarketSwipeFeed}
          openSearchTrigger={openSearchTrigger}
        />
      )}

        <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} selectedMarket={currentMarket?.name || ''} marketUrl={currentMarket?.url || ''} currentLogoUrl={currentMarket?.logoUrl} existingCatalogs={currentMarket?.catalogs} onStreamStart={handleStreamStart} onStreamUpdate={handleStreamUpdate} onStreamEnd={handleStreamEnd} onLogoUpdate={handleLogoUpdate} />
        <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={() => setIsAdmin(true)} />
        <AddMarketModal isOpen={isAddMarketModalOpen} onClose={() => setIsAddMarketModalOpen(false)} onAdd={handleAddMarket} />
        {marketToEdit && <EditMarketModal isOpen={!!marketToEdit} onClose={() => setMarketToEdit(null)} market={marketToEdit} onSave={handleUpdateMarket} onDelete={handleDeleteMarket} />}
        {productToEdit && activeMarketId && <EditProductModal isOpen={!!productToEdit} onClose={() => setProductToEdit(null)} product={productToEdit.product} onSave={handleUpdateProduct} />}
        <DatabaseModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} onSave={saveDatabaseConfig} currentConfig={supabaseConfig} />
        <BannerEditorModal isOpen={isFeaturedAdModalOpen} onClose={() => setIsFeaturedAdModalOpen(false)} banner={featuredAd} onSave={handleSaveFeaturedAd} />
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
              allMarkets={sortedMarkets} 
              onCompareClick={handleCompareClick} 
              canGoBack={!!previousViewState} 
              onBack={handleRestorePreviousView} 
              showComparisons={showCheaperOnly} 
              catalogEndDate={viewProduct?.catalogEndDate} 
              currentIndex={viewProduct?.currentIndex}
              totalCount={viewProduct?.productList?.length}
              productList={viewProduct?.productList}
              onSelectIndex={handleSelectIndexInModal}
              onSelectMarketInModal={handleNavigateToMarketFromModal}
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

        <OpportunityDetailModal
          isOpen={opportunityModalIndex !== null}
          onClose={() => setOpportunityModalIndex(null)}
          items={groupedOpportunities}
          initialIndex={opportunityModalIndex ?? 0}
          allMarkets={markets}
          onSelectIndex={(newIdx) => setOpportunityModalIndex(newIdx)}
          checkIsFavorite={(productName, marketId) => isFavorite(productName, marketId)}
          onToggleFavorite={(prod, marketId) => toggleFavorite(prod, marketId)}
          onEnsureFavorite={(prod, marketId) => ensureFavorite(prod, marketId)}
        />

        <OpportunityInstagramModal
          isOpen={opportunityInstagramIndex !== null}
          onClose={() => setOpportunityInstagramIndex(null)}
          items={groupedOpportunities}
          initialIndex={opportunityInstagramIndex ?? 0}
        />

    </>
  );
};

export default App;
