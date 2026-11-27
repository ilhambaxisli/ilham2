
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
import BannerEditorModal, { normalizeAdLinkUrl, AdManagerTab } from './components/BannerEditorModal';
import HtmlAdFrame from './components/HtmlAdFrame';
import { MarketData, DiscountProduct, SupabaseConfig, Catalog, FavoriteItem, BannerData, UpcomingCampaign } from './types';
import {
  UPCOMING_CAMPAIGNS_STORAGE_KEY,
  UPCOMING_CATEGORY_NAME,
  formatUpcomingDateLabel,
  getLocalDateStr,
  getShortMarketLabel,
  isUpcomingCampaignBannerActive,
  normalizeUpcomingCampaignList,
  resolveMarketForCampaign,
  shouldAutoPromoteCampaign,
} from './utils/upcomingCampaigns';
import * as supabaseService from './services/supabase';
import { RefreshCw, ShoppingBag, ArrowRight, Loader2, Plus, Trash2, Search, Database, Home, ChevronRight, Store, Grid3x3, Grid2x2, XCircle, ChevronUp, ChevronDown, Edit, Calendar, Clock, AlertTriangle, CheckCircle2, ShoppingCart, TrendingDown, ArrowLeft, ArrowUp, Heart, X, Check, ChevronLeft, Sparkles, Tag, Percent, Download, Megaphone, Layers } from 'lucide-react';

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
  searchQuery: string;
  showFavorites: boolean;
}

const getProductAddedTimestamp = (product: DiscountProduct): number => {
  const raw =
    product.addedAt ??
    (product as any).createdAt ??
    (product as any).created_at;
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (!isNaN(parsed)) return parsed;
    const ms = Date.parse(raw);
    if (!isNaN(ms)) return ms;
  }
  return 0;
};

const getProductExpirySortWeight = (product: DiscountProduct, catalogEndDate?: string): number => {
  const cd = calculateDaysLeft(extractProductEndDate(product, catalogEndDate));
  if (cd && cd.daysLeft < 0) return 1_000_000 + Math.abs(cd.daysLeft);
  return 0;
};

const sortProductsNewestFirstWithExpiredLast = <T extends DiscountProduct>(products: T[], catalogEndDate?: string): T[] => {
  if (products.length <= 1) return products;
  return products
    .map((item, idx) => ({
      item,
      idx,
      weight: getProductExpirySortWeight(item, catalogEndDate),
      addedAt: getProductAddedTimestamp(item),
    }))
    .sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight;
      if (a.weight === 0 && a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
};

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
  const [visibleDetailCount, setVisibleDetailCount] = useState(12);
  const [detailStartOffset, setDetailStartOffset] = useState(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTopSentinelRef = useRef<HTMLDivElement | null>(null);
  const preserveSliceOnMarketChangeRef = useRef<boolean>(false);
  const upwardPrependAnchorRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const isUpwardLoadingRef = useRef<boolean>(false);
  const jumpSettledAtRef = useRef<number>(0);
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

  const handleSelectMarket = (
    marketId: string | null,
    options?: { preserveSearchReturn?: boolean; focusCategory?: string | null; keepPendingScroll?: boolean }
  ) => {
    if (marketId !== null) {
      captureHomeScrollBeforeLeave();
    }
    if (!options?.preserveSearchReturn) {
      setSearchReturnState(null);
    }
    setActiveMarketId(marketId);
    setSelectedCategoryFilter(options?.focusCategory ?? null);
    setActiveCategoryDropdown(null);
    setIsMarketSwitcherOpen(false);
    if (!options?.keepPendingScroll) {
      setDetailStartOffset(0);
      setVisibleDetailCount(24);
      if (marketId !== null) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  };

  const handleNavigateToMarketIdUpcoming = (rawMarketId: string) => {
    const resolvedMarket =
      resolveMarketForCampaign(rawMarketId, markets) ||
      markets.find((m) => m.id === rawMarketId);
    const targetMarketId = resolvedMarket ? resolvedMarket.id : rawMarketId;
    if (resolvedMarket?.catalogs && resolvedMarket.catalogs.length > 0) {
      const primaryCatalogId = resolvedMarket.catalogs[0].id;
      setActiveCatalogByMarket(prev =>
        prev[targetMarketId] === primaryCatalogId
          ? prev
          : { ...prev, [targetMarketId]: primaryCatalogId }
      );
    }
    const mappedUpcoming =
      upcomingProductsByMarketMap.get(targetMarketId) ||
      upcomingProductsByMarketMap.get(targetMarketId.trim().toLowerCase()) ||
      [];
    if (mappedUpcoming.length > 0) {
      preserveSliceOnMarketChangeRef.current = true;
      pendingCategoryScrollRef.current = { marketId: targetMarketId, category: UPCOMING_CATEGORY_NAME };
      handleSelectMarket(targetMarketId, { keepPendingScroll: true });
    } else {
      handleSelectMarket(targetMarketId);
    }
  };

  const handleNavigateToMarketUpcoming = (campaign: UpcomingCampaign) => {
    const resolvedMarket = resolveMarketForCampaign(campaign.marketId, markets);
    const targetMarketId = resolvedMarket ? resolvedMarket.id : campaign.marketId;
    if (resolvedMarket?.catalogs && resolvedMarket.catalogs.length > 0) {
      const primaryCatalogId = resolvedMarket.catalogs[0].id;
      setActiveCatalogByMarket(prev =>
        prev[targetMarketId] === primaryCatalogId
          ? prev
          : { ...prev, [targetMarketId]: primaryCatalogId }
      );
    }
    const hasUpcomingProducts = Array.isArray(campaign.products) && campaign.products.length > 0;
    if (hasUpcomingProducts) {
      preserveSliceOnMarketChangeRef.current = true;
      pendingCategoryScrollRef.current = { marketId: targetMarketId, category: UPCOMING_CATEGORY_NAME };
      handleSelectMarket(targetMarketId, { keepPendingScroll: true });
    } else {
      handleSelectMarket(targetMarketId);
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
  const [expandedSearchMarkets, setExpandedSearchMarkets] = useState<Record<string, boolean>>({});
  const [showFavorites, setShowFavorites] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [openSearchTrigger, setOpenSearchTrigger] = useState(0);
  const [isAddMarketModalOpen, setIsAddMarketModalOpen] = useState(false);
  const [marketToEdit, setMarketToEdit] = useState<MarketData | null>(null);
  const [productToEdit, setProductToEdit] = useState<{product: DiscountProduct, index: number, catalogId?: string} | null>(null);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [featuredAds, setFeaturedAds] = useState<BannerData[]>(() => {
    try {
      const savedList = localStorage.getItem('featuredAds_v2');
      if (savedList) {
        const parsed = JSON.parse(savedList);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => ({
            id: item?.id || `featured-ad-${idx + 1}`,
            title: item?.title || '',
            imageUrl: item?.imageUrl || '',
            htmlContent: item?.htmlContent || '',
            link: item?.link || '',
            isVisible: Boolean(item?.isVisible),
            fitMode: item?.fitMode === 'contain' ? 'contain' : 'cover',
          }));
        }
      }
      const legacy = localStorage.getItem('featuredAd_v1');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === 'object' && (parsed.htmlContent || parsed.imageUrl || parsed.title || parsed.isVisible)) {
          return [{
            id: parsed.id || 'featured-ad',
            title: parsed.title || '',
            imageUrl: parsed.imageUrl || '',
            htmlContent: parsed.htmlContent || '',
            link: parsed.link || '',
            isVisible: Boolean(parsed.isVisible),
            fitMode: parsed.fitMode === 'contain' ? 'contain' : 'cover',
          }];
        }
      }
    } catch (e) {}
    return [];
  });
  const [swipeAds, setSwipeAds] = useState<BannerData[]>(() => {
    try {
      const saved = localStorage.getItem('swipeAds_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => ({
            id: item?.id || `swipe-ad-${idx + 1}`,
            title: item?.title || '',
            imageUrl: item?.imageUrl || '',
            htmlContent: item?.htmlContent || '',
            link: item?.link || '',
            isVisible: Boolean(item?.isVisible),
            fitMode: item?.fitMode === 'contain' ? 'contain' : 'cover',
          }));
        }
      }
    } catch (e) {}
    return [];
  });
  const [upcomingCampaigns, setUpcomingCampaigns] = useState<UpcomingCampaign[]>(() => {
    try {
      const saved = localStorage.getItem(UPCOMING_CAMPAIGNS_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return normalizeUpcomingCampaignList(parsed);
      }
    } catch (e) {}
    return [];
  });
  const upcomingCampaignsRef = useRef<UpcomingCampaign[]>(upcomingCampaigns);
  upcomingCampaignsRef.current = upcomingCampaigns;
  const [todayDateStr, setTodayDateStr] = useState<string>(() => getLocalDateStr(0));
  const promotedBatchKeyRef = useRef<string>('');
  const [isFeaturedAdModalOpen, setIsFeaturedAdModalOpen] = useState(false);
  const [adManagerInitialTab, setAdManagerInitialTab] = useState<AdManagerTab>('featured');
  const [adManagerEditId, setAdManagerEditId] = useState<string | null>(null);
  const [erroredAdImgs, setErroredAdImgs] = useState<Record<string, boolean>>({});
  const sessionSwipeCountRef = useRef<number>(0);
  const getSwipeAdFirstOffset = useCallback(() => {
    const count = sessionSwipeCountRef.current;
    if (count < 5) return 5 - count;
    const rem = (count - 5) % 10;
    return rem === 0 ? 10 : 10 - rem;
  }, []);
  const handleSwipeProgress = useCallback(() => {
    sessionSwipeCountRef.current += 1;
  }, []);
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

  const handleNavigateToMarketFromModal = (marketId: string) => {
    const isFromSearch = searchQuery.trim().length >= 2 || debouncedSearchQuery.trim().length >= 2;
    if (isFromSearch) {
      const listScrollY = window.scrollY;
      setSearchReturnState({
        searchQuery: searchQuery || debouncedSearchQuery,
        maxPrice: maxPrice || debouncedMaxPrice,
        expandedSearchMarkets: { ...expandedSearchMarkets },
        activeSearchMarketId,
        searchRevealLimit: effectiveSearchRevealLimit,
        scrollY: listScrollY
      });
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setMaxPrice('');
      setDebouncedMaxPrice('');
      setIsSearching(false);
    }
    setViewProduct(null);
    setShowFavorites(false);
    handleSelectMarket(marketId, isFromSearch ? { preserveSearchReturn: true } : undefined);
  };
  const [previousViewState, setPreviousViewState] = useState<ViewState | null>(null);
  const [searchReturnState, setSearchReturnState] = useState<{
    searchQuery: string;
    maxPrice: string;
    expandedSearchMarkets: Record<string, boolean>;
    activeSearchMarketId?: string | null;
    searchRevealLimit?: number;
    scrollY: number;
  } | null>(null);
  const skipSearchResetRef = useRef<boolean>(false);
  const skipSearchScrollResetRef = useRef<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<string | null>(null);
  const [isMarketSwitcherOpen, setIsMarketSwitcherOpen] = useState(false);
  const pendingCategoryScrollRef = useRef<{ marketId: string; category: string } | null>(null);
  const marketDetailContainerRef = useRef<HTMLDivElement | null>(null);
  const marketDetailAnimRef = useRef<Animation | null>(null);

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
      if (!wasSearchable) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim().length >= 2 ? searchQuery : '');
      setDebouncedMaxPrice(maxPrice || '');
      setIsSearching(false);
    }, 90);
    return () => { clearTimeout(handler); };
  }, [searchQuery, maxPrice]); 

  useEffect(() => { 
    if (showFavorites) {
      window.scrollTo({ top: 0, behavior: 'auto' }); 
    }
  }, [showFavorites]);

  // Reset lazy load count & expanded search markets on market, catalog, or search query change
  useEffect(() => {
    if (preserveSliceOnMarketChangeRef.current) {
      preserveSliceOnMarketChangeRef.current = false;
      return;
    }
    setDetailStartOffset(0);
    setVisibleDetailCount(12);
    if (skipSearchResetRef.current) {
      skipSearchResetRef.current = false;
      return;
    }
    setExpandedSearchMarkets({});
  }, [activeMarketId, activeCatalogByMarket, debouncedSearchQuery, debouncedMaxPrice]);

  // Progressive initial ramp for normal product list (12 -> 24)
  useEffect(() => {
    if (!activeMarketId || showFavorites || detailStartOffset > 0 || visibleDetailCount >= 24) return;
    const timer = window.setTimeout(() => {
      setVisibleDetailCount(prev => (prev < 24 ? Math.min(24, prev + 12) : prev));
    }, 95);
    return () => window.clearTimeout(timer);
  }, [activeMarketId, showFavorites, detailStartOffset, visibleDetailCount]);

  // IntersectionObserver for smooth downward lazy loading in normal product list
  useEffect(() => {
    if (!activeMarketId || visibleDetailCount < 24) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;

    let loadTimer: number | null = null;
    const scheduleMore = () => {
      if (loadTimer !== null) return;
      loadTimer = window.setTimeout(() => {
        loadTimer = null;
        setVisibleDetailCount((prev) => prev + 24);
      }, 24);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          scheduleMore();
        }
      },
      { rootMargin: '650px 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (loadTimer !== null) window.clearTimeout(loadTimer);
    };
  }, [activeMarketId, visibleDetailCount, activeCatalogByMarket]);

  // Upward lazy loading when jumped near the bottom (e.g. Sabahkı Endirimlər) and user scrolls UP
  const handleLoadMoreUpward = useCallback(() => {
    if (detailStartOffset <= 0 || isUpwardLoadingRef.current) return;
    isUpwardLoadingRef.current = true;
    upwardPrependAnchorRef.current = {
      prevScrollHeight: document.documentElement.scrollHeight,
      prevTop: window.scrollY,
    };
    setDetailStartOffset((prev) => Math.max(0, prev - 24));
  }, [detailStartOffset]);

  useEffect(() => {
    if (!activeMarketId || showFavorites || detailStartOffset <= 0) return;
    const el = loadMoreTopSentinelRef.current;
    if (!el) return;

    let loadTimer: number | null = null;
    const triggerUpward = () => {
      if (Date.now() < jumpSettledAtRef.current) return;
      if (loadTimer !== null) return;
      loadTimer = window.setTimeout(() => {
        loadTimer = null;
        handleLoadMoreUpward();
      }, 65);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerUpward();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (loadTimer !== null) window.clearTimeout(loadTimer);
    };
  }, [activeMarketId, showFavorites, detailStartOffset, activeCatalogByMarket, handleLoadMoreUpward]);

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
      const unsubBanners = supabaseService.subscribeToBanners((b1, _b2, nextFeaturedList, nextSwipeList, nextUpcomingList, hasUpcomingField) => {
        const normalizedFeatured: BannerData[] = Array.isArray(nextFeaturedList)
          ? nextFeaturedList
          : (b1 && typeof b1 === 'object' && ((b1.htmlContent || '').trim() || (b1.imageUrl || '').trim() || (b1.title || '').trim() || b1.isVisible)
              ? [{
                  id: b1.id || 'featured-ad',
                  title: b1.title || '',
                  imageUrl: b1.imageUrl || '',
                  htmlContent: b1.htmlContent || '',
                  link: b1.link || '',
                  isVisible: Boolean(b1.isVisible),
                  fitMode: b1.fitMode === 'contain' ? 'contain' : 'cover',
                }]
              : []);
        const normalizedSwipe: BannerData[] = Array.isArray(nextSwipeList) ? nextSwipeList : [];
        setFeaturedAds(normalizedFeatured);
        setSwipeAds(normalizedSwipe);
        setErroredAdImgs({});
        try {
          localStorage.setItem('featuredAds_v2', JSON.stringify(normalizedFeatured));
          localStorage.setItem('swipeAds_v1', JSON.stringify(normalizedSwipe));
        } catch (e) {}

        if (hasUpcomingField && Array.isArray(nextUpcomingList)) {
          const normalizedUpcoming = normalizeUpcomingCampaignList(nextUpcomingList);
          upcomingCampaignsRef.current = normalizedUpcoming;
          setUpcomingCampaigns(normalizedUpcoming);
          try {
            localStorage.setItem(UPCOMING_CAMPAIGNS_STORAGE_KEY, JSON.stringify(normalizedUpcoming));
          } catch (e) {}
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

  const handleSaveAllAds = (
    nextFeatured: BannerData[],
    nextSwipe: BannerData[],
    nextUpcoming?: UpcomingCampaign[]
  ) => {
    const sanitizeList = (list: BannerData[], prefix: string): BannerData[] =>
      list
        .map((item, idx) => {
          const cleanHtml = (item.htmlContent || '').trim();
          const cleanImg = (item.imageUrl || '').trim();
          const cleanTitle = (item.title || '').trim();
          return {
            id: item.id || `${prefix}-${idx + 1}`,
            title: cleanTitle,
            imageUrl: cleanImg,
            htmlContent: cleanHtml,
            link: normalizeAdLinkUrl(item.link),
            isVisible: Boolean(item.isVisible && (cleanHtml || cleanImg || cleanTitle)),
            fitMode: (item.fitMode === 'contain' ? 'contain' : 'cover') as 'contain' | 'cover',
          };
        })
        .filter((item) => Boolean(item.htmlContent || item.imageUrl || item.title));

    const cleanFeatured = sanitizeList(nextFeatured, 'featured-ad');
    const cleanSwipe = sanitizeList(nextSwipe, 'swipe-ad');
    const cleanUpcoming = Array.isArray(nextUpcoming)
      ? normalizeUpcomingCampaignList(nextUpcoming)
      : upcomingCampaignsRef.current;

    setFeaturedAds(cleanFeatured);
    setSwipeAds(cleanSwipe);
    upcomingCampaignsRef.current = cleanUpcoming;
    setUpcomingCampaigns(cleanUpcoming);
    setErroredAdImgs({});
    try {
      localStorage.setItem('featuredAds_v2', JSON.stringify(cleanFeatured));
      localStorage.setItem('swipeAds_v1', JSON.stringify(cleanSwipe));
      localStorage.setItem(UPCOMING_CAMPAIGNS_STORAGE_KEY, JSON.stringify(cleanUpcoming));
    } catch (e) {}
    if (isCloudConnected) {
      supabaseService.saveAllAds(cleanFeatured, cleanSwipe, cleanUpcoming);
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

  // Refresh local date every minute so midnight rollover activates scheduled tomorrow campaigns automatically
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getLocalDateStr(0);
      setTodayDateStr((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeUpcomingCampaigns = useMemo(
    () => upcomingCampaigns.filter((c) => isUpcomingCampaignBannerActive(c, todayDateStr)),
    [upcomingCampaigns, todayDateStr]
  );

  const upcomingProductsByMarketMap = useMemo(() => {
    const map = new Map<string, DiscountProduct[]>();
    activeUpcomingCampaigns.forEach((camp) => {
      const resolvedMarket = resolveMarketForCampaign(camp.marketId, markets);
      const targetKey = resolvedMarket ? resolvedMarket.id : camp.marketId.trim().toLowerCase();
      if (!targetKey) return;
      const list = map.get(targetKey) || [];
      (camp.products || []).forEach((prod) => {
        const resolvedExp = prod.expiryDate || prod.bitis || camp.endDate;
        list.push({
          ...prod,
          expiryDate: resolvedExp || undefined,
          bitis: resolvedExp || undefined,
          _isUpcoming: true,
          _upcomingActivateAt: camp.activateAt,
          _upcomingCampaignId: camp.id,
        } as DiscountProduct);
      });
      map.set(targetKey, list);
    });
    return map;
  }, [activeUpcomingCampaigns, markets]);

  // Auto-promote scheduled upcoming campaign products into the target market catalog when activateAt date arrives
  useEffect(() => {
    if (isLoading || marketsRef.current.length === 0) return;
    const dueCampaigns = upcomingCampaigns.filter((c) => shouldAutoPromoteCampaign(c, todayDateStr));
    if (dueCampaigns.length === 0) return;

    const batchKey = `${todayDateStr}::${dueCampaigns.map((c) => c.id).sort().join(',')}`;
    if (promotedBatchKeyRef.current === batchKey) return;
    promotedBatchKeyRef.current = batchKey;

    const nowIso = new Date().toISOString();

    updateMarketsState((prevMarkets) =>
      prevMarkets.map((market) => {
        const matchingCampaigns = dueCampaigns.filter((c) => {
          const resolved = resolveMarketForCampaign(c.marketId, prevMarkets);
          return resolved
            ? resolved.id === market.id
            : c.marketId.trim().toLowerCase() === market.id.trim().toLowerCase();
        });
        if (matchingCampaigns.length === 0) return market;

        const incomingProducts: DiscountProduct[] = [];
        const promoteBaseMs = Date.now();
        let promoteSeq = 0;
        matchingCampaigns.forEach((camp) => {
          (camp.products || []).forEach((prod) => {
            const resolvedExp = prod.expiryDate || prod.bitis || camp.endDate;
            incomingProducts.push({
              ...prod,
              expiryDate: resolvedExp || undefined,
              bitis: resolvedExp || undefined,
              addedAt: typeof prod.addedAt === 'number' ? prod.addedAt : (promoteBaseMs - promoteSeq),
            });
            promoteSeq += 1;
          });
        });
        if (incomingProducts.length === 0) return market;

        const existingKeys = new Set<string>();
        const registerProductKey = (p: DiscountProduct) => {
          existingKeys.add(
            `${normalizeTextForSearch(p.productName || '')}::${String(p.newPrice || '').trim()}`
          );
        };
        (market.catalogs || []).forEach((cat) => (cat.products || []).forEach(registerProductKey));
        (market.products || []).forEach(registerProductKey);

        const freshProducts = incomingProducts.filter((p) => {
          const key = `${normalizeTextForSearch(p.productName || '')}::${String(p.newPrice || '').trim()}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        if (freshProducts.length === 0) return market;

        const nextCatalogs = market.catalogs ? [...market.catalogs] : [];
        if (nextCatalogs.length > 0) {
          nextCatalogs[0] = {
            ...nextCatalogs[0],
            products: [...freshProducts, ...(nextCatalogs[0].products || [])],
            lastUpdated: nowIso,
          };
          return {
            ...market,
            catalogs: nextCatalogs,
            products: nextCatalogs[0].products,
            lastUpdated: nowIso,
          };
        }

        const mergedRootProducts = [...freshProducts, ...(market.products || [])];
        return {
          ...market,
          products: mergedRootProducts,
          lastUpdated: nowIso,
        };
      })
    );

    const dueIds = new Set(dueCampaigns.map((c) => c.id));
    const nextUpcoming = upcomingCampaigns.map((c) =>
      dueIds.has(c.id) ? { ...c, promotedAt: nowIso, isVisible: false } : c
    );
    upcomingCampaignsRef.current = nextUpcoming;
    setUpcomingCampaigns(nextUpcoming);
    try {
      localStorage.setItem(UPCOMING_CAMPAIGNS_STORAGE_KEY, JSON.stringify(nextUpcoming));
    } catch (e) {}
    if (isCloudConnected) {
      supabaseService.saveAllAds(featuredAds, swipeAds, nextUpcoming);
    }
  }, [isLoading, markets, upcomingCampaigns, todayDateStr, isCloudConnected, featuredAds, swipeAds]);

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

  const [homeOppLimit, setHomeOppLimit] = useState<number>(24);
  const [homeOppColumnCount, setHomeOppColumnCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 768) return 3;
    return 2;
  });
  const homeOppSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateCols = () => {
      const next = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 2;
      setHomeOppColumnCount(prev => (prev === next ? prev : next));
    };
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  useEffect(() => {
    if (activeMarketId !== null || showFavorites || debouncedSearchQuery.trim().length >= 2) return;
    const sentinel = homeOppSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHomeOppLimit((prev) => prev + 24);
        }
      },
      { rootMargin: '500px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeMarketId, showFavorites, debouncedSearchQuery, homeOppLimit]);

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
      const groups = new Map<string, {
          productName: string,
          category: any,
          imageUrl?: string,
          variants: Array<{
              marketId: string,
              marketName: string,
              price: number,
              originalPriceStr: string,
              oldPrice?: string,
              endDate?: string,
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
                 const resolvedEndDate = extractProductEndDate(p, cat.endDate);
                 const cd = calculateDaysLeft(resolvedEndDate);
                 if (cd && cd.daysLeft < 0) return;
                 const normalizedName = (p.productName || '').trim().toLowerCase();
                 if (!normalizedName) return;
                 const priceVal = parsePriceNumber(p.newPrice);
                 if (isNaN(priceVal)) return;
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
                 const cleanOld = p.oldPrice && p.oldPrice !== '---' ? String(p.oldPrice).trim() : undefined;
                 const variantData = {
                     marketId: market.id,
                     marketName: market.name,
                     price: priceVal,
                     originalPriceStr: String(p.newPrice ?? ''),
                     oldPrice: cleanOld,
                     endDate: resolvedEndDate,
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
  }, [markets]);
  
  const isFavorite = useCallback((productName: string, marketId: string) => {
    const norm = (productName || '').trim().toLowerCase();
    return favorites.some(f => (f.productName || '').trim().toLowerCase() === norm && f.marketId === marketId);
  }, [favorites]);

  const toggleFavorite = useCallback((product: DiscountProduct, marketId: string) => {
    const norm = (product.productName || '').trim().toLowerCase();
    setFavorites(prev => {
      const exists = prev.find(f => (f.productName || '').trim().toLowerCase() === norm && f.marketId === marketId);
      let newFavorites;
      if (exists) newFavorites = prev.filter(f => !((f.productName || '').trim().toLowerCase() === norm && f.marketId === marketId));
      else newFavorites = [...prev, { ...product, marketId, addedAt: Date.now() }];
      return newFavorites;
    });
  }, []);

  const ensureFavorite = (product: DiscountProduct, marketId: string) => {
    const norm = (product.productName || '').trim().toLowerCase();
    setFavorites(prev => {
      const exists = prev.find(f => (f.productName || '').trim().toLowerCase() === norm && f.marketId === marketId);
      if (exists) return prev;
      return [...prev, { ...product, marketId, addedAt: Date.now() }];
    });
  };

  const indexedMarketProducts = useMemo(() => {
    return sortedMarkets.map(market => {
      const baseProductEntries = market.catalogs
        ? market.catalogs.flatMap(c => (c.products || []).map(product => ({ product, catEndDate: c.endDate })))
        : (market.products || []).map(product => ({ product, catEndDate: undefined as string | undefined }));

      const upcomingForMarket =
        upcomingProductsByMarketMap.get(market.id) ||
        upcomingProductsByMarketMap.get(market.id.trim().toLowerCase()) ||
        [];
      const upcomingEntries = upcomingForMarket.map(product => ({
        product,
        catEndDate: product.expiryDate || product.bitis,
      }));

      const allProductEntries = [...baseProductEntries, ...upcomingEntries];

      const indexed = allProductEntries
        .map((entry, idx) => ({
          product: entry.product,
          productWithMeta: {
            ...entry.product,
            _hasCheaper: (entry.product as any)._isUpcoming ? false : checkForCheaperAlternative(entry.product, market.id)
          },
          normName: normalizeTextForSearch(entry.product.productName || ''),
          priceNum: parsePriceNumber(entry.product.newPrice),
          weight: (entry.product as any)._isUpcoming
            ? 500_000 + idx
            : getProductExpirySortWeight(entry.product, entry.catEndDate),
          addedAt: getProductAddedTimestamp(entry.product),
          idx,
        }))
        .sort((a, b) => {
          if (a.weight !== b.weight) return a.weight - b.weight;
          if (a.weight === 0 && a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
          return a.idx - b.idx;
        });

      return { market, indexed };
    });
  }, [sortedMarkets, productPriceIndex, upcomingProductsByMarketMap]);

  const filteredMarketData = useMemo(() => {
    if (showFavorites) return [];
    const isGlobalSearch = debouncedSearchQuery.trim().length > 0;
    const hasPriceFilter = debouncedMaxPrice.length > 0;
    if (!isGlobalSearch && !hasPriceFilter) return [];

    const qNorm = isGlobalSearch ? normalizeTextForSearch(debouncedSearchQuery) : '';
    const maxPriceLimit = hasPriceFilter ? parsePriceNumber(debouncedMaxPrice) : NaN;
    const checkPriceLimit = hasPriceFilter && !isNaN(maxPriceLimit);

    return indexedMarketProducts
      .map(({ market, indexed }) => {
        const productsWithMeta = indexed
          .filter(item => {
            if (qNorm && !item.normName.includes(qNorm)) return false;
            if (checkPriceLimit && !isNaN(item.priceNum) && item.priceNum > maxPriceLimit) return false;
            return true;
          })
          .map(item => item.productWithMeta);

        return { ...market, filteredProducts: productsWithMeta };
      })
      .filter(m => m.filteredProducts.length > 0);
  }, [indexedMarketProducts, debouncedSearchQuery, debouncedMaxPrice, showFavorites]);

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
          products.unshift({
            ...updatedProduct,
            addedAt: typeof updatedProduct.addedAt === 'number' ? updatedProduct.addedAt : Date.now(),
          });
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
        products.unshift({
          ...updatedProduct,
          addedAt: typeof updatedProduct.addedAt === 'number' ? updatedProduct.addedAt : Date.now(),
        });
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
      if ((product as any)._isUpcoming && (product as any)._upcomingCampaignId) {
          setAdManagerInitialTab('upcoming');
          setAdManagerEditId((product as any)._upcomingCampaignId);
          setIsFeaturedAdModalOpen(true);
          return;
      }
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
    setPreviousViewState({ activeMarketId, searchQuery, showFavorites });
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

  const performCategoryScrollAndAnimate = useCallback((
    marketId: string,
    categoryName: string,
    options?: { skipSlideAnim?: boolean }
  ) => {
    const targetId = `category-section-${marketId}-${encodeURIComponent(categoryName)}`;
    const el = document.getElementById(targetId);
    if (!el) return false;
    const measuredHeader = stickyHeaderRef.current?.offsetHeight || stickyHeaderHeight;
    const headerOffset = measuredHeader < 130 ? Math.max(measuredHeader, 140) : measuredHeader;
    const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset - 8;
    jumpSettledAtRef.current = Date.now() + 450;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });

    const detailEl = marketDetailContainerRef.current;
    if (
      !options?.skipSlideAnim &&
      detailEl &&
      typeof detailEl.animate === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      marketDetailAnimRef.current?.cancel();
      marketDetailAnimRef.current = detailEl.animate(
        [
          { opacity: 0.35, transform: 'translate3d(0, 14px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 220,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      );
    }
    return true;
  }, [stickyHeaderHeight]);

  useLayoutEffect(() => {
    if (upwardPrependAnchorRef.current) {
      const { prevScrollHeight, prevScrollTop } = upwardPrependAnchorRef.current;
      upwardPrependAnchorRef.current = null;
      const nextHeight = document.documentElement.scrollHeight;
      const delta = nextHeight - prevScrollHeight;
      if (delta > 0) {
        window.scrollTo({ top: prevScrollTop + delta, behavior: 'auto' });
      }
      isUpwardLoadingRef.current = false;
    }
  }, [detailStartOffset]);

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
    debouncedMaxPrice.length > 0;

  const isSearchResultsViewportMode =
    !isLoading && !showFavorites && activeMarketId === null && isSearchViewActive;

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
  }, [isSearchViewActive, activeMarketId, showFavorites, filteredMarketData.length, debouncedSearchQuery]);

  // Dual billboard auto-marquee for Home featured sample rows: starts 1s after render, opposite directions, ping-pongs at ends, pauses on touch
  useEffect(() => {
    const isHomeFeaturedVisible =
      !isLoading &&
      activeMarketId === null &&
      !showFavorites &&
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
  }, [isLoading, activeMarketId, showFavorites, isSearchViewActive, viewProduct, sampleFeaturedProducts.length]);

  const INITIAL_SEARCH_REVEAL = 9;
  const AUTO_SEARCH_REVEAL_TARGET = 27;
  const SEARCH_REVEAL_STEP = 15;

  const searchRevealKey = `${debouncedSearchQuery.trim()}|${debouncedMaxPrice.trim()}`;
  const [searchRevealState, setSearchRevealState] = useState<{ key: string; limit: number }>({
    key: '',
    limit: INITIAL_SEARCH_REVEAL
  });
  const effectiveSearchRevealLimit =
    searchRevealState.key === searchRevealKey ? searchRevealState.limit : INITIAL_SEARCH_REVEAL;
  const totalSearchResultsCount = useMemo(
    () => filteredMarketData.reduce((sum, m) => sum + m.filteredProducts.length, 0),
    [filteredMarketData]
  );

  const [activeSearchMarketId, setActiveSearchMarketId] = useState<string | null>(null);
  const searchChipsRowRef = useRef<HTMLDivElement | null>(null);
  const searchListScrollRef = useRef<HTMLDivElement | null>(null);
  const searchListAnimRef = useRef<Animation | null>(null);
  const searchLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const pendingSearchJumpIdxRef = useRef<number | null>(null);
  const programmaticSearchScrollUntilRef = useRef<number>(0);
  const searchSlideScrollRafRef = useRef<number | null>(null);
  const searchSwipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const searchWheelCooldownRef = useRef<number>(0);

  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShowScrollToTop(false);
      return;
    }
    const updateWindowScrollTop = () => {
      setShowScrollToTop(window.scrollY > 260);
    };
    updateWindowScrollTop();
    window.addEventListener('scroll', updateWindowScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', updateWindowScrollTop);
  }, [isLoading, isSearchResultsViewportMode, activeMarketId, showFavorites]);

  const handleScrollToTop = () => {
    setIsMarketSwitcherOpen(false);
    setActiveCategoryDropdown(null);
    setScrolledCategoryInfo(null);
    if (detailStartOffset > 0) {
      isScrollingToTopRef.current = false;
      setDetailStartOffset(0);
      setVisibleDetailCount(24);
      window.scrollTo({ top: 0, behavior: 'auto' });
      const detailEl = marketDetailContainerRef.current;
      if (
        detailEl &&
        typeof detailEl.animate === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        marketDetailAnimRef.current?.cancel();
        marketDetailAnimRef.current = detailEl.animate(
          [
            { opacity: 0.35, transform: 'translate3d(0, 14px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ],
          {
            duration: 220,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }
        );
      }
      return;
    }
    isScrollingToTopRef.current = true;
    if (scrollToTopSafetyTimerRef.current !== null) {
      window.clearTimeout(scrollToTopSafetyTimerRef.current);
    }
    scrollToTopSafetyTimerRef.current = window.setTimeout(() => {
      isScrollingToTopRef.current = false;
      scrollToTopSafetyTimerRef.current = null;
    }, 1400);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isSearchViewActive || activeMarketId !== null || showFavorites || filteredMarketData.length === 0) {
      setActiveSearchMarketId(null);
      return;
    }
    setActiveSearchMarketId(prev => {
      if (prev && filteredMarketData.some(m => m.id === prev)) return prev;
      return filteredMarketData[0].id;
    });
  }, [isSearchViewActive, activeMarketId, showFavorites, filteredMarketData]);

  useEffect(() => {
    if (!activeSearchMarketId || !searchChipsRowRef.current) return;
    const row = searchChipsRowRef.current;
    const chipEl = row.querySelector<HTMLElement>(`[data-search-chip-id="${activeSearchMarketId}"]`);
    if (chipEl) {
      const targetLeft = Math.max(0, chipEl.offsetLeft - row.clientWidth / 2 + chipEl.clientWidth / 2);
      row.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  }, [activeSearchMarketId, filteredMarketData]);

  const performSearchMarketScroll = useCallback((idx: number) => {
    if (idx < 0 || idx >= filteredMarketData.length) return;
    const targetMarket = filteredMarketData[idx];
    const listEl = searchListScrollRef.current;

    programmaticSearchScrollUntilRef.current = Date.now() + 260;

    if (idx === 0) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (listEl) {
      const sec = listEl.querySelector(`[data-search-market-section="${targetMarket.id}"]`) as HTMLElement | null;
      if (sec) {
        const headerBottom = searchTopBarRef.current?.getBoundingClientRect().bottom ?? stickyHeaderHeight;
        const compactHeader = sec.querySelector('[data-search-compact-header="true"]') as HTMLElement | null;
        const targetTop = Math.max(
          0,
          window.scrollY + sec.getBoundingClientRect().top - headerBottom + (compactHeader ? compactHeader.offsetHeight : 0)
        );
        window.scrollTo({ top: targetTop, behavior: 'auto' });
      }
    }

    if (
      listEl &&
      typeof listEl.animate === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      searchListAnimRef.current?.cancel();
      searchListAnimRef.current = listEl.animate(
        [
          { opacity: 0.28, transform: 'translate3d(0, 18px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 240,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      );
    }

    setActiveSearchMarketId(targetMarket.id);
  }, [filteredMarketData, stickyHeaderHeight]);

  const scrollToSearchMarketIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= filteredMarketData.length) return;
    const targetMarket = filteredMarketData[idx];

    let neededLimit = 0;
    for (let i = 0; i < idx; i++) {
      neededLimit += filteredMarketData[i].filteredProducts.length;
    }
    neededLimit += Math.min(SEARCH_REVEAL_STEP, filteredMarketData[idx].filteredProducts.length);

    if (neededLimit > effectiveSearchRevealLimit) {
      pendingSearchJumpIdxRef.current = idx;
      programmaticSearchScrollUntilRef.current = Date.now() + 360;
      setSearchRevealState({ key: searchRevealKey, limit: neededLimit });
      setActiveSearchMarketId(targetMarket.id);
      return;
    }

    performSearchMarketScroll(idx);
  }, [filteredMarketData, effectiveSearchRevealLimit, searchRevealKey, performSearchMarketScroll]);

  useLayoutEffect(() => {
    const pendingIdx = pendingSearchJumpIdxRef.current;
    if (pendingIdx === null) return;
    pendingSearchJumpIdxRef.current = null;
    performSearchMarketScroll(pendingIdx);
  }, [effectiveSearchRevealLimit, filteredMarketData, performSearchMarketScroll]);

  // Progressive initial reveal (lightweight small batches so search opens instantly without CPU spike)
  useEffect(() => {
    if (!isSearchResultsViewportMode || totalSearchResultsCount === 0) return;
    const autoTarget = Math.min(totalSearchResultsCount, AUTO_SEARCH_REVEAL_TARGET);
    if (effectiveSearchRevealLimit >= autoTarget) return;

    const timer = window.setTimeout(() => {
      setSearchRevealState(prev => {
        const current = prev.key === searchRevealKey ? prev.limit : INITIAL_SEARCH_REVEAL;
        if (current >= autoTarget) return prev;
        return {
          key: searchRevealKey,
          limit: Math.min(autoTarget, current + 9)
        };
      });
    }, 95);

    return () => window.clearTimeout(timer);
  }, [isSearchResultsViewportMode, searchRevealKey, effectiveSearchRevealLimit, totalSearchResultsCount]);

  // Progressive bottom-scroll reveal triggered by the spinning-cart sentinel beneath the products
  useEffect(() => {
    if (!isSearchResultsViewportMode || totalSearchResultsCount === 0) return;
    const autoTarget = Math.min(totalSearchResultsCount, AUTO_SEARCH_REVEAL_TARGET);
    if (effectiveSearchRevealLimit < autoTarget) return;
    if (effectiveSearchRevealLimit >= totalSearchResultsCount) return;

    const sentinel = searchLoadMoreRef.current;
    if (!sentinel) return;

    let loadTimer: number | null = null;
    const scheduleNextBatch = () => {
      if (loadTimer !== null) return;
      loadTimer = window.setTimeout(() => {
        loadTimer = null;
        setSearchRevealState(prev => {
          const current = prev.key === searchRevealKey ? prev.limit : INITIAL_SEARCH_REVEAL;
          if (current >= totalSearchResultsCount) return prev;
          return {
            key: searchRevealKey,
            limit: Math.min(totalSearchResultsCount, current + SEARCH_REVEAL_STEP)
          };
        });
      }, 110);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          scheduleNextBatch();
        }
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (loadTimer !== null) window.clearTimeout(loadTimer);
    };
  }, [isSearchResultsViewportMode, searchRevealKey, effectiveSearchRevealLimit, totalSearchResultsCount]);

  // Sync active market tab while scrolling the unified search list on window scroll
  useEffect(() => {
    if (!isSearchResultsViewportMode || filteredMarketData.length === 0) return;

    const onSearchWindowScroll = () => {
      if (searchSlideScrollRafRef.current !== null) return;
      searchSlideScrollRafRef.current = requestAnimationFrame(() => {
        searchSlideScrollRafRef.current = null;
        if (Date.now() < programmaticSearchScrollUntilRef.current) return;
        const topPos = window.scrollY;
        if (topPos <= 10) {
          const firstId = filteredMarketData[0]?.id || null;
          setActiveSearchMarketId(prev => (prev === firstId ? prev : firstId));
          return;
        }
        const listEl = searchListScrollRef.current;
        if (!listEl) return;
        const headerBottom = searchTopBarRef.current?.getBoundingClientRect().bottom ?? stickyHeaderHeight;
        const sections = Array.from(listEl.querySelectorAll('[data-search-market-section]')) as HTMLElement[];
        let currentId = filteredMarketData[0]?.id || null;
        for (const sec of sections) {
          const compactHeader = sec.querySelector('[data-search-compact-header="true"]') as HTMLElement | null;
          const triggerTop = sec.getBoundingClientRect().top + (compactHeader ? compactHeader.offsetHeight : 0) - 24;
          if (triggerTop <= headerBottom) {
            const secId = sec.getAttribute('data-search-market-section');
            if (secId) currentId = secId;
          } else {
            break;
          }
        }
        if (currentId) {
          setActiveSearchMarketId(prev => (prev === currentId ? prev : currentId));
        }
      });
    };

    window.addEventListener('scroll', onSearchWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onSearchWindowScroll);
      if (searchSlideScrollRafRef.current !== null) {
        cancelAnimationFrame(searchSlideScrollRafRef.current);
        searchSlideScrollRafRef.current = null;
      }
    };
  }, [isSearchResultsViewportMode, filteredMarketData, stickyHeaderHeight]);

  // Reset vertical scroll position whenever search query changes
  useEffect(() => {
    if (skipSearchScrollResetRef.current) {
      skipSearchScrollResetRef.current = false;
      return;
    }
    if (isSearchResultsViewportMode) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [debouncedSearchQuery, debouncedMaxPrice]);

  const topCategoryPillsRef = useRef<HTMLDivElement | null>(null);
  const clickedCategoryRef = useRef<string | null>(null);
  const isScrollingToTopRef = useRef<boolean>(false);
  const scrollToTopSafetyTimerRef = useRef<number | null>(null);
  const [scrolledCategoryInfo, setScrolledCategoryInfo] = useState<{
    name: string;
    count: number;
    colorIdx: number;
  } | null>(null);

  useEffect(() => {
    if (!activeMarketId || showFavorites) {
      clickedCategoryRef.current = null;
      isScrollingToTopRef.current = false;
      if (scrollToTopSafetyTimerRef.current !== null) {
        window.clearTimeout(scrollToTopSafetyTimerRef.current);
        scrollToTopSafetyTimerRef.current = null;
      }
      setScrolledCategoryInfo(null);
      return;
    }

    const clearClickedCategory = () => {
      clickedCategoryRef.current = null;
      if (isScrollingToTopRef.current) {
        isScrollingToTopRef.current = false;
        if (scrollToTopSafetyTimerRef.current !== null) {
          window.clearTimeout(scrollToTopSafetyTimerRef.current);
          scrollToTopSafetyTimerRef.current = null;
        }
      }
    };

    const updateScrolledCategory = () => {
      if (isScrollingToTopRef.current) {
        if (window.scrollY <= 4) {
          isScrollingToTopRef.current = false;
          if (scrollToTopSafetyTimerRef.current !== null) {
            window.clearTimeout(scrollToTopSafetyTimerRef.current);
            scrollToTopSafetyTimerRef.current = null;
          }
        } else {
          setScrolledCategoryInfo(null);
          return;
        }
      }

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
  }, [activeMarketId, showFavorites, detailStartOffset, visibleDetailCount, activeCatalogByMarket, debouncedSearchQuery, debouncedMaxPrice]);

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
  const isSubpageActive = activeMarketId !== null || showFavorites;
  const hasActiveSubpage = Boolean(isSubpageActive || isSearchActive);

  // Target history depth:
  // 0: Root Home page
  // 1: Subpage (market / favorites)
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
    skipSearchScrollResetRef.current = true;
    setSearchReturnState(null);
    setActiveMarketId(null);
    setSelectedCategoryFilter(null);
    setActiveCategoryDropdown(null);
    setIsMarketSwitcherOpen(false);
    setShowFavorites(false);
    setSearchQuery(saved.searchQuery);
    setDebouncedSearchQuery(saved.searchQuery);
    setMaxPrice(saved.maxPrice);
    setDebouncedMaxPrice(saved.maxPrice);
    setExpandedSearchMarkets(saved.expandedSearchMarkets || {});
    setActiveSearchMarketId(saved.activeSearchMarketId || null);
    const savedKey = `${(saved.searchQuery || '').trim()}|${(saved.maxPrice || '').trim()}`;
    setSearchRevealState({
      key: savedKey,
      limit: saved.searchRevealLimit || AUTO_SEARCH_REVEAL_TARGET
    });
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
  const isViewingPrimaryCatalog = !activeSelectedCatId || activeMarketCatalogs.length === 0 || activeSelectedCatId === activeMarketCatalogs[0]?.id;
  const activeMarketUpcomingProducts = useMemo(() => {
    if (!activeMarketObj || !isViewingPrimaryCatalog) return [];
    return (
      upcomingProductsByMarketMap.get(activeMarketObj.id) ||
      upcomingProductsByMarketMap.get(activeMarketObj.id.trim().toLowerCase()) ||
      []
    );
  }, [activeMarketObj, isViewingPrimaryCatalog, upcomingProductsByMarketMap]);

  const activeMarketNormalFilteredProducts = useMemo(
    () => activeMarketProducts.filter(filterProductForDetail),
    [activeMarketCatalog, activeMarketObj, debouncedSearchQuery]
  );
  const activeMarketFilteredUpcomingProducts = useMemo(
    () => activeMarketUpcomingProducts.filter(filterProductForDetail),
    [activeMarketUpcomingProducts, debouncedSearchQuery]
  );
  const activeMarketFilteredProducts = useMemo(
    () => [...activeMarketNormalFilteredProducts, ...activeMarketFilteredUpcomingProducts],
    [activeMarketNormalFilteredProducts, activeMarketFilteredUpcomingProducts]
  );

  const orderedNormalCategoryGroups = useMemo(() => {
    const catEndDate = activeMarketCatalog?.endDate;
    const catOrderMap = new Map<string, DiscountProduct[]>();
    activeMarketNormalFilteredProducts.forEach(p => {
      const cat = (p.category || 'Digər').trim() || 'Digər';
      if (!catOrderMap.has(cat)) catOrderMap.set(cat, []);
      catOrderMap.get(cat)!.push(p);
    });

    return Array.from(catOrderMap.entries())
      .map(([name, prods], idx) => {
        const sortedProds = sortProductsNewestFirstWithExpiredLast(prods, catEndDate);
        const hasActive = sortedProds.some(p => getProductExpirySortWeight(p, catEndDate) === 0);
        const maxAddedAt = sortedProds.reduce((max, p) => {
          if (getProductExpirySortWeight(p, catEndDate) > 0) return max;
          return Math.max(max, getProductAddedTimestamp(p));
        }, 0);
        return { name, products: sortedProds, hasActive, maxAddedAt, idx };
      })
      .sort((a, b) => {
        if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
        if (a.hasActive && a.maxAddedAt !== b.maxAddedAt) return b.maxAddedAt - a.maxAddedAt;
        return a.idx - b.idx;
      });
  }, [activeMarketNormalFilteredProducts, activeMarketCatalog?.endDate]);

  const activeMarketCategoriesWithCounts = useMemo(() => {
    const list = orderedNormalCategoryGroups.map(g => ({ name: g.name, count: g.products.length }));
    if (activeMarketFilteredUpcomingProducts.length > 0) {
      list.push({ name: UPCOMING_CATEGORY_NAME, count: activeMarketFilteredUpcomingProducts.length });
    }
    return list;
  }, [orderedNormalCategoryGroups, activeMarketFilteredUpcomingProducts]);

  const activeMarketHasCategories =
    activeMarketCategoriesWithCounts.length > 0 &&
    !(activeMarketCategoriesWithCounts.length === 1 && activeMarketCategoriesWithCounts[0].name.toLowerCase() === 'digər');

  const activeMarketCategoryColorIndexMap = useMemo(
    () => new Map(activeMarketCategoriesWithCounts.map((c, idx) => [c.name, idx % CATEGORY_TAG_COLORS.length])),
    [activeMarketCategoriesWithCounts]
  );

  const activeMarketFullOrderedProducts = useMemo(() => {
    const catEndDate = activeMarketCatalog?.endDate;
    const normalCatSet = new Set<string>();
    activeMarketNormalFilteredProducts.forEach(p => normalCatSet.add((p.category || 'Digər').trim() || 'Digər'));
    const hasNormalCategories =
      normalCatSet.size > 0 && !(normalCatSet.size === 1 && normalCatSet.has('Digər'));

    const orderedNormal: DiscountProduct[] = !hasNormalCategories
      ? sortProductsNewestFirstWithExpiredLast(activeMarketNormalFilteredProducts, catEndDate)
      : orderedNormalCategoryGroups.flatMap(g => g.products);

    if (activeMarketFilteredUpcomingProducts.length === 0) {
      return orderedNormal;
    }
    const orderedUpcoming = sortProductsNewestFirstWithExpiredLast(activeMarketFilteredUpcomingProducts, catEndDate);
    return [...orderedNormal, ...orderedUpcoming];
  }, [activeMarketNormalFilteredProducts, activeMarketFilteredUpcomingProducts, orderedNormalCategoryGroups, activeMarketCatalog?.endDate]);

  const scrollToActiveCategorySection = useCallback((categoryName: string) => {
    if (!activeMarketObj) return;
    clickedCategoryRef.current = categoryName;
    const isUpcomingTarget = categoryName === UPCOMING_CATEGORY_NAME;
    const startIdx = activeMarketFullOrderedProducts.findIndex(p => {
      const cat = (p as any)._isUpcoming
        ? UPCOMING_CATEGORY_NAME
        : ((p.category || 'Digər').trim() || 'Digər');
      return cat === categoryName;
    });
    if (startIdx < 0) return;

    const catInfo = activeMarketCategoriesWithCounts.find(c => c.name === categoryName);
    const neededCount = isUpcomingTarget
      ? activeMarketFullOrderedProducts.length
      : startIdx + Math.min(catInfo?.count || 1, 15);

    if (startIdx < detailStartOffset) {
      const nextStart = startIdx <= 24 ? 0 : Math.max(0, startIdx - 12);
      pendingCategoryScrollRef.current = { marketId: activeMarketObj.id, category: categoryName };
      setDetailStartOffset(nextStart);
      if (neededCount > visibleDetailCount) {
        setVisibleDetailCount(neededCount);
      }
      return;
    }

    if (neededCount > visibleDetailCount) {
      pendingCategoryScrollRef.current = { marketId: activeMarketObj.id, category: categoryName };
      if (startIdx - detailStartOffset > 48) {
        setDetailStartOffset(Math.max(0, startIdx - 24));
      }
      setVisibleDetailCount(neededCount);
    } else {
      pendingCategoryScrollRef.current = null;
      performCategoryScrollAndAnimate(activeMarketObj.id, categoryName, { skipSlideAnim: isUpcomingTarget });
    }
  }, [activeMarketObj, activeMarketFullOrderedProducts, activeMarketCategoriesWithCounts, detailStartOffset, visibleDetailCount, performCategoryScrollAndAnimate]);

  useLayoutEffect(() => {
    const pending = pendingCategoryScrollRef.current;
    if (!pending || pending.marketId !== activeMarketId) return;

    const isUpcomingTarget = pending.category === UPCOMING_CATEGORY_NAME;
    const targetStartIdx = activeMarketFullOrderedProducts.findIndex((p) => {
      const cat = (p as any)._isUpcoming
        ? UPCOMING_CATEGORY_NAME
        : ((p.category || 'Digər').trim() || 'Digər');
      return cat === pending.category;
    });

    if (targetStartIdx === -1) {
      pendingCategoryScrollRef.current = null;
      return;
    }

    const catCount = activeMarketCategoriesWithCounts.find((c) => c.name === pending.category)?.count || 1;
    const neededEnd = isUpcomingTarget
      ? activeMarketFullOrderedProducts.length
      : targetStartIdx + Math.min(catCount, 15);

    if (targetStartIdx < detailStartOffset) {
      const nextStart = targetStartIdx <= 24 ? 0 : Math.max(0, targetStartIdx - 12);
      setDetailStartOffset(nextStart);
      if (neededEnd > visibleDetailCount) {
        setVisibleDetailCount(neededEnd);
      }
      return;
    }

    if (neededEnd > visibleDetailCount) {
      if (targetStartIdx - detailStartOffset > 48) {
        setDetailStartOffset(Math.max(0, targetStartIdx - 24));
      }
      setVisibleDetailCount(neededEnd);
      return;
    }

    if (performCategoryScrollAndAnimate(pending.marketId, pending.category, { skipSlideAnim: isUpcomingTarget })) {
      pendingCategoryScrollRef.current = null;
    }
  }, [
    visibleDetailCount,
    detailStartOffset,
    activeMarketId,
    activeMarketFullOrderedProducts,
    activeMarketCategoriesWithCounts,
    performCategoryScrollAndAnimate,
  ]);

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
    showFavorites,
    activeMarketObj,
    activeMarketFilteredProducts.length
  ]);

  return (
    <>
      {isLoading && <CartLoading />}

      <div className={`min-h-screen pb-36 sm:pb-40 bg-white font-sans flex flex-col transition-opacity duration-200 ${isLoading ? 'opacity-0 pointer-events-none overflow-hidden h-screen' : 'opacity-100'}`}>
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
              <div className="relative z-50 bg-white/95 backdrop-blur-md border-t border-b border-gray-100 py-1.5 sm:py-2 px-2.5 sm:px-6 lg:px-8 shadow-xs">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
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
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-nowrap">
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
                            </button>
                            <span className="text-[11px] sm:text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200/80 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 tabular-nums leading-none">
                              {activeMarketFilteredProducts.length} məhsul
                            </span>
                            {activeDateStatus.label && (
                              <span className={`hidden sm:inline-block text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${activeDateStatus.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                {activeDateStatus.label}
                              </span>
                            )}
                          </div>

                          {scrolledCategoryInfo && activeMarketHasCategories && (() => {
                            const isScrolledUpcoming = scrolledCategoryInfo.name === UPCOMING_CATEGORY_NAME;
                            const scColor = CATEGORY_TAG_COLORS[scrolledCategoryInfo.colorIdx % CATEGORY_TAG_COLORS.length] || CATEGORY_TAG_COLORS[0];
                            const isCatOpen = activeCategoryDropdown === activeMarketObj.id;
                            return (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMarketSwitcherOpen(false);
                                    setActiveCategoryDropdown(prev => prev === activeMarketObj.id ? null : activeMarketObj.id);
                                  }}
                                  title="Kateqoriyaları aç və seç"
                                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg border text-xs sm:text-sm font-black min-w-0 max-w-[230px] sm:max-w-[340px] cursor-pointer active:scale-95 transition-colors shadow-2xs ${
                                    isScrolledUpcoming
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : scColor.chip
                                  }`}
                                >
                                  {isScrolledUpcoming && <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                                  <span className="truncate">{scrolledCategoryInfo.name}</span>
                                  <span className={`text-[11px] sm:text-xs font-black px-1.5 py-0.5 rounded-md leading-none shrink-0 ${
                                    isScrolledUpcoming ? 'bg-emerald-600 text-white' : scColor.count
                                  }`}>
                                    {scrolledCategoryInfo.count}
                                  </span>
                                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isCatOpen ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            );
                          })()}
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
                            const isUpcomingCat = cat.name === UPCOMING_CATEGORY_NAME;
                            const cIdx = activeMarketCategoryColorIndexMap.get(cat.name) ?? 0;
                            const cColor = CATEGORY_TAG_COLORS[cIdx] || CATEGORY_TAG_COLORS[0];
                            const isCurrentCat = scrolledCategoryInfo?.name === cat.name || (isUpcomingCat && selectedCategoryFilter === UPCOMING_CATEGORY_NAME);
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
                                  {isUpcomingCat ? (
                                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 border ${cColor.chip}`} />
                                  )}
                                  <span className={`truncate ${isUpcomingCat ? 'font-bold text-emerald-800' : ''}`}>{cat.name}</span>
                                </div>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                  isUpcomingCat ? 'bg-emerald-600 text-white' : cColor.count
                                }`}>
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
               <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
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
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 mt-2 flex justify-end gap-2 flex-wrap">
            <button
              onClick={() => {
                setAdManagerInitialTab('featured');
                setAdManagerEditId(null);
                setIsFeaturedAdModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 shadow-sm cursor-pointer"
              title="Örnəklər sırasındakı reklamları idarə et"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Reklam (Örnək){featuredAds.length > 0 ? ` (${featuredAds.length})` : ''}
            </button>
            <button
              onClick={() => {
                setAdManagerInitialTab('swipe');
                setAdManagerEditId(null);
                setIsFeaturedAdModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors border border-orange-200 shadow-sm cursor-pointer"
              title="Hər 5 və 10 sürüşdürmədə çıxan reklamları idarə et"
            >
              <Layers className="w-3.5 h-3.5" />
              Kaydırma Reklamı{swipeAds.length > 0 ? ` (${swipeAds.length})` : ''}
            </button>
            <button
              onClick={() => {
                setAdManagerInitialTab('upcoming');
                setAdManagerEditId(null);
                setIsFeaturedAdModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm cursor-pointer"
              title="Sabahkı endirim bannerlərini və məhsullarını idarə et"
            >
              <Clock className="w-3.5 h-3.5" />
              Sabahkı Endirimlər{upcomingCampaigns.length > 0 ? ` (${upcomingCampaigns.length})` : ''}
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
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Kataloq Taranır...</span>
              </div>
            </div>
          </div>
        )}

        <div className={`max-w-6xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 ${isSearchResultsViewportMode ? 'pt-0 pb-6 md:pb-8' : 'pt-1.5 pb-6 md:pt-3 md:pb-8'}`}>
          <main className="w-full">
            <h1 className="sr-only">endirim.net – Market Endirimləri və Qiymət Müqayisəsi</h1>

            {showFavorites ? (
               <div className={`max-w-3xl md:max-w-4xl mx-auto ${favorites.length > 0 ? 'pb-32 sm:pb-36' : ''}`}>
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
                         <span className="truncate">Seçilənlər</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">{favorites.length} məhsul</span>
                    </div>
                  </div>
                  {favorites.length > 0 ? (
                      <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 transition-all duration-300 ${isSearching ? 'blur-sm opacity-60' : ''}`}>
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
                                      isThreeColMobile={false}
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
                 {(searchQuery.trim().length >= 2 || debouncedSearchQuery.trim().length >= 2 || debouncedMaxPrice.length > 0) ? (
                  <div className="relative">
                    <div>
                        {/* Sabit Top Bar: Geri düyməsi, Görünüş seçimi və bərabər hizalı Market tabları */}
                        {(() => {
                          const effectiveActiveIdx = Math.max(
                            0,
                            activeSearchMarketId
                              ? filteredMarketData.findIndex(m => m.id === activeSearchMarketId)
                              : 0
                          );
                          const effectiveActiveId = filteredMarketData[effectiveActiveIdx]?.id;

                          return (
                            <>
                              <div
                                ref={searchTopBarRef}
                                style={{ top: `${stickyHeaderHeight}px` }}
                                className={`sticky z-30 -mx-2.5 sm:-mx-6 lg:-mx-8 bg-gray-100/95 backdrop-blur-md border-t border-gray-200/70 pt-2 transition-[top] duration-150 ${
                                  filteredMarketData.length > 0 ? 'pb-0 space-y-1.5' : 'pb-2 border-b border-gray-200/90'
                                }`}
                              >
                                <div className="px-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
                                  {debouncedSearchQuery.trim().length > 0 ? (
                                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSearchQuery('');
                                            setDebouncedSearchQuery('');
                                            setIsSearching(false);
                                          }}
                                          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-700 hover:text-green-700 active:scale-95 transition-colors cursor-pointer shrink-0"
                                          title="Axtarışı təmizlə və geri qayıt"
                                        >
                                          <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-2xs shrink-0">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                          </div>
                                          <span>Geri</span>
                                        </button>
                                        <span className="h-4 w-px bg-gray-300/80 shrink-0" aria-hidden="true" />
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                            {debouncedSearchQuery}
                                          </span>
                                          <span className="inline-flex items-center text-[11px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full shrink-0 tabular-nums leading-none">
                                            {totalSearchResultsCount} nəticə
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs sm:text-sm font-bold text-gray-700">Nəticələr</span>
                                        <span className="inline-flex items-center text-[11px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full shrink-0 tabular-nums leading-none">
                                          {totalSearchResultsCount} nəticə
                                        </span>
                                      </div>
                                    )}

                                  <div className="flex items-center bg-white/80 p-0.5 rounded-lg border border-gray-200/90 shrink-0" role="group" aria-label="Görünüş rejimi">
                                    <button
                                      type="button"
                                      onClick={() => setProductViewMode('grid')}
                                      className={`p-1 sm:p-1.5 rounded-md transition-colors cursor-pointer ${productViewMode === 'grid' ? 'bg-emerald-50 text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                      title="3-lü cərgə"
                                    >
                                      <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setProductViewMode('two')}
                                      className={`p-1 sm:p-1.5 rounded-md transition-colors cursor-pointer ${productViewMode === 'two' ? 'bg-emerald-50 text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                                      title="2-li cərgə"
                                    >
                                      <Grid2x2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                  </div>
                                </div>

                                {filteredMarketData.length > 0 && (
                                  <div
                                    ref={searchChipsRowRef}
                                    style={{ boxShadow: 'inset 0 -1px 0 0 rgba(209, 213, 219, 0.9)' }}
                                    className="px-2.5 sm:px-6 lg:px-8 flex items-end gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide pt-1"
                                  >
                                    {filteredMarketData.map((m, idx) => {
                                      const shortName = m.name.replace(/\s+market$/i, '').trim().split(/\s+/)[0] || m.name;
                                      const isActiveChip = effectiveActiveId === m.id;
                                      return (
                                        <button
                                          key={`search-jump-${m.id}`}
                                          data-search-chip-id={m.id}
                                          type="button"
                                          onClick={() => scrollToSearchMarketIndex(idx)}
                                          className={
                                            isActiveChip
                                              ? 'relative z-20 inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-xl border bg-white text-gray-900 border-gray-200/90 border-b-white shrink-0 cursor-pointer select-none transition-colors duration-150'
                                              : 'relative z-10 inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-xl border border-transparent bg-white/60 hover:bg-white/95 text-gray-600 hover:text-gray-900 shrink-0 cursor-pointer select-none transition-colors duration-150'
                                          }
                                          title={`${m.name} (${m.filteredProducts.length} məhsul)`}
                                        >
                                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-gray-200/90 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                            {m.logoUrl ? (
                                              <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-0.5" />
                                            ) : (
                                              <span className={`text-${m.themeColor || 'green'}-700 font-black text-xs sm:text-sm`}>
                                                {m.logoPlaceholder}
                                              </span>
                                            )}
                                          </div>
                                          <span className={`text-sm sm:text-base font-extrabold tracking-tight ${isActiveChip ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {shortName}
                                          </span>
                                          <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-extrabold leading-none ${
                                            isActiveChip
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-gray-200/80 text-gray-600'
                                          }`}>
                                            {m.filteredProducts.length}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2.5 sm:pt-3">
                                {filteredMarketData.length === 0 ? (
                                  searchQuery.trim() !== debouncedSearchQuery.trim() ? (
                                    <div className="flex flex-col items-center justify-center py-20 px-4 select-none">
                                      <div className="relative flex items-center justify-center">
                                        <div className="absolute inset-0 bg-emerald-100 rounded-full blur-md opacity-70 animate-pulse" />
                                        <ShoppingCart className="relative w-8 h-8 text-emerald-600 animate-spin" strokeWidth={1.8} />
                                      </div>
                                      <span className="mt-2.5 text-xs font-bold text-gray-500 animate-pulse">Məhsullar yüklənir...</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-16 px-4">
                                      <div className="text-center py-12 px-6 bg-gray-50/80 rounded-2xl border border-gray-200/80 max-w-sm w-full">
                                        <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm sm:text-base font-bold text-gray-700">Məhsul tapılmadı</p>
                                        <p className="text-xs text-gray-400 mt-1">Başqa açar söz yoxlayın</p>
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  <div
                                    ref={searchListScrollRef}
                                    data-search-list-scroll="true"
                                    onTouchStart={(e) => {
                                      const t = e.touches[0];
                                      if (!t) return;
                                      searchSwipeStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
                                    }}
                                    onTouchEnd={(e) => {
                                      const start = searchSwipeStartRef.current;
                                      searchSwipeStartRef.current = null;
                                      if (!start || filteredMarketData.length <= 1) return;
                                      const t = e.changedTouches[0];
                                      if (!t) return;
                                      const dx = t.clientX - start.x;
                                      const dy = t.clientY - start.y;
                                      const dt = Date.now() - start.time;
                                      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && dt < 550) {
                                        if (dx < 0 && effectiveActiveIdx < filteredMarketData.length - 1) {
                                          scrollToSearchMarketIndex(effectiveActiveIdx + 1);
                                        } else if (dx > 0 && effectiveActiveIdx > 0) {
                                          scrollToSearchMarketIndex(effectiveActiveIdx - 1);
                                        }
                                      }
                                    }}
                                    onWheel={(e) => {
                                      if (filteredMarketData.length <= 1) return;
                                      const now = Date.now();
                                      if (now < searchWheelCooldownRef.current) return;
                                      if (Math.abs(e.deltaX) > 28 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.6) {
                                        searchWheelCooldownRef.current = now + 380;
                                        if (e.deltaX > 0 && effectiveActiveIdx < filteredMarketData.length - 1) {
                                          scrollToSearchMarketIndex(effectiveActiveIdx + 1);
                                        } else if (e.deltaX < 0 && effectiveActiveIdx > 0) {
                                          scrollToSearchMarketIndex(effectiveActiveIdx - 1);
                                        }
                                      }
                                    }}
                                    className="relative"
                                  >
                                    {(() => {
                                      let remainingBudget = effectiveSearchRevealLimit;
                                      return filteredMarketData.map((market, idx) => {
                                        if (remainingBudget <= 0) return null;
                                        const marketLimit = Math.min(market.filteredProducts.length, remainingBudget);
                                        remainingBudget -= marketLimit;
                                        const marketEndDate = market.catalogs?.[0]?.endDate;
                                        const isFirstMarket = idx === 0;
                                        return (
                                          <SearchMarketResultCard
                                            key={`search-unified-${market.id}`}
                                            market={market}
                                            filteredProducts={market.filteredProducts}
                                            productViewMode={productViewMode}
                                            isAdmin={isAdmin}
                                            isFavorite={isFavorite}
                                            onToggleFavorite={toggleFavorite}
                                            headerMode={isFirstMarket ? 'hidden' : 'compact-name'}
                                            maxProductsToShow={marketLimit}
                                            onProductClick={(product) => {
                                              if (!isAdmin) {
                                                const modalList = filteredMarketData.flatMap(m => {
                                                  const mEndDate = m.catalogs?.[0]?.endDate;
                                                  return m.filteredProducts.map(p => ({
                                                    product: p,
                                                    marketName: m.name,
                                                    marketId: m.id,
                                                    catalogEndDate: mEndDate
                                                  }));
                                                });
                                                const clickedIdx = modalList.findIndex(
                                                  item => item.product === product && item.marketId === market.id
                                                );
                                                setViewProduct({
                                                  product,
                                                  marketName: market.name,
                                                  marketId: market.id,
                                                  catalogEndDate: marketEndDate,
                                                  productList: modalList,
                                                  currentIndex: clickedIdx >= 0 ? clickedIdx : 0
                                                });
                                              }
                                            }}
                                            onEditProduct={(product) => handleEditFromSearch(product, market.id)}
                                          />
                                        );
                                      });
                                    })()}

                                    {effectiveSearchRevealLimit < totalSearchResultsCount && (
                                      <div
                                        ref={searchLoadMoreRef}
                                        className="flex flex-col items-center justify-center py-6 sm:py-8 select-none"
                                      >
                                        <div className="relative flex items-center justify-center">
                                          <div className="absolute inset-0 bg-emerald-100 rounded-full blur-md opacity-70 animate-pulse" />
                                          <ShoppingCart className="relative w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 animate-spin" strokeWidth={1.8} />
                                        </div>
                                        <span className="mt-2 text-[11px] sm:text-xs font-bold text-gray-500 animate-pulse">
                                          Məhsullar yüklənir...
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                    </div>
                  </div>
                ) : (
                  <>
                    {activeMarketId === null ? (
                      <div className="w-full space-y-4 sm:space-y-6 animate-[fadeIn_0.4s_ease-out]">
                        {/* Two independent horizontally scrollable rows of wide horizontal featured cards */}
                        {sampleFeaturedProducts.length > 0 && (() => {
                          type MarqueeRowItem =
                            | { type: 'product'; product: DiscountProduct; market: MarketData }
                            | { type: 'ad'; ad: BannerData; isPlaceholder?: boolean }
                            | { type: 'upcoming'; campaign: UpcomingCampaign; market: MarketData | null };

                          const activeCarouselAds = featuredAds.filter(
                            (a) => a.isVisible && ((a.htmlContent || '').trim() || (a.imageUrl || '').trim() || (a.title || '').trim())
                          );

                          const topProducts = sampleFeaturedProducts.filter((_, i) => i % 2 === 0);
                          const bottomProducts = sampleFeaturedProducts.filter((_, i) => i % 2 === 1);

                          const emptyPlaceholderAd: BannerData = {
                            id: 'placeholder-ad',
                            title: '',
                            imageUrl: '',
                            htmlContent: '',
                            link: '',
                            isVisible: false,
                            fitMode: 'cover',
                          };

                          type MarqueeBannerSlot =
                            | { kind: 'ad'; ad: BannerData; isPlaceholder?: boolean }
                            | { kind: 'upcoming'; campaign: UpcomingCampaign; market: MarketData | null };

                          const allPromoSlots: MarqueeBannerSlot[] = [
                            ...activeUpcomingCampaigns.map((campaign) => ({
                              kind: 'upcoming' as const,
                              campaign,
                              market: resolveMarketForCampaign(campaign.marketId, markets),
                            })),
                            ...activeCarouselAds.map((ad) => ({
                              kind: 'ad' as const,
                              ad,
                            })),
                          ];

                          const topBanners: MarqueeBannerSlot[] =
                            allPromoSlots.length === 0
                              ? [{ kind: 'ad', ad: emptyPlaceholderAd, isPlaceholder: true }]
                              : allPromoSlots.filter((_, i) => i % 2 === 0);

                          const bottomBanners: MarqueeBannerSlot[] =
                            allPromoSlots.length > 1
                              ? allPromoSlots.filter((_, i) => i % 2 === 1)
                              : [];

                          // Strictly interleave: Product, Banner, Product, Banner... (never two banners back-to-back)
                          const interleaveProductsAndAds = (
                            productsList: { product: DiscountProduct; market: MarketData }[],
                            bannersList: MarqueeBannerSlot[]
                          ): MarqueeRowItem[] => {
                            const merged: MarqueeRowItem[] = [];
                            let pIdx = 0;
                            let bIdx = 0;

                            if (pIdx < productsList.length) {
                              merged.push({ type: 'product', ...productsList[pIdx++] });
                            }
                            while (bIdx < bannersList.length) {
                              const slot = bannersList[bIdx++];
                              if (slot.kind === 'upcoming') {
                                merged.push({ type: 'upcoming', campaign: slot.campaign, market: slot.market });
                              } else {
                                merged.push({ type: 'ad', ad: slot.ad, isPlaceholder: slot.isPlaceholder });
                              }
                              if (pIdx < productsList.length) {
                                merged.push({ type: 'product', ...productsList[pIdx++] });
                              }
                            }
                            while (pIdx < productsList.length) {
                              merged.push({ type: 'product', ...productsList[pIdx++] });
                            }
                            return merged;
                          };

                          const topRowItems = interleaveProductsAndAds(topProducts, topBanners);
                          const bottomRowItems = interleaveProductsAndAds(bottomProducts, bottomBanners);

                          const sampleRows = [
                            { key: 'top', items: topRowItems, ref: featuredCarouselTopRef },
                            ...(bottomRowItems.length > 0
                              ? [{ key: 'bottom', items: bottomRowItems, ref: featuredCarouselBottomRef }]
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
                                    className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
                                        const currentAd = item.ad;
                                        const adHtml = (currentAd.htmlContent || '').trim();
                                        const adImg = (currentAd.imageUrl || '').trim();
                                        const adTitle = (currentAd.title || '').trim();
                                        const adLink = normalizeAdLinkUrl(currentAd.link);
                                        const adFitMode = currentAd.fitMode === 'contain' ? 'contain' : 'cover';
                                        const imgErrKey = `${currentAd.id}::${adImg}`;
                                        const isImgErrored = Boolean(erroredAdImgs[imgErrKey]);
                                        const hasActiveAd = Boolean(!item.isPlaceholder && currentAd.isVisible && (adHtml || adImg || adTitle));
                                        const showAdHtml = Boolean(hasActiveAd && adHtml);
                                        const showAdImage = Boolean(hasActiveAd && !showAdHtml && adImg && !isImgErrored);

                                        const cardInner = (
                                          <div className={`bg-white rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full h-full relative z-10 shadow-2xs border border-amber-200/90 ${(showAdHtml || showAdImage) ? 'p-0' : 'p-1.5'}`}>
                                            {showAdHtml ? (
                                              <HtmlAdFrame html={adHtml} title={adTitle || 'Reklam'} interactive={false} />
                                            ) : showAdImage ? (
                                              adFitMode === 'cover' ? (
                                                <img
                                                  src={adImg}
                                                  alt={adTitle || 'Reklam'}
                                                  referrerPolicy="no-referrer"
                                                  onError={() => setErroredAdImgs(prev => ({ ...prev, [imgErrKey]: true }))}
                                                  className="w-full h-full object-cover object-center pointer-events-none select-none"
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
                                                    onError={() => setErroredAdImgs(prev => ({ ...prev, [imgErrKey]: true }))}
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
                                            key={`sample-hero-${row.key}-ad-${currentAd.id}-${idx}`}
                                            className="w-[calc((100%-8px)/1.85)] sm:w-[calc((100%-16px)/2.5)] md:w-[calc((100%-24px)/3.5)] lg:w-[calc((100%-36px)/4.4)] shrink-0 h-[110px] sm:h-[124px] md:h-[134px] lg:h-[138px]"
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
                                                    setAdManagerInitialTab('featured');
                                                    setAdManagerEditId(item.isPlaceholder ? null : currentAd.id);
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
                                                  onClick={() => {
                                                    setAdManagerInitialTab('featured');
                                                    setAdManagerEditId(item.isPlaceholder ? null : currentAd.id);
                                                    setIsFeaturedAdModalOpen(true);
                                                  }}
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

                                      if (item.type === 'upcoming') {
                                        const camp = item.campaign;
                                        const campMkt = item.market;
                                        const campHtml = (camp.htmlContent || '').trim();
                                        const campImg = (camp.imageUrl || '').trim();
                                        const campTitle = (camp.title || '').trim();
                                        const campFitMode = camp.fitMode === 'contain' ? 'contain' : 'cover';
                                        const imgErrKey = `upcoming-${camp.id}::${campImg}`;
                                        const isImgErrored = Boolean(erroredAdImgs[imgErrKey]);
                                        const showCampHtml = Boolean(campHtml);
                                        const showCampImg = Boolean(!showCampHtml && campImg && !isImgErrored);
                                        const shortMktName = getShortMarketLabel(campMkt?.name || camp.marketId);
                                        const dateTabLabel = formatUpcomingDateLabel(camp.activateAt, todayDateStr);

                                        return (
                                          <div
                                            key={`sample-hero-${row.key}-upcoming-${camp.id}-${idx}`}
                                            className="w-[calc((100%-8px)/1.85)] sm:w-[calc((100%-16px)/2.5)] md:w-[calc((100%-24px)/3.5)] lg:w-[calc((100%-36px)/4.4)] shrink-0 h-[110px] sm:h-[124px] md:h-[134px] lg:h-[138px]"
                                          >
                                            <div
                                              style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                              className="relative flex flex-col h-full select-none pt-3.5 sm:pt-4 group/upcomingcard"
                                            >
                                              <div
                                                className="absolute top-0 left-0 z-0 bg-emerald-600 text-white px-2 pt-[3px] rounded-t-lg sm:rounded-t-xl flex items-start justify-center pointer-events-none select-none max-w-[88%] shadow-xs"
                                                style={{ height: '34px' }}
                                              >
                                                <span className="text-[9px] sm:text-[10.5px] font-black tracking-tight whitespace-nowrap leading-none">
                                                  {shortMktName} · {dateTabLabel}
                                                </span>
                                              </div>

                                              {isAdmin && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setAdManagerInitialTab('upcoming');
                                                    setAdManagerEditId(camp.id);
                                                    setIsFeaturedAdModalOpen(true);
                                                  }}
                                                  className="absolute top-0 right-1 z-20 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shadow-sm cursor-pointer transition-colors"
                                                  title="Sabahkı endirimi düzəlt"
                                                >
                                                  <Edit className="w-2.5 h-2.5" />
                                                  Düzəlt
                                                </button>
                                              )}

                                              <button
                                                type="button"
                                                onClick={() => handleNavigateToMarketUpcoming(camp)}
                                                className="flex flex-1 min-h-0 w-full cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all text-left"
                                                title={campTitle || `${shortMktName} · Sabahkı endirimlər`}
                                              >
                                                <div className={`bg-white rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full h-full relative z-10 shadow-2xs border border-emerald-200/90 ${(showCampHtml || showCampImg) ? 'p-0' : 'p-2'}`}>
                                                  {showCampHtml ? (
                                                    <HtmlAdFrame html={campHtml} title={campTitle || shortMktName} interactive={false} />
                                                  ) : showCampImg ? (
                                                    campFitMode === 'cover' ? (
                                                      <img
                                                        src={campImg}
                                                        alt={campTitle || shortMktName}
                                                        referrerPolicy="no-referrer"
                                                        onError={() => setErroredAdImgs(prev => ({ ...prev, [imgErrKey]: true }))}
                                                        className="w-full h-full object-cover object-center pointer-events-none select-none"
                                                      />
                                                    ) : (
                                                      <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gray-100">
                                                        <img
                                                          src={campImg}
                                                          alt=""
                                                          aria-hidden="true"
                                                          referrerPolicy="no-referrer"
                                                          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-45 pointer-events-none select-none"
                                                        />
                                                        <img
                                                          src={campImg}
                                                          alt={campTitle || shortMktName}
                                                          referrerPolicy="no-referrer"
                                                          onError={() => setErroredAdImgs(prev => ({ ...prev, [imgErrKey]: true }))}
                                                          className="relative z-10 w-full h-full object-contain pointer-events-none select-none"
                                                        />
                                                      </div>
                                                    )
                                                  ) : (
                                                    <div className="w-full h-full rounded-[9px] sm:rounded-xl border border-dashed border-emerald-300/90 bg-emerald-50/40 flex flex-col items-center justify-center px-2 text-center">
                                                      <p className="text-[11.5px] min-[380px]:text-xs sm:text-[13px] font-extrabold text-emerald-950 leading-snug line-clamp-2">
                                                        {campTitle || `${shortMktName} · Sabahkı Endirimlər`}
                                                      </p>
                                                      <span className="mt-1 text-[10px] font-bold text-emerald-700 tabular-nums">
                                                        {(camp.products || []).length} məhsula bax →
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      }

                                      const { product, market } = item;
                                      return (
                                        <div
                                          key={`sample-hero-${row.key}-${market.id}-${idx}`}
                                          className="w-[calc((100%-8px)/1.85)] sm:w-[calc((100%-16px)/2.5)] md:w-[calc((100%-24px)/3.5)] lg:w-[calc((100%-36px)/4.4)] shrink-0 h-[110px] sm:h-[124px] md:h-[134px] lg:h-[138px]"
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
                                    className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
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

                        {/* Total product count above the Markets List (active / non-expired products only) - strictly non-copyable */}
                        <div
                          className="flex items-center justify-between px-1 pt-0.5 select-none"
                          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                        >
                          <span
                            className="text-xs sm:text-sm font-extrabold text-black uppercase tracking-wider select-none"
                            style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                          >
                            Marketlər
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 sm:px-3 py-1 rounded-full shadow-2xs tabular-nums select-none"
                            style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                          >
                            Cəmi {displayedHomeProductsCount} məhsul
                          </span>
                        </div>

                        {/* Markets List - Responsive grid (1-col mobile, 2-col tablet, 3-col desktop) */}
                        <div
                          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 select-none"
                          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                        >
                          {sortedMarkets.map((market) => {
                            const previewCatalog = market.catalogs && market.catalogs.length > 0 ? market.catalogs[0] : null;
                            const allMarketProducts = (market.catalogs && market.catalogs.length > 0)
                              ? market.catalogs.flatMap(c => c.products || [])
                              : (market.products || []);
                            const previewProducts = previewCatalog ? (previewCatalog.products || []) : allMarketProducts;
                            const catalogProductsCount = previewProducts.length;
                            const upcomingCount = (
                              upcomingProductsByMarketMap.get(market.id) ||
                              upcomingProductsByMarketMap.get(market.id.trim().toLowerCase()) ||
                              []
                            ).length;
                            const isMarketExpired = isMarketFullyExpired(market);

                            return (
                              <div
                                key={market.id}
                                onClick={() => handleSelectMarket(market.id)}
                                role="button"
                                tabIndex={0}
                                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
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
                                    <h3
                                      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                      className={`text-sm sm:text-base md:text-lg font-black ${isMarketExpired ? 'text-gray-500' : 'text-gray-800'} group-hover:text-blue-600 transition-colors truncate select-none`}
                                    >
                                      {market.name}
                                    </h3>
                                    {/* Green product count for active markets, gray for expired + upcoming +N badge */}
                                    <div className="inline-flex items-center gap-1 shrink-0">
                                      <span
                                        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                        className={`inline-flex items-center text-xs sm:text-sm font-black px-2 sm:px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs border select-none tabular-nums ${
                                          isMarketExpired
                                            ? 'text-gray-500 bg-gray-100 border-gray-200'
                                            : 'text-emerald-700 bg-emerald-50 border-emerald-200/90'
                                        }`}
                                      >
                                        {catalogProductsCount}
                                      </span>
                                      {upcomingCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleNavigateToMarketIdUpcoming(market.id);
                                          }}
                                          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                          title={`${market.name} · Sabahkı endirimlərə keç (${upcomingCount} məhsul)`}
                                          aria-label={`${market.name} sabahkı endirimlərə keç (${upcomingCount} məhsul)`}
                                          className="inline-flex items-center text-xs sm:text-sm font-black px-2 sm:px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700/80 select-none tabular-nums cursor-pointer active:scale-95 transition-all"
                                        >
                                          +{upcomingCount}
                                        </button>
                                      )}
                                    </div>
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

                        {/* Fürsətlər ("Ucuzun da ucuzu") right below the Markets List */}
                        {groupedOpportunities.length > 0 && (() => {
                          const visibleHomeGroups = groupedOpportunities.slice(0, homeOppLimit);
                          const colCount = Math.max(2, homeOppColumnCount);
                          const colBuckets: Array<Array<{ group: typeof visibleHomeGroups[number]; idx: number }>> = Array.from({ length: colCount }, () => []);
                          const colHeights = Array(colCount).fill(0);
                          visibleHomeGroups.forEach((group, idx) => {
                            let targetCol = 0;
                            for (let c = 1; c < colCount; c++) {
                              if (colHeights[c] < colHeights[targetCol]) targetCol = c;
                            }
                            colBuckets[targetCol].push({ group, idx });
                            colHeights[targetCol] += 220 + group.variants.length * 42;
                          });

                          return (
                            <section className="space-y-3 pt-3 sm:pt-4 border-t border-gray-200/70">
                              <div
                                className="flex items-center justify-start px-0.5 select-none"
                                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-black text-gray-900 tracking-tight">
                                    <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                                    <span>Ucuzun da ucuzu</span>
                                  </span>
                                  <span className="inline-flex items-center text-[11px] sm:text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full tabular-nums">
                                    {groupedOpportunities.length}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 items-start">
                                {colBuckets.map((colItems, colIdx) => (
                                  <div key={`home-opp-col-${colIdx}`} className="flex flex-col gap-2.5 sm:gap-3.5 md:gap-4 min-w-0">
                                    {colItems.map(({ group, idx }) => (
                                      <GroupedProductCard
                                        key={`home-opp-${group.productName}-${idx}`}
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

                              {groupedOpportunities.length > homeOppLimit && (
                                <div ref={homeOppSentinelRef} className="h-8 w-full" aria-hidden="true" />
                              )}
                            </section>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="animate-[fadeIn_0.3s_ease-out]">
                        {(() => {
                          const mkt = activeMarketObj || sortedMarkets[0];
                          if (!mkt) return null;
                          const mktCatalogs = mkt.catalogs || [];
                          const selectedCatId = activeCatalogByMarket[mkt.id] || (mktCatalogs[0]?.id || null);
                          const mktCatalog = mktCatalogs.find(c => c.id === selectedCatId) || (mktCatalogs.length > 0 ? mktCatalogs[0] : null);
                          const mktProducts = mktCatalog ? mktCatalog.products : (mkt.products || []);
                          const isDiscountSorted = isAdmin && adminSortByDiscount;
                          const mktFilteredProducts = isDiscountSorted
                            ? [...activeMarketFilteredProducts].sort((a, b) => {
                                const sa = getProductDiscountSortScore(a);
                                const sb = getProductDiscountSortScore(b);
                                if (Math.abs(sb.pct - sa.pct) > 0.01) return sb.pct - sa.pct;
                                if (Math.abs(sb.diff - sa.diff) > 0.01) return sb.diff - sa.diff;
                                return 0;
                              })
                            : activeMarketFullOrderedProducts;
                          const mktAccent = mkt.themeColor || 'green';

                          const allCategoriesWithCounts = activeMarketCategoriesWithCounts;
                          const effectiveHasCategories = activeMarketHasCategories && !isDiscountSorted;
                          const categoryColorIndexMap = activeMarketCategoryColorIndexMap;

                          const orderedForDisplay = effectiveHasCategories ? activeMarketFullOrderedProducts : mktFilteredProducts;
                          const clampedStartOffset = !isDiscountSorted
                            ? Math.min(detailStartOffset, Math.max(0, orderedForDisplay.length - 1))
                            : 0;
                          const displayedProducts = orderedForDisplay.slice(clampedStartOffset, visibleDetailCount);
                          const hasMore = visibleDetailCount < orderedForDisplay.length;
                          const hasMoreAbove = clampedStartOffset > 0 && !isDiscountSorted;

                          const openProductInMarketModal = (product: DiscountProduct) => {
                            if (isAdmin) return;
                            const fullMarketModalList = orderedForDisplay.map(p => ({
                              product: p,
                              marketName: mkt.name,
                              marketId: mkt.id,
                              catalogEndDate: mktCatalog?.endDate
                            }));
                            const fullIdx = fullMarketModalList.findIndex(item => item.product === product);
                            setViewProduct({
                              product,
                              marketName: mkt.name,
                              marketId: mkt.id,
                              catalogEndDate: mktCatalog?.endDate,
                              productList: fullMarketModalList,
                              currentIndex: fullIdx >= 0 ? fullIdx : 0
                            });
                          };

                          const scrollToCategorySection = (categoryName: string) => {
                            scrollToActiveCategorySection(categoryName);
                          };

                          // Grouping by category (all categories stay visible, with 'Sabahkı Endirimlər' last)
                          const groupedProductsByCategory: { category: string; products: { product: DiscountProduct; originalIndex: number }[] }[] = [];
                          if (effectiveHasCategories) {
                            const catMap = new Map<string, { category: string; products: { product: DiscountProduct; originalIndex: number }[] }>();
                            displayedProducts.forEach((product) => {
                              const cat = (product as any)._isUpcoming
                                ? UPCOMING_CATEGORY_NAME
                                : ((product.category || 'Digər').trim() || 'Digər');
                              if (!catMap.has(cat)) {
                                const newGroup = { category: cat, products: [] };
                                catMap.set(cat, newGroup);
                                groupedProductsByCategory.push(newGroup);
                              }
                              const rawIdx = (product as any)._isUpcoming ? -1 : mktProducts.indexOf(product);
                              catMap.get(cat)!.products.push({ product, originalIndex: rawIdx >= 0 ? rawIdx : 0 });
                            });
                          }

                          return (
                            <div 
                              key={mkt.id} 
                              ref={marketDetailContainerRef}
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
                                            setDetailStartOffset(0);
                                            setVisibleDetailCount(12);
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
                                          const isUpcomingCat = cat.name === UPCOMING_CATEGORY_NAME;
                                          const colorIdx = categoryColorIndexMap.get(cat.name) ?? 0;
                                          const tagColor = CATEGORY_TAG_COLORS[colorIdx];
                                          return (
                                            <button
                                              key={`cat-tag-${cat.name}`}
                                              type="button"
                                              onClick={() => scrollToCategorySection(cat.name)}
                                              className={`inline-flex items-center gap-1.5 rounded-lg border font-bold transition-all active:scale-95 cursor-pointer ${
                                                isUpcomingCat
                                                  ? 'px-3 py-1.5 text-xs sm:text-[13px] font-extrabold bg-emerald-100/90 text-emerald-900 border-emerald-400/90 hover:bg-emerald-200/80 shadow-2xs'
                                                  : `px-2.5 py-1 text-[11px] sm:text-xs ${tagColor.chip}`
                                              }`}
                                            >
                                              {isUpcomingCat && (
                                                <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                                              )}
                                              <span>{cat.name}</span>
                                              <span className={`font-extrabold px-1.5 py-0.5 leading-none rounded-md ${
                                                isUpcomingCat ? 'text-[11px] bg-emerald-600 text-white' : `text-[10px] ${tagColor.count}`
                                              }`}>
                                                {cat.count}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {/* Upward Lazy Load Sentinel when scrolled into middle/bottom slice */}
                                      {hasMoreAbove && (
                                        <div
                                          ref={loadMoreTopSentinelRef}
                                          onClick={handleLoadMoreUpward}
                                          className="py-4 flex flex-col items-center justify-center cursor-pointer select-none"
                                        >
                                          <div className="relative flex items-center justify-center">
                                            <div className="absolute inset-0 bg-emerald-100 rounded-full blur-md opacity-70 animate-pulse" />
                                            <ShoppingCart className="relative w-6 h-6 text-emerald-600 animate-spin" strokeWidth={1.8} />
                                          </div>
                                          <span className="mt-1.5 text-[11px] font-bold text-gray-500 animate-pulse">
                                            Əvvəlki məhsullar yüklənir...
                                          </span>
                                        </div>
                                      )}

                                      {groupedProductsByCategory.map((group, groupIdx) => {
                                        const isUpcomingGroup = group.category === UPCOMING_CATEGORY_NAME;
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
                                            className={
                                              isUpcomingGroup
                                                ? 'mt-2 rounded-2xl bg-gradient-to-b from-emerald-50/90 via-emerald-50/35 to-white border-2 border-emerald-300/90 p-2.5 sm:p-4 space-y-3 sm:space-y-4 shadow-xs'
                                                : `space-y-2.5 sm:space-y-3 ${groupIdx > 0 ? 'pt-3.5 border-t border-gray-100' : ''}`
                                            }
                                          >
                                            {isUpcomingGroup ? (
                                              <div className="flex items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-emerald-600 text-white shadow-sm select-none">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                                  </div>
                                                  <div className="min-w-0">
                                                    <h3 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-white leading-tight truncate">
                                                      {group.category}
                                                    </h3>
                                                    <p className="text-[11px] sm:text-xs font-semibold text-emerald-100 leading-tight mt-0.5 truncate">
                                                      Sabah başlayacaq endirimli məhsullar
                                                    </p>
                                                  </div>
                                                </div>
                                                <span className="shrink-0 bg-white text-emerald-800 text-xs sm:text-sm font-black px-2.5 sm:px-3 py-1 rounded-lg shadow-2xs tabular-nums">
                                                  {catTotalCount} məhsul
                                                </span>
                                              </div>
                                            ) : (
                                              (groupIdx > 0 || hasMoreAbove) && (
                                                <div className="flex items-center justify-start">
                                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-extrabold shadow-2xs select-none ${tagColor.chip}`}>
                                                    <span>{group.category}</span>
                                                    <span className={`text-[10px] sm:text-xs font-black px-1.5 py-0.5 leading-none rounded-md ${tagColor.count}`}>
                                                      {catTotalCount}
                                                    </span>
                                                  </div>
                                                </div>
                                              )
                                            )}

                                            <div className={productViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4'}>
                                              {group.products.map(({ product, originalIndex }, cardIdx) => {
                                                const isUpProd = Boolean((product as any)._isUpcoming);
                                                return (
                                                  <div
                                                    key={`${mkt.id}-${isUpProd ? `up-${cardIdx}` : originalIndex}-${product.productName}`}
                                                    className="animate-[fadeIn_0.24s_ease-out]"
                                                  >
                                                    <ProductCard 
                                                      product={product} 
                                                      accentColor={mktAccent} 
                                                      catalogEndDate={mktCatalog?.endDate}
                                                      isAdmin={isAdmin} 
                                                      variant="compact"
                                                      isListMode={false}
                                                      isThreeColMobile={productViewMode === 'grid'}
                                                      hasCheaperAlternative={!isUpProd && checkForCheaperAlternative(product, mkt.id)} 
                                                      onClick={() => openProductInMarketModal(product)} 
                                                      onEdit={() => {
                                                        if (isUpProd && (product as any)._upcomingCampaignId) {
                                                          setAdManagerInitialTab('upcoming');
                                                          setAdManagerEditId((product as any)._upcomingCampaignId);
                                                          setIsFeaturedAdModalOpen(true);
                                                          return;
                                                        }
                                                        setActiveMarketId(mkt.id);
                                                        setProductToEdit({ product, index: originalIndex, catalogId: selectedCatId || undefined });
                                                      }} 
                                                      isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                                      onToggleFavorite={() => toggleFavorite(product, mkt.id)} 
                                                      onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, mkt, mktCatalog?.endDate) : undefined}
                                                    />
                                                  </div>
                                                );
                                              })}
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
                                        const isUpProd = Boolean((product as any)._isUpcoming);
                                        const rawIdx = isUpProd ? -1 : mktProducts.indexOf(product);
                                        const resolvedIdx = rawIdx >= 0 ? rawIdx : index;
                                        return (
                                          <div
                                            key={`${mkt.id}-${isUpProd ? `up-${index}` : resolvedIdx}-${product.productName}`}
                                            className="animate-[fadeIn_0.24s_ease-out]"
                                          >
                                            <ProductCard 
                                              product={product} 
                                              accentColor={mktAccent} 
                                              catalogEndDate={mktCatalog?.endDate}
                                              isAdmin={isAdmin} 
                                              variant="compact"
                                              isListMode={false}
                                              isThreeColMobile={productViewMode === 'grid'}
                                              hasCheaperAlternative={!isUpProd && checkForCheaperAlternative(product, mkt.id)} 
                                              onClick={() => openProductInMarketModal(product)} 
                                              onEdit={() => {
                                                if (isUpProd && (product as any)._upcomingCampaignId) {
                                                  setAdManagerInitialTab('upcoming');
                                                  setAdManagerEditId((product as any)._upcomingCampaignId);
                                                  setIsFeaturedAdModalOpen(true);
                                                  return;
                                                }
                                                setActiveMarketId(mkt.id);
                                                setProductToEdit({ product, index: resolvedIdx, catalogId: selectedCatId || undefined });
                                              }} 
                                              isFavorite={isFavorite(product.productName || '', mkt.id)} 
                                              onToggleFavorite={() => toggleFavorite(product, mkt.id)} 
                                              onExportInstagram={isAdmin ? () => exportGeneralProductPosterPng(product, mkt, mktCatalog?.endDate) : undefined}
                                            />
                                          </div>
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


                              {/* Infinite Scroll / Lazy Load Sentinel with Spinning Cart */}
                              {hasMore && (
                                <div
                                  ref={loadMoreSentinelRef}
                                  onClick={() => setVisibleDetailCount(prev => prev + 18)}
                                  className="py-6 sm:py-8 flex flex-col items-center justify-center cursor-pointer select-none"
                                >
                                  <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-emerald-100 rounded-full blur-md opacity-70 animate-pulse" />
                                    <ShoppingCart className="relative w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 animate-spin" strokeWidth={1.8} />
                                  </div>
                                  <span className="mt-2 text-[11px] sm:text-xs font-bold text-gray-500 animate-pulse">
                                    Məhsullar yüklənir...
                                  </span>
                                </div>
                              )}
                              {!hasMore && orderedForDisplay.length > 24 && clampedStartOffset === 0 && (
                                <div className="py-6 text-center text-xs font-medium text-gray-400">
                                  Bütün {orderedForDisplay.length} məhsul göstərildi
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

      {/* Seçilənlər: Axtarış qutusunun üzərində, aşağı solda sabit (yalnız ad, qiymət və cəmi qiymət) */}
      {!isLoading && showFavorites && favorites.length > 0 && (() => {
        const favoritesTotalPrice = favorites.reduce((sum, item) => {
          const parsed = parsePriceNumber(item.newPrice);
          return sum + (!isNaN(parsed) && parsed > 0 ? parsed : 0);
        }, 0);
        return (
          <div className="fixed bottom-[69px] sm:bottom-[81px] left-0 right-0 z-30 pointer-events-none">
            <div className="max-w-3xl md:max-w-4xl mx-auto px-2.5 sm:px-6 flex justify-start">
              <div className="pointer-events-auto w-full max-w-[320px] sm:max-w-[380px] bg-white/95 backdrop-blur-md border border-b-0 border-gray-200/90 rounded-t-xl shadow-[0_-4px_18px_rgba(0,0,0,0.08)] overflow-hidden text-left">
                <div className="max-h-24 sm:max-h-28 overflow-y-auto px-3 py-1.5 space-y-0.5">
                  {favorites.map((item, idx) => {
                    const parsed = parsePriceNumber(item.newPrice);
                    const priceLabel = !isNaN(parsed)
                      ? `${parsed.toFixed(2)} ₼`
                      : `${String(item.newPrice || '').replace(/₼/g, '').trim()} ₼`;
                    return (
                      <div
                        key={`fav-sum-${item.marketId}-${item.productName}-${idx}`}
                        className="flex items-baseline justify-start gap-1.5 text-[11px] sm:text-xs leading-snug text-gray-800 text-left"
                      >
                        <span className="truncate font-medium">{item.productName}</span>
                        <span className="shrink-0 font-bold text-emerald-700 tabular-nums">{priceLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200/90 bg-gray-50/95 px-3 py-1.5 flex items-center justify-start gap-1.5 text-xs sm:text-[13px] font-extrabold text-gray-900 text-left">
                  <span>Cəmi:</span>
                  <span className="text-emerald-700 tabular-nums">{favoritesTotalPrice.toFixed(2)} ₼</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sağ kənarda sürətli yuxarı çıxma düyməsi (aşağı sürüşdürdükdə görünür, yuxarıda gizlənir) */}
      {!isLoading && !viewProduct && opportunityModalIndex === null && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="Yuxarı qayıt"
          title="Yuxarı qayıt"
          className={`fixed right-3 sm:right-6 bottom-[82px] sm:bottom-[96px] z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 border border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-md flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
            showScrollToTop
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
          }`}
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Bottom Fixed Search & Filter Dock (Pinned at the very bottom of the screen) */}
      {!isLoading && (
        <BottomSearchDock 
          searchQuery={searchQuery}
          onSearchChange={handleSearchQueryChange}
          showFavorites={showFavorites}
          onShowFavoritesChange={(active) => {
             if (active) {
               captureHomeScrollBeforeLeave();
             }
             setShowFavorites(active);
             if (active) {
               setSearchReturnState(null);
               setActiveMarketId(null);
               setSearchQuery('');
               setDebouncedSearchQuery('');
               setIsSearching(false);
             }
          }}
          favoritesCount={favorites.length}
          openSearchTrigger={openSearchTrigger}
        />
      )}

        <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} selectedMarket={currentMarket?.name || ''} marketUrl={currentMarket?.url || ''} currentLogoUrl={currentMarket?.logoUrl} existingCatalogs={currentMarket?.catalogs} onStreamStart={handleStreamStart} onStreamUpdate={handleStreamUpdate} onStreamEnd={handleStreamEnd} onLogoUpdate={handleLogoUpdate} />
        <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={() => setIsAdmin(true)} />
        <AddMarketModal isOpen={isAddMarketModalOpen} onClose={() => setIsAddMarketModalOpen(false)} onAdd={handleAddMarket} />
        {marketToEdit && <EditMarketModal isOpen={!!marketToEdit} onClose={() => setMarketToEdit(null)} market={marketToEdit} onSave={handleUpdateMarket} onDelete={handleDeleteMarket} />}
        {productToEdit && activeMarketId && <EditProductModal isOpen={!!productToEdit} onClose={() => setProductToEdit(null)} product={productToEdit.product} onSave={handleUpdateProduct} />}
        <DatabaseModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} onSave={saveDatabaseConfig} currentConfig={supabaseConfig} />
        <BannerEditorModal
          isOpen={isFeaturedAdModalOpen}
          onClose={() => {
            setIsFeaturedAdModalOpen(false);
            setAdManagerEditId(null);
          }}
          featuredAds={featuredAds}
          swipeAds={swipeAds}
          upcomingCampaigns={upcomingCampaigns}
          markets={sortedMarkets}
          initialTab={adManagerInitialTab}
          initialEditAdId={adManagerEditId}
          onSaveAllAds={handleSaveAllAds}
        />
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
              catalogEndDate={viewProduct?.catalogEndDate} 
              currentIndex={viewProduct?.currentIndex}
              totalCount={viewProduct?.productList?.length}
              productList={viewProduct?.productList}
              onSelectIndex={handleSelectIndexInModal}
              onSelectMarketInModal={handleNavigateToMarketFromModal}
              swipeAds={swipeAds}
              swipeAdFirstOffset={getSwipeAdFirstOffset()}
              onSwipeProgress={handleSwipeProgress}
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
          swipeAds={swipeAds}
          swipeAdFirstOffset={getSwipeAdFirstOffset()}
          onSwipeProgress={handleSwipeProgress}
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
