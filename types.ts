
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
  customImageUrl?: string;
  expiryDate?: string; // Product-specific expiration date
  bitis?: string; // Supabase product end date field
  endDate?: string;
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
  title: string;
  link: string;
  isVisible: boolean;
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
