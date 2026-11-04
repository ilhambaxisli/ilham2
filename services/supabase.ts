import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, MarketData, BannerData } from '../types';

let supabase: SupabaseClient | null = null;

export const initializeSupabase = (config: SupabaseConfig) => {
  try {
    if (!config.supabaseUrl || !config.supabaseKey) return false;
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
    return true;
  } catch (error) {
    console.error("Supabase initialization error:", error);
    return false;
  }
};

export const isSupabaseInitialized = () => !!supabase;

// --- Markets ---

export const subscribeToMarkets = (callback: (markets: MarketData[]) => void) => {
  if (!supabase) return () => {};

  // Initial Fetch
  supabase
    .from('app_settings')
    .select('data')
    .eq('id', 'markets')
    .single()
    .then(({ data, error }) => {
      if (!error && data?.data) {
        callback(data.data as MarketData[]);
      } else {
        // If not found, callback empty to init
        // callback([]); 
      }
    });

  // Realtime Subscription
  const channel = supabase
    .channel('public:app_settings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.markets' },
      (payload) => {
        if (payload.new && (payload.new as any).data) {
          callback((payload.new as any).data as MarketData[]);
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};

export const saveMarkets = async (markets: MarketData[]) => {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'markets', data: markets });

  if (error) console.error("Error saving markets:", error);
};

// --- Banners ---

export const subscribeToBanners = (callback: (b1: BannerData, b2: BannerData) => void) => {
  if (!supabase) return () => {};

  // Initial Fetch
  supabase
    .from('app_settings')
    .select('data')
    .eq('id', 'banners')
    .single()
    .then(({ data, error }) => {
      if (!error && data?.data) {
        const banners = data.data as { banner1: BannerData, banner2: BannerData };
        callback(banners.banner1, banners.banner2);
      }
    });

  // Realtime Subscription
  const channel = supabase
    .channel('public:app_settings_banners')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.banners' },
      (payload) => {
        if (payload.new && (payload.new as any).data) {
          const banners = (payload.new as any).data as { banner1: BannerData, banner2: BannerData };
          callback(banners.banner1, banners.banner2);
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};

export const saveBanners = async (banner1: BannerData, banner2: BannerData) => {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'banners', data: { banner1, banner2 } });

  if (error) console.error("Error saving banners:", error);
};