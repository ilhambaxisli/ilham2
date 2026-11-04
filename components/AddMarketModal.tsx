
import React, { useState } from 'react';
import { X, Save, Store, Image as ImageIcon, Check } from 'lucide-react';
import { MarketData } from '../types';

interface AddMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (market: MarketData) => void;
}

const COLORS: MarketData['themeColor'][] = [
  'red', 'orange', 'amber', 'yellow', 'lime', 
  'green', 'emerald', 'teal', 'cyan', 'sky', 
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 
  'pink', 'rose', 'slate', 'gray', 'zinc'
];

const AddMarketModal: React.FC<AddMarketModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState<MarketData['themeColor']>('blue');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMarket: MarketData = {
      id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name,
      url,
      themeColor: color,
      products: [],
      lastUpdated: new Date().toISOString(),
      logoPlaceholder: name.charAt(0).toUpperCase(),
      logoUrl: logoUrl.trim() || undefined
    };
    onAdd(newMarket);
    setName('');
    setUrl('');
    setLogoUrl('');
    setColor('blue');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                Yeni Market Əlavə et
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
                  placeholder="Məs: Rahat Market"
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
                  placeholder="https://market.az/katalog.pdf"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Logo URL (İstəyə bağlı)</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"
                    placeholder="https://.../logo.png"
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

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Əlavə et
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMarketModal;
