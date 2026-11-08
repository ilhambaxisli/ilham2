import React from 'react';
import { ShoppingCart, Plus } from 'lucide-react';

interface HeaderProps {
  onAdminClick?: () => void;
  isAdmin?: boolean;
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  onAdminClick, 
  isAdmin, 
  onLogoClick
}) => {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2.5 sm:py-3">
          
          {/* Logo Section */}
          <div 
            onClick={onLogoClick}
            className="flex items-center gap-2 text-green-600 cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="font-bold text-lg sm:text-xl tracking-tight text-gray-900">
              endirim<span className="text-green-600">.net</span>
            </span>
          </div>
          
          {/* Admin Button */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                Admin Rejimi
              </span>
            )}
            <button 
              onClick={onAdminClick}
              className={`p-1.5 sm:p-2 rounded-full transition-colors ${isAdmin ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title={isAdmin ? "Admin Çıxışı" : "Admin Girişi"}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
