import React, { useState } from 'react';
import { Product, SpecKey } from '../types/product';
import { StampBadge } from './StampBadge';
import { SpecIndicator } from './SpecIndicator';
import { 
  Star, 
  ExternalLink, 
  Info, 
  Monitor, 
  Gamepad2, 
  Cpu, 
  MemoryStick as RamIcon, 
  HardDrive, 
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Handshake
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  highlightedSpec: SpecKey;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  highlightedSpec,
  onSelect 
}) => {
  // 3 tabs: 'top' | 'flop' | 'comment'
  const [activeTab, setActiveTab] = useState<'top' | 'flop' | 'comment'>('top');

  const discountPercent = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // Background style & color scheme according to user rule:
  // "da bianco nuovo, quasi bianco come nuovo... a grigio scuro usato"
  const isNuovo = product.condition === 'Nuovo';
  const isRicondizionato = product.condition === 'Ricondizionato';
  const isLightCard = isNuovo || isRicondizionato;

  // Card theme classes
  const cardTheme = isNuovo
    ? 'bg-white text-slate-900 border-slate-200 shadow-xl shadow-slate-900/10'
    : isRicondizionato
    ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-lg shadow-slate-900/15'
    : 'bg-slate-900/95 text-slate-100 border-slate-800 shadow-xl shadow-black/40';

  const innerBoxTheme = isLightCard
    ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
    : 'bg-slate-950/70 border-slate-800 text-slate-300';

  const titleTheme = isLightCard
    ? 'text-slate-900 group-hover:text-orange-600'
    : 'text-white group-hover:text-orange-300';

  const footerTheme = isLightCard
    ? 'bg-slate-200/80 border-slate-300'
    : 'bg-slate-950/80 border-slate-800';

  // Condition Badge & Symbol with responsive text
  const renderConditionBadge = () => {
    if (isNuovo) {
      return (
        <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-amber-500/15 text-amber-800 border border-amber-500/40">
          <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500/30 flex-shrink-0" />
          <span>Nuovo</span>
        </div>
      );
    }
    if (isRicondizionato) {
      return (
        <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-sky-500/15 text-sky-800 border border-sky-500/40">
          <RefreshCw className="w-3 h-3 text-sky-600 flex-shrink-0" />
          <span>Ricon<span className="hidden xs:inline">dizionato</span></span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-extrabold bg-slate-800 text-slate-200 border border-slate-700">
        <Handshake className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span>Usato<span className="hidden xs:inline"> Garantito</span></span>
      </div>
    );
  };

  // Render stars
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.4;
    return (
      <div className="flex items-center gap-1">
        <div className="flex text-amber-500">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i < fullStars
                  ? 'fill-amber-500 text-amber-500'
                  : i === fullStars && hasHalf
                  ? 'fill-amber-500/50 text-amber-500'
                  : isLightCard ? 'text-slate-300' : 'text-slate-700'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-black ml-1 ${isLightCard ? 'text-slate-900' : 'text-amber-300'}`}>
          {product.rating.toFixed(1)}
        </span>
      </div>
    );
  };

  // Helper for row highlighting
  const isHighlighted = (key: SpecKey) => highlightedSpec === key;

  // Amazon prices are still static (Creators API not fully unlocked yet) and
  // MediaWorld has no affiliate tracking yet (Awin approval pending) nor a
  // live price sync: flag both as unverified while catalog automation catches up.
  const showUnverifiedNotice = /amazon|mediaworld/i.test(product.store);

  return (
    <div className={`group relative flex flex-col rounded-2xl border transition-all duration-300 w-full max-w-full overflow-hidden ${cardTheme}`}>
      
      {/* 1. Header: Left = Stamp (Only Fox for Scelta Furba) | Middle = Condition Symbol | Right = Big Discount */}
      <div className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 border-b ${
        isLightCard ? 'border-slate-300/90 bg-slate-50/80' : 'border-slate-800/80 bg-slate-950/40'
      }`}>
        
        {/* Left: Stamp */}
        <div className="flex items-center flex-shrink-0">
          <StampBadge stamp={product.stamp} size="md" />
        </div>

        {/* Middle: Condition Symbol */}
        <div className="flex items-center justify-center flex-1 min-w-0">
          {renderConditionBadge()}
        </div>

        {/* Right: Big Discount */}
        <div className="flex items-center justify-end flex-shrink-0">
          {discountPercent > 0 ? (
            <span className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight leading-none">
              -{discountPercent}%
            </span>
          ) : (
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
              isLightCard ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Netto
            </span>
          )}
        </div>

      </div>

      {/* 2. Main Card Content */}
      <div className="p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3">
        
        {/* Thumbnail + Title + Rating */}
        <div className="flex gap-2.5 sm:gap-3 items-center">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-950/10 border border-slate-300/60 flex-shrink-0">
            <img 
              src={product.imageUrl} 
              alt={product.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {product.weight && (
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded text-[8px] sm:text-[9px] font-bold bg-slate-950/80 text-white">
                {product.weight}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 block truncate">
              {product.brand} • {product.model}
            </span>
            <h3 className={`text-xs sm:text-base font-black line-clamp-2 leading-snug transition-colors ${titleTheme}`}>
              {product.title}
            </h3>
            <div className="mt-0.5 sm:mt-1">
              {renderStars(product.rating)}
            </div>
          </div>
        </div>

        {/* 3. The 5 Specs with Clean Icons (Arrows without text) & Dynamic Highlight */}
        <div className={`rounded-xl p-2 sm:p-2.5 border flex flex-col gap-1 sm:gap-1.5 max-w-full overflow-hidden ${innerBoxTheme}`}>
          
          {/* Schermo */}
          <div className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs py-1 px-1.5 sm:px-2 rounded-lg transition-colors min-w-0 ${
            isHighlighted('screen') 
              ? isLightCard 
                ? 'bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300' 
                : 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40' 
              : isLightCard ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
              <Monitor className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isHighlighted('screen') 
                  ? isLightCard ? 'text-emerald-700' : 'text-emerald-400' 
                  : isLightCard ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {product.specs.screen.value}
              </span>
            </div>
            <div className="flex-shrink-0">
              <SpecIndicator level={product.specs.screen.indicator} isLight={isLightCard} />
            </div>
          </div>

          {/* Scheda Video */}
          <div className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs py-1 px-1.5 sm:px-2 rounded-lg transition-colors min-w-0 ${
            isHighlighted('gpu') 
              ? isLightCard 
                ? 'bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300' 
                : 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40' 
              : isLightCard ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
              <Gamepad2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isHighlighted('gpu') 
                  ? isLightCard ? 'text-emerald-700' : 'text-emerald-400' 
                  : isLightCard ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {product.specs.gpu.value}
              </span>
            </div>
            <div className="flex-shrink-0">
              <SpecIndicator level={product.specs.gpu.indicator} isLight={isLightCard} />
            </div>
          </div>

          {/* Processore */}
          <div className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs py-1 px-1.5 sm:px-2 rounded-lg transition-colors min-w-0 ${
            isHighlighted('cpu') 
              ? isLightCard 
                ? 'bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300' 
                : 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40' 
              : isLightCard ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
              <Cpu className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isHighlighted('cpu') 
                  ? isLightCard ? 'text-emerald-700' : 'text-emerald-400' 
                  : isLightCard ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {product.specs.cpu.value}
              </span>
            </div>
            <div className="flex-shrink-0">
              <SpecIndicator level={product.specs.cpu.indicator} isLight={isLightCard} />
            </div>
          </div>

          {/* RAM */}
          <div className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs py-1 px-1.5 sm:px-2 rounded-lg transition-colors min-w-0 ${
            isHighlighted('ram') 
              ? isLightCard 
                ? 'bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300' 
                : 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40' 
              : isLightCard ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
              <RamIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isHighlighted('ram') 
                  ? isLightCard ? 'text-emerald-700' : 'text-emerald-400' 
                  : isLightCard ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {product.specs.ram.value}
              </span>
            </div>
            <div className="flex-shrink-0">
              <SpecIndicator level={product.specs.ram.indicator} isLight={isLightCard} />
            </div>
          </div>

          {/* SSD */}
          <div className={`flex items-center justify-between gap-1.5 sm:gap-2 text-xs py-1 px-1.5 sm:px-2 rounded-lg transition-colors min-w-0 ${
            isHighlighted('ssd') 
              ? isLightCard 
                ? 'bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300' 
                : 'bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40' 
              : isLightCard ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
              <HardDrive className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isHighlighted('ssd') 
                  ? isLightCard ? 'text-emerald-700' : 'text-emerald-400' 
                  : isLightCard ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {product.specs.ssd.value}
              </span>
            </div>
            <div className="flex-shrink-0">
              <SpecIndicator level={product.specs.ssd.indicator} isLight={isLightCard} />
            </div>
          </div>

        </div>

        {/* 4. Top, Flop & Commento: 3 Card/Tabs in totale con altissima leggibilità su qualsiasi sfondo */}
        <div className="space-y-1.5 sm:space-y-2 max-w-full">
          
          {/* 3 Tabs Header */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border max-w-full ${
            isLightCard ? 'bg-slate-200/90 border-slate-300' : 'bg-slate-950/60 border-slate-800'
          }`}>
            
            {/* Tab 1: Top */}
            <button
              onClick={() => setActiveTab('top')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] sm:text-xs font-extrabold transition-all truncate ${
                activeTab === 'top'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isLightCard
                  ? 'text-slate-700 hover:text-emerald-800 hover:bg-slate-300/70'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Top ({product.topHighlights.length})</span>
            </button>

            {/* Tab 2: Flop */}
            <button
              onClick={() => setActiveTab('flop')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] sm:text-xs font-extrabold transition-all truncate ${
                activeTab === 'flop'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : isLightCard
                  ? 'text-slate-700 hover:text-rose-800 hover:bg-slate-300/70'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Flop ({product.flopWarnings.length})</span>
            </button>

            {/* Tab 3: Commento */}
            <button
              onClick={() => setActiveTab('comment')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] sm:text-xs font-extrabold transition-all truncate ${
                activeTab === 'comment'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : isLightCard
                  ? 'text-slate-700 hover:text-amber-800 hover:bg-slate-300/70'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Commento</span>
            </button>

          </div>

          {/* Active Tab Card Content with crystal-clear contrast on ANY background */}
          {activeTab === 'top' && (
            <div className={`rounded-xl p-2.5 sm:p-3 text-xs space-y-1.5 border min-h-[85px] sm:min-h-[90px] flex flex-col justify-center max-w-full overflow-hidden ${
              isLightCard 
                ? 'bg-emerald-50 border-emerald-300 text-slate-900 shadow-sm' 
                : 'bg-emerald-950/40 border-emerald-500/40 text-slate-100'
            }`}>
              {product.topComment && (
                <p className={`text-[10px] sm:text-[11px] font-black leading-snug pb-1 border-b ${
                  isLightCard ? 'text-emerald-900 border-emerald-200' : 'text-emerald-300 border-emerald-500/20'
                }`}>
                  💬 “{product.topComment}”
                </p>
              )}
              <ul className={`space-y-1 pl-4 list-disc list-outside text-[10px] sm:text-[11px] font-medium leading-snug ${
                isLightCard ? 'text-slate-800 marker:text-emerald-600' : 'text-slate-200 marker:text-emerald-400'
              }`}>
                {product.topHighlights.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'flop' && (
            <div className={`rounded-xl p-2.5 sm:p-3 text-xs space-y-1.5 border min-h-[85px] sm:min-h-[90px] flex flex-col justify-center max-w-full overflow-hidden ${
              isLightCard 
                ? 'bg-rose-50 border-rose-300 text-slate-900 shadow-sm' 
                : 'bg-rose-950/40 border-rose-500/40 text-slate-100'
            }`}>
              {product.flopComment && (
                <p className={`text-[10px] sm:text-[11px] font-black leading-snug pb-1 border-b ${
                  isLightCard ? 'text-rose-900 border-rose-200' : 'text-rose-300 border-rose-500/20'
                }`}>
                  ⚠️ “{product.flopComment}”
                </p>
              )}
              <ul className={`space-y-1 pl-4 list-disc list-outside text-[10px] sm:text-[11px] font-medium leading-snug ${
                isLightCard ? 'text-slate-800 marker:text-rose-600' : 'text-slate-200 marker:text-rose-400'
              }`}>
                {product.flopWarnings.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'comment' && (
            <div className={`rounded-xl p-2.5 sm:p-3 text-xs space-y-1.5 border min-h-[85px] sm:min-h-[90px] flex flex-col justify-center max-w-full overflow-hidden ${
              isLightCard 
                ? 'bg-amber-50 border-amber-300 text-slate-900 shadow-sm' 
                : 'bg-amber-950/30 border-amber-500/40 text-slate-100'
            }`}>
              <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b ${
                isLightCard ? 'text-amber-900 border-amber-200' : 'text-amber-400 border-amber-500/20'
              }`}>
                <span>🦊 Verdetto della Volpe:</span>
              </div>
              <p className={`text-[10px] sm:text-[11px] leading-relaxed italic font-medium ${
                isLightCard ? 'text-slate-800' : 'text-slate-200'
              }`}>
                “{product.stampRationale}”
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Unverified Link Notice (Amazon & Refurbed only, while catalog automation is finished) */}
      {showUnverifiedNotice && (
        <div className={`px-3 sm:px-4 py-1.5 flex items-center gap-1.5 border-t text-[10px] sm:text-[11px] font-bold ${
          isLightCard
            ? 'bg-amber-100 border-amber-300 text-amber-800'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
          <span>Link non verificato: sito in aggiornamento</span>
        </div>
      )}

      {/* 5. Card Footer with Clean Price & CTA */}
      <div className={`mt-auto p-3 sm:p-3.5 sm:px-4 border-t flex items-center justify-between gap-2 max-w-full ${footerTheme}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 sm:gap-1.5">
            <span className={`text-xl sm:text-2xl font-black ${isLightCard ? 'text-slate-900' : 'text-white'}`}>
              {product.price} €
            </span>
            {product.originalPrice && (
              <span className="text-[10px] sm:text-xs text-slate-400 line-through truncate">
                {product.originalPrice} €
              </span>
            )}
          </div>
          <div className={`text-[10px] sm:text-[11px] font-medium truncate ${isLightCard ? 'text-slate-600' : 'text-slate-400'}`}>
            {product.store}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onSelect(product)}
            className={`p-2 sm:p-2.5 rounded-xl border transition-colors ${
              isLightCard
                ? 'bg-white hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="Dettagli e Analisi"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={`Vai alla scheda prodotto su ${product.store}`}
            className="inline-flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/25 transition-all"
          >
            <span>Acquista</span>
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </a>
        </div>
      </div>

    </div>
  );
};
