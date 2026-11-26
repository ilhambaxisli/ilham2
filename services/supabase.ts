import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, MarketData, BannerData, UpcomingCampaign } from '../types';
import { normalizeUpcomingCampaignList } from '../utils/upcomingCampaigns';

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
      if (!error && Array.isArray(data?.data)) {
        callback(data.data as MarketData[]);
      } else if (error) {
        console.error("Error fetching markets from Supabase:", error);
      }
    });

  // Realtime Subscription
  const channel = supabase
    .channel('public:app_settings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.markets' },
      (payload) => {
        const nextData = (payload.new as any)?.data;
        if (Array.isArray(nextData)) {
          callback(nextData as MarketData[]);
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};

export const saveMarkets = async (markets: MarketData[]): Promise<boolean> => {
  if (!supabase || !Array.isArray(markets)) return false;

  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'markets', data: markets }, { onConflict: 'id' });

  if (error) {
    console.error("Error saving markets:", error);
    return false;
  }
  return true;
};

// --- Banners & Ads ---

export interface StoredAdsPayload {
  banner1?: BannerData;
  banner2?: BannerData;
  featuredAds?: BannerData[];
  swipeAds?: BannerData[];
  upcomingCampaigns?: UpcomingCampaign[];
}

const normalizeBannerList = (raw: unknown): BannerData[] => {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  return raw
    .filter((item): item is BannerData => Boolean(item && typeof item === 'object'))
    .map((item, idx) => {
      const baseId = (item.id || `ad-${idx + 1}`).trim() || `ad-${idx + 1}`;
      let uniqueId = baseId;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${baseId}-${idx + 1}`;
        while (seenIds.has(uniqueId)) {
          uniqueId = `${uniqueId}-${Math.random().toString(36).slice(2, 5)}`;
        }
      }
      seenIds.add(uniqueId);
      return {
        id: uniqueId,
        imageUrl: (item.imageUrl || '').trim(),
        htmlContent: (item.htmlContent || '').trim(),
        title: (item.title || '').trim(),
        link: (item.link || '').trim(),
        isVisible: Boolean(item.isVisible),
        fitMode: item.fitMode === 'contain' ? 'contain' : 'cover',
      };
    });
};

const extractAdsFromPayload = (
  raw: StoredAdsPayload | null | undefined
): {
  featuredAds: BannerData[];
  swipeAds: BannerData[];
  upcomingCampaigns: UpcomingCampaign[];
  hasUpcomingField: boolean;
} => {
  if (!raw || typeof raw !== 'object') {
    return { featuredAds: [], swipeAds: [], upcomingCampaigns: [], hasUpcomingField: false };
  }

  let featuredAds = normalizeBannerList(raw.featuredAds);
  if (featuredAds.length === 0) {
    const legacy = [raw.banner1, raw.banner2].filter(
      (b): b is BannerData => Boolean(b && typeof b === 'object' && ((b.htmlContent || '').trim() || (b.imageUrl || '').trim() || (b.title || '').trim() || b.isVisible))
    );
    featuredAds = normalizeBannerList(legacy);
  }

  const swipeAds = normalizeBannerList(raw.swipeAds);
  const hasUpcomingField = Array.isArray(raw.upcomingCampaigns);
  const upcomingCampaigns = hasUpcomingField ? normalizeUpcomingCampaignList(raw.upcomingCampaigns) : [];
  return { featuredAds, swipeAds, upcomingCampaigns, hasUpcomingField };
};

export const subscribeToBanners = (
  callback: (
    b1: BannerData,
    b2: BannerData,
    featuredAds?: BannerData[],
    swipeAds?: BannerData[],
    upcomingCampaigns?: UpcomingCampaign[],
    hasUpcomingField?: boolean
  ) => void
) => {
  if (!supabase) return () => {};

  const emit = (payloadData: StoredAdsPayload | null | undefined) => {
    const { featuredAds, swipeAds, upcomingCampaigns, hasUpcomingField } = extractAdsFromPayload(payloadData);
    const empty: BannerData = { id: 'empty', imageUrl: '', htmlContent: '', title: '', link: '', isVisible: false, fitMode: 'cover' };
    callback(
      featuredAds[0] || payloadData?.banner1 || empty,
      featuredAds[1] || payloadData?.banner2 || empty,
      featuredAds,
      swipeAds,
      upcomingCampaigns,
      hasUpcomingField
    );
  };

  // Initial Fetch
  supabase
    .from('app_settings')
    .select('data')
    .eq('id', 'banners')
    .single()
    .then(({ data, error }) => {
      if (!error && data?.data) {
        emit(data.data as StoredAdsPayload);
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
          emit((payload.new as any).data as StoredAdsPayload);
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
    .upsert({ id: 'banners', data: { banner1, banner2 } }, { onConflict: 'id' });

  if (error) console.error("Error saving banners:", error);
};

export const saveAllAds = async (
  featuredAds: BannerData[],
  swipeAds: BannerData[],
  upcomingCampaigns?: UpcomingCampaign[]
): Promise<boolean> => {
  if (!supabase) return false;

  const payload: StoredAdsPayload = {
    featuredAds,
    swipeAds,
    ...(Array.isArray(upcomingCampaigns) ? { upcomingCampaigns } : {}),
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'banners', data: payload }, { onConflict: 'id' });

  if (error) {
    console.error("Error saving ads:", error);
    return false;
  }
  return true;
};