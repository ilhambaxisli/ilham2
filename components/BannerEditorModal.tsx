import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, ExternalLink, Image as ImageIcon, Megaphone } from 'lucide-react';
import { BannerData } from '../types';

interface BannerEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  banner: BannerData;
  onSave: (banner: BannerData) => void;
}

export const normalizeAdLinkUrl = (raw?: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
};

const BannerEditorModal: React.FC<BannerEditorModalProps> = ({ isOpen, onClose, banner, onSave }) => {
  const [formData, setFormData] = useState<BannerData>(banner);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setFormData(banner);
    setPreviewError(false);
  }, [banner, isOpen]);

  if (!isOpen) return null;

  const trimmedImage = (formData.imageUrl || '').trim();
  const trimmedTitle = (formData.title || '').trim();
  const normalizedLink = normalizeAdLinkUrl(formData.link);
  const fitMode = formData.fitMode === 'contain' ? 'contain' : 'cover';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent = Boolean(trimmedImage || trimmedTitle);
    const nextData: BannerData = {
      id: formData.id || 'featured-ad',
      title: trimmedTitle,
      imageUrl: trimmedImage,
      link: normalizedLink,
      isVisible: hasContent ? formData.isVisible : false,
      fitMode,
    };
    onSave(nextData);
    onClose();
  };

  const handleClear = () => {
    onSave({ id: formData.id || 'featured-ad', isVisible: false, title: '', imageUrl: '', link: '', fitMode: 'cover' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-xs transition-opacity" />

        <div
          className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-5 pt-5 pb-5 sm:p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                    Örnək Reklam Sahəsi
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Ana səhifədəki “Örnəklər” sırasındakı reklam kartı
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

            {/* Live Card Preview */}
            <div className="mb-4 bg-gray-50 rounded-xl p-3 border border-gray-200/80">
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
              <div className="mx-auto w-[210px] sm:w-[240px] h-[96px] sm:h-[108px] relative flex flex-col pt-3.5 sm:pt-4">
                <div
                  className="absolute top-0 left-0 z-0 bg-amber-500 text-white px-2 pt-[3px] rounded-t-lg flex items-start justify-center shadow-xs"
                  style={{ height: '34px', backgroundColor: '#f59e0b' }}
                >
                  <span className="text-[10px] font-black tracking-tight leading-none">
                    Reklam
                  </span>
                </div>
                <div className={`bg-white rounded-xl overflow-hidden flex items-center justify-center flex-1 min-h-0 w-full relative z-10 shadow-xs border border-amber-200/90 ${formData.isVisible && trimmedImage && !previewError ? 'p-0' : 'p-1.5'}`}>
                  {formData.isVisible && trimmedImage && !previewError ? (
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
                  ) : formData.isVisible && trimmedTitle ? (
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
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                  Görsəl Linki (URL)
                </label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPreviewError(false);
                    setFormData((prev) => ({
                      ...prev,
                      imageUrl: val,
                      isVisible: val.trim().length > 0 ? true : prev.isVisible,
                    }));
                  }}
                  className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  placeholder="https://..."
                />
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                  İdeal ölçü: <strong>480×200 px</strong> (~2.4:1 yatay). Digər ölçülər də kartın içinə uyğunlaşdırılır.
                </p>
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
                    onClick={() => setFormData((prev) => ({ ...prev, fitMode: 'cover' }))}
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
                    onClick={() => setFormData((prev) => ({ ...prev, fitMode: 'contain' }))}
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

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  Tıklandıqda Yönləndiriləcək Link
                </label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) => setFormData((prev) => ({ ...prev, link: e.target.value }))}
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
                  value={formData.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      title: val,
                      isVisible: val.trim().length > 0 ? true : prev.isVisible,
                    }));
                  }}
                  className="block w-full border border-gray-300 rounded-lg shadow-2xs py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Görsəl olmadıqda və ya alt mətn kimi göstərilər"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                />
                <span className="text-xs sm:text-sm font-semibold text-gray-800">
                  Yayımda (Aktiv deyilsə standart reklam yazısı göstərilir)
                </span>
              </label>

              <div className="flex gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border border-red-200 text-xs sm:text-sm font-bold rounded-xl text-red-600 bg-red-50/70 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Sil / Təmizlə
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border border-transparent text-xs sm:text-sm font-bold rounded-xl text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  Yadda saxla
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerEditorModal;