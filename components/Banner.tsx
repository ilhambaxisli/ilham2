
import React from 'react';
import { BannerData } from '../types';
import { ExternalLink, Edit2, ImageOff } from 'lucide-react';

interface BannerProps {
  banner: BannerData;
  isAdmin: boolean;
  onEdit: () => void;
  variant?: 'horizontal' | 'vertical';
}

const Banner: React.FC<BannerProps> = ({ banner, isAdmin, onEdit, variant = 'horizontal' }) => {
  if (!banner.isVisible && !isAdmin) return null;

  // Placeholder State for Admin
  if (!banner.isVisible && isAdmin) {
    return (
      <div className={`
        ${variant === 'vertical' ? 'w-full' : 'mt-4 mb-4'}
        ${variant === 'vertical' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}
      `}>
        <button 
          onClick={onEdit}
          className={`
            w-full border-2 border-dashed border-gray-300 rounded-xl 
            text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 
            transition-all flex flex-col items-center justify-center gap-1
            ${variant === 'vertical' ? 'h-32' : 'h-20'} 
            bg-gray-50/50
          `}
          title="Reklamı redaktə etmək üçün klikləyin"
        >
          <div className="flex items-center gap-2">
            <ImageOff className="w-5 h-5 opacity-50" />
            <span className="font-bold text-sm">Boş Reklam Sahəsi</span>
          </div>
          <span className="text-[10px] opacity-60">
             {variant === 'horizontal' ? 'Üfüqi' : 'Şaquli'} (Gizli) - Düzəlt
          </span>
        </button>
      </div>
    );
  }

  // Vertical (Sidebar) Layout
  if (variant === 'vertical') {
    return (
      <div className="w-full h-full rounded-xl overflow-hidden shadow-sm bg-white border border-gray-100 relative group">
        {isAdmin && (
          <button 
            onClick={onEdit}
            className="absolute top-2 right-2 z-20 bg-white/90 p-2 rounded-full shadow-sm text-gray-700 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Düzəlt"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
        <a 
          href={banner.link || '#'} 
          target={banner.link ? "_blank" : undefined}
          rel="noreferrer"
          className={`block h-full relative ${!banner.link ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {banner.imageUrl ? (
            <img 
              src={banner.imageUrl} 
              alt={banner.title} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-blue-600 to-indigo-700 p-4 text-white flex flex-col items-center justify-center text-center">
              <h3 className="text-xl font-bold mb-2">{banner.title}</h3>
              {banner.link && <span className="underline text-sm">Keçid et</span>}
            </div>
          )}
        </a>
      </div>
    );
  }

  // Horizontal Layout (Default)
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="relative group rounded-xl overflow-hidden shadow-lg bg-white">
        
        {isAdmin && (
          <button 
            onClick={onEdit}
            className="absolute top-2 right-2 z-20 bg-white/90 p-2 rounded-full shadow-sm text-gray-700 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Düzəlt"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}

        <a 
          href={banner.link || '#'} 
          target={banner.link ? "_blank" : undefined}
          rel="noreferrer"
          className={`block relative ${!banner.link ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {banner.imageUrl ? (
            <div className="relative w-full h-48 sm:h-64 md:h-80">
              <img 
                src={banner.imageUrl} 
                alt={banner.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6 w-full">
                <h3 className="text-white text-xl md:text-3xl font-bold drop-shadow-md">
                  {banner.title}
                </h3>
                {banner.link && (
                  <span className="inline-flex items-center text-white/90 text-sm mt-2 hover:underline">
                    Ətraflı <ExternalLink className="w-3 h-3 ml-1" />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">{banner.title}</h3>
              {banner.link && (
                <div className="inline-block bg-white text-blue-600 px-4 py-2 rounded-full font-bold text-sm mt-2">
                  Bax
                </div>
              )}
            </div>
          )}
        </a>
      </div>
    </div>
  );
};

export default Banner;
