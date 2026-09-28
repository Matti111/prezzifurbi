import React from 'react';
import { FilterState, StampType, ConditionType, SortOption, Product, SpecTagCategory, UseCase, RangeFilter } from '../types/product';
import { SlidersHorizontal, ArrowDownAZ, RotateCcw, Cpu, MemoryStick as RamIcon, HardDrive, Gamepad2, BarChart3, Monitor, Weight as WeightIcon, Home, Briefcase, GraduationCap, Palette, Code2 } from 'lucide-react';
import {
  collectTagOptions,
  isTagAvailable,
  minPriceForSelection,
  distinctSortedValues,
  parseRamGB,
  parseSsdGB,
  parseScreenInches,
} from '../utils/specTags';

/** Formattazione capacità storage: TB con un decimale solo se non è un multiplo
 * esatto (1024 -> "1 TB", 1536 -> "1.5 TB"), stessa convenzione di collectTagOptions. */
const formatStorage = (gb: number) =>
  gb >= 1024 ? `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB` : `${gb} GB`;
const formatScreen = (inches: number) => `${Number(inches.toFixed(1))}"`;
const formatRam = (gb: number) => `${gb} GB`;

/** Indice del valore più vicino a `target` dentro `values` (già ordinato
 * crescente): serve a far combaciare la soglia salvata nel filtro con
 * l'indice dello slider anche se, cambiando altri filtri, quel valore esatto
 * non è più tra quelli disponibili nel pool corrente. */
function closestIndex(values: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < values.length; i++) {
    const diff = Math.abs(values[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

interface RangeSliderFieldProps {
  label: string;
  icon: React.ReactNode;
  /** Valori REALMENTE presenti in catalogo, ordinati crescenti (es. RAM
   * [4,8,16,32,64]): lo slider scatta solo su questi, mai su un continuo
   * arbitrario che potrebbe far scegliere una taglia inesistente (es. 9GB). */
  values: number[];
  value: RangeFilter;
  onChange: (next: RangeFilter) => void;
  format: (n: number) => string;
}

/** Slider a doppia soglia (min + max) per una specifica numerica discreta: due
 * <input type="range"> impilati (indice nell'array `values`, non il valore
 * continuo) invece di un vero doppio cursore, più semplice da verificare
 * senza poter far girare Vite in locale su questa macchina. */
const RangeSliderField: React.FC<RangeSliderFieldProps> = ({ label, icon, values, value, onChange, format }) => {
  if (values.length < 2) return null; // nessuna variazione reale nel pool attuale

  const lastIndex = values.length - 1;
  const minIndex = value.min === null ? 0 : closestIndex(values, value.min);
  const maxIndex = value.max === null ? lastIndex : closestIndex(values, value.max);

  const handleMinChange = (rawIndex: number) => {
    const idx = Math.min(rawIndex, maxIndex);
    onChange({ min: idx <= 0 ? null : values[idx], max: value.max });
  };
  const handleMaxChange = (rawIndex: number) => {
    const idx = Math.max(rawIndex, minIndex);
    onChange({ min: value.min, max: idx >= lastIndex ? null : values[idx] });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </label>
        <span className="text-[11px] font-bold text-orange-400">
          {format(values[minIndex])} – {format(values[maxIndex])}
        </span>
      </div>
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={minIndex}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="w-full accent-orange-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          aria-label={`${label} - soglia minima`}
        />
        <input
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={maxIndex}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="w-full accent-orange-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          aria-label={`${label} - soglia massima`}
        />
      </div>
    </div>
  );
};

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

const USE_CASE_OPTIONS: { value: UseCase; label: string; icon: React.ReactNode }[] = [
  { value: 'gaming', label: 'Gaming', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { value: 'creativita', label: 'Creatività', icon: <Palette className="w-3.5 h-3.5" /> },
  { value: 'programmazione', label: 'Programmazione', icon: <Code2 className="w-3.5 h-3.5" /> },
  { value: 'studio', label: 'Studio', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { value: 'lavoro', label: 'Lavoro', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'home', label: 'Home', icon: <Home className="w-3.5 h-3.5" /> },
];

// RAM/Storage/Schermo sono ora slider a soglia min/max (vedi RangeSliderField sopra),
// non più bottoni a valore esatto: restano qui solo le specifiche categoriche.
const TAG_GROUPS: { key: SpecTagCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'cpu', label: 'Processore', icon: <Cpu className="w-3.5 h-3.5 text-orange-400" /> },
  { key: 'gpu', label: 'Scheda Video', icon: <Gamepad2 className="w-3.5 h-3.5 text-orange-400" /> },
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
  const hasRangeSelection =
    filters.ramRange.min !== null || filters.ramRange.max !== null ||
    filters.ssdRange.min !== null || filters.ssdRange.max !== null ||
    filters.screenRange.min !== null || filters.screenRange.max !== null;

  const ramValues = distinctSortedValues(productsForTags, (p) => parseRamGB(p.specs.ram.value));
  const ssdValues = distinctSortedValues(productsForTags, (p) => parseSsdGB(p.specs.ssd.value));
  const screenValues = distinctSortedValues(productsForTags, (p) => parseScreenInches(p.specs.screen.value));
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

  const toggleUseCase = (uc: UseCase) => {
    const next = filters.useCases.includes(uc)
      ? filters.useCases.filter((x) => x !== uc)
      : [...filters.useCases, uc];
    onFilterChange({ useCases: next });
  };

  const isFiltered =
    filters.stamp !== 'all' ||
    filters.category !== 'all' ||
    filters.useCases.length > 0 ||
    filters.condition !== 'all' ||
    filters.maxPrice < 1200 ||
    hasSpecSelection ||
    hasRangeSelection ||
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

      {/* 1B. Utilizzo: un prodotto può avere più tag, il filtro è multi-selezione
          (combacia se almeno uno dei tag selezionati è tra gli useCases del prodotto) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex-shrink-0">
          Per cosa ti serve:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {USE_CASE_OPTIONS.map((opt) => {
            const isActive = filters.useCases.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleUseCase(opt.value)}
                className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-orange-400/50'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
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

      {/* 2C. Soglie min/max su specifiche numeriche (RAM/Storage/Schermo): a
          differenza dei tag esatti sotto, qui l'utente sceglie un intervallo invece
          di un valore singolo (es. "almeno 16GB" senza escludere 32GB/64GB), ma lo
          slider scatta solo sulle taglie davvero presenti in catalogo (mai un
          continuo arbitrario che farebbe scegliere es. "9GB", che nessuno vende) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-slate-800 mt-3">
        <RangeSliderField
          label="RAM"
          icon={<RamIcon className="w-3.5 h-3.5 text-orange-400" />}
          values={ramValues}
          value={filters.ramRange}
          onChange={(next) => onFilterChange({ ramRange: next })}
          format={formatRam}
        />
        <RangeSliderField
          label="Storage"
          icon={<HardDrive className="w-3.5 h-3.5 text-orange-400" />}
          values={ssdValues}
          value={filters.ssdRange}
          onChange={(next) => onFilterChange({ ssdRange: next })}
          format={formatStorage}
        />
        <RangeSliderField
          label="Dimensione Schermo"
          icon={<Monitor className="w-3.5 h-3.5 text-orange-400" />}
          values={screenValues}
          value={filters.screenRange}
          onChange={(next) => onFilterChange({ screenRange: next })}
          format={formatScreen}
        />
      </div>

      {/* 2B. Tag di specifica (CPU/GPU/Peso): mostrano dove si trova il limite di
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
