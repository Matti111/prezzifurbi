import React from 'react';
import { X, BarChart3 } from 'lucide-react';
import { Product, SpecTagCategory } from '../types/product';
import { collectTagOptions, specValueForProduct, TagOption } from '../utils/specTags';
import { BENCHMARK_SOURCE } from '../data/hardwareBenchmarks';

interface PerformanceCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

interface Row extends TagOption {
  count: number;
}

function buildRows(products: Product[], category: SpecTagCategory): Row[] {
  const options = collectTagOptions(products, category).sort((a, b) => b.rank - a.rank);
  return options.map((opt) => ({
    ...opt,
    count: products.filter((p) => specValueForProduct(p, category) === opt.value).length,
  }));
}

const BarChartGroup: React.FC<{ title: string; rows: Row[] }> = ({ title, rows }) => {
  if (rows.length === 0) return null;
  const maxRank = rows[0].rank || 1;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-wider text-white">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const pct = Math.max(6, (row.rank / maxRank) * 100);
          return (
            <div key={String(row.value)} className="flex items-center gap-2">
              <span className="w-24 sm:w-28 flex-shrink-0 text-[11px] font-semibold text-slate-300 truncate">
                {row.label}
                {row.sourced === false && <span className="text-slate-600" title="Stima approssimativa, non ancora un dato da benchmark reale">*</span>}
              </span>
              <div className="flex-1 h-5 bg-slate-950 rounded-md overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 flex items-center justify-end pr-1.5 rounded-md"
                  style={{ width: `${pct}%` }}
                >
                  <span className="text-[10px] font-black text-slate-950">{Math.round(row.rank)}</span>
                </div>
              </div>
              <span className="w-16 flex-shrink-0 text-[10px] text-slate-500 text-right">
                {row.count} {row.count === 1 ? 'offerta' : 'offerte'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PerformanceCompareModal: React.FC<PerformanceCompareModalProps> = ({ isOpen, onClose, products }) => {
  if (!isOpen) return null;

  const gpuRows = buildRows(products, 'gpu');
  const cpuRows = buildRows(products, 'cpu');

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Confronto Prestazioni</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Quanto è potente rispetto alle altre?</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Barre più lunghe = hardware più veloce. Calcolato sulle offerte attualmente filtrate.
          </p>
        </div>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto text-xs sm:text-sm text-slate-300">
          <BarChartGroup title="Scheda Video (GPU)" rows={gpuRows} />
          <BarChartGroup title="Processore (CPU)" rows={cpuRows} />

          {gpuRows.length === 0 && cpuRows.length === 0 && (
            <p className="text-center text-slate-500 py-6">Nessun prodotto da confrontare con i filtri attuali.</p>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-slate-800">
            Punteggi basati su: {BENCHMARK_SOURCE}. Le famiglie con <span className="text-slate-400">*</span> non hanno
            ancora un dato reale in tabella e mostrano una stima approssimativa.
          </p>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
