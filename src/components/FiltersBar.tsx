import React from 'react';
import { FilterState, StampType, ConditionType, SortOption } from '../types/product';
import { SlidersHorizontal, ArrowDownAZ, RotateCcw } from 'lucide-react';

interface FiltersBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onReset: () => void;
  resultCount: number;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  resultCount,
}) => {
  const stampOptions: { label: string; value: StampType | 'all'; icon?: string }[] = [
    { label: 'Tutti', value: 'all' },
    { label: 'Scelta Furba', value: 'scelta_furba', icon: '🦊' },
    { label: 'Best Buy', value: 'best_buy', icon: '⚡' },
    { label: 'Cheaper', value: 'cheaper_good', icon: '🏷️' },
  ];

  const conditionOptions: { label: string; value: ConditionType | 'all'; icon: string }[] = [
    { label: 'Tutti', value: 'all', icon: '📦' },
    { label: 'Nuovo', value: 'Nuovo', icon: '✨' },
    { label: 'Ricondizionato', value: 'Ricondizionato', icon: '🔄' },
    { label: 'Usato', value: 'Usato', icon: '🤝' },
  ];

  const isFiltered =
    filters.stamp !== 'all' ||
    filters.category !== 'all' ||
    filters.condition !== 'all' ||
    filters.maxPrice < 1200 ||
    filters.minRam > 8 ||
    filters.searchQuery !== '';

  return (
    <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-3 sm:p-5 mb-6 shadow-xl backdrop-blur-sm max-w-full overflow-hidden">
      
      {/* 1. Quick Stamp & Condition Selector Buttons */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        
        {/* Timbri */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1 flex-shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" />
            <span>Timbro:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {stampOptions.map((opt) => {
              const isActive = filters.stamp === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onFilterChange({ stamp: opt.value })}
                  className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-orange-400/50'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Condizione */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex-shrink-0">
            Stato:
          </span>
          <div className="flex flex-wrap gap-1">
            {conditionOptions.map((opt) => {
              const isActive = filters.condition === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onFilterChange({ condition: opt.value })}
                  className={`px-2 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-slate-700 text-white border border-slate-500 ring-1 ring-slate-400'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 2. Detailed Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-3">
        
        {/* Max Budget Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-semibold text-slate-400">
              Budget Massimo
            </label>
            <span className="text-[11px] font-bold text-orange-400">
              Fino a {filters.maxPrice} €
            </span>
          </div>
          <input
            type="range"
            min={300}
            max={1200}
            step={50}
            value={filters.maxPrice}
            onChange={(e) => onFilterChange({ maxPrice: Number(e.target.value) })}
            className="w-full accent-orange-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* RAM Minima */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            RAM Minima
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[8, 16, 32].map((ram) => (
              <button
                key={ram}
                onClick={() => onFilterChange({ minRam: ram })}
                className={`py-1 rounded-lg text-xs font-semibold transition-colors border ${
                  filters.minRam === ram
                    ? 'bg-slate-700 text-white border-orange-500/80 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {ram} GB+
              </button>
            ))}
          </div>
        </div>

        {/* Sorting Dropdown (Ordina da...) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <ArrowDownAZ className="w-3.5 h-3.5 text-orange-400" />
            <span>Ordina per specifica o prezzo</span>
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as SortOption })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-orange-500 font-medium"
          >
            <option value="deal_score">🦊 Rapporto Qualità / Prezzo</option>
            <option value="price_asc">💰 Prezzo: dal più basso</option>
            <option value="price_desc">💎 Prezzo: dal più alto</option>
            <option value="gpu">🎮 Scheda Video (GPU)</option>
            <option value="cpu">⚙️ Processore (CPU)</option>
            <option value="ram">🧠 RAM</option>
            <option value="ssd">💾 Hard Disk / SSD</option>
          </select>
        </div>

      </div>

      {/* 3. Filter Status Bar */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div>
          Trovati <strong className="text-white">{resultCount}</strong> portatili
        </div>

        {isFiltered && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Azzera filtri</span>
          </button>
        )}
      </div>

    </div>
  );
};
