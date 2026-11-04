
import React, { useState, useEffect } from 'react';
import { X, Save, Store, Image as ImageIcon, Check, Trash2, AlertTriangle } from 'lucide-react';
import { MarketData } from '../types';

interface EditMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: MarketData;
  onSave: (updatedMarket: MarketData) => void;
  onDelete: (marketId: string) => void;
}

const COLORS: MarketData['themeColor'][] = [
  'red', 'orange', 'amber', 'yellow', 'lime', 
  'green', 'emerald', 'teal', 'cyan', 'sky', 
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 
  'pink', 'rose', 'slate', 'gray', 'zinc'
];

const EditMarketModal: React.FC<EditMarketModalProps> = ({ isOpen, onClose, market, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState<MarketData['themeColor']>('blue');
  
  // New state for 2-step deletion
  const [isDeleting, setIsDeleting] = useState(false);

  // Load market data when modal opens
  useEffect(() => {
    if (isOpen && market) {
      setName(market.name);
      setUrl(market.url);
      setLogoUrl(market.logoUrl || '');
      setColor(market.themeColor);
      setIsDeleting(false); // Reset delete state on open
    }
  }, [isOpen, market]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedMarket: MarketData = {
      ...market,
      name,
      url,
      themeColor: color,
      logoUrl: logoUrl.trim() || undefined,
      lastUpdated: new Date().toISOString()
    };
    onSave(updatedMarket);
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDeleting) {
        // Second click: Actually delete
        onDelete(market.id);
    } else {
        // First click: Show confirmation
        setIsDeleting(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                Marketi Düzəlt
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Market Adı</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">PDF Kataloq Linki</label>
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Logo URL</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tema Rəngi</label>
                <div className="grid grid-cols-6 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 ${
                        color === c ? 'border-gray-900 scale-110 shadow-sm' : 'border-transparent'
                      } bg-${c}-500 focus:outline-none`}
                      title={c}
                    >
                        {color === c && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t mt-2">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className={`
                    flex-1 inline-flex justify-center items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-md focus:outline-none transition-all duration-200
                    ${isDeleting 
                        ? 'bg-red-600 text-white border-transparent hover:bg-red-700' 
                        : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                    }
                  `}
                >
                  {isDeleting ? (
                      <>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Təsdiqlə: Sil
                      </>
                  ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Sil
                      </>
                  )}
                </button>
                <button
                  type="submit"
                  className="flex-[2] inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm hover:shadow-md transition-shadow"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Yadda saxla
                </button>
              </div>
              
              {isDeleting && (
                  <p className="text-xs text-center text-red-500 animate-pulse">
                      Bu market və bütün kataloqları silinəcək. Ləğv etmək üçün kənara çıxın.
                  </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMarketModal;
