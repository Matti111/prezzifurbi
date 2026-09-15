import React from 'react';
import { StampType } from '../types/product';
import { Zap, Tag } from 'lucide-react';

interface StampBadgeProps {
  stamp: StampType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StampBadge: React.FC<StampBadgeProps> = ({ stamp, className = '', size = 'md' }) => {
  if (stamp === 'nessuno') return null;

  if (stamp === 'scelta_furba') {
    return (
      <div 
        title="Scelta Furba: Miglior rapporto qualità/prezzo"
        className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 border border-amber-300/50 cursor-default hover:scale-105 transition-transform ${
          size === 'lg' ? 'w-12 h-12 text-2xl' : size === 'sm' ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-xl'
        } ${className}`}
      >
        <span className="leading-none select-none">🦊</span>
      </div>
    );
  }

  if (stamp === 'best_buy') {
    return (
      <div 
        title="Best Buy: Il più potente ad un prezzo onesto"
        className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-300/50 cursor-default hover:scale-105 transition-transform ${
          size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
        } ${className}`}
      >
        <Zap className={`${size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} fill-amber-300 text-amber-300`} />
      </div>
    );
  }

  if (stamp === 'cheaper_good') {
    return (
      <div 
        title="Cheaper but Good: Il prezzo più basso senza fregature"
        className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/30 border border-emerald-300/50 cursor-default hover:scale-105 transition-transform ${
          size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
        } ${className}`}
      >
        <Tag className={`${size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
      </div>
    );
  }

  return null;
};
