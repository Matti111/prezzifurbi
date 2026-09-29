import React from 'react';

interface SeoIntroProps {
  onOpenHowItWorks: () => void;
}

/**
 * Testo descrittivo sotto il catalogo: non sostituisce "Come Funziona" (il
 * modal resta la spiegazione completa), serve a dare a chi legge la pagina
 * (utente o motore di ricerca) un contesto scritto di cosa fa il sito, senza
 * doverlo dedurre dall'interfaccia filtri. Deliberatamente breve (punto 10
 * del documento SEO utente: "non trasformare la homepage in un muro di testo").
 */
export const SeoIntro: React.FC<SeoIntroProps> = ({ onOpenHowItWorks }) => {
  return (
    <section className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-900 text-xs sm:text-sm text-slate-400 leading-relaxed space-y-4 max-w-3xl">
      <h2 className="text-sm sm:text-base font-black text-white">
        Cos'è Prezzi Furbi
      </h2>
      <p>
        Prezzi Furbi confronta ogni notte le offerte di notebook e PC portatili su{' '}
        <strong className="text-slate-300">eBay, Amazon e MediaWorld</strong>, estrae le specifiche
        reali (schermo, GPU, CPU, RAM, storage) dal titolo e dalla descrizione di ogni annuncio, e le
        normalizza in un formato comparabile — così puoi confrontare due notebook di venditori diversi
        senza dover decifrare sigle o titoli scritti in maiuscolo.
      </p>
      <p>
        <strong className="text-slate-300">Non guardiamo lo sconto dichiarato dal negozio, guardiamo il valore reale.</strong>{' '}
        Una percentuale di sconto si può gonfiare a piacere con un prezzo di listino inventato; il
        rapporto tra le specifiche vere e il prezzo pagato no. Per questo i tre timbri —{' '}
        <strong className="text-slate-300">🦊 Scelta Furba</strong> (il miglior rapporto qualità/prezzo),{' '}
        <strong className="text-slate-300">⚡ Best Buy</strong> (la massima potenza a un prezzo onesto) e{' '}
        <strong className="text-slate-300">🏷️ Cheaper</strong> (il prezzo minimo che rispetta comunque
        standard di qualità veri) — si basano solo su specifiche e prezzo pagato, mai su uno sconto
        percentuale. Quando un prezzo di listino compare, è perché il negozio lo dichiara davvero
        (es. "più basso ultimi 30 giorni"), altrimenti mostriamo un prezzo tipico calcolato sulla
        mediana di prodotti comparabili nello stesso catalogo.
      </p>
      <p>
        Prezzo e disponibilità vengono ricontrollati ogni notte; ogni scheda mostra un indicatore di
        freschezza del dato (verde/giallo/rosso in base a quanto tempo fa è stato verificato).{' '}
        <button
          onClick={onOpenHowItWorks}
          className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-2"
        >
          Leggi la guida completa al metodo →
        </button>
      </p>
    </section>
  );
};
