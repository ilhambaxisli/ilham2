import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Download,
  Instagram,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Share2
} from 'lucide-react';
import { OpportunityItem } from './OpportunityDetailModal';
import { DiscountProduct } from '../types';

interface OpportunityInstagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: OpportunityItem[];
  initialIndex?: number;
}

const POSTER_W = 1080;
const POSTER_H = 1350;

// In-memory cache of loaded CORS-clean HTMLImageElements for instant downloads
const loadedImageCache = new Map<string, HTMLImageElement>();

const getBingFallbackUrl = (productName: string, size = 450) =>
  `https://tse2.mm.bing.net/th?q=${encodeURIComponent((productName || '').trim() + ' product')}&w=${size}&h=${size}&c=7&rs=1&p=0`;

const getSimplifiedProductName = (productName: string) =>
  (productName || '')
    .replace(/[—–\-/|()]/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(qr|q|kq|kg|ml|lt|l|ədəd|eded|əd)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const blobToDataUrl = (blob: Blob): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' && reader.result.startsWith('data:') ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

const decodeDataUrlToImage = (srcUrl: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      if (typeof img.decode === 'function') {
        await img.decode().catch(() => {});
      }
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
    };
    img.onerror = () => resolve(null);
    img.src = srcUrl;
  });
};

// CORS-safe image loader: tries direct CORS first, falls back to wsrv.nl CORS bridge only if host omits CORS headers
const loadDirectCorsImage = async (rawUrl?: string, timeoutMs = 4500): Promise<HTMLImageElement | null> => {
  const cleanUrl = rawUrl?.trim();
  if (!cleanUrl) return null;

  if (loadedImageCache.has(cleanUrl)) {
    return loadedImageCache.get(cleanUrl)!;
  }

  // Data / blob / same-origin URLs load directly without CORS issues
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('/')) {
    const img = await decodeDataUrlToImage(cleanUrl);
    if (img) loadedImageCache.set(cleanUrl, img);
    return img;
  }

  // 1) Try simple CORS GET fetch first (zero CORS preflight, uses clean CORS cache if available)
  const tryFetchBlobUrl = async (targetUrl: string, cacheMode: RequestCache) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, {
        mode: 'cors',
        cache: cacheMode,
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      window.clearTimeout(timer);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      if (blob.type && (blob.type.includes('text/') || blob.type.includes('json') || blob.type.includes('xml'))) {
        return null;
      }
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl) return null;
      return await decodeDataUrlToImage(dataUrl);
    } catch {
      window.clearTimeout(timer);
      return null;
    }
  };

  const directDefault = await tryFetchBlobUrl(cleanUrl, 'default');
  if (directDefault) {
    loadedImageCache.set(cleanUrl, directDefault);
    return directDefault;
  }

  // If browser cached a non-CORS <img> response earlier, reload bypasses the non-CORS cache
  const directReload = await tryFetchBlobUrl(cleanUrl, 'reload');
  if (directReload) {
    loadedImageCache.set(cleanUrl, directReload);
    return directReload;
  }

  // 2) Direct <img crossOrigin="anonymous"> fallback (zero proxy)
  const imgFallback = await new Promise<HTMLImageElement | null>((resolve) => {
    let settled = false;
    const finish = (val: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      resolve(val);
    };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const t = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = async () => {
      if (typeof img.decode === 'function') {
        await img.decode().catch(() => {});
      }
      finish(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
    };
    img.onerror = () => finish(null);
    img.src = cleanUrl;
  });

  if (imgFallback) {
    loadedImageCache.set(cleanUrl, imgFallback);
    return imgFallback;
  }

  // 3) CORS image bridge fallback (strictly used only when origin omits Access-Control-Allow-Origin)
  const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png`;
  const wsrvImg = await tryFetchBlobUrl(wsrvUrl, 'default');
  if (wsrvImg) {
    loadedImageCache.set(cleanUrl, wsrvImg);
    return wsrvImg;
  }

  return null;
};

interface ResolvedPosterImages {
  productImage: HTMLImageElement | null;
  productPreviewSrc: string | null;
  logoImages: Record<string, HTMLImageElement | null>;
}

const resolvePosterImages = async (item: OpportunityItem): Promise<ResolvedPosterImages> => {
  const sortedVariants = [...item.variants].sort((a, b) => a.price - b.price).slice(0, 4);
  const explicitUrl = item.imageUrl?.trim();
  const bing450 = getBingFallbackUrl(item.productName, 450);
  const bing300 = getBingFallbackUrl(item.productName, 300);

  const loadProduct = async (): Promise<{ img: HTMLImageElement | null; src: string | null }> => {
    // 1. Always prioritize the product's explicit imageUrl first
    if (explicitUrl) {
      const directExplicit = await loadDirectCorsImage(explicitUrl);
      if (directExplicit) return { img: directExplicit, src: directExplicit.src };
    }
    // 2. Fallback to Bing only if explicitUrl is missing or blocked by host CORS policy
    const directBing450 = await loadDirectCorsImage(bing450);
    if (directBing450) return { img: directBing450, src: directBing450.src };

    const directBing300 = await loadDirectCorsImage(bing300);
    if (directBing300) return { img: directBing300, src: directBing300.src };

    const simplified = getSimplifiedProductName(item.productName);
    if (simplified && simplified !== item.productName.trim()) {
      const simplifiedBing = await loadDirectCorsImage(getBingFallbackUrl(simplified, 450));
      if (simplifiedBing) return { img: simplifiedBing, src: simplifiedBing.src };
    }

    return { img: null, src: null };
  };

  const [productRes, ...logoResults] = await Promise.all([
    loadProduct(),
    ...sortedVariants.map((v) => loadDirectCorsImage(v.logoUrl))
  ]);

  const logoImages: Record<string, HTMLImageElement | null> = {};
  sortedVariants.forEach((v, idx) => {
    logoImages[v.marketId] = logoResults[idx] ?? null;
  });

  return {
    productImage: productRes.img,
    productPreviewSrc: productRes.src,
    logoImages
  };
};

// Pure HTML/CSS instant preview component shown in modal
interface OpportunityPosterViewProps {
  item: OpportunityItem;
  productImgSrc: string;
  onProductImgError?: () => void;
}

export const OpportunityPosterView: React.FC<OpportunityPosterViewProps> = ({
  item,
  productImgSrc,
  onProductImgError
}) => {
  const sortedVariants = [...item.variants].sort((a, b) => a.price - b.price);
  const cheapest = sortedVariants[0];
  const priciest = sortedVariants[sortedVariants.length - 1];
  const minP = cheapest?.price ?? 0;
  const maxP = priciest?.price ?? 0;
  const saving = Math.max(0, maxP - minP);
  const savingPct = maxP > 0 ? Math.round((saving / maxP) * 100) : 0;
  const visibleVariants = sortedVariants.slice(0, 4);
  const cheapestName = cheapest?.marketName || '';

  return (
    <div
      style={{
        width: `${POSTER_W}px`,
        height: `${POSTER_H}px`,
        background: 'linear-gradient(155deg, #065f46 0%, #047857 55%, #064e3b 100%)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
      className="relative flex flex-col justify-between p-12 overflow-hidden select-none text-left box-border"
    >
      {/* Simple Top Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1.3" fill="#ffffff" stroke="none" />
              <circle cx="19" cy="21" r="1.3" fill="#ffffff" stroke="none" />
              <path d="M1.5 2h3.8l2.5 12.6a2 2 0 0 0 2 1.6h9.4a2 2 0 0 0 2-1.6L22.5 6.5H6.2" />
            </svg>
          </div>
          <div className="text-[38px] font-black tracking-tight leading-none text-white">
            endirim<span className="text-emerald-300">.net</span>
          </div>
        </div>

        {item.category && (
          <div className="px-5 py-2.5 rounded-full bg-white/15 text-emerald-50 text-[21px] font-bold tracking-wide">
            {item.category}
          </div>
        )}
      </div>

      {/* Single Clean White Showcase Card */}
      <div className="relative z-10 mt-5 flex-1 min-h-0 bg-white rounded-[38px] p-8 shadow-2xl flex flex-col justify-between gap-6">
        {/* Product Title */}
        <h2 className="text-[38px] font-extrabold text-gray-900 leading-[1.18] text-center line-clamp-2 px-2">
          {item.productName}
        </h2>

        {/* Split Main Content: BIG Product Image (Left) + Market Price Differences (Right) */}
        <div className="flex-1 min-h-0 flex items-stretch gap-6">
          {/* Left: Big Product Photo */}
          <div className="w-[53%] bg-gray-50/90 border border-gray-200/80 rounded-[30px] p-6 flex items-center justify-center overflow-hidden">
            {productImgSrc ? (
              <img
                src={productImgSrc}
                alt={item.productName}
                onError={onProductImgError}
                className="w-full h-full max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="w-60 h-60 rounded-3xl bg-gray-100 flex items-center justify-center text-gray-400 text-[26px] font-bold">
                {item.category || 'Məhsul'}
              </div>
            )}
          </div>

          {/* Right: Market Prices & Differences */}
          <div className="w-[47%] flex flex-col justify-center gap-3.5">
            {visibleVariants.map((variant, idx) => {
              const isCheapest = idx === 0 || variant.price === minP;
              const diff = variant.price - minP;
              const shortMkt = variant.marketName.replace(/\s+Market$/i, '') || variant.marketName;

              return (
                <div
                  key={`${variant.marketId}-${idx}`}
                  className={`rounded-[24px] px-5 py-4 flex flex-col gap-2 ${
                    isCheapest
                      ? 'bg-emerald-50 border-[2.5px] border-emerald-500 shadow-sm'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden p-1.5 shrink-0 border-2 ${
                          isCheapest ? 'border-emerald-500' : 'border-gray-200'
                        }`}
                      >
                        {variant.logoUrl ? (
                          <img src={variant.logoUrl} alt={variant.marketName} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[19px] font-black text-emerald-700">{variant.logoPlaceholder}</span>
                        )}
                      </div>
                      <span className={`text-[26px] font-extrabold truncate ${isCheapest ? 'text-emerald-950' : 'text-gray-800'}`}>
                        {shortMkt}
                      </span>
                    </div>

                    {isCheapest && (
                      <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-[15px] font-black tracking-wide shrink-0">
                        ƏN UCUZ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pl-1">
                    <span className={`font-black leading-none ${isCheapest ? 'text-[42px] text-emerald-600' : 'text-[34px] text-gray-800'}`}>
                      {variant.originalPriceStr} ₼
                    </span>

                    {!isCheapest && diff > 0 && (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[20px] font-extrabold leading-none whitespace-nowrap">
                        +{diff.toFixed(2)} ₼
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clean Hero Savings Highlight */}
        <div
          className="px-8 py-6 rounded-[28px] flex items-center justify-between shadow-lg"
          style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' }}
        >
          <div>
            <div className="text-[50px] font-black text-white tracking-tight leading-none">
              {saving.toFixed(2)} ₼ QƏNAƏT!
            </div>
            {cheapestName && (
              <div className="text-[21px] font-bold text-emerald-50 mt-2 leading-none">
                Ən sərfəli: {cheapestName}
              </div>
            )}
          </div>

          {savingPct > 0 && (
            <div className="px-6 py-3.5 rounded-2xl bg-white text-emerald-700 text-[38px] font-black leading-none shadow-sm">
              -{savingPct}%
            </div>
          )}
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="relative z-10 mt-4 text-center text-emerald-100/90 text-[22px] font-bold">
        endirim.net · Market qiymətlərini müqayisə et
      </div>
    </div>
  );
};

// Direct high-resolution 1080x1350 Canvas PNG builder (instant, crisp, guaranteed image draw)
const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
};

const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const rest = `${current} ${words[j]}`;
          if (ctx.measureText(rest + '…').width <= maxWidth) {
            current = rest;
          } else {
            break;
          }
        }
        if (i + 1 < words.length && ctx.measureText(current).width > maxWidth - 20) {
          while (current.length > 3 && ctx.measureText(current + '…').width > maxWidth) {
            current = current.slice(0, -1);
          }
        }
        if (words.length > i + 1) current = current.replace(/[.,;:\s]+$/, '') + '…';
        lines.push(current);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
};

const drawCircularLogo = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  img: HTMLImageElement | null,
  placeholder: string,
  borderColor: string,
  borderWidth: number
) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, radius - borderWidth - 3), 0, Math.PI * 2);
    ctx.clip();
    const box = (radius - borderWidth - 4) * 2;
    const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = '#059669';
    ctx.font = `900 ${Math.round(radius * 0.78)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((placeholder || 'M').slice(0, 2).toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
};

const renderPosterToOutput = async (
  item: OpportunityItem,
  images: ResolvedPosterImages
): Promise<{ blob: Blob | null; dataUrl: string | null }> => {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: null, dataUrl: null };

  const sortedVariants = [...item.variants].sort((a, b) => a.price - b.price);
  const cheapest = sortedVariants[0];
  const priciest = sortedVariants[sortedVariants.length - 1];
  const minP = cheapest?.price ?? 0;
  const maxP = priciest?.price ?? 0;
  const saving = Math.max(0, maxP - minP);
  const savingPct = maxP > 0 ? Math.round((saving / maxP) * 100) : 0;
  const visibleVariants = sortedVariants.slice(0, 4);
  const cheapestName = cheapest?.marketName || '';

  // 1. Emerald backdrop
  const bg = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H);
  bg.addColorStop(0, '#065f46');
  bg.addColorStop(0.55, '#047857');
  bg.addColorStop(1, '#064e3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  const padX = 48;
  const contentW = POSTER_W - padX * 2;

  // 2. Simple Brand Top Bar
  const headerY = 46;
  roundRectPath(ctx, padX, headerY, 56, 56, 16);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(padX + 14, headerY + 16);
  ctx.lineTo(padX + 20, headerY + 16);
  ctx.lineTo(padX + 24, headerY + 35);
  ctx.lineTo(padX + 41, headerY + 35);
  ctx.lineTo(padX + 44, headerY + 22);
  ctx.lineTo(padX + 22, headerY + 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX + 26, headerY + 41, 2.4, 0, Math.PI * 2);
  ctx.arc(padX + 39, headerY + 41, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '900 38px Inter, system-ui, sans-serif';
  const wordLeft = 'endirim';
  const wLeft = ctx.measureText(wordLeft).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(wordLeft, padX + 70, headerY + 29);
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText('.net', padX + 70 + wLeft, headerY + 29);

  if (item.category) {
    ctx.font = '700 21px Inter, system-ui, sans-serif';
    const catW = Math.min(340, ctx.measureText(item.category).width + 40);
    roundRectPath(ctx, padX + contentW - catW, headerY + 6, catW, 44, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.fillStyle = '#ecfdf5';
    ctx.textAlign = 'center';
    ctx.fillText(item.category, padX + contentW - catW / 2, headerY + 29);
    ctx.textAlign = 'left';
  }

  // 3. Single Clean White Showcase Card
  const cardY = 124;
  const cardH = 1138;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, padX, cardY, contentW, cardH, 38);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const innerPad = 32;
  const innerX = padX + innerPad;
  const innerW = contentW - innerPad * 2;

  // Product Title at top of white card
  ctx.font = '800 38px Inter, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, item.productName, innerW - 16, 2);
  const titleLineH = 45;
  const titleStartY = cardY + 54;
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, POSTER_W / 2, titleStartY + idx * titleLineH);
  });
  ctx.textAlign = 'left';

  // Bottom Hero Savings Strip inside card
  const savH = 142;
  const savY = cardY + cardH - innerPad - savH;

  // Split Stage bounds between title and savings strip
  const stageTop = titleStartY + Math.max(1, titleLines.length) * titleLineH + 14;
  const stageBottom = savY - 24;
  const stageH = Math.max(460, stageBottom - stageTop);

  // Left Column: BIG Product Image (~53%)
  const colGap = 24;
  const leftW = Math.round((innerW - colGap) * 0.53);
  const rightX = innerX + leftW + colGap;
  const rightW = innerW - leftW - colGap;

  roundRectPath(ctx, innerX, stageTop, leftW, stageH, 30);
  ctx.fillStyle = '#f9fafb';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(229, 231, 235, 0.85)';
  ctx.stroke();

  if (images.productImage && images.productImage.naturalWidth > 0 && images.productImage.naturalHeight > 0) {
    const pImg = images.productImage;
    const imgPad = 28;
    const boxW = leftW - imgPad * 2;
    const boxH = stageH - imgPad * 2;
    const scale = Math.min(boxW / pImg.naturalWidth, boxH / pImg.naturalHeight);
    const dw = pImg.naturalWidth * scale;
    const dh = pImg.naturalHeight * scale;
    const dx = innerX + (leftW - dw) / 2;
    const dy = stageTop + (stageH - dh) / 2;
    ctx.drawImage(pImg, dx, dy, dw, dh);
  } else {
    roundRectPath(ctx, innerX + leftW / 2 - 110, stageTop + stageH / 2 - 90, 220, 180, 24);
    ctx.fillStyle = '#f3f4f6';
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.category || 'Məhsul', innerX + leftW / 2, stageTop + stageH / 2);
    ctx.textAlign = 'left';
  }

  // Right Column: Market Prices & Differences (vertically centered)
  const vCount = visibleVariants.length;
  const vGap = 16;
  const vCardH = vCount <= 2 ? 172 : vCount === 3 ? 156 : 142;
  const totalRightH = vCount * vCardH + Math.max(0, vCount - 1) * vGap;
  const rightStartY = stageTop + Math.max(0, (stageH - totalRightH) / 2);

  visibleVariants.forEach((variant, idx) => {
    const ry = rightStartY + idx * (vCardH + vGap);
    const isCheapest = idx === 0 || variant.price === minP;
    const diff = variant.price - minP;
    const shortMkt = variant.marketName.replace(/\s+Market$/i, '') || variant.marketName;

    roundRectPath(ctx, rightX, ry, rightW, vCardH, 24);
    ctx.fillStyle = isCheapest ? '#ecfdf5' : '#f9fafb';
    ctx.fill();
    ctx.lineWidth = isCheapest ? 3 : 2;
    ctx.strokeStyle = isCheapest ? '#10b981' : '#e5e7eb';
    ctx.stroke();

    // Row top: logo + market name + optional ƏN UCUZ badge
    const logoR = 24;
    const logoCx = rightX + 20 + logoR;
    const logoCy = ry + 38;
    drawCircularLogo(
      ctx,
      logoCx,
      logoCy,
      logoR,
      images.logoImages[variant.marketId] ?? null,
      variant.logoPlaceholder,
      isCheapest ? '#10b981' : '#e5e7eb',
      2
    );

    const nameMaxW = isCheapest ? rightW - 205 : rightW - 96;
    ctx.fillStyle = isCheapest ? '#064e3b' : '#1f2937';
    ctx.font = '800 25px Inter, system-ui, sans-serif';
    ctx.fillText(shortMkt, logoCx + logoR + 12, logoCy + 1, nameMaxW);

    if (isCheapest) {
      const tag = 'ƏN UCUZ';
      ctx.font = '900 15px Inter, system-ui, sans-serif';
      const tagW = ctx.measureText(tag).width + 24;
      roundRectPath(ctx, rightX + rightW - tagW - 18, logoCy - 15, tagW, 30, 10);
      ctx.fillStyle = '#059669';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(tag, rightX + rightW - tagW / 2 - 18, logoCy + 1);
      ctx.textAlign = 'left';
    }

    // Row bottom: price on left + difference pill on right
    const priceY = ry + vCardH - 36;
    ctx.fillStyle = isCheapest ? '#059669' : '#1f2937';
    ctx.font = isCheapest ? '900 42px Inter, system-ui, sans-serif' : '900 34px Inter, system-ui, sans-serif';
    ctx.fillText(`${variant.originalPriceStr} ₼`, rightX + 22, priceY);

    if (!isCheapest && diff > 0) {
      const diffTxt = `+${diff.toFixed(2)} ₼`;
      ctx.font = '800 20px Inter, system-ui, sans-serif';
      const diffW = ctx.measureText(diffTxt).width + 26;
      roundRectPath(ctx, rightX + rightW - diffW - 18, priceY - 19, diffW, 38, 12);
      ctx.fillStyle = '#fff1f2';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fecdd3';
      ctx.stroke();
      ctx.fillStyle = '#e11d48';
      ctx.textAlign = 'center';
      ctx.fillText(diffTxt, rightX + rightW - diffW / 2 - 18, priceY + 1);
      ctx.textAlign = 'left';
    }
  });

  // Hero Savings Banner inside white card bottom
  const savGrad = ctx.createLinearGradient(innerX, savY, innerX + innerW, savY);
  savGrad.addColorStop(0, '#10b981');
  savGrad.addColorStop(1, '#059669');
  roundRectPath(ctx, innerX, savY, innerW, savH, 28);
  ctx.fillStyle = savGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 50px Inter, system-ui, sans-serif';
  ctx.fillText(`${saving.toFixed(2)} ₼ QƏNAƏT!`, innerX + 34, cheapestName ? savY + 52 : savY + savH / 2 + 2);

  if (cheapestName) {
    ctx.fillStyle = '#ecfdf5';
    ctx.font = '700 21px Inter, system-ui, sans-serif';
    ctx.fillText(`Ən sərfəli: ${cheapestName}`, innerX + 36, savY + 102, innerW - 240);
  }

  if (savingPct > 0) {
    const pctStr = `-${savingPct}%`;
    ctx.font = '900 38px Inter, system-ui, sans-serif';
    const pctW = ctx.measureText(pctStr).width + 48;
    roundRectPath(ctx, innerX + innerW - pctW - 30, savY + (savH - 68) / 2, pctW, 68, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#047857';
    ctx.textAlign = 'center';
    ctx.fillText(pctStr, innerX + innerW - pctW / 2 - 30, savY + savH / 2 + 2);
    ctx.textAlign = 'left';
  }

  // Minimal Footer
  ctx.fillStyle = 'rgba(236, 253, 245, 0.9)';
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('endirim.net · Market qiymətlərini müqayisə et', POSTER_W / 2, 1300);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
    } catch {
      resolve(null);
    }
  });
  if (blob) return { blob, dataUrl: null };

  try {
    return { blob: null, dataUrl: canvas.toDataURL('image/png', 1.0) };
  } catch {
    return { blob: null, dataUrl: null };
  }
};

const triggerBlobOrUrlDownload = (
  blob: Blob | null,
  fallbackDataUrl: string | null,
  productName: string
) => {
  const slugBase = (productName || '')
    .toLowerCase()
    .replace(/[^a-z0-9əöüğçşçı]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const filename = `endirim-net-${slugBase || 'furset'}.png`;

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } else if (fallbackDataUrl) {
    const a = document.createElement('a');
    a.href = fallbackDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

// Direct 1-click export helper used right on Fürsətlər cards
export const exportOpportunityPosterPng = async (item: OpportunityItem): Promise<void> => {
  const images = await resolvePosterImages(item);
  const { blob, dataUrl } = await renderPosterToOutput(item, images);
  triggerBlobOrUrlDownload(blob, dataUrl, item.productName);
};

const parsePosterPrice = (val: unknown): number => {
  if (val === null || val === undefined) return NaN;
  const cleaned = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
  return parseFloat(cleaned);
};

// Direct 1-click 1080x1350 Instagram poster builder for any general DiscountProduct in Admin mode
export const exportGeneralProductPosterPng = async (
  product: DiscountProduct,
  marketInfo: { id?: string; name: string; logoUrl?: string; logoPlaceholder?: string },
  catalogEndDate?: string
): Promise<void> => {
  const explicitUrl =
    (typeof product.imageUrl === 'string' && product.imageUrl.trim()) ||
    (typeof product.customImageUrl === 'string' && product.customImageUrl.trim()) ||
    '';

  const loadProductImg = async (): Promise<HTMLImageElement | null> => {
    if (explicitUrl) {
      const direct = await loadDirectCorsImage(explicitUrl);
      if (direct) return direct;
    }
    const bing450 = await loadDirectCorsImage(getBingFallbackUrl(product.productName, 450));
    if (bing450) return bing450;

    const bing300 = await loadDirectCorsImage(getBingFallbackUrl(product.productName, 300));
    if (bing300) return bing300;

    const simplified = getSimplifiedProductName(product.productName);
    if (simplified && simplified !== (product.productName || '').trim()) {
      const simplifiedBing = await loadDirectCorsImage(getBingFallbackUrl(simplified, 450));
      if (simplifiedBing) return simplifiedBing;
    }
    return null;
  };

  const [productImg, marketLogoImg] = await Promise.all([
    loadProductImg(),
    loadDirectCorsImage(marketInfo.logoUrl)
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const newPNum = parsePosterPrice(product.newPrice);
  const oldPNum = parsePosterPrice(product.oldPrice);
  const hasOldPrice = Boolean(
    product.oldPrice &&
    product.oldPrice !== '---' &&
    !isNaN(oldPNum) &&
    !isNaN(newPNum) &&
    oldPNum > newPNum
  );
  const saving = hasOldPrice ? Math.max(0, oldPNum - newPNum) : 0;

  let pct = 0;
  if (hasOldPrice && oldPNum > 0) {
    pct = Math.round(((oldPNum - newPNum) / oldPNum) * 100);
  } else if (product.discountPercentage) {
    const parsedPct = parseFloat(String(product.discountPercentage).replace(/[^0-9.]/g, ''));
    if (!isNaN(parsedPct) && parsedPct > 0) pct = Math.round(parsedPct);
  }

  // 1. Emerald backdrop
  const bg = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H);
  bg.addColorStop(0, '#065f46');
  bg.addColorStop(0.55, '#047857');
  bg.addColorStop(1, '#064e3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  const padX = 48;
  const contentW = POSTER_W - padX * 2;

  // 2. Top Brand Header
  const headerY = 46;
  roundRectPath(ctx, padX, headerY, 56, 56, 16);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(padX + 14, headerY + 16);
  ctx.lineTo(padX + 20, headerY + 16);
  ctx.lineTo(padX + 24, headerY + 35);
  ctx.lineTo(padX + 41, headerY + 35);
  ctx.lineTo(padX + 44, headerY + 22);
  ctx.lineTo(padX + 22, headerY + 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX + 26, headerY + 41, 2.4, 0, Math.PI * 2);
  ctx.arc(padX + 39, headerY + 41, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '900 38px Inter, system-ui, sans-serif';
  const wordLeft = 'endirim';
  const wLeft = ctx.measureText(wordLeft).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(wordLeft, padX + 70, headerY + 29);
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText('.net', padX + 70 + wLeft, headerY + 29);

  if (product.category) {
    ctx.font = '700 21px Inter, system-ui, sans-serif';
    const catW = Math.min(340, ctx.measureText(product.category).width + 40);
    roundRectPath(ctx, padX + contentW - catW, headerY + 6, catW, 44, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.fillStyle = '#ecfdf5';
    ctx.textAlign = 'center';
    ctx.fillText(product.category, padX + contentW - catW / 2, headerY + 29);
    ctx.textAlign = 'left';
  }

  // 3. White Showcase Card
  const cardY = 124;
  const cardH = 1138;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, padX, cardY, contentW, cardH, 38);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const innerPad = 32;
  const innerX = padX + innerPad;
  const innerW = contentW - innerPad * 2;

  // Product Title
  ctx.font = '800 38px Inter, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, product.productName || 'Endirimli Məhsul', innerW - 16, 2);
  const titleLineH = 45;
  const titleStartY = cardY + 54;
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, POSTER_W / 2, titleStartY + idx * titleLineH);
  });
  ctx.textAlign = 'left';

  // Bottom Hero Strip
  const savH = 142;
  const savY = cardY + cardH - innerPad - savH;

  // Split Stage
  const stageTop = titleStartY + Math.max(1, titleLines.length) * titleLineH + 16;
  const stageBottom = savY - 24;
  const stageH = Math.max(460, stageBottom - stageTop);

  const colGap = 24;
  const leftW = Math.round((innerW - colGap) * 0.53);
  const rightX = innerX + leftW + colGap;
  const rightW = innerW - leftW - colGap;

  // Left: BIG Product Image
  roundRectPath(ctx, innerX, stageTop, leftW, stageH, 30);
  ctx.fillStyle = '#f9fafb';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(229, 231, 235, 0.85)';
  ctx.stroke();

  if (productImg && productImg.naturalWidth > 0 && productImg.naturalHeight > 0) {
    const imgPad = 28;
    const boxW = leftW - imgPad * 2;
    const boxH = stageH - imgPad * 2;
    const scale = Math.min(boxW / productImg.naturalWidth, boxH / productImg.naturalHeight);
    const dw = productImg.naturalWidth * scale;
    const dh = productImg.naturalHeight * scale;
    const dx = innerX + (leftW - dw) / 2;
    const dy = stageTop + (stageH - dh) / 2;
    ctx.drawImage(productImg, dx, dy, dw, dh);
  } else {
    roundRectPath(ctx, innerX + leftW / 2 - 110, stageTop + stageH / 2 - 90, 220, 180, 24);
    ctx.fillStyle = '#f3f4f6';
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(product.category || 'Məhsul', innerX + leftW / 2, stageTop + stageH / 2);
    ctx.textAlign = 'left';
  }

  // Right Column: Market Card + Price Card + Optional Expiry/Saving Card
  const shortMkt = (marketInfo.name || 'Market').replace(/\s+Market$/i, '') || marketInfo.name;
  const marketCardH = 128;
  const priceCardH = hasOldPrice ? 286 : 230;
  const expText = product.expiryDate || (product as any).bitis || catalogEndDate || '';
  const hasMetaCard = saving > 0 || Boolean(expText);
  const metaCardH = 112;
  const rGap = 20;
  const totalRightH = marketCardH + rGap + priceCardH + (hasMetaCard ? rGap + metaCardH : 0);
  const rightStartY = stageTop + Math.max(0, (stageH - totalRightH) / 2);

  // Card 1: Market Info
  roundRectPath(ctx, rightX, rightStartY, rightW, marketCardH, 26);
  ctx.fillStyle = '#f9fafb';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e5e7eb';
  ctx.stroke();

  const mLogoR = 32;
  const mLogoCx = rightX + 24 + mLogoR;
  const mLogoCy = rightStartY + marketCardH / 2;
  drawCircularLogo(
    ctx,
    mLogoCx,
    mLogoCy,
    mLogoR,
    marketLogoImg,
    marketInfo.logoPlaceholder || shortMkt.slice(0, 1),
    '#10b981',
    2.5
  );

  ctx.fillStyle = '#6b7280';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText('MARKET', mLogoCx + mLogoR + 16, rightStartY + 42);

  ctx.fillStyle = '#111827';
  ctx.font = '900 32px Inter, system-ui, sans-serif';
  ctx.fillText(shortMkt, mLogoCx + mLogoR + 16, rightStartY + 82, rightW - (mLogoR * 2 + 54));

  // Card 2: Price Highlight
  const priceCardY = rightStartY + marketCardH + rGap;
  roundRectPath(ctx, rightX, priceCardY, rightW, priceCardH, 28);
  ctx.fillStyle = '#ecfdf5';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#10b981';
  ctx.stroke();

  ctx.fillStyle = '#047857';
  ctx.font = '800 20px Inter, system-ui, sans-serif';
  ctx.fillText('ENDİRİM QİYMƏTİ', rightX + 26, priceCardY + 46);

  ctx.fillStyle = '#059669';
  ctx.font = '900 72px Inter, system-ui, sans-serif';
  ctx.fillText(`${product.newPrice} ₼`, rightX + 24, priceCardY + (hasOldPrice ? 124 : 138), rightW - 48);

  if (hasOldPrice) {
    const oldY = priceCardY + 216;
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    const lbl = 'Əvvəlki qiymət:';
    ctx.fillText(lbl, rightX + 26, oldY);
    const lblW = ctx.measureText(lbl).width;

    const oldStr = `${product.oldPrice} ₼`;
    ctx.fillStyle = '#e11d48';
    ctx.font = '800 34px Inter, system-ui, sans-serif';
    const oldX = rightX + 36 + lblW;
    ctx.fillText(oldStr, oldX, oldY);
    const oldW = ctx.measureText(oldStr).width;

    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(oldX - 3, oldY + 1);
    ctx.lineTo(oldX + oldW + 3, oldY + 1);
    ctx.stroke();
  }

  // Card 3: Saving / End date chip
  if (hasMetaCard) {
    const metaY = priceCardY + priceCardH + rGap;
    roundRectPath(ctx, rightX, metaY, rightW, metaCardH, 24);
    ctx.fillStyle = '#fff1f2';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fecdd3';
    ctx.stroke();

    if (saving > 0) {
      ctx.fillStyle = '#be123c';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText('CİBİNİZDƏ QALAN', rightX + 24, metaY + 36);
      ctx.fillStyle = '#e11d48';
      ctx.font = '900 34px Inter, system-ui, sans-serif';
      ctx.fillText(`${saving.toFixed(2)} ₼ QƏNAƏT`, rightX + 24, metaY + 76, rightW - 48);
    } else if (expText) {
      ctx.fillStyle = '#be123c';
      ctx.font = '800 20px Inter, system-ui, sans-serif';
      ctx.fillText('BİTMƏ TARİXİ', rightX + 24, metaY + 36);
      ctx.fillStyle = '#9f1239';
      ctx.font = '900 30px Inter, system-ui, sans-serif';
      ctx.fillText(String(expText), rightX + 24, metaY + 76, rightW - 48);
    }
  }

  // Bottom Hero Banner inside card
  const savGrad = ctx.createLinearGradient(innerX, savY, innerX + innerW, savY);
  savGrad.addColorStop(0, '#10b981');
  savGrad.addColorStop(1, '#059669');
  roundRectPath(ctx, innerX, savY, innerW, savH, 28);
  ctx.fillStyle = savGrad;
  ctx.fill();

  const headline = saving > 0
    ? `${saving.toFixed(2)} ₼ QƏNAƏT!`
    : pct > 0
      ? `-${pct}% ENDİRİM!`
      : `${product.newPrice} ₼ ENDİRİM!`;

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 50px Inter, system-ui, sans-serif';
  ctx.fillText(headline, innerX + 34, savY + 52, innerW - (pct > 0 ? 250 : 68));

  ctx.fillStyle = '#ecfdf5';
  ctx.font = '700 21px Inter, system-ui, sans-serif';
  const subTxt = expText ? `${marketInfo.name} · Son tarix: ${expText}` : `${marketInfo.name} · Aktual Endirim`;
  ctx.fillText(subTxt, innerX + 36, savY + 102, innerW - (pct > 0 ? 250 : 68));

  if (pct > 0) {
    const pctStr = `-${pct}%`;
    ctx.font = '900 38px Inter, system-ui, sans-serif';
    const pctW = ctx.measureText(pctStr).width + 48;
    roundRectPath(ctx, innerX + innerW - pctW - 30, savY + (savH - 68) / 2, pctW, 68, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#047857';
    ctx.textAlign = 'center';
    ctx.fillText(pctStr, innerX + innerW - pctW / 2 - 30, savY + savH / 2 + 2);
    ctx.textAlign = 'left';
  }

  // Minimal Footer
  ctx.fillStyle = 'rgba(236, 253, 245, 0.9)';
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('endirim.net · Market qiymətlərini müqayisə et', POSTER_W / 2, 1300);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
    } catch {
      resolve(null);
    }
  });
  if (blob) {
    triggerBlobOrUrlDownload(blob, null, product.productName || 'endirim');
    return;
  }

  try {
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    triggerBlobOrUrlDownload(null, dataUrl, product.productName || 'endirim');
  } catch {
    // Ignore gracefully
  }
};

const OpportunityInstagramModal: React.FC<OpportunityInstagramModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0
}) => {
  const previewBoxRef = useRef<HTMLDivElement | null>(null);

  const [selectedIdx, setSelectedIdx] = useState<number>(initialIndex);
  const [previewScale, setPreviewScale] = useState<number>(0.32);
  const [productDisplaySrc, setProductDisplaySrc] = useState<string>('');
  const [resolvedImages, setResolvedImages] = useState<ResolvedPosterImages | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadedFeedback, setDownloadedFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const clamped = Math.max(0, Math.min(Math.max(items.length - 1, 0), initialIndex));
      setSelectedIdx(clamped);
      setDownloadedFeedback(false);
    }
  }, [isOpen, initialIndex, items.length]);

  const activeItem = items[selectedIdx] || items[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    const updateScale = () => {
      const box = previewBoxRef.current;
      if (!box) return;
      const availW = Math.max(220, box.clientWidth - 16);
      const maxH = Math.min(window.innerHeight * 0.56, 520);
      const scaleW = availW / POSTER_W;
      const scaleH = maxH / POSTER_H;
      setPreviewScale(Math.min(scaleW, scaleH));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeItem) return;
    let cancelled = false;

    const immediateSrc = activeItem.imageUrl?.trim() || getBingFallbackUrl(activeItem.productName, 450);
    setProductDisplaySrc(immediateSrc);
    setResolvedImages(null);

    resolvePosterImages(activeItem)
      .then((imgs) => {
        if (!cancelled) {
          setResolvedImages(imgs);
          // Only update preview src if explicit imageUrl was not provided
          if (!activeItem.imageUrl?.trim() && imgs.productPreviewSrc) {
            setProductDisplaySrc(imgs.productPreviewSrc);
          }
        }
      })
      .catch(() => {
        // Ignore gracefully
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeItem]);

  const triggerDownload = useCallback(async () => {
    if (!activeItem || isDownloading) return;
    setIsDownloading(true);
    try {
      const imgs = resolvedImages || (await resolvePosterImages(activeItem));
      if (!resolvedImages) {
        setResolvedImages(imgs);
        if (imgs.productPreviewSrc) setProductDisplaySrc(imgs.productPreviewSrc);
      }
      const { blob, dataUrl } = await renderPosterToOutput(activeItem, imgs);
      triggerBlobOrUrlDownload(blob, dataUrl, activeItem.productName);

      setDownloadedFeedback(true);
      window.setTimeout(() => setDownloadedFeedback(false), 1800);
    } catch {
      // Handled gracefully
    } finally {
      setIsDownloading(false);
    }
  }, [activeItem, isDownloading, resolvedImages]);

  const triggerShare = useCallback(async () => {
    if (!activeItem || typeof navigator === 'undefined' || !navigator.share) return;
    try {
      const imgs = resolvedImages || (await resolvePosterImages(activeItem));
      if (!resolvedImages) setResolvedImages(imgs);
      const { blob } = await renderPosterToOutput(activeItem, imgs);
      if (!blob) return;
      const file = new File([blob], 'endirim-net-furset.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'endirim.net Fürsət',
          text: `${activeItem.productName} - endirim.net`,
          files: [file]
        });
      }
    } catch {
      // Share cancelled
    }
  }, [activeItem, resolvedImages]);

  if (!isOpen) return null;

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[94dvh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 text-white flex items-center justify-center shrink-0">
              <Instagram className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-gray-900 truncate">
              Instagram Fürsət Şəkli
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
            title="Bağla"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {items.length === 0 || !activeItem ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Hazırda qiymət fərqi olan aktiv fürsət tapılmadı.
          </div>
        ) : (
          <div className="p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto">
            {/* Prev/Next Switcher */}
            {items.length > 1 && (
              <div className="flex items-center justify-between gap-2 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => setSelectedIdx((prev) => Math.max(0, prev - 1))}
                  disabled={selectedIdx <= 0}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer hover:bg-gray-100"
                  title="Əvvəlki fürsət"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-gray-700 truncate text-center flex-1">
                  {selectedIdx + 1} / {items.length} · {activeItem.productName}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIdx((prev) => Math.min(items.length - 1, prev + 1))}
                  disabled={selectedIdx >= items.length - 1}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer hover:bg-gray-100"
                  title="Növbəti fürsət"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Instant HTML/CSS Scaled Preview */}
            <div
              ref={previewBoxRef}
              className="flex items-center justify-center bg-gray-100 rounded-2xl p-2 border border-gray-200/80 overflow-hidden"
            >
              <div
                className="rounded-xl overflow-hidden shadow-md shrink-0"
                style={{
                  width: `${Math.round(POSTER_W * previewScale)}px`,
                  height: `${Math.round(POSTER_H * previewScale)}px`
                }}
              >
                <div
                  style={{
                    width: `${POSTER_W}px`,
                    height: `${POSTER_H}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left'
                  }}
                >
                  <OpportunityPosterView
                    item={activeItem}
                    productImgSrc={productDisplaySrc || getBingFallbackUrl(activeItem.productName, 450)}
                    onProductImgError={() => {
                      const bing = getBingFallbackUrl(activeItem.productName, 450);
                      if (productDisplaySrc !== bing) {
                        setProductDisplaySrc(bing);
                      } else {
                        setProductDisplaySrc('');
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Download & Share Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={triggerDownload}
                disabled={isDownloading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {downloadedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>İndirildi!</span>
                  </>
                ) : isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>İndirilir...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Şəkli İndir</span>
                  </>
                )}
              </button>

              {canShareFiles && (
                <button
                  type="button"
                  onClick={triggerShare}
                  disabled={isDownloading}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-gray-900 hover:bg-black active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                  title="Paylaş"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Paylaş</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpportunityInstagramModal;
