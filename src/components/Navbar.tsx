import React from 'react';
import { Search, HelpCircle, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenHowItWorks: () => void;
  totalDeals: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onOpenHowItWorks,
  totalDeals,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-2 sm:gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform text-lg sm:text-2xl select-none">
                🦊
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-2xl font-black tracking-tight text-white">
                    Prezzi<span className="text-orange-500">Furbi</span>
                  </span>
                  <span className="hidden xs:inline-flex px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    BETA
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium hidden md:block">
                  Notebook & PC selezionati senza fregature
                </span>
              </div>
            </a>
          </div>

          {/* Quick Search on Desktop */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Cerca modello, RTX 4060, i7, ThinkPad..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Actions & Verified Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{totalDeals} Offerte</span>
            </div>

            <button
              onClick={onOpenHowItWorks}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-bold transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Come Funziona</span>
              <span className="sm:hidden">Guida</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="pb-2.5 md:hidden">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cerca notebook, GPU o processore..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-all"
            />
          </div>
        </div>

      </div>
    </header>
  );
};
