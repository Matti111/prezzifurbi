import React from 'react';
import { X, CheckCircle2, AlertTriangle, ChevronsUp, ArrowUp, Equal, ArrowDown } from 'lucide-react';
import { StampBadge } from './StampBadge';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl select-none">🦊</span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Guida Rapida al Metodo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Come Funziona Prezzi Furbi
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Zero sigle incomprensibili, zero schede tecniche da 50 righe. Solo quello che conta davvero.
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs sm:text-sm text-slate-300">
          
          {/* Section 1: The 3 Stamps */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>1. I 3 Timbri Ufficiali</span>
            </h3>
            
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <StampBadge stamp="scelta_furba" size="sm" className="mt-0.5" />
                <div className="text-xs">
                  <strong className="text-white block mb-0.5">Miglior Rapporto Qualità / Prezzo</strong>
                  È l'affare d'oro: spendi la cifra giusta e ottieni un computer bilanciato, affidabile e moderno senza sprecare soldi.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <StampBadge stamp="best_buy" size="sm" className="mt-0.5" />
                <div className="text-xs">
                  <strong className="text-white block mb-0.5">Massima Potenza ad un Prezzo Onesto</strong>
                  Il più performante in assoluto della categoria: processori i7/Ryzen top tier, schede RTX 4060 o schermi da sogno a un prezzo nettamente inferiore al listino.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <StampBadge stamp="cheaper_good" size="sm" className="mt-0.5" />
                <div className="text-xs">
                  <strong className="text-white block mb-0.5">Prezzo Minimo ma Affidabile</strong>
                  L'offerta d'attacco per chi ha poco budget (spesso 300€ - 500€), ma che rispetta standard di qualità veri (RAM decente, SSD veloce, scocca solida).
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: The Benchmark Arrows */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              2. Il Significato delle Frecce sui 5 Componenti Chiave
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2">
                <ChevronsUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <strong className="text-emerald-300 block">TOP ASSOLUTO</strong>
                  <span>Nettamente sopra la media della fascia</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-500/30 flex items-center gap-2">
                <ArrowUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <strong className="text-green-300 block">SOPRA LA MEDIA</strong>
                  <span>Componente di livello superiore</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <Equal className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div>
                  <strong className="text-slate-300 block">NELLA MEDIA</strong>
                  <span>Standard atteso per questo prezzo</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-2">
                <ArrowDown className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <div>
                  <strong className="text-rose-300 block">SOTTO LA MEDIA</strong>
                  <span>Limite hardware da considerare</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Top & Flop */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              3. Nessun Segreto: I Fattori Secondari (Top & Flop)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tutti i componenti secondari (peso, rumorosità, tipo di porte, qualità costruttiva) non vengono affogati in tabelle illeggibili:
            </p>
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-start gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-emerald-400">In Verde (TOP):</strong> Chicche inattese come schermi 144Hz IPS, telaio in alluminio militare, dissipazione silenziosa o peso piuma inferiore a 1.5kg.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-rose-400">In Rosso (FLOP):</strong> Compromessi e potenziali fregature svelate (HDD meccanici lenti, schermi TN sbiaditi, peso mattone oltre 2.5kg o RAM saldata non espandibile).</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors"
          >
            Ho Capito, Mostrami le Offerte!
          </button>
        </div>

      </div>
    </div>
  );
};
