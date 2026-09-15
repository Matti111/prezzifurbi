import React from 'react';
import { IndicatorLevel } from '../types/product';
import { ChevronsUp, ArrowUp, Equal, ArrowDown } from 'lucide-react';

interface SpecIndicatorProps {
  level: IndicatorLevel;
  isLight?: boolean;
  className?: string;
}

export const SpecIndicator: React.FC<SpecIndicatorProps> = ({ level, isLight = false, className = '' }) => {
  if (isLight) {
    switch (level) {
      case 'double_up':
        return (
          <span
            title="Top Assoluto: Molto superiore alla media del budget"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 text-white border border-emerald-700 shadow-sm select-none ${className}`}
          >
            <ChevronsUp className="w-5 h-5 text-white stroke-[3]" />
          </span>
        );
      case 'up':
        return (
          <span
            title="Superiore alla media"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-400 font-bold select-none ${className}`}
          >
            <ArrowUp className="w-4 h-4 text-emerald-700 stroke-[3]" />
          </span>
        );
      case 'neutral':
        return (
          <span
            title="Nella media della categoria"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-200 text-slate-800 border border-slate-300 select-none ${className}`}
          >
            <Equal className="w-4 h-4 text-slate-700 stroke-[3]" />
          </span>
        );
      case 'down':
        return (
          <span
            title="Sotto la media / Limite da considerare"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 text-rose-800 border border-rose-400 select-none ${className}`}
          >
            <ArrowDown className="w-4 h-4 text-rose-700 stroke-[3]" />
          </span>
        );
      default:
        return null;
    }
  }

  // Dark theme card
  switch (level) {
    case 'double_up':
      return (
        <span
          title="Top Assoluto: Molto superiore alla media del budget"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 select-none shadow-sm shadow-emerald-500/10 ${className}`}
        >
          <ChevronsUp className="w-5 h-5 text-emerald-300 stroke-[3]" />
        </span>
      );
    case 'up':
      return (
        <span
          title="Superiore alla media"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 select-none ${className}`}
        >
          <ArrowUp className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
        </span>
      );
    case 'neutral':
      return (
        <span
          title="Nella media della categoria"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 select-none ${className}`}
        >
          <Equal className="w-4 h-4 text-slate-400 stroke-[2.5]" />
        </span>
      );
    case 'down':
      return (
        <span
          title="Sotto la media / Limite da considerare"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/25 text-rose-400 border border-rose-500/50 select-none ${className}`}
        >
          <ArrowDown className="w-4 h-4 text-rose-400 stroke-[2.5]" />
        </span>
      );
    default:
      return null;
  }
};
