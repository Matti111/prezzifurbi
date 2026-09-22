import { ShieldCheck, HeartHandshake, Eye } from 'lucide-react';

interface AffiliateDisclaimerProps {
  onOpenHowItWorks: () => void;
}

export const AffiliateDisclaimer: React.FC<AffiliateDisclaimerProps> = ({ onOpenHowItWorks }) => {
  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-slate-950/90 py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Value Proposition & Brand Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8 border-b border-slate-800">
          
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 flex-shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">Trasparenza Totale sui Difetti</h4>
              <p className="leading-relaxed">
                Nessun computer è perfetto. Segnaliamo i difetti (FLOP in rosso) con la stessa precisione dei pregi (TOP in verde), così compri sapendo cosa aspettarti.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">Solo Offerte Reali Verificate</h4>
              <p className="leading-relaxed">
                Niente prezzi civetta o sconti finti. Confrontiamo costantemente il mercato del ricondizionato garantito e del nuovo per trovare le vere occasioni.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">Come Guadagniamo (Affiliazioni)</h4>
              <p className="leading-relaxed">
                Quando acquisti tramite i nostri link, riceviamo una piccola commissione dai negozi partner. Il prezzo per te non cambia mai di un centesimo.
              </p>
            </div>
          </div>

        </div>

        {/* Legal Disclaimer compliant with Awin / Amazon / eBay guidelines */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] leading-relaxed text-slate-400 space-y-2">
          <p>
            <strong>Informativa di Trasparenza sulle Affiliazioni Commerciali:</strong> Prezzi Furbi (prezzifurbi.it) partecipa a vari programmi di affiliazione, tra cui il Programma Affiliazione Awin (MediaWorld, Unieuro, Euronics), eBay Partner Network e Amazon EU Associates, programmi che consentono ai siti web di percepire una commissione pubblicitaria promuovendo e creando collegamenti a offerte verificate.
          </p>
          <p>
            Le schede comparative, i timbri («Scelta Furba», «Best Buy», «Cheaper but Good») e le valutazioni a stelle sono formulati in modo totalmente indipendente dalla redazione sulla base delle specifiche tecniche oggettive e del prezzo effettivo di mercato. I prezzi e le disponibilità dei prodotti sono soggetti a variazioni da parte dei rispettivi venditori terzi.
          </p>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 text-slate-500 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-base select-none">🦊</span>
            <span>© {new Date().getFullYear()} Prezzi Furbi. Tutti i diritti riservati.</span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenHowItWorks} 
              className="hover:text-orange-400 transition-colors"
            >
              Guida ai Timbri & Frecce
            </button>
            <span>•</span>
            <a href="#privacy" className="hover:text-orange-400 transition-colors">
              Privacy & Cookie Policy
            </a>
            <span>•</span>
            <a href="mailto:info@prezzifurbi.it" className="hover:text-orange-400 transition-colors">
              Contatti
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
