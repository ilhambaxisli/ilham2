
import React, { useState, useEffect } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { DiscountProduct, ProductCategory } from '../types';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: DiscountProduct;
  onSave: (updatedProduct: DiscountProduct) => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, product, onSave }) => {
  const [formData, setFormData] = useState<DiscountProduct>(product);

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        productName: String(product.productName || ''),
        oldPrice: product.oldPrice !== undefined && product.oldPrice !== null ? String(product.oldPrice) : '',
        newPrice: product.newPrice !== undefined && product.newPrice !== null ? String(product.newPrice) : '',
        discountPercentage: product.discountPercentage !== undefined && product.discountPercentage !== null ? String(product.discountPercentage) : '',
        expiryDate: product.expiryDate || (product as any).bitis || (product as any).endDate || '',
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      bitis: formData.expiryDate || (formData as any).bitis || undefined,
    });
    onClose();
  };

  const categories: ProductCategory[] = [
    'Meyvə & Tərəvəz', 'Ət & Toyuq', 'Süd & Səhər Yeməyi', 
    'Qida & Paxlalılar', 'İçkilər', 'Qəlyanaltı', 
    'Təmizlik', 'Şəxsi Baxım', 'Ev & Həyat', 'Uşaq', 'Digər'
  ];

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full border border-gray-100">
          <div className="bg-white px-6 pt-5 pb-6">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h3 className="text-xl leading-6 font-bold text-gray-900">
                {product.productName ? 'Məhsulu Düzəlt' : 'Yeni Məhsul Əlavə et'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Məhsul Adı</label>
                <input
                  type="text"
                  required
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                  placeholder="Məs: Süd 1L"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Köhnə Qiymət</label>
                  <input
                    type="text"
                    value={formData.oldPrice}
                    onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value })}
                    className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="2.50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Yeni Qiymət</label>
                  <input
                    type="text"
                    required
                    value={formData.newPrice}
                    onChange={(e) => setFormData({ ...formData, newPrice: e.target.value })}
                    className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="1.99"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Kateqoriya</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Son Tarix
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate || ''}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Xüsusi Şəkil URL</label>
                <input
                  type="text"
                  value={formData.customImageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, customImageUrl: e.target.value })}
                  className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-transparent shadow-lg px-4 py-3 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none transition-all active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  Yadda Saxla
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
