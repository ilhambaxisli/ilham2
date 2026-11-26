import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  Plus,
  Edit3,
  ArrowLeft,
  Layers,
  Eye,
  EyeOff,
  Code2,
  Sparkles,
  Calendar,
  Clock,
  ShoppingBag,
  Check,
} from 'lucide-react';
import { BannerData, DiscountProduct, MarketData, ProductCategory, UpcomingCampaign } from '../types';
import {
  formatUpcomingDateLabel,
  getLocalDateStr,
  getShortMarketLabel,
  resolveMarketForCampaign,
} from '../utils/upcomingCampaigns';
import HtmlAdFrame from './HtmlAdFrame';

export type AdManagerTab = 'featured' | 'swipe' | 'upcoming';

interface BannerEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  featuredAds: BannerData[];
  swipeAds: BannerData[];
  upcomingCampaigns?: UpcomingCampaign[];
  markets?: MarketData[];
  initialTab?: AdManagerTab;
  initialEditAdId?: string | null;
  onSaveAllAds: (
    featuredAds: BannerData[],
    swipeAds: BannerData[],
    upcomingCampaigns: UpcomingCampaign[]
  ) => void;
}

export const normalizeAdLinkUrl = (raw?: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
};

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Meyvə & Tərəvəz',
  'Ət & Toyuq',
  'Süd & Səhər Yeməyi',
  'Qida & Paxlalılar',
  'İçkilər',
  'Qəlyanaltı',
  'Təmizlik',
  'Şəxsi Baxım',
  'Ev & Həyat',
  'Uşaq',
  'Digər',
];

const createEmptyAd = (prefix: string): BannerData => ({
  id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: '',
  imageUrl: '',
  htmlContent: '',
  link: '',
  isVisible: true,
  fitMode: 'cover',
});

const createEmptyUpcomingCampaign = (defaultMarketId = 'oba'): UpcomingCampaign => ({
  id: `upcoming-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  marketId: defaultMarketId,
  title: '',
  imageUrl: '',
  htmlContent: '',
  isVisible: true,
  fitMode: 'cover',
  activateAt: getLocalDateStr(1),
  endDate: '',
  products: [],
});

const createEmptyUpcomingProduct = (): DiscountProduct => ({
  productName: '',
  oldPrice: '',
  newPrice: '',
  discountPercentage: '',
  category: 'Qida & Paxlalılar',
  imageUrl: '',
  customImageUrl: '',
  expiryDate: '',
});

const SAMPLE_ANIMATED_HTML_AD = `<style>
  .ad-wrap {
    width: 100%; height: 100%;
    background: linear-gradient(125deg, #f59e0b, #ef4444, #f97316, #f59e0b);
    background-size: 300% 300%;
    animation: gradMove 6s ease infinite;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    font-family: system-ui, -apple-system, sans-serif; color: #fff; padding: 8px 12px;
    position: relative; overflow: hidden;
  }
  @keyframes gradMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes pulseScale { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
  .badge { background: rgba(255,255,255,.22); border: 1px solid rgba(255,255,255,.45); padding: 4px 10px; border-radius: 999px; font-weight: 900; font-size: 13px; animation: pulseScale 1.8s ease-in-out infinite; white-space: nowrap; }
  .txt { font-weight: 800; font-size: 14px; line-height: 1.2; text-shadow: 0 1px 4px rgba(0,0,0,.2); }
</style>
<div class="ad-wrap">
  <span class="badge">% ENDİRİM</span>
  <span class="txt">Xüsusi Kampaniya Başladı!</span>
</div>`;

const SAMPLE_UPCOMING_HTML_AD = `<style>
  .up-ad {
    width: 100%; height: 100%;
    background: linear-gradient(125deg, #065f46, #059669, #10b981);
    background-size: 200% 200%;
    animation: upMove 6s ease infinite;
    display: flex; flex-direction: column; justify-content: center;
    padding: 10px 14px; color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    position: relative; overflow: hidden;
  }
  @keyframes upMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  .up-k { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #a7f3d0; }
  .up-t { font-size: 14px; font-weight: 900; line-height: 1.2; margin-top: 2px; }
  .up-b { margin-top: 6px; display: inline-block; width: fit-content; background: #ecfdf5; color: #064e3b; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
</style>
<div class="up-ad">
  <div class="up-k">SABAH BAŞLAYIR</div>
  <div class="up-t">Yeni Endirim Kampaniyası</div>
  <div class="up-b">Məhsullara bax →</div>
</div>`;

const BannerEditorModal: React.FC<BannerEditorModalProps> = ({
  isOpen,
  onClose,
  featuredAds,
  swipeAds,
  upcomingCampaigns = [],
  markets = [],
  initialTab = 'featured',
  initialEditAdId = null,
  onSaveAllAds,
}) => {
  const [activeTab, setActiveTab] = useState<AdManagerTab>(initialTab);
  const [localFeatured, setLocalFeatured] = useState<BannerData[]>(featuredAds);
  const [localSwipe, setLocalSwipe] = useState<BannerData[]>(swipeAds);
  const [localUpcoming, setLocalUpcoming] = useState<UpcomingCampaign[]>(upcomingCampaigns);

  const [editingAd, setEditingAd] = useState<BannerData | null>(null);
  const [editingUpcoming, setEditingUpcoming] = useState<UpcomingCampaign | null>(null);
  const [adContentMode, setAdContentMode] = useState<'image' | 'html'>('image');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Upcoming sub-product editor state
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState<DiscountProduct>(createEmptyUpcomingProduct);
  const [productFormError, setProductFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setLocalFeatured(featuredAds);
    setLocalSwipe(swipeAds);
    setLocalUpcoming(upcomingCampaigns);
    setPreviewError(false);
    setIsProductFormOpen(false);
    setEditingProductIndex(null);
    setProductFormError('');

    if (initialEditAdId) {
      if (initialTab === 'upcoming') {
        const foundUpcoming = upcomingCampaigns.find((c) => c.id === initialEditAdId);
        if (foundUpcoming) {
          const hasHtml = Boolean((foundUpcoming.htmlContent || '').trim());
          const resolvedMkt = resolveMarketForCampaign(foundUpcoming.marketId, markets);
          setAdContentMode(hasHtml ? 'html' : 'image');
          setEditingAd(null);
          setEditingUpcoming({
            ...foundUpcoming,
            marketId: resolvedMkt?.id || foundUpcoming.marketId,
            htmlContent: foundUpcoming.htmlContent || '',
            fitMode: foundUpcoming.fitMode === 'contain' ? 'contain' : 'cover',
            products: [...(foundUpcoming.products || [])],
          });
          setIsCreatingNew(false);
          return;
        }
      } else {
        const targetList = initialTab === 'swipe' ? swipeAds : featuredAds;
        const found = targetList.find((a) => a.id === initialEditAdId);
        if (found) {
          const hasHtml = Boolean((found.htmlContent || '').trim());
          setAdContentMode(hasHtml ? 'html' : 'image');
          setEditingUpcoming(null);
          setEditingAd({
            ...found,
            htmlContent: found.htmlContent || '',
            fitMode: found.fitMode === 'contain' ? 'contain' : 'cover',
          });
          setIsCreatingNew(false);
          return;
        }
      }
    }

    setEditingAd(null);
    setEditingUpcoming(null);
    setAdContentMode('image');
    setIsCreatingNew(false);
  }, [isOpen, initialTab, initialEditAdId, featuredAds, swipeAds, upcomingCampaigns]);

  if (!isOpen) return null;

  const currentList = activeTab === 'featured' ? localFeatured : localSwipe;
  const todayStr = getLocalDateStr(0);

  const commitLists = (
    nextFeatured: BannerData[],
    nextSwipe: BannerData[],
    nextUpcoming: UpcomingCampaign[]
  ) => {
    setLocalFeatured(nextFeatured);
    setLocalSwipe(nextSwipe);
    setLocalUpcoming(nextUpcoming);
    onSaveAllAds(nextFeatured, nextSwipe, nextUpcoming);
  };

  const handleStartAdd = () => {
    setPreviewError(false);
    setIsCreatingNew(true);
    setIsProductFormOpen(false);
    setEditingProductIndex(null);
    setProductFormError('');

    if (activeTab === 'upcoming') {
      setAdContentMode('image');
      setEditingAd(null);
      setEditingUpcoming(createEmptyUpcomingCampaign(markets[0]?.id || 'oba'));
    } else {
      setAdContentMode('image');
      setEditingUpcoming(null);
      setEditingAd(createEmptyAd(activeTab === 'featured' ? 'featured-ad' : 'swipe-ad'));
    }
  };

  const handleStartEdit = (ad: BannerData) => {
    setPreviewError(false);
    setIsCreatingNew(false);
    const hasHtml = Boolean((ad.htmlContent || '').trim());
    setAdContentMode(hasHtml ? 'html' : 'image');
    setEditingUpcoming(null);
    setEditingAd({
      ...ad,
      htmlContent: ad.htmlContent || '',
      fitMode: ad.fitMode === 'contain' ? 'contain' : 'cover',
    });
  };

  const handleStartEditUpcoming = (campaign: UpcomingCampaign) => {
    setPreviewError(false);
    setIsCreatingNew(false);
    setIsProductFormOpen(false);
    setEditingProductIndex(null);
    setProductFormError('');
    const hasHtml = Boolean((campaign.htmlContent || '').trim());
    const resolvedMkt = resolveMarketForCampaign(campaign.marketId, markets);
    setAdContentMode(hasHtml ? 'html' : 'image');
    setEditingAd(null);
    setEditingUpcoming({
      ...campaign,
      marketId: resolvedMkt?.id || campaign.marketId,
      htmlContent: campaign.htmlContent || '',
      fitMode: campaign.fitMode === 'contain' ? 'contain' : 'cover',
      products: [...(campaign.products || [])],
    });
  };

  const handleDeleteAd = (adId: string) => {
    if (activeTab === 'featured') {
      const next = localFeatured.filter((a) => a.id !== adId);
      commitLists(next, localSwipe, localUpcoming);
    } else {
      const next = localSwipe.filter((a) => a.id !== adId);
      commitLists(localFeatured, next, localUpcoming);
    }
  };

  const handleDeleteUpcoming = (campaignId: string) => {
    const next = localUpcoming.filter((c) => c.id !== campaignId);
    commitLists(localFeatured, localSwipe, next);
  };

  const handleToggleVisible = (adId: string) => {
    if (activeTab === 'featured') {
      const next = localFeatured.map((a) => (a.id === adId ? { ...a, isVisible: !a.isVisible } : a));
      commitLists(next, localSwipe, localUpcoming);
    } else {
      const next = localSwipe.map((a) => (a.id === adId ? { ...a, isVisible: !a.isVisible } : a));
      commitLists(localFeatured, next, localUpcoming);
    }
  };

  const handleToggleUpcomingVisible = (campaignId: string) => {
    const next = localUpcoming.map((c) =>
      c.id === campaignId ? { ...c, isVisible: !c.isVisible } : c
    );
    commitLists(localFeatured, localSwipe, next);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    const trimmedImage = adContentMode === 'image' ? (editingAd.imageUrl || '').trim() : '';
    const trimmedHtml = adContentMode === 'html' ? (editingAd.htmlContent || '').trim() : '';
    const trimmedTitle = (editingAd.title || '').trim();
    const normalizedLink = normalizeAdLinkUrl(editingAd.link);
    const hasContent = Boolean(trimmedHtml || trimmedImage || trimmedTitle);

    const savedItem: BannerData = {
      id: editingAd.id || `${activeTab}-ad-${Date.now()}`,
      title: trimmedTitle,
      imageUrl: trimmedImage,
      htmlContent: trimmedHtml,
      link: normalizedLink,
      isVisible: hasContent ? editingAd.isVisible : false,
      fitMode: editingAd.fitMode === 'contain' ? 'contain' : 'cover',
    };

    const updateTarget = (list: BannerData[]) => {
      if (!hasContent) {
        return list.filter((a) => a.id !== savedItem.id);
      }
      const idx = list.findIndex((a) => a.id === savedItem.id);
      if (idx >= 0) {
        return list.map((a, i) => (i === idx ? savedItem : a));
      }
      return [...list, savedItem];
    };

    if (activeTab === 'featured') {
      commitLists(updateTarget(localFeatured), localSwipe, localUpcoming);
    } else {
      commitLists(localFeatured, updateTarget(localSwipe), localUpcoming);
    }

    setEditingAd(null);
    setIsCreatingNew(false);
  };

  const handleSaveUpcomingProductDraft = () => {
    if (!editingUpcoming) return;
    const name = String(productDraft.productName || '').trim();
    const newP = String(productDraft.newPrice || '').trim();
    if (!name || !newP) {
      setProductFormError('Məhsul adı və yeni qiymət mütləqdir.');
      return;
    }

    const oldP = String(productDraft.oldPrice || '').trim();
    let pct = String(productDraft.discountPercentage || '').trim();
    if (!pct && oldP) {
      const o = parseFloat(oldP.replace(',', '.').replace(/[^0-9.]/g, ''));
      const n = parseFloat(newP.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (!isNaN(o) && !isNaN(n) && o > n && o > 0) {
        pct = `-${Math.round(((o - n) / o) * 100)}%`;
      }
    }

    const cleanImg = String(productDraft.imageUrl || productDraft.customImageUrl || '').trim();
    const cleanExp = String(productDraft.expiryDate || '').trim();
    const normalizedProd: DiscountProduct = {
      productName: name,
      oldPrice: oldP,
      newPrice: newP,
      discountPercentage: pct,
      category: (productDraft.category || 'Digər') as ProductCategory,
      imageUrl: cleanImg || undefined,
      customImageUrl: cleanImg || undefined,
      expiryDate: cleanExp || undefined,
      bitis: cleanExp || undefined,
    };

    setEditingUpcoming((prev) => {
      if (!prev) return prev;
      const list = [...(prev.products || [])];
      if (editingProductIndex !== null && list[editingProductIndex]) {
        list[editingProductIndex] = normalizedProd;
      } else {
        list.push(normalizedProd);
      }
      return { ...prev, products: list };
    });

    setProductFormError('');
    setEditingProductIndex(null);
    setProductDraft(createEmptyUpcomingProduct());
    setIsProductFormOpen(false);
  };

  const handleSaveUpcomingForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUpcoming) return;

    const trimmedImage = adContentMode === 'image' ? (editingUpcoming.imageUrl || '').trim() : '';
    const trimmedHtml = adContentMode === 'html' ? (editingUpcoming.htmlContent || '').trim() : '';
    const trimmedTitle = (editingUpcoming.title || '').trim();
    const cleanProducts = (editingUpcoming.products || []).filter(
      (p) => Boolean((p.productName || '').trim() && (p.newPrice || '').trim())
    );
    const hasContent = Boolean(trimmedHtml || trimmedImage || trimmedTitle || cleanProducts.length > 0);
    const cleanActivateAt = (editingUpcoming.activateAt || getLocalDateStr(1)).trim();
    const isRescheduledFuture = cleanActivateAt > todayStr;

    const savedCampaign: UpcomingCampaign = {
      id: editingUpcoming.id || `upcoming-${Date.now()}`,
      marketId: (editingUpcoming.marketId || markets[0]?.id || 'oba').trim(),
      title: trimmedTitle,
      imageUrl: trimmedImage,
      htmlContent: trimmedHtml,
      isVisible: hasContent ? editingUpcoming.isVisible : false,
      fitMode: editingUpcoming.fitMode === 'contain' ? 'contain' : 'cover',
      activateAt: cleanActivateAt,
      endDate: (editingUpcoming.endDate || '').trim() || undefined,
      products: cleanProducts,
      promotedAt: isRescheduledFuture ? undefined : editingUpcoming.promotedAt,
    };

    const nextUpcoming = !hasContent
      ? localUpcoming.filter((c) => c.id !== savedCampaign.id)
      : localUpcoming.some((c) => c.id === savedCampaign.id)
        ? localUpcoming.map((c) => (c.id === savedCampaign.id ? savedCampaign : c))
        : [...localUpcoming, savedCampaign];

    commitLists(localFeatured, localSwipe, nextUpcoming);
    setEditingUpcoming(null);
    setIsCreatingNew(false);
  };

  const getRowPositionLabel = (list: BannerData[], index: number) => {
    const visibleBefore = list
      .slice(0, index + 1)
      .filter((a) => a.isVisible && ((a.htmlContent || '').trim() || (a.imageUrl || '').trim() || (a.title || '').trim()));
    const ad = list[index];
    const isActive = Boolean(ad.isVisible && ((ad.htmlContent || '').trim() || (ad.imageUrl || '').trim() || (ad.title || '').trim()));
    if (!isActive) return 'Gizli (Yayımda deyil)';
    const activePos = visibleBefore.length - 1;
    return activePos % 2 === 0 ? `${activePos + 1}-ci · Üst sıra` : `${activePos + 1}-ci · Alt sıra`;
  };

  const renderFormView = () => {
    if (!editingAd) return null;
    const trimmedHtml = adContentMode === 'html' ? (editingAd.htmlContent || '').trim() : '';
    const trimmedImage = adContentMode === 'image' ? (editingAd.imageUrl || '').trim() : '';
    const trimmedTitle = (editingAd.title || '').trim();
    const normalizedLink = normalizeAdLinkUrl(editingAd.link);
    const fitMode = editingAd.fitMode === 'contain' ? 'contain' : 'cover';

    return (
      <form onSubmit={handleSaveForm} className="space-y-3.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => {
              setEditingAd(null);
              setIsCreatingNew(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Siyahıya qayıt
          </button>
          <span className="text-xs font-extrabold text-amber-700">
            {isCreatingNew
              ? activeTab === 'featured'
                ? 'Yeni Örnək Reklamı'
                : 'Yeni Kaydırma Reklamı'
              : 'Reklamı Düzəlt'}
          </span>
        </div>

        {/* Live Preview */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Canlı Önizləmə
            </span>
            {normalizedLink && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-blue-600 truncate max-w-[230px]">
                <ExternalLink className="w-3 h-3 shrink-0" />
                {normalizedLink}
              </span>
            )}
          </div>

          {activeTab === 'featured' ? (
            <div className="mx-auto w-[210px] sm:w-[240px] h-[96px] sm:h-[108px] relative flex flex-col pt-3.5 sm:pt-4">
              <div
                className="absolute top-0 left-0 z-0 bg-amber-500 text-white px-2 pt-[3px] rounded-t-lg flex items-start justify-center shadow-xs"
                style={{ height: '34px', backgroundColor: '#f59e0b' }}
              >
                <span className="text-[10px] font-black tracking-tight leading-none">Reklam</span>
              </div>
              <div
                className={`bg-white rounded-xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full relative z-10 shadow-xs border border-amber-200/90 ${
                  editingAd.isVisible && (trimmedHtml || (trimmedImage && !previewError)) ? 'p-0' : 'p-1.5'
                }`}
              >
                {editingAd.isVisible && trimmedHtml ? (
                  <HtmlAdFrame html={trimmedHtml} title={trimmedTitle || 'HTML Reklam'} interactive={false} />
                ) : editingAd.isVisible && trimmedImage && !previewError ? (
                  fitMode === 'cover' ? (
                    <img
                      src={trimmedImage}
                      alt={trimmedTitle || 'Reklam önizləmə'}
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewError(true)}
                      className="w-full h-full object-cover object-center scale-[1.02]"
                    />
                  ) : (
                    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gray-100">
                      <img
                        src={trimmedImage}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-45"
                      />
                      <img
                        src={trimmedImage}
                        alt={trimmedTitle || 'Reklam önizləmə'}
                        referrerPolicy="no-referrer"
                        onError={() => setPreviewError(true)}
                        className="relative z-10 w-full h-full object-contain"
                      />
                    </div>
                  )
                ) : editingAd.isVisible && trimmedTitle ? (
                  <div className="w-full h-full rounded-[8px] border border-dashed border-amber-300/90 bg-amber-50/40 flex items-center justify-center px-2 text-center">
                    <p className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">
                      {trimmedTitle}
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-[8px] border border-dashed border-amber-300/90 bg-white flex items-center justify-center px-2 text-center">
                    <p className="text-[11px] font-bold text-gray-500 leading-snug">
                      Burda sizin reklamınız ola bilər
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-[170px] h-[220px] rounded-xl overflow-hidden bg-white border border-amber-200 shadow-sm flex flex-col">
              <div className="relative flex-1 min-h-0 bg-gray-100 overflow-hidden flex items-center justify-center">
                <span className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black">
                  REKLAM
                </span>
                {trimmedHtml ? (
                  <HtmlAdFrame html={trimmedHtml} title={trimmedTitle || 'HTML Kaydırma Reklamı'} interactive={false} />
                ) : trimmedImage && !previewError ? (
                  fitMode === 'cover' ? (
                    <img
                      src={trimmedImage}
                      alt={trimmedTitle || 'Kaydırma reklamı'}
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewError(true)}
                      className="w-full h-full object-cover object-center scale-[1.02]"
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
                      <img
                        src={trimmedImage}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-45"
                      />
                      <img
                        src={trimmedImage}
                        alt={trimmedTitle || 'Kaydırma reklamı'}
                        referrerPolicy="no-referrer"
                        onError={() => setPreviewError(true)}
                        className="relative z-10 w-full h-full object-contain"
                      />
                    </div>
                  )
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 px-3 text-center">
                    {trimmedTitle || 'Kaydırma reklamı önizləməsi'}
                  </span>
                )}
              </div>
              {(trimmedTitle || normalizedLink) && (
                <div className="px-2 py-1.5 bg-white border-t border-gray-100 flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-gray-800 truncate">
                    {trimmedTitle || normalizedLink.replace(/^https?:\/\//i, '')}
                  </span>
                  {normalizedLink && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black shrink-0">
                      Keçid
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ad Content Mode Toggle: Image URL vs Animated HTML */}
        <div>
          <span className="block text-xs font-bold text-gray-700 mb-1.5">Reklam Məzmunu Növü</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdContentMode('image')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                adContentMode === 'image'
                  ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Görsəl Linki (URL)
            </button>
            <button
              type="button"
              onClick={() => setAdContentMode('html')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                adContentMode === 'html'
                  ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              HTML (Hərəkətli)
            </button>
          </div>
        </div>

        {adContentMode === 'image' ? (
          <>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                Görsəl Linki (URL)
              </label>
              <input
                type="text"
                value={editingAd.imageUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setPreviewError(false);
                  setEditingAd((prev) =>
                    prev
                      ? {
                          ...prev,
                          imageUrl: val,
                          isVisible: val.trim().length > 0 ? true : prev.isVisible,
                        }
                      : prev
                  );
                }}
                className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-amber-500 focus:border-amber-500 text-sm"
                placeholder="https://..."
              />
              {previewError && trimmedImage && (
                <p className="text-[11px] font-semibold text-red-600 mt-1">
                  Görsəl yüklənə bilmədi. Linkin birbaşa şəkil linki olduğunu yoxlayın.
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-bold text-gray-700 mb-1.5">Görünüş Rejimi</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAd((prev) => (prev ? { ...prev, fitMode: 'cover' } : prev))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    fitMode === 'cover'
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Kartı tam doldur
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAd((prev) => (prev ? { ...prev, fitMode: 'contain' } : prev))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    fitMode === 'contain'
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Kəsmədən sığdır
                </button>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <Code2 className="w-3.5 h-3.5 text-amber-500" />
                HTML / CSS / Animasiya Kodu
              </label>
              <button
                type="button"
                onClick={() => {
                  setEditingAd((prev) =>
                    prev
                      ? {
                          ...prev,
                          htmlContent: SAMPLE_ANIMATED_HTML_AD,
                          isVisible: true,
                        }
                      : prev
                  );
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Nümunə əlavə et
              </button>
            </div>
            <textarea
              rows={6}
              value={editingAd.htmlContent || ''}
              onChange={(e) => {
                const val = e.target.value;
                setEditingAd((prev) =>
                  prev
                    ? {
                        ...prev,
                        htmlContent: val,
                        isVisible: val.trim().length > 0 ? true : prev.isVisible,
                      }
                    : prev
                );
              }}
              className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-amber-500 focus:border-amber-500 text-xs font-mono leading-relaxed"
              placeholder="<style>...</style><div>Hərəkətli HTML reklam kodunu bura yapışdırın...</div>"
            />
            <p className="text-[10.5px] text-gray-500 mt-1">
              CSS animasiya, SVG və ya tam HTML banner kodu daxil edə bilərsiniz. Kart ölçüsünə avtomatik uyğunlaşır.
            </p>
          </div>
        )}

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            Tıklandıqda Yönləndiriləcək Link
          </label>
          <input
            type="text"
            value={editingAd.link}
            onChange={(e) => setEditingAd((prev) => (prev ? { ...prev, link: e.target.value } : prev))}
            className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Məs: oba.az və ya https://oba.az"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Başlıq / Alternativ Mətn (İstəyə bağlı)
          </label>
          <input
            type="text"
            value={editingAd.title}
            onChange={(e) => {
              const val = e.target.value;
              setEditingAd((prev) =>
                prev
                  ? {
                      ...prev,
                      title: val,
                      isVisible: val.trim().length > 0 ? true : prev.isVisible,
                    }
                  : prev
              );
            }}
            className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Məs: OBA Market Endirimləri"
          />
        </div>

        <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={editingAd.isVisible}
            onChange={(e) => setEditingAd((prev) => (prev ? { ...prev, isVisible: e.target.checked } : prev))}
            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
          />
          <span className="text-xs sm:text-sm font-semibold text-gray-800">
            Yayımda (Aktiv deyilsə saytda göstərilmir)
          </span>
        </label>

        <div className="flex gap-2.5 pt-3 border-t border-gray-100">
          {!isCreatingNew && (
            <button
              type="button"
              onClick={() => {
                handleDeleteAd(editingAd.id);
                setEditingAd(null);
              }}
              className="inline-flex justify-center items-center px-3 py-2.5 border border-red-200 text-xs sm:text-sm font-bold rounded-xl text-red-600 bg-red-50/70 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Sil
            </button>
          )}
          <button
            type="submit"
            className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border border-transparent text-xs sm:text-sm font-bold rounded-xl text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Yadda saxla
          </button>
        </div>
      </form>
    );
  };

  const renderUpcomingFormView = () => {
    if (!editingUpcoming) return null;
    const trimmedHtml = adContentMode === 'html' ? (editingUpcoming.htmlContent || '').trim() : '';
    const trimmedImage = adContentMode === 'image' ? (editingUpcoming.imageUrl || '').trim() : '';
    const trimmedTitle = (editingUpcoming.title || '').trim();
    const fitMode = editingUpcoming.fitMode === 'contain' ? 'contain' : 'cover';
    const targetMarket = markets.find((m) => m.id === editingUpcoming.marketId);
    const shortLabel = getShortMarketLabel(targetMarket?.name || editingUpcoming.marketId);
    const activateDateLabel = formatUpcomingDateLabel(editingUpcoming.activateAt);

    return (
      <form onSubmit={handleSaveUpcomingForm} className="space-y-3.5 max-h-[72vh] overflow-y-auto pr-0.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 sticky top-0 bg-white z-20">
          <button
            type="button"
            onClick={() => {
              setEditingUpcoming(null);
              setIsCreatingNew(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Siyahıya qayıt
          </button>
          <span className="text-xs font-extrabold text-emerald-700">
            {isCreatingNew ? 'Yeni Sabahkı Endirim Kampaniyası' : 'Sabahkı Endirimi Düzəlt'}
          </span>
        </div>

        {/* Live Banner Preview */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Canlı Önizləmə
            </span>
            <span className="text-[10.5px] font-bold text-emerald-700 tabular-nums">
              {activateDateLabel} · {(editingUpcoming.products || []).length} məhsul
            </span>
          </div>

          <div className="mx-auto w-[225px] sm:w-[250px] h-[98px] sm:h-[110px] relative flex flex-col pt-3.5 sm:pt-4">
            <div
              className="absolute top-0 left-0 z-0 bg-emerald-600 text-white px-2 pt-[3px] rounded-t-lg flex items-start justify-center shadow-xs"
              style={{ height: '34px' }}
            >
              <span className="text-[10px] font-black tracking-tight leading-none whitespace-nowrap">
                {shortLabel} · {activateDateLabel}
              </span>
            </div>
            <div
              className={`bg-white rounded-xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full relative z-10 shadow-xs border border-emerald-200/90 ${
                trimmedHtml || (trimmedImage && !previewError) ? 'p-0' : 'p-2'
              }`}
            >
              {trimmedHtml ? (
                <HtmlAdFrame html={trimmedHtml} title={trimmedTitle || 'Sabahkı Endirimlər'} interactive={false} />
              ) : trimmedImage && !previewError ? (
                fitMode === 'cover' ? (
                  <img
                    src={trimmedImage}
                    alt={trimmedTitle || 'Sabahkı Endirim'}
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewError(true)}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gray-100">
                    <img
                      src={trimmedImage}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-45"
                    />
                    <img
                      src={trimmedImage}
                      alt={trimmedTitle || 'Sabahkı Endirim'}
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewError(true)}
                      className="relative z-10 w-full h-full object-contain"
                    />
                  </div>
                )
              ) : (
                <div className="w-full h-full rounded-[8px] border border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-xs font-extrabold text-emerald-900 leading-snug line-clamp-2">
                    {trimmedTitle || `${shortLabel} · Sabahkı Endirimlər`}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-700 mt-0.5 tabular-nums">
                    {(editingUpcoming.products || []).length} məhsul gözlənilir
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Target Market & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Market</label>
            <select
              value={resolveMarketForCampaign(editingUpcoming.marketId, markets)?.id || editingUpcoming.marketId}
              onChange={(e) =>
                setEditingUpcoming((prev) => (prev ? { ...prev, marketId: e.target.value } : prev))
              }
              className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-2.5 text-sm font-semibold text-gray-800 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {(markets.length > 0
                ? markets
                : [
                    { id: 'oba', name: 'Oba Market' } as MarketData,
                    { id: 'araz', name: 'Araz Market' } as MarketData,
                  ]
              ).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-700 mb-1">
              <Calendar className="w-3 h-3 text-emerald-600" />
              Başlama Tarixi
            </label>
            <input
              type="date"
              required
              value={editingUpcoming.activateAt}
              onChange={(e) =>
                setEditingUpcoming((prev) =>
                  prev ? { ...prev, activateAt: e.target.value } : prev
                )
              }
              className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-700 mb-1">
              <Clock className="w-3 h-3 text-gray-500" />
              Bitmə Tarixi (İstəyə bağlı)
            </label>
            <input
              type="date"
              value={editingUpcoming.endDate || ''}
              onChange={(e) =>
                setEditingUpcoming((prev) => (prev ? { ...prev, endDate: e.target.value } : prev))
              }
              className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-2.5 py-1.5 leading-snug">
          <strong>Avtomatik keçid:</strong> Başlama tarixi ({editingUpcoming.activateAt}) gəldikdə
          banner gizlənir və aşağıdakı məhsullar avtomatik olaraq{' '}
          <strong>{targetMarket?.name || editingUpcoming.marketId}</strong> kataloquna əlavə olunur.
        </p>

        {/* Banner Content Mode */}
        <div>
          <span className="block text-xs font-bold text-gray-700 mb-1.5">Banner Məzmunu Növü</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdContentMode('image')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                adContentMode === 'image'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Görsəl Linki (URL)
            </button>
            <button
              type="button"
              onClick={() => setAdContentMode('html')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                adContentMode === 'html'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              HTML (Hərəkətli)
            </button>
          </div>
        </div>

        {adContentMode === 'image' ? (
          <div className="space-y-2.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                Banner Görsəl Linki (URL)
              </label>
              <input
                type="text"
                value={editingUpcoming.imageUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setPreviewError(false);
                  setEditingUpcoming((prev) =>
                    prev ? { ...prev, imageUrl: val } : prev
                  );
                }}
                className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setEditingUpcoming((prev) => (prev ? { ...prev, fitMode: 'cover' } : prev))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  fitMode === 'cover'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Kartı tam doldur
              </button>
              <button
                type="button"
                onClick={() =>
                  setEditingUpcoming((prev) => (prev ? { ...prev, fitMode: 'contain' } : prev))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  fitMode === 'contain'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Kəsmədən sığdır
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                HTML / CSS / Animasiya Kodu
              </label>
              <button
                type="button"
                onClick={() =>
                  setEditingUpcoming((prev) =>
                    prev
                      ? { ...prev, htmlContent: SAMPLE_UPCOMING_HTML_AD, isVisible: true }
                      : prev
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Nümunə əlavə et
              </button>
            </div>
            <textarea
              rows={5}
              value={editingUpcoming.htmlContent || ''}
              onChange={(e) => {
                const val = e.target.value;
                setEditingUpcoming((prev) =>
                  prev ? { ...prev, htmlContent: val } : prev
                );
              }}
              className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-xs font-mono leading-relaxed"
              placeholder="<style>...</style><div>Sabahkı endirim banner kodu...</div>"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Kampaniya Başlığı (İstəyə bağlı)
          </label>
          <input
            type="text"
            value={editingUpcoming.title}
            onChange={(e) =>
              setEditingUpcoming((prev) => (prev ? { ...prev, title: e.target.value } : prev))
            }
            className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            placeholder="Məs: Sabahkı Xüsusi Endirimlər"
          />
        </div>

        {/* Dedicated Tomorrow's Products Section */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-extrabold text-gray-900">
                Sabahkı Məhsullar ({(editingUpcoming.products || []).length})
              </span>
            </div>
            {!isProductFormOpen && (
              <button
                type="button"
                onClick={() => {
                  setEditingProductIndex(null);
                  setProductDraft(createEmptyUpcomingProduct());
                  setProductFormError('');
                  setIsProductFormOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Məhsul əlavə et
              </button>
            )}
          </div>

          {isProductFormOpen && (
            <div className="rounded-xl border border-emerald-200 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-800">
                  {editingProductIndex !== null ? 'Məhsulu Düzəlt' : 'Yeni Sabahkı Məhsul'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsProductFormOpen(false);
                    setEditingProductIndex(null);
                    setProductFormError('');
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Məhsul Adı *
                </label>
                <input
                  type="text"
                  value={productDraft.productName}
                  onChange={(e) =>
                    setProductDraft((prev) => ({ ...prev, productName: e.target.value }))
                  }
                  className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Məs: Azərçay Qara Çay 500 q"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">
                    Köhnə Qiymət
                  </label>
                  <input
                    type="text"
                    value={productDraft.oldPrice}
                    onChange={(e) =>
                      setProductDraft((prev) => ({ ...prev, oldPrice: e.target.value }))
                    }
                    className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="9.49"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">
                    Yeni Qiymət *
                  </label>
                  <input
                    type="text"
                    value={productDraft.newPrice}
                    onChange={(e) =>
                      setProductDraft((prev) => ({ ...prev, newPrice: e.target.value }))
                    }
                    className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="6.29"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">
                    Endirim %
                  </label>
                  <input
                    type="text"
                    value={productDraft.discountPercentage}
                    onChange={(e) =>
                      setProductDraft((prev) => ({
                        ...prev,
                        discountPercentage: e.target.value,
                      }))
                    }
                    className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Avtomatik"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">
                    Kateqoriya
                  </label>
                  <select
                    value={productDraft.category}
                    onChange={(e) =>
                      setProductDraft((prev) => ({
                        ...prev,
                        category: e.target.value as ProductCategory,
                      }))
                    }
                    className="block w-full border border-gray-300 rounded-lg py-1.5 px-2 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">
                    Son Tarix (İstəyə bağlı)
                  </label>
                  <input
                    type="date"
                    value={productDraft.expiryDate || ''}
                    onChange={(e) =>
                      setProductDraft((prev) => ({ ...prev, expiryDate: e.target.value }))
                    }
                    className="block w-full border border-gray-300 rounded-lg py-1.5 px-2 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Məhsul Şəkli (URL)
                </label>
                <input
                  type="text"
                  value={productDraft.imageUrl || productDraft.customImageUrl || ''}
                  onChange={(e) =>
                    setProductDraft((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                      customImageUrl: e.target.value,
                    }))
                  }
                  className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="https://..."
                />
              </div>

              {productFormError && (
                <p className="text-[11px] font-bold text-red-600">{productFormError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductFormOpen(false);
                    setEditingProductIndex(null);
                    setProductFormError('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Ləğv et
                </button>
                <button
                  type="button"
                  onClick={handleSaveUpcomingProductDraft}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingProductIndex !== null ? 'Yenilə' : 'Siyahıya əlavə et'}
                </button>
              </div>
            </div>
          )}

          {(editingUpcoming.products || []).length === 0 ? (
            <p className="text-[11.5px] text-gray-500 text-center py-3">
              Hələ məhsul əlavə edilməyib. Bannerə klikləyəndə bu məhsullar açılacaq.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
              {(editingUpcoming.products || []).map((prod, idx) => {
                const imgSrc = (prod.imageUrl || prod.customImageUrl || '').trim();
                return (
                  <div
                    key={`${prod.productName}-${idx}`}
                    className="flex items-center gap-2 bg-white border border-gray-200/85 rounded-lg p-1.5"
                  >
                    <div className="w-9 h-9 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={prod.productName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{prod.productName}</p>
                      <p className="text-[11px] font-semibold text-gray-500 tabular-nums flex items-center gap-1.5">
                        <span className="text-emerald-700 font-extrabold">{prod.newPrice} ₼</span>
                        {prod.oldPrice && (
                          <span className="line-through text-gray-400">{prod.oldPrice} ₼</span>
                        )}
                        {prod.discountPercentage && (
                          <span className="text-rose-600 font-bold">{prod.discountPercentage}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProductIndex(idx);
                          setProductDraft({
                            ...prod,
                            imageUrl: prod.imageUrl || prod.customImageUrl || '',
                            expiryDate: prod.expiryDate || prod.bitis || '',
                          });
                          setProductFormError('');
                          setIsProductFormOpen(true);
                        }}
                        className="p-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 cursor-pointer"
                        title="Düzəlt"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingUpcoming((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  products: (prev.products || []).filter((_, i) => i !== idx),
                                }
                              : prev
                          )
                        }
                        className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={editingUpcoming.isVisible}
            onChange={(e) =>
              setEditingUpcoming((prev) =>
                prev ? { ...prev, isVisible: e.target.checked } : prev
              )
            }
            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
          />
          <span className="text-xs sm:text-sm font-semibold text-gray-800">
            Yayımda (Aktiv tarix gələnə qədər banner göstərilsin)
          </span>
        </label>

        <div className="flex gap-2.5 pt-3 border-t border-gray-100 sticky bottom-0 bg-white">
          {!isCreatingNew && (
            <button
              type="button"
              onClick={() => {
                handleDeleteUpcoming(editingUpcoming.id);
                setEditingUpcoming(null);
              }}
              className="inline-flex justify-center items-center px-3 py-2.5 border border-red-200 text-xs sm:text-sm font-bold rounded-xl text-red-600 bg-red-50/70 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Sil
            </button>
          )}
          <button
            type="submit"
            className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border border-transparent text-xs sm:text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Yadda saxla
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-xs transition-opacity" />

        <div
          className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-4 pt-4 pb-5 sm:p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-3.5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                    Reklam & Sabahkı Endirimlər
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Örnəklər, sürüşdürmə və sabahkı kampaniyalar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('featured');
                  setEditingAd(null);
                  setEditingUpcoming(null);
                  setIsCreatingNew(false);
                }}
                className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'featured'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 shrink-0 hidden min-[400px]:inline" />
                <span className="truncate">Örnək</span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] tabular-nums">
                  {localFeatured.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('swipe');
                  setEditingAd(null);
                  setEditingUpcoming(null);
                  setIsCreatingNew(false);
                }}
                className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'swipe'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0 hidden min-[400px]:inline" />
                <span className="truncate">Kaydırma</span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] tabular-nums">
                  {localSwipe.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upcoming');
                  setEditingAd(null);
                  setEditingUpcoming(null);
                  setIsCreatingNew(false);
                }}
                className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer ${
                  activeTab === 'upcoming'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0 hidden min-[400px]:inline" />
                <span className="truncate">Sabahkı</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] tabular-nums">
                  {localUpcoming.length}
                </span>
              </button>
            </div>

            {activeTab === 'upcoming' ? (
              editingUpcoming ? (
                renderUpcomingFormView()
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 px-3 py-2.5 text-[11.5px] text-emerald-950 font-medium leading-snug">
                    Banner ana səhifədə <strong>Örnək məhsullar</strong> sırasında görünür və
                    kliklədikdə birbaşa həmin marketin <strong>Sabahkı Endirimlər</strong> bölməsinə
                    aparır. Məhsullar günü gəldikdə avtomatik öz kateqoriyalarına qarışır.
                  </div>

                  {localUpcoming.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 py-7 px-4 text-center">
                      <Clock className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm font-bold text-gray-700">
                        Hələ sabahkı endirim kampaniyası əlavə edilməyib
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Market seçib banner və sabahkı endirimli məhsulları əlavə edə bilərsiniz.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                      {localUpcoming.map((camp, index) => {
                        const targetMkt = resolveMarketForCampaign(camp.marketId, markets);
                        const mktLabel = targetMkt?.name || getShortMarketLabel(camp.marketId);
                        const isPromoted = Boolean(camp.promotedAt);
                        const dateLabel = formatUpcomingDateLabel(camp.activateAt);
                        const statusText = isPromoted
                          ? 'Kataloqa köçürüldü'
                          : camp.isVisible
                            ? `${dateLabel} · Aktiv`
                            : 'Gizli';

                        return (
                          <div
                            key={camp.id || index}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                              camp.isVisible && !isPromoted
                                ? 'bg-white border-emerald-200 shadow-2xs'
                                : 'bg-gray-50 border-gray-200/70 opacity-75'
                            }`}
                          >
                            <div className="w-16 h-11 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                              {(camp.htmlContent || '').trim() ? (
                                <HtmlAdFrame html={camp.htmlContent || ''} title={camp.title || mktLabel} interactive={false} />
                              ) : camp.imageUrl ? (
                                <img
                                  src={camp.imageUrl}
                                  alt={camp.title || mktLabel}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Clock className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold leading-none">
                                  {mktLabel}
                                </span>
                                <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold leading-none tabular-nums">
                                  {statusText}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-gray-900 truncate mt-1">
                                {camp.title || `${mktLabel} · Sabahkı Endirimlər`}
                              </p>
                              <p className="text-[10.5px] text-gray-500 font-semibold tabular-nums">
                                {(camp.products || []).length} məhsul · {camp.activateAt}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleUpcomingVisible(camp.id)}
                                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                  camp.isVisible
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                                }`}
                                title={camp.isVisible ? 'Gizlət' : 'Yayımla'}
                              >
                                {camp.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditUpcoming(camp)}
                                className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                                title="Düzəlt"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUpcoming(camp.id)}
                                className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Sabahkı Endirim Əlavə Et
                  </button>
                </div>
              )
            ) : editingAd ? (
              renderFormView()
            ) : (
              <div className="space-y-3">
                {/* Explanation Notice */}
                <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 px-3 py-2.5 text-[11.5px] text-amber-900 font-medium leading-snug">
                  {activeTab === 'featured' ? (
                    <>
                      <strong>1-ci</strong> reklam üst sırada, <strong>2-ci</strong> alt sırada,{' '}
                      <strong>3-cü</strong> yenə üst sırada — hər zaman{' '}
                      <strong>1 məhsul, 1 reklam</strong> şəklində avtomatik paylaşılır.
                    </>
                  ) : (
                    <>
                      Bu reklamlar normal məhsul siyahılarında <strong>görünmür</strong>. Yalnız
                      məhsul detalını sürüşdürərkən <strong>5-ci, 15-ci, 25-ci...</strong> (hər 10
                      sürüşdürmədə) avtomatik çıxır.
                    </>
                  )}
                </div>

                {/* Ads List */}
                {currentList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 py-7 px-4 text-center">
                    <Megaphone className="w-7 h-7 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm font-bold text-gray-700">
                      {activeTab === 'featured'
                        ? 'Hələ örnək reklamı əlavə edilməyib'
                        : 'Hələ kaydırma reklamı əlavə edilməyib'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {activeTab === 'featured'
                        ? 'Boş olduqda ana səhifədə “Burda sizin reklamınız ola bilər” kartı görünür.'
                        : 'Əlavə etdikdə 5, 15, 25-ci sürüşdürmələrdə avtomatik reklam çıxacaq.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                    {currentList.map((ad, index) => {
                      const posLabel =
                        activeTab === 'featured'
                          ? getRowPositionLabel(currentList, index)
                          : ad.isVisible
                            ? `Aktiv · #${index + 1}`
                            : 'Gizli';

                      return (
                        <div
                          key={ad.id || index}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                            ad.isVisible
                              ? 'bg-white border-gray-200 shadow-2xs'
                              : 'bg-gray-50 border-gray-200/70 opacity-75'
                          }`}
                        >
                          <div className="w-16 h-11 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                            {(ad.htmlContent || '').trim() ? (
                              <div className="w-full h-full relative">
                                <HtmlAdFrame html={ad.htmlContent || ''} title={ad.title || 'HTML'} interactive={false} />
                                <span className="absolute bottom-0.5 right-0.5 px-1 py-0 rounded bg-black/75 text-white text-[8px] font-black leading-tight">
                                  HTML
                                </span>
                              </div>
                            ) : ad.imageUrl ? (
                              <img
                                src={ad.imageUrl}
                                alt={ad.title || 'Reklam'}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Megaphone className="w-4 h-4 text-amber-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold leading-none">
                                {posLabel}
                              </span>
                              {(ad.htmlContent || '').trim() && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9.5px] font-extrabold leading-none">
                                  HTML
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-gray-900 truncate mt-1">
                              {ad.title || ad.link || ((ad.htmlContent || '').trim() ? 'Hərəkətli HTML Reklam' : 'Şəkilli Reklam')}
                            </p>
                            {ad.link && (
                              <p className="text-[10.5px] text-blue-600 truncate leading-tight">
                                {ad.link}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleVisible(ad.id)}
                              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                ad.isVisible
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={ad.isVisible ? 'Gizlət' : 'Yayımla'}
                            >
                              {ad.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(ad)}
                              className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                              title="Düzəlt"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAd(ad.id)}
                              className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {activeTab === 'featured'
                    ? 'Yeni Örnək Reklamı Əlavə Et'
                    : 'Yeni Kaydırma Reklamı Əlavə Et'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerEditorModal;