import { Product, UseCase } from '../types/product';
import { parseCpuTag, parseGpuTag, parseRamGB, parseSsdGB } from './specTags';

/**
 * "Non guardiamo lo sconto, guardiamo il valore": queste funzioni non usano mai
 * la percentuale di sconto dichiarata dal negozio. Il valore/l'occasione si
 * misurano sulle specifiche reali (benchmark CPU/GPU, RAM, SSD) relative al
 * prezzo, sempre nel contesto di prodotti comparabili — mai sul catalogo intero.
 */

const MIN_COMPARABLES_FOR_TYPICAL_PRICE = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Due prodotti sono "comparabili" se hanno lo stesso tier reale di CPU/GPU
 * (stessa famiglia/generazione) e la stessa fascia di RAM/SSD. */
function comparableKey(p: Product): string {
  const cpu = parseCpuTag(p.specs.cpu.value).label;
  const gpu = parseGpuTag(p.specs.gpu.value).label;
  const ramGB = parseRamGB(p.specs.ram.value);
  const ssdGB = parseSsdGB(p.specs.ssd.value);
  return `${cpu}|${gpu}|${ramGB}|${ssdGB}`;
}

/**
 * Prezzo tipico per un prodotto, calcolato come mediana dei prezzi di altri
 * prodotti comparabili nel pool dato (già filtrato per contesto dal chiamante).
 * Ritorna null se non ci sono abbastanza dati — non si inventa mai un prezzo
 * tipico da un campione troppo piccolo.
 */
export function computeTypicalPrice(pool: Product[], product: Product): number | null {
  const key = comparableKey(product);
  const comparablePrices = pool
    .filter((p) => p.id !== product.id && comparableKey(p) === key)
    .map((p) => p.price);

  if (comparablePrices.length < MIN_COMPARABLES_FOR_TYPICAL_PRICE - 1) return null;
  return Math.round(median([...comparablePrices, product.price]));
}

export interface ValueFraming {
  /** Prezzo di riferimento da mostrare come "prezzo tipico", se disponibile. */
  referencePrice: number | null;
  /** true se referencePrice viene da un prezzo di listino reale dichiarato
   * dal negozio (es. MediaWorld "più basso ultimi 30gg"), false se calcolato
   * come mediana di prodotti comparabili nel catalogo. */
  isSourced: boolean;
  savings: number | null;
}

/** Non fabbrica mai un risparmio: usa prima un originalPrice reale (dichiarato
 * dalla fonte), altrimenti un prezzo tipico calcolato sul pool contestuale
 * (solo se ci sono abbastanza comparabili), altrimenti nessun risparmio mostrato. */
export function getValueFraming(pool: Product[], product: Product): ValueFraming {
  if (product.originalPrice && product.originalPrice > product.price) {
    return {
      referencePrice: product.originalPrice,
      isSourced: true,
      savings: product.originalPrice - product.price,
    };
  }

  const typical = computeTypicalPrice(pool, product);
  if (typical !== null && typical > product.price) {
    return { referencePrice: typical, isSourced: false, savings: typical - product.price };
  }

  return { referencePrice: null, isSourced: false, savings: null };
}

/** Le 5 caratteristiche chiave come "punteggi" comparabili (più alto = meglio). */
function specTiers(p: Product) {
  return {
    cpu: parseCpuTag(p.specs.cpu.value).rank,
    gpu: parseGpuTag(p.specs.gpu.value).rank,
    ram: parseRamGB(p.specs.ram.value),
    ssd: parseSsdGB(p.specs.ssd.value),
  };
}

/**
 * Ritorna il prodotto che domina `product` nel `pool` dato (stesso contesto di
 * ricerca, mai il catalogo intero), o null se non dominato. Un prodotto A
 * domina B se A costa uguale o meno E non è peggiore di B su nessuna delle 4
 * specifiche chiave (CPU/GPU/RAM/SSD), con almeno un miglioramento netto (su
 * specifiche o prezzo) per evitare di considerare "dominati" due prodotti
 * identici. La dominanza NON elimina il prodotto: va solo ripiegato come
 * alternativa (vedi App.tsx).
 */
export function findDominator(product: Product, pool: Product[]): Product | null {
  const tiersB = specTiers(product);

  for (const candidate of pool) {
    if (candidate.id === product.id) continue;
    if (candidate.condition !== product.condition) continue; // nuovo vs usato non è un confronto equo
    if (candidate.price > product.price) continue;

    const tiersA = specTiers(candidate);
    const notWorse =
      tiersA.cpu >= tiersB.cpu && tiersA.gpu >= tiersB.gpu && tiersA.ram >= tiersB.ram && tiersA.ssd >= tiersB.ssd;
    if (!notWorse) continue;

    const strictlyBetter =
      candidate.price < product.price ||
      tiersA.cpu > tiersB.cpu ||
      tiersA.gpu > tiersB.gpu ||
      tiersA.ram > tiersB.ram ||
      tiersA.ssd > tiersB.ssd;
    if (strictlyBetter) return candidate;
  }

  return null;
}

/**
 * La volpe è rara per definizione (punto 8 del documento): non basta che il
 * backend abbia assegnato "scelta_furba"/"best_buy" su soglie assolute, deve
 * anche essere tra le migliori occasioni per almeno uno dei suoi stessi
 * useCases, confrontato con gli altri prodotti che condividono quel tag nel
 * catalogo (non nel sottoinsieme filtrato dall'utente: la volpe è una
 * proprietà stabile del prodotto, non cambia mentre l'utente filtra).
 */
export function qualifiesForFox(product: Product, fullCatalog: Product[]): UseCase | null {
  if (product.stamp !== 'scelta_furba' && product.stamp !== 'best_buy') return null;

  for (const useCase of product.useCases) {
    const peers = fullCatalog.filter((p) => p.useCases.includes(useCase));
    if (peers.length < 4) continue; // troppo pochi prodotti per un confronto significativo

    const tiersB = specTiers(product);
    const valueDensity = (p: Product) => {
      const t = specTiers(p);
      return (t.cpu + t.gpu * 1.3 + t.ram * 0.3 + t.ssd * 0.01) / Math.max(p.price, 1);
    };
    const myDensity = valueDensity(product);
    const better = peers.filter((p) => valueDensity(p) > myDensity).length;
    const percentile = better / peers.length;

    if (percentile <= 0.15) return useCase; // tra il 15% più conveniente per questo utilizzo
  }

  return null;
}

export type FreshnessLevel = 'green' | 'yellow' | 'red';

/** Soglie volutamente permissive (vedi documento): un dato non deve diventare
 * "vecchio" troppo in fretta solo perché non tutte le fonti si aggiornano
 * alla stessa frequenza. */
export function freshnessLevel(lastUpdated?: string): FreshnessLevel {
  if (!lastUpdated) return 'yellow';
  const days = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 10) return 'green';
  if (days < 30) return 'yellow';
  return 'red';
}
