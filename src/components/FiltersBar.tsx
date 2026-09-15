import React from 'react';
import { FilterState, StampType, ConditionType, SortOption, Product, SpecTagCategory } from '../types/product';
import { SlidersHorizontal, ArrowDownAZ, RotateCcw, Cpu, MemoryStick as RamIcon, HardDrive, Gamepad2, BarChart3, Monitor, Weight as WeightIcon } from 'lucide-react';
import { collectTagOptions, isTagAvailable, minPriceForSelection } from '../utils/specTags';

interface FiltersBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onReset: () => void;
  resultCount: number;
  /** Catalogo già filtrato per ricerca/timbro/stato/categoria (non per prezzo o tag
   * di specifica): è la base su cui i tag sotto calcolano disponibilità e prezzo minimo. */
  productsForTags: Product[];
  onOpenCompare: () => void;
}

const BUDGET_MIN = 300;
const BUDGET_MAX = 1200;

const TAG_GROUPS: { key: SpecTagCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'cpu', label: 'Processore', icon: <Cpu className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'ram', label: 'RAM', icon: <RamIcon className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'ssd', label: 'Storage', icon: <HardDrive className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'gpu', label: 'Scheda Video', icon: <Gamepad2 className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'screen', label: 'Dimensione Schermo', icon: <Monitor className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'weight', label: 'Peso', icon: <WeightIcon className="w-3.5 h-3.5 text-orange-400" /> },
];

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  resultCount,
  productsForTags,
  onOpenCompare,
}) => {
  const handleTagClick = (category: SpecTagCategory, value: string | number) => {
    const current = filters.specTags[category];

    // Click sullo stesso tag già selezionato -> lo deseleziona
    if (current === value) {
      const next = { ...filters.specTags };
      delete next[category];
      onFilterChange({ specTags: next });
      return;
    }

    const available = isTagAvailable(productsForTags, filters.specTags, category, value, filters.maxPrice);
    if (available) {
      // Compatibile con la selezione attuale -> si aggiunge/sostituisce solo questa categoria
      onFilterChange({ specTags: { ...filters.specTags, [category]: value } });
    } else {
      // Non compatibile -> azzera la selezione e parte solo da questo tag
      onFilterChange({ specTags: { [category]: value } });
    }
  };

  const hasSpecSelection = Object.keys(filters.specTags).length > 0;
  // Senza nessun tag selezionato, la selezione vuota combacia con ogni prodotto:
  // il trattino mostra semplicemente il prezzo del prodotto più economico disponibile.
  const rawDashPrice = minPriceForSelection(productsForTags, filters.specTags);
  const dashPrice = isFinite(rawDashPrice) ? rawDashPrice : null;
  const dashPercent =
    dashPrice !== null
      ? Math.min(100, Math.max(0, ((dashPrice - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100))
      : null;
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
    hasSpecSelection ||
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3">

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
          <div className={`relative ${dashPercent !== null ? 'pt-4' : ''}`}>
            {dashPercent !== null && (
              <>
                <span
                  className="absolute top-0 -translate-x-1/2 text-[10px] font-black text-emerald-400 whitespace-nowrap"
                  style={{ left: `${dashPercent}%` }}
                >
                  {dashPrice}€
                </span>
                <span
                  className="absolute top-3.5 -translate-x-1/2 w-0.5 h-2.5 bg-emerald-400 pointer-events-none rounded-full"
                  style={{ left: `${dashPercent}%` }}
                />
              </>
            )}
            <input
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={50}
              value={filters.maxPrice}
              onChange={(e) => onFilterChange({ maxPrice: Number(e.target.value) })}
              className="w-full accent-orange-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
            />
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

      {/* 2B. Tag di specifica (CPU/RAM/SSD/GPU): mostrano dove si trova il limite di
          budget per avere quella caratteristica, combinabili se compatibili tra loro */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-3 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Caratteristiche</span>
        <button
          onClick={onOpenCompare}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Confronta prestazioni</span>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {TAG_GROUPS.map((group) => {
          const options = collectTagOptions(productsForTags, group.key);
          if (options.length === 0) return null;

          return (
            <div key={group.key}>
              <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                {group.icon}
                <span>{group.label}</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                  const isSelected = filters.specTags[group.key] === opt.value;
                  const available =
                    isSelected || isTagAvailable(productsForTags, filters.specTags, group.key, opt.value, filters.maxPrice);

                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => handleTagClick(group.key, opt.value)}
                      title={!available ? 'Non compatibile con la selezione attuale: clicca per sostituirla' : undefined}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        isSelected
                          ? 'bg-orange-500 text-white border-orange-400 shadow-sm shadow-orange-500/25'
                          : available
                          ? 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/60'
                          : 'bg-slate-950 text-slate-600 border-slate-800/80 opacity-60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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
