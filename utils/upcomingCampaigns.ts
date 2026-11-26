import { DiscountProduct, MarketData, UpcomingCampaign } from '../types';

export const UPCOMING_CAMPAIGNS_STORAGE_KEY = 'upcomingCampaigns_v1';
export const UPCOMING_CATEGORY_NAME = 'Sabahkı Endirimlər';

export const getLocalDateStr = (offsetDays = 0): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AZ_MONTHS_SHORT = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

export const formatUpcomingDateLabel = (dateStr?: string, todayStr = getLocalDateStr(0)): string => {
  const clean = (dateStr || '').trim();
  if (!clean) return 'Sabah';
  if (clean === todayStr) return 'Bu gün';
  if (clean === getLocalDateStr(1)) return 'Sabah';

  const parts = clean.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (!isNaN(day) && monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${AZ_MONTHS_SHORT[monthIdx]}`;
    }
  }
  return clean;
};

export const getShortMarketLabel = (marketName?: string): string => {
  const trimmed = (marketName || '').trim();
  if (!trimmed) return 'Market';
  if (/^al(\s+market)?$/i.test(trimmed)) return 'Al Market';
  return trimmed.replace(/\s+Market$/i, '').trim() || trimmed;
};

export const resolveMarketForCampaign = (
  marketIdOrName: string,
  markets: MarketData[]
): MarketData | null => {
  if (!Array.isArray(markets) || markets.length === 0) return null;
  const raw = (marketIdOrName || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const exact = markets.find((m) => m.id === raw);
  if (exact) return exact;

  const ciId = markets.find((m) => (m.id || '').trim().toLowerCase() === lower);
  if (ciId) return ciId;

  const normToken = (s: string) =>
    s
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+market$/i, '')
      .trim();
  const targetNorm = normToken(raw);

  return (
    markets.find((m) => {
      const mFullName = (m.name || '').trim().toLowerCase();
      const mNameNorm = normToken(m.name || '');
      const mIdNorm = (m.id || '').trim().toLowerCase();
      return (
        mFullName === lower ||
        (targetNorm.length > 0 && mNameNorm === targetNorm) ||
        getShortMarketLabel(m.name).toLowerCase() === lower ||
        mIdNorm.startsWith(`${lower}-`)
      );
    }) || null
  );
};

export const normalizeUpcomingProducts = (rawProducts: unknown): DiscountProduct[] => {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .filter((item): item is DiscountProduct => Boolean(item && typeof item === 'object'))
    .map((p) => {
      const cleanImg = (typeof p.imageUrl === 'string' ? p.imageUrl : typeof p.customImageUrl === 'string' ? p.customImageUrl : '').trim();
      const exp = (p.expiryDate || (p as any).bitis || (p as any).endDate || '').toString().trim();
      return {
        ...p,
        productName: String(p.productName || '').trim(),
        oldPrice: p.oldPrice !== undefined && p.oldPrice !== null ? String(p.oldPrice).trim() : '',
        newPrice: p.newPrice !== undefined && p.newPrice !== null ? String(p.newPrice).trim() : '',
        discountPercentage: p.discountPercentage !== undefined && p.discountPercentage !== null ? String(p.discountPercentage).trim() : '',
        category: (p.category || 'Digər') as DiscountProduct['category'],
        imageUrl: cleanImg || undefined,
        customImageUrl: cleanImg || undefined,
        expiryDate: exp || undefined,
        bitis: exp || undefined,
      };
    })
    .filter((p) => Boolean(p.productName && p.newPrice));
};

export const normalizeUpcomingCampaignList = (raw: unknown): UpcomingCampaign[] => {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  return raw
    .filter(
      (item): item is UpcomingCampaign =>
        Boolean(
          item &&
            typeof item === 'object' &&
            item.id !== 'test-upcoming-oba-demo' &&
            !item.isTestSeed
        )
    )
    .map((item, idx) => {
      const baseId = (item.id || `upcoming-${idx + 1}`).trim() || `upcoming-${idx + 1}`;
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
        marketId: String(item.marketId || 'oba').trim() || 'oba',
        title: String(item.title || '').trim(),
        imageUrl: String(item.imageUrl || '').trim(),
        htmlContent: String(item.htmlContent || '').trim(),
        isVisible: Boolean(item.isVisible),
        fitMode: item.fitMode === 'contain' ? 'contain' : 'cover',
        activateAt: String(item.activateAt || getLocalDateStr(1)).trim(),
        endDate: item.endDate ? String(item.endDate).trim() : undefined,
        products: normalizeUpcomingProducts(item.products),
        promotedAt: item.promotedAt ? String(item.promotedAt).trim() : undefined,
      };
    });
};

export const isUpcomingCampaignBannerActive = (
  campaign: UpcomingCampaign,
  todayStr = getLocalDateStr(0)
): boolean => {
  if (!campaign.isVisible || campaign.promotedAt) return false;
  if (campaign.activateAt && todayStr >= campaign.activateAt) return false;
  return Boolean(
    (campaign.htmlContent || '').trim() ||
      (campaign.imageUrl || '').trim() ||
      (campaign.title || '').trim() ||
      (campaign.products && campaign.products.length > 0)
  );
};

export const shouldAutoPromoteCampaign = (
  campaign: UpcomingCampaign,
  todayStr = getLocalDateStr(0)
): boolean => {
  if (campaign.promotedAt) return false;
  if (!campaign.activateAt || todayStr < campaign.activateAt) return false;
  return Boolean(campaign.products && campaign.products.length > 0);
};
