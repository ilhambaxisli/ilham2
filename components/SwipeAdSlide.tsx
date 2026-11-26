import React, { useState, useEffect } from 'react';
import { ExternalLink, ChevronUp, ChevronDown, Megaphone } from 'lucide-react';
import { BannerData } from '../types';
import { normalizeAdLinkUrl } from './BannerEditorModal';
import HtmlAdFrame from './HtmlAdFrame';

interface SwipeAdSlideProps {
  ad: BannerData;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  variant?: 'product' | 'opportunity';
}

const SwipeAdSlide: React.FC<SwipeAdSlideProps> = ({
  ad,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  variant = 'product',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [ad.imageUrl]);

  const adHtml = (ad.htmlContent || '').trim();
  const adImg = (ad.imageUrl || '').trim();
  const adTitle = (ad.title || '').trim();
  const adLink = normalizeAdLinkUrl(ad.link);
  const adFitMode = ad.fitMode === 'contain' ? 'contain' : 'cover';
  const showHtml = Boolean(adHtml);
  const showImage = Boolean(!showHtml && adImg && !imgError);

  const imageBlock = showHtml ? (
    <div className="w-full h-full relative overflow-hidden bg-white">
      <HtmlAdFrame html={adHtml} title={adTitle || 'Reklam'} interactive={false} />
    </div>
  ) : showImage ? (
    adFitMode === 'cover' ? (
      <img
        src={adImg}
        alt={adTitle || 'Reklam'}
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover object-center scale-[1.02] pointer-events-none select-none"
      />
    ) : (
      <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gray-900">
        <img
          src={adImg}
          alt=""
          aria-hidden="true"
          draggable={false}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-45 pointer-events-none select-none"
        />
        <img
          src={adImg}
          alt={adTitle || 'Reklam'}
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="relative z-10 w-full h-full object-contain pointer-events-none select-none"
        />
      </div>
    )
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-amber-50 via-white to-amber-100/70 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md mb-3">
        <Megaphone className="w-6 h-6" />
      </div>
      <h3 className="text-lg sm:text-xl font-black text-gray-900 leading-snug">
        {adTitle || 'Reklam'}
      </h3>
    </div>
  );

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-white overflow-hidden select-none">
      {/* Main Full-Bleed Ad Visual Area */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-gray-100">
        {adLink ? (
          <a
            href={adLink}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            className="block w-full h-full cursor-pointer group"
            title={adTitle || adLink}
          >
            {imageBlock}
          </a>
        ) : (
          imageBlock
        )}

        {/* Top-left Reklam badge */}
        <div className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-black tracking-wide shadow-md pointer-events-none">
          <Megaphone className="w-3 h-3" />
          <span>REKLAM</span>
        </div>

        {/* Mobile Quick Up/Down Buttons */}
        <div className="sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
          {hasPrev && onPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className="w-7 h-7 rounded-full bg-white/95 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
              title="Əvvəlki"
            >
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
          {hasNext && onNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="w-7 h-7 rounded-full bg-white/95 shadow-md text-gray-700 flex items-center justify-center active:scale-90"
              title="Növbəti"
            >
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Ad Action / Info Bar */}
      {(adTitle || adLink) && (
        <div className={`px-3.5 sm:px-5 ${variant === 'opportunity' ? 'py-3' : 'py-2.5'} bg-white border-t border-amber-100 flex items-center justify-between gap-2.5 shrink-0`}>
          <div className="min-w-0 flex-1">
            {adTitle && (
              <p className="text-xs sm:text-sm font-extrabold text-gray-900 truncate leading-tight">
                {adTitle}
              </p>
            )}
            {adLink && (
              <p className="text-[10.5px] sm:text-xs font-medium text-gray-500 truncate mt-0.5">
                {adLink.replace(/^https?:\/\//i, '')}
              </p>
            )}
          </div>

          {adLink && (
            <a
              href={adLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-black shadow-sm transition-colors shrink-0"
            >
              <span>Ətraflı bax</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Bottom Swipe Continue Hint */}
      <div className="py-1.5 px-3 bg-white border-t border-gray-100 flex items-center justify-center gap-1 text-gray-400 text-[9.5px] sm:text-[10px] font-medium shrink-0">
        <ChevronUp className="w-3 h-3 animate-bounce shrink-0" />
        <span className="truncate">Məhsullara davam etmək üçün sürüşdürün</span>
        <ChevronDown className="w-3 h-3 animate-bounce shrink-0" />
      </div>
    </div>
  );
};

export default SwipeAdSlide;
