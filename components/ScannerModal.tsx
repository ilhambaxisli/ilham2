
import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, Loader2, AlertCircle, Link as LinkIcon, Download, Save, Image as ImageIcon, Check, FolderPlus, Folder, Calendar, Layers } from 'lucide-react';
import { DiscountProduct, Catalog } from '../types';
import { analyzeCatalogStream } from '../services/geminiService';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMarket: string; 
  marketUrl: string;
  currentLogoUrl?: string;
  existingCatalogs?: Catalog[]; 
  onStreamStart: () => void;
  onStreamUpdate: (products: DiscountProduct[], catalogId: string, catalogName: string, startDate?: string, endDate?: string) => void;
  onStreamEnd: (url?: string, catalogId?: string) => void;
  onLogoUpdate: (url: string) => void;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedMarket, 
  marketUrl,
  currentLogoUrl,
  existingCatalogs = [],
  onStreamStart,
  onStreamUpdate,
  onStreamEnd,
  onLogoUpdate
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(marketUrl);
  const [activeTab, setActiveTab] = useState<'link' | 'file'>('link');
  const [scanProgress, setScanProgress] = useState<{current: number, total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoInput, setLogoInput] = useState(currentLogoUrl || '');
  const [isLogoSaved, setIsLogoSaved] = useState(false);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('new');
  const [newCatalogName, setNewCatalogName] = useState('Əsas Kataloq');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateSaved, setIsDateSaved] = useState(false);
  
  // Cleanup and reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setUrlInput(marketUrl);
      setLogoInput(currentLogoUrl || '');
      setIsInitializing(false);
      setError(null);
      setScanProgress(null);
      
      if (existingCatalogs.length > 0) {
        setSelectedCatalogId(existingCatalogs[0].id);
        const cat = existingCatalogs[0];
        setStartDate(cat.startDate || '');
        setEndDate(cat.endDate || '');
      } else {
        setSelectedCatalogId('new');
        setNewCatalogName('Əsas Kataloq');
        setStartDate('');
        setEndDate('');
      }
    }
  }, [isOpen, marketUrl, currentLogoUrl, existingCatalogs]);

  useEffect(() => {
    if (selectedCatalogId !== 'new') {
      const cat = existingCatalogs.find(c => c.id === selectedCatalogId);
      if (cat) {
        setStartDate(cat.startDate || '');
        setEndDate(cat.endDate || '');
      }
    } else {
      setStartDate('');
      setEndDate('');
    }
  }, [selectedCatalogId, existingCatalogs]);

  if (!isOpen) return null;

  const handleSaveLogo = () => {
    onLogoUpdate(logoInput);
    setIsLogoSaved(true);
    setTimeout(() => setIsLogoSaved(false), 2000);
  };

  const handleSaveMetadata = () => {
    if (selectedCatalogId === 'new') return;
    const catalog = existingCatalogs.find(c => c.id === selectedCatalogId);
    if (catalog) {
       onStreamUpdate(catalog.products, catalog.id, catalog.name, startDate, endDate);
       setIsDateSaved(true);
       setTimeout(() => setIsDateSaved(false), 2000);
    }
  };

  const processFile = async (data: ArrayBuffer | string, mimeType: string, url?: string) => {
    setIsInitializing(true);
    setError(null);
    onStreamStart();

    let targetCatalogId = selectedCatalogId;
    let targetCatalogName = newCatalogName;

    if (selectedCatalogId !== 'new') {
      const existing = existingCatalogs.find(c => c.id === selectedCatalogId);
      if (existing) targetCatalogName = existing.name;
    } else {
      targetCatalogId = Date.now().toString();
    }

    const accumulatedProducts: DiscountProduct[] = [];

    try {
      // 1. Check if it is a PDF that needs page-by-page processing
      if (mimeType === 'application/pdf' || (typeof data === 'string' && data.startsWith('application/pdf'))) {
        const pdfData = data instanceof ArrayBuffer ? data : convertDataURIToBinary(data as string);
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        setScanProgress({ current: 0, total: numPages });

        for (let i = 1; i <= numPages; i++) {
          setScanProgress({ current: i, total: numPages });
          
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context!, viewport }).promise;
          
          const pageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          
          await analyzeCatalogStream(
            pageBase64, 
            'image/jpeg', 
            selectedMarket,
            (newProducts) => {
              // Merge products while avoiding exact duplicates on the same page stream
              newProducts.forEach(np => {
                const exists = accumulatedProducts.some(ap => ap.productName === np.productName && ap.newPrice === np.newPrice);
                if (!exists) accumulatedProducts.push(np);
              });
              onStreamUpdate([...accumulatedProducts], targetCatalogId, targetCatalogName, startDate, endDate);
            }
          );
        }
      } else {
        // 2. Process as a single image
        const base64Data = typeof data === 'string' ? (data.includes(',') ? data.split(',')[1] : data) : btoa(new Uint8Array(data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        
        await analyzeCatalogStream(
          base64Data, 
          mimeType, 
          selectedMarket,
          (products) => {
            onStreamUpdate(products, targetCatalogId, targetCatalogName, startDate, endDate);
          }
        );
      }

      onStreamEnd(url, targetCatalogId);
      onClose();
    } catch (err: any) {
      console.error(err);
      onStreamEnd(url, targetCatalogId);
      setIsInitializing(false);
      setError(err.message || "Xəta baş verdi. Kataloq oxuna bilmədi.");
    }
  };

  const convertDataURIToBinary = (dataURI: string) => {
    const base64Index = dataURI.indexOf(';base64,') + ';base64,'.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  };

  const handleUrlScan = async () => {
    if (!urlInput) {
      setError("Zəhmət olmasa düzgün link daxil edin.");
      return;
    }
    
    if (selectedCatalogId === 'new' && !newCatalogName.trim()) {
      setError("Zəhmət olmasa kataloq adı yazın.");
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Linkdən fayl yüklənə bilmədi.");
      
      const blob = await response.blob();
      const mimeType = blob.type || 'application/pdf';
      const arrayBuffer = await blob.arrayBuffer();
      
      processFile(arrayBuffer, mimeType, urlInput);
    } catch (err: any) {
      setIsInitializing(false);
      setError(err.message || "Bağlantı xətası.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (selectedCatalogId === 'new' && !newCatalogName.trim()) {
      setError("Zəhmət olmasa kataloq adı yazın.");
      return;
    }

    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (data) processFile(data as ArrayBuffer, mimeType);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={!isInitializing ? onClose : undefined}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              {selectedMarket} Kataloqu Yenilə
            </h3>
            {!isInitializing && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            
            {!isInitializing && (
              <>
                <div className="mb-6 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Market Logosu
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={logoInput}
                            onChange={(e) => setLogoInput(e.target.value)}
                            className="flex-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="https://... (Logo URL)"
                        />
                        <button
                            onClick={handleSaveLogo}
                            className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all ${isLogoSaved ? 'bg-green-600' : 'bg-gray-800 hover:bg-gray-700'} focus:outline-none`}
                        >
                            {isLogoSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="mb-6 bg-green-50/50 p-3 rounded-xl border border-green-100">
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Folder className="w-4 h-4" /> Kataloq və Tarix
                    </label>
                    <div className="space-y-3">
                        <select
                          value={selectedCatalogId}
                          onChange={(e) => setSelectedCatalogId(e.target.value)}
                          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="new">+ Yeni Kataloq Yarat</option>
                          {existingCatalogs.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>

                        {selectedCatalogId === 'new' && (
                           <div className="flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
                             <FolderPlus className="w-5 h-5 text-green-600" />
                             <input 
                                type="text"
                                value={newCatalogName}
                                onChange={(e) => setNewCatalogName(e.target.value)}
                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Məs: Bayram Endirimləri"
                             />
                           </div>
                        )}

                        <div className="flex gap-2">
                           <div className="flex-1">
                             <label className="text-xs text-gray-500 block mb-1">Başlanğıc</label>
                             <input 
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-2 text-sm"
                             />
                           </div>
                           <div className="flex-1">
                             <label className="text-xs text-gray-500 block mb-1">Bitmə</label>
                             <input 
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-2 text-sm"
                             />
                           </div>
                        </div>

                        {selectedCatalogId !== 'new' && (
                          <div className="flex justify-end pt-1">
                            <button
                                onClick={handleSaveMetadata}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-all"
                            >
                                {isDateSaved ? <Check className="w-3 h-3 mr-1.5" /> : <Save className="w-3 h-3 mr-1.5" />}
                                {isDateSaved ? 'Yadda Saxlandı' : 'Tarixləri Yenilə'}
                            </button>
                          </div>
                        )}
                    </div>
                </div>
              </>
            )}

            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
              <button
                onClick={() => setActiveTab('link')}
                disabled={isInitializing}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Link ilə Əlavə et
              </button>
              <button
                onClick={() => setActiveTab('file')}
                disabled={isInitializing}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Fayl Yüklə
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg text-sm flex flex-col gap-2 border border-red-200 animate-[fadeIn_0.3s_ease-out]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Xəta:</span>
                    <span className="leading-relaxed">{error}</span>
                  </div>
                </div>
              </div>
            )}

            {isInitializing ? (
              <div className="py-8 text-center">
                 <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
                 {scanProgress ? (
                   <div className="space-y-4">
                      <p className="text-base font-bold text-gray-900">Səhifə {scanProgress.current} / {scanProgress.total} taranır...</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-xs mx-auto">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-500">Hər səhifə dəqiqlik üçün tək-tək analiz edilir.</p>
                   </div>
                 ) : (
                   <p className="text-base font-bold text-gray-900">Fayl emal edilir...</p>
                 )}
              </div>
            ) : (
              <>
                {activeTab === 'link' && (
                  <div className="space-y-4">
                    <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="https://site.az/katalog.pdf"
                      />
                    </div>
                    <button
                      onClick={handleUrlScan}
                      className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Taramaya Başla
                    </button>
                  </div>
                )}

                {activeTab === 'file' && (
                   <div 
                    className="border-2 border-gray-300 border-dashed rounded-xl px-6 py-8 hover:border-green-500 hover:bg-green-50/30 transition-all cursor-pointer group text-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileText className="h-10 w-10 text-gray-400 group-hover:text-green-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-gray-600">PDF və ya Şəkil Seç</span>
                    <input 
                      type="file" 
                      className="sr-only" 
                      accept="image/*,application/pdf"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;
