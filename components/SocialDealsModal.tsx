
import React, { useState } from 'react';
import { X, Save, Instagram, Plus, Trash2, Store, Image as ImageIcon, Sparkles, ExternalLink, HelpCircle, AlertTriangle, Info } from 'lucide-react';
import { MarketData } from '../types';

interface SocialDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  markets: MarketData[];
  onUpdateMarkets: (fn: (prev: MarketData[]) => MarketData[]) => void;
}

const SocialDealsModal: React.FC<SocialDealsModalProps> = ({ isOpen, onClose, markets, onUpdateMarkets }) => {
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0]?.id || '');
  const [newUrl, setNewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);

  if (!isOpen) return null;

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    const clean = url.trim().split('?')[0].replace(/\/$/, '');
    return `${clean}/embed/`;
  };

  const handleAddDeal = () => {
    if (!newUrl || !newUrl.trim() || !selectedMarketId) return;

    try {
      // Linki en temiz haliyle sakla (Hata almamak için)
      const cleanPostUrl = newUrl.trim().split('?')[0].replace(/\/$/, '');

      onUpdateMarkets(prev => prev.map(m => {
        if (m.id === selectedMarketId) {
          const posts = m.instagramPosts ? [...m.instagramPosts] : [];
          if (posts.includes(cleanPostUrl)) return m;
          // FIXED: Add to the START of the list so it appears first on the home page
          return { ...m, instagramPosts: [cleanPostUrl, ...posts] };
        }
        return m;
      }));
      
      setNewUrl('');
      setPreviewError(false);
    } catch (e) {
      console.error("Link əlavə etmək mümkün olmadı", e);
    }
  };

  const handleRemoveDeal = (marketId: string, url: string) => {
    onUpdateMarkets(prev => prev.map(m => {
      if (m.id === marketId) {
        return { ...m, instagramPosts: (m.instagramPosts || []).filter(p => p !== url) };
      }
      return m;
    }));
  };

  const allDeals = markets.flatMap(m => 
    (m.instagramPosts || []).map(url => ({ marketId: m.id, marketName: m.name, url }))
  );

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-gray-100">
          <div className="bg-white px-6 pt-5 pb-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-3 shrink-0">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-600" />
                İnstagram Son Paylaşımlar İdarəçisi
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="mb-6 flex items-start gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800 text-xs leading-relaxed">
               <Info className="w-5 h-5 shrink-0 text-blue-600" />
               <p>
                 <span className="font-bold block mb-1">Yeni Linklər üçün:</span>
                 Əlavə etdiyiniz ən son link ana səhifədə <b>ilk sırada</b> görünəcək. Əgər bir postun içindəki bir neçə şəkli əlavə edirsinizsə, onları sondan başa doğru əlavə etməyiniz məsləhətdir.
               </p>
            </div>

            <div className="bg-pink-50 p-5 rounded-2xl border border-pink-100 mb-6 shrink-0">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-pink-700 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Yeni Fürsət Əlavə et
                  </h4>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Market Seçin</label>
                    <select 
                      value={selectedMarketId}
                      onChange={(e) => setSelectedMarketId(e.target.value)}
                      className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 text-sm focus:ring-pink-500 focus:border-pink-500"
                    >
                      {markets.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Instagram Linki</label>
                    <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newUrl}
                          onChange={(e) => { setNewUrl(e.target.value); setPreviewError(false); }}
                          placeholder="https://instagram.com/p/..."
                          className="flex-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 text-sm focus:ring-pink-500 focus:border-pink-500"
                        />
                        <button 
                          onClick={handleAddDeal}
                          disabled={!newUrl.trim()}
                          className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-pink-700 transition-colors disabled:opacity-50"
                        >
                          Əlavə et
                        </button>
                    </div>
                  </div>
               </div>
               
               {newUrl && (
                 <div className="mt-4 flex items-center gap-4 p-3 bg-white rounded-xl border border-pink-200">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100 relative">
                        {newUrl.includes('instagram.com') ? (
                          <div className="w-full h-full relative overflow-hidden bg-gray-100 pointer-events-none">
                            <div 
                              className="absolute top-0 left-0 origin-top-left pointer-events-none"
                              style={{ width: '320px', height: '320px', transform: 'scale(0.2)' }}
                            >
                              <div className="absolute top-[-52px] left-0 w-[320px] h-[430px]">
                                <iframe 
                                  src={getEmbedUrl(newUrl)}
                                  className="w-full h-full border-none pointer-events-none"
                                  scrolling="no"
                                  title="Instagram Preview"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img 
                            src={newUrl} 
                            alt="Ön baxış" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={() => setPreviewError(true)}
                          />
                        )}
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-bold text-green-600 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Şəkil tapıldı
                       </p>
                       <p className="text-[10px] text-gray-400 mt-1 truncate">{newUrl}</p>
                    </div>
                 </div>
               )}
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Mövcud Fürsətlər ({allDeals.length})</h4>
               {allDeals.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allDeals.map((deal, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all">
                         <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 shrink-0 border-2 border-white shadow-sm ring-2 ring-pink-50 relative">
                            {deal.url.includes('instagram.com') ? (
                              <div className="w-full h-full relative overflow-hidden bg-gray-100 pointer-events-none">
                                <div 
                                  className="absolute top-0 left-0 origin-top-left pointer-events-none"
                                  style={{ width: '320px', height: '320px', transform: 'scale(0.175)' }}
                                >
                                  <div className="absolute top-[-52px] left-0 w-[320px] h-[430px]">
                                    <iframe 
                                      src={getEmbedUrl(deal.url)}
                                      className="w-full h-full border-none pointer-events-none"
                                      scrolling="no"
                                      title="Instagram Deal"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img 
                                src={deal.url} 
                                alt="Deals" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/174/174855.png' }}
                              />
                            )}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-gray-900 truncate">{deal.marketName}</p>
                            <a href={deal.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                               Linki gör <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                         </div>
                         <button 
                            onClick={() => handleRemoveDeal(deal.marketId, deal.url)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="text-center py-10">
                    <p className="text-sm text-gray-400">Hələ heç bir fürsət əlavə olunmayıb.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialDealsModal;
