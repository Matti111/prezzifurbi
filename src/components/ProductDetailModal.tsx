import { Product } from '../types/product';
import { getValueFraming } from '../utils/valuation';
import { StampBadge } from './StampBadge';
import { SpecIndicator } from './SpecIndicator';
import { 
  X, 
  ExternalLink, 
  Star, 
  Monitor, 
  Gamepad2, 
  Cpu, 
  MemoryStick as RamIcon, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle,
  Scale,
  Shield,
  Award
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  /** Pool contestuale (stesso usato per le card) per calcolare un prezzo
   * tipico onesto quando non c'è un prezzo di listino reale. */
  pool: Product[];
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, pool }) => {
  if (!product) return null;

  const valueFraming = getValueFraming(pool, product);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StampBadge stamp={product.stamp} size="lg" />
            <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
              {product.condition}
            </span>
            {valueFraming.savings && (
              <span className="text-xs px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                Risparmi {valueFraming.savings} € rispetto al {valueFraming.isSourced ? 'prezzo di listino' : 'prezzo tipico'} ({valueFraming.referencePrice} €)
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {product.title}
          </h2>
          
          <div className="flex items-center gap-2 mt-2">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.floor(product.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-amber-300">{product.rating} / 5</span>
            <span className="text-xs text-slate-400">• Giudizio redazionale Prezzi Furbi</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Rationale Quote */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 to-amber-950/20 border border-orange-500/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl select-none">💡</span>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">
                  Perché ha questo timbro:
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {product.stampRationale}
                </p>
              </div>
            </div>
          </div>

          {/* 5 Specifiche con Analisi Approfondita */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-400" />
              <span>Analisi dei 5 Componenti Chiave</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Schermo */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Schermo</span>
                  </span>
                  <SpecIndicator level={product.specs.screen.indicator} />
                </div>
                <div className="text-sm font-bold text-white">{product.specs.screen.value}</div>
                {product.specs.screen.note && (
                  <div className="text-[11px] text-slate-400 italic">{product.specs.screen.note}</div>
                )}
              </div>

              {/* Scheda Video */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Scheda Grafica</span>
                  </span>
                  <SpecIndicator level={product.specs.gpu.indicator} />
                </div>
                <div className="text-sm font-bold text-emerald-300">{product.specs.gpu.value}</div>
                {product.specs.gpu.note && (
                  <div className="text-[11px] text-slate-400 italic">{product.specs.gpu.note}</div>
                )}
              </div>

              {/* Processore */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    <span>Processore</span>
                  </span>
                  <SpecIndicator level={product.specs.cpu.indicator} />
                </div>
                <div className="text-sm font-bold text-white">{product.specs.cpu.value}</div>
                {product.specs.cpu.note && (
                  <div className="text-[11px] text-slate-400 italic">{product.specs.cpu.note}</div>
                )}
              </div>

              {/* RAM */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <RamIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>RAM Memoria</span>
                  </span>
                  <SpecIndicator level={product.specs.ram.indicator} />
                </div>
                <div className="text-sm font-bold text-white">{product.specs.ram.value}</div>
                {product.specs.ram.note && (
                  <div className="text-[11px] text-slate-400 italic">{product.specs.ram.note}</div>
                )}
              </div>

              {/* SSD */}
              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-teal-400" />
                    <span>Archiviazione SSD</span>
                  </span>
                  <SpecIndicator level={product.specs.ssd.indicator} />
                </div>
                <div className="text-sm font-bold text-white">{product.specs.ssd.value}</div>
                {product.specs.ssd.note && (
                  <div className="text-[11px] text-slate-400 italic">{product.specs.ssd.note}</div>
                )}
              </div>

            </div>
          </div>

          {/* Dettagli Top e Flop a confronto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Top */}
            <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/30 p-4">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Punti di Forza & Chicche</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-200 pl-4 list-disc marker:text-emerald-400">
                {product.topHighlights.map((item, i) => (
                  <li key={i} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>

            {/* Flop */}
            <div className="rounded-2xl bg-rose-950/40 border border-rose-500/30 p-4">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Difetti & Compromessi da Sapere</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-200 pl-4 list-disc marker:text-rose-400">
                {product.flopWarnings.map((item, i) => (
                  <li key={i} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* Scheda Identikit */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-bold text-orange-400">🎯 Ideale per:</span>
              <span className="text-slate-300 font-medium">{product.idealFor}</span>
            </div>
            {product.weight && (
              <div className="flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Peso:</span>
                <span className="text-white font-semibold">{product.weight}</span>
              </div>
            )}
            {product.warranty && (
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Garanzia:</span>
                <span className="text-white font-semibold">{product.warranty}</span>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer with Direct Outbound Affiliate CTA */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 font-medium">Prezzo attuale verificato:</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{product.price} €</span>
              {valueFraming.referencePrice && (
                <span className="text-sm text-slate-500 line-through">
                  {valueFraming.isSourced ? 'Listino' : 'Tipico'} {valueFraming.referencePrice} €
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
            >
              Chiudi
            </button>

            <a
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-xl shadow-orange-500/25 hover:scale-[1.02] transition-all"
            >
              <span>Vedi Offerta su {product.store}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
