import { initializeApp, FirebaseApp } from "firebase/app";
import { getDatabase, ref, set, onValue, Database, update } from "firebase/database";
import { FirebaseConfig, MarketData, BannerData } from "../types";

let app: FirebaseApp | null = null;
let db: Database | null = null;

export const initializeFirebase = (config: FirebaseConfig) => {
  try {
    app = initializeApp(config);
    db = getDatabase(app);
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return false;
  }
};

export const isFirebaseInitialized = () => !!db;

// --- Markets & Products ---

export const subscribeToMarkets = (callback: (markets: MarketData[]) => void) => {
  if (!db) return () => {};
  const marketsRef = ref(db, 'markets');
  return onValue(marketsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Convert object back to array if needed, or just pass valid data
      // We assume data is stored as an object keyed by ID or an array
      const marketsList = Array.isArray(data) ? data : Object.values(data);
      callback(marketsList as MarketData[]);
    } else {
      callback([]);
    }
  });
};

export const saveMarkets = async (markets: MarketData[]) => {
  if (!db) return;
  // We save the whole array for simplicity in this demo. 
  // In a real huge app, we'd update specific paths.
  await set(ref(db, 'markets'), markets);
};

export const updateMarketProducts = async (marketId: string, products: any[]) => {
  if (!db) return;
  
  // We need to find the index or key of the market. 
  // For simplicity, we are storing markets as a list. 
  // This is a bit inefficient (fetch all to find index), so we'll just 
  // rely on the App component to pass the full updated state to `saveMarkets`
  // OR we assume the app logic handles the state merging and calls saveMarkets.
  
  // To strictly support "Clear and Update" from the App.tsx logic:
  // We will rely on `saveMarkets` being called with the new state from App.tsx
};

// --- Banners ---

export const subscribeToBanners = (callback: (b1: BannerData, b2: BannerData) => void) => {
  if (!db) return () => {};
  const bannersRef = ref(db, 'banners');
  return onValue(bannersRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data.banner1, data.banner2);
    }
  });
};

export const saveBanners = async (banner1: BannerData, banner2: BannerData) => {
  if (!db) return;
  await set(ref(db, 'banners'), { banner1, banner2 });
};
