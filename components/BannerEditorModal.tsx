
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { BannerData } from '../types';

interface BannerEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  banner: BannerData;
  onSave: (banner: BannerData) => void;
}

const BannerEditorModal: React.FC<BannerEditorModalProps> = ({ isOpen, onClose, banner, onSave }) => {
  const [formData, setFormData] = useState<BannerData>(banner);

  useEffect(() => {
    setFormData(banner);
  }, [banner, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleClear = () => {
    onSave({ ...formData, isVisible: false, title: '', imageUrl: '', link: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Reklam Sahəsini Düzəlt
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Başlıq / Mətn</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Məs: Həftə Sonu Fürsətləri!"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Görsel URL (İstəyə bağlı)</label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-500 mt-1">Geniş (landscape) görsəllər məsləhətdir.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Yönləndiriləcək Link (İstəyə bağlı)</label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isVisible" className="ml-2 block text-sm text-gray-900">
                  Yayımda (Saytda göstər)
                </label>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil / Təmizlə
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                >
                  <Save className="w-4 h-4 mr-2" />
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