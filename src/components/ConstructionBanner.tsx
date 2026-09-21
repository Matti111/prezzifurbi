import { useState } from 'react';
import { Construction, X } from 'lucide-react';

export const ConstructionBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-50 w-full bg-amber-500 text-slate-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-2 text-center">
        <Construction className="w-4 h-4 flex-shrink-0" />
        <p className="text-xs sm:text-sm font-bold leading-snug">
          Sito in fase di aggiornamento: prezzi e link ad alcune offerte potrebbero non essere ancora sincronizzati.
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Chiudi avviso"
          className="absolute right-3 sm:right-6 lg:right-8 p-1 rounded-lg hover:bg-black/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
