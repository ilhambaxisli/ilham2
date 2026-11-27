
export type ProductCategory = 
  | 'Meyvə & Tərəvəz'
  | 'Ət & Toyuq'
  | 'Süd & Səhər Yeməyi'
  | 'Qida & Paxlalılar'
  | 'İçkilər'
  | 'Qəlyanaltı'
  | 'Təmizlik'
  | 'Şəxsi Baxım'
  | 'Ev & Həyat'
  | 'Uşaq'
  | 'Digər';

export interface DiscountProduct {
  productName: string;
  oldPrice: string;
  newPrice: string;
  discountPercentage: string;
  category: ProductCategory;
  imageUrl?: string;
  customImageUrl?: string;
  expiryDate?: string; // Product-specific expiration date
  bitis?: string; // Supabase product end date field
  endDate?: string;
  addedAt?: number;
  [key: string]: any;
}

export interface FavoriteItem extends DiscountProduct {
  marketId: string;
  addedAt: number;
}

export interface Catalog {
  id: string;
  name: string;
  products: DiscountProduct[];
  url?: string;
  lastUpdated: string;
  startDate?: string;
  endDate?: string;
}

export interface MarketData {
  id: string;
  name: string;
  lastUpdated: string;
  products: DiscountProduct[];
  catalogs?: Catalog[];
  url: string;
  themeColor: 
    | 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone'
    | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' 
    | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' 
    | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' 
    | 'pink' | 'rose';
  logoPlaceholder: string;
  logoUrl?: string;
  instagramPosts?: string[]; // New: List of Instagram/Social image URLs
}

export interface BannerData {
  id: string;
  imageUrl: string;
  htmlContent?: string;
  title: string;
  link: string;
  isVisible: boolean;
  fitMode?: 'contain' | 'cover';
}

export interface UpcomingCampaign {
  id: string;
  marketId: string;
  title: string;
  imageUrl: string;
  htmlContent?: string;
  isVisible: boolean;
  fitMode?: 'contain' | 'cover';
  activateAt: string; // YYYY-MM-DD local activation date
  endDate?: string;   // YYYY-MM-DD optional end date for promoted products
  products: DiscountProduct[];
  promotedAt?: string;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

// Added FirebaseConfig interface to fix compilation error in services/firebase.ts
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL?: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type StreamUpdateHandler = (products: DiscountProduct[]) => void;
