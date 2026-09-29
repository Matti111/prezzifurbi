import { Product, SpecTagCategory, SpecTagSelection, RangeFilter } from '../types/product';
import { CPU_GEN_BENCHMARKS, GPU_BENCHMARKS } from '../data/hardwareBenchmarks';

export interface ParsedTag {
  label: string;
  /** Punteggio di prestazione (circa 0-100): dato reale da benchmark se `sourced`
   * è true, altrimenti una stima approssimativa dedotta dal modello. */
  rank: number;
  sourced: boolean;
}

export function parseRamGB(value: string): number {
  const m = value.match(/(\d+)\s*GB/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function parseSsdGB(value: string): number {
  const tb = value.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tb) return Math.round(parseFloat(tb[1]) * 1024);
  const gb = value.match(/(\d+)\s*GB/i);
  return gb ? parseInt(gb[1], 10) : 0;
}

/** Dimensione schermo in pollici, es. 15.6 da "15.6\" FHD (1920x1080) 144Hz IPS". */
export function parseScreenInches(value: string): number {
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*(?:"|”|pollici|inch)/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** Peso in kg da una stringa tipo "2.40 kg", o null se assente/non interpretabile. */
export function parseWeightKg(value?: string): number | null {
  if (!value) return null;
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/** Applica il punteggio reale da benchmark se la famiglia è in tabella, altrimenti
 * tiene la stima euristica passata come fallback (finché qualcuno non aggiunge il
 * dato reale in hardwareBenchmarks.ts). */
function withFamilyBenchmark(table: Record<string, number>, label: string, fallbackRank: number): ParsedTag {
  if (label in table) {
    return { label, rank: table[label], sourced: true };
  }
  return { label, rank: fallbackRank, sourced: false };
}

/** Come withFamilyBenchmark, ma la chiave in tabella è "<label>|<fascia>": la stessa
 * label CPU (es. "Intel i7") può valere punteggi molto diversi a seconda della
 * generazione del chip, mentre il tag/filtro mostrato resta solo la label. */
function withGenBenchmark(table: Record<string, number>, label: string, bracket: string, fallbackRank: number): ParsedTag {
  const key = `${label}|${bracket}`;
  if (key in table) {
    return { label, rank: table[key], sourced: true };
  }
  return { label, rank: fallbackRank, sourced: false };
}

/** Fascia di generazione: stesso "Intel i7" può valere ~33 (10a gen) o ~52 (13a/14a
 * gen), quindi va dedotta dal modello per pescare il punteggio giusto in tabella
 * (vedi CPU_GEN_BENCHMARKS in hardwareBenchmarks.ts). L'etichetta del tag resta solo
 * "Intel i7": la generazione entra nel punteggio, non moltiplica i pulsanti filtro. */
function intelGeneration(value: string): 'legacy' | '10-11' | '12' | '13-14' {
  if (/i[3579][- ]1[34]\d{3}/i.test(value)) return '13-14';
  if (/i[3579][- ]12\d{3}/i.test(value)) return '12';
  if (/i[3579][- ]1[01]\d{3}/i.test(value)) return '10-11';
  return 'legacy'; // 8a/9a gen o non riconosciuta
}

function ryzenGeneration(value: string): 'legacy' | '7000' {
  return /Ryzen\s+[3579]\s+[5-8]\d{3}/i.test(value) ? '7000' : 'legacy';
}

export function parseCpuTag(value: string): ParsedTag {
  let m = value.match(/Core\s+Ultra\s+([579])/i);
  if (m) return withGenBenchmark(CPU_GEN_BENCHMARKS, `Core Ultra ${m[1]}`, 'na', 40 + parseInt(m[1], 10));

  m = value.match(/\bi([3579])\b/i);
  if (m) return withGenBenchmark(CPU_GEN_BENCHMARKS, `Intel i${m[1]}`, intelGeneration(value), 30 + parseInt(m[1], 10));

  m = value.match(/Ryzen\s+([3579])/i);
  if (m) return withGenBenchmark(CPU_GEN_BENCHMARKS, `Ryzen ${m[1]}`, ryzenGeneration(value), 30 + parseInt(m[1], 10));

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0, sourced: false };
}

export function parseGpuTag(value: string): ParsedTag {
  // GPU workstation "RTX Ada Generation"/"Quadro RTX": stesso numero di una RTX
  // GeForce ma silicio e prestazioni reali diverse (mai la stessa fascia) — vanno
  // riconosciute PRIMA del match RTX generico sotto, altrimenti "RTX 2000 Ada" o
  // "Quadro RTX 3000" finiscono etichettate come una fantomatica "RTX 2000"/"RTX 3000"
  // GeForce che non esiste in nessun listino, con un punteggio stimato gonfiato.
  let m = value.match(/RTX\s?(\d{3,4})[^,]{0,20}\bAda\b/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `RTX ${m[1]} Ada (Workstation)`, 30 + parseInt(m[1], 10) / 200);

  m = value.match(/Quadro\s+RTX\s?(\d{3,4})/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `Quadro RTX ${m[1]} (Workstation)`, 18);

  m = value.match(/RTX\s?(\d{3,4})/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `RTX ${m[1]}`, 40 + parseInt(m[1], 10) / 100);

  m = value.match(/GTX\s?(\d{3,4})/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `GTX ${m[1]}`, 15 + parseInt(m[1], 10) / 100);

  m = value.match(/Quadro\s?([A-Za-z0-9]+)/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `Quadro ${m[1]}`, 16);

  m = value.match(/Radeon\s?(\d{3}[A-Za-z]?)/i);
  if (m) return withFamilyBenchmark(GPU_BENCHMARKS, `Radeon ${m[1]}`, 15 + parseInt(m[1], 10) / 100);

  if (/Iris\s?Xe/i.test(value)) return withFamilyBenchmark(GPU_BENCHMARKS, 'Iris Xe', 11);
  if (/Radeon/i.test(value)) return withFamilyBenchmark(GPU_BENCHMARKS, 'Radeon integrata', 15);
  if (/UHD Graphics/i.test(value)) return withFamilyBenchmark(GPU_BENCHMARKS, 'UHD Graphics', 6);

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0, sourced: false };
}

/** Valori distinti REALMENTE presenti nel pool di prodotti dato (mai un range
 * continuo arbitrario): lo slider di soglia scatta solo su taglie che esistono
 * davvero in catalogo (es. RAM 4/8/16/32GB, mai un generico "9GB" che nessun
 * prodotto ha). Ordinati crescenti; array vuoto se nessun prodotto ha un
 * valore leggibile per questa specifica. */
export function distinctSortedValues(products: Product[], valueOf: (p: Product) => number): number[] {
  const set = new Set<number>();
  for (const p of products) {
    const v = valueOf(p);
    if (v > 0) set.add(v);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Un prodotto soddisfa una soglia min/max se il suo valore rientra nei limiti
 * impostati (lato non impostato = nessun limite). Un valore non riconosciuto (<= 0,
 * es. specifica non estratta dal parser) non può essere confermato entro la soglia,
 * quindi non combacia appena min o max è impostato — stessa cautela già applicata
 * ai tag esatti cpu/gpu, mai un'inclusione ottimistica su un dato mancante. */
export function matchesRange(value: number, range: RangeFilter): boolean {
  if (range.min === null && range.max === null) return true;
  if (value <= 0) return false;
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
}

export function specValueForProduct(p: Product, category: SpecTagCategory): string | number {
  switch (category) {
    case 'ram':
      return parseRamGB(p.specs.ram.value);
    case 'ssd':
      return parseSsdGB(p.specs.ssd.value);
    case 'cpu':
      return parseCpuTag(p.specs.cpu.value).label;
    case 'gpu':
      return parseGpuTag(p.specs.gpu.value).label;
    case 'screen':
      return parseScreenInches(p.specs.screen.value);
    case 'weight':
      return parseWeightKg(p.weight) ?? 0;
  }
}

/** Un prodotto soddisfa la selezione se combacia con ogni categoria selezionata,
 * a parte quella indicata in `ignoreCategory` (usata per valutare le alternative
 * all'interno della stessa categoria già scelta). */
export function productMatchesSelection(
  p: Product,
  selection: SpecTagSelection,
  ignoreCategory?: SpecTagCategory
): boolean {
  return (Object.keys(selection) as SpecTagCategory[]).every((cat) => {
    if (cat === ignoreCategory) return true;
    const val = selection[cat];
    if (val === undefined) return true;
    return specValueForProduct(p, cat) === val;
  });
}

export function isTagAvailable(
  products: Product[],
  selection: SpecTagSelection,
  category: SpecTagCategory,
  value: string | number,
  maxPrice: number
): boolean {
  return products.some((p) => {
    if (p.price > maxPrice) return false;
    if (!productMatchesSelection(p, selection, category)) return false;
    return specValueForProduct(p, category) === value;
  });
}

/** Prezzo minimo per la combinazione attuale, su tutto il catalogo (non limitato
 * dallo slider del budget) - è il valore mostrato nel trattino sullo slider. */
export function minPriceForSelection(products: Product[], selection: SpecTagSelection): number {
  let min = Infinity;
  for (const p of products) {
    if (productMatchesSelection(p, selection) && p.price < min) {
      min = p.price;
    }
  }
  return min;
}

export interface TagOption {
  value: string | number;
  label: string;
  rank: number;
  /** Solo per cpu/gpu: true se `rank` è un punteggio reale da benchmark, false se stimato. */
  sourced?: boolean;
}

export function collectTagOptions(products: Product[], category: SpecTagCategory): TagOption[] {
  if (category === 'cpu' || category === 'gpu') {
    // Il punteggio mostrato per un tag ("Intel i7", "RTX 4060"...) è la media reale
    // dei prodotti effettivamente nel catalogo con quella label, non un valore fisso
    // per famiglia: così riflette sempre le generazioni/modelli davvero in vendita
    // ed è sempre coerente con le frecce mostrate sulle singole card.
    const acc = new Map<string, { sum: number; count: number; sourcedCount: number }>();
    for (const p of products) {
      const tag = category === 'cpu' ? parseCpuTag(p.specs.cpu.value) : parseGpuTag(p.specs.gpu.value);
      const entry = acc.get(tag.label) ?? { sum: 0, count: 0, sourcedCount: 0 };
      entry.sum += tag.rank;
      entry.count += 1;
      if (tag.sourced) entry.sourcedCount += 1;
      acc.set(tag.label, entry);
    }
    return Array.from(acc.entries())
      .map(([label, { sum, count, sourcedCount }]) => ({
        value: label,
        label,
        rank: sum / count,
        sourced: sourcedCount > 0,
      }))
      .sort((a, b) => a.rank - b.rank);
  }

  const map = new Map<string | number, TagOption>();
  for (const p of products) {
    if (category === 'ram') {
      const gb = parseRamGB(p.specs.ram.value);
      if (gb > 0) map.set(gb, { value: gb, label: `${gb} GB`, rank: gb });
    } else if (category === 'ssd') {
      const gb = parseSsdGB(p.specs.ssd.value);
      if (gb > 0) {
        const label = gb >= 1024 ? `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB` : `${gb} GB`;
        map.set(gb, { value: gb, label, rank: gb });
      }
    } else if (category === 'screen') {
      const inches = parseScreenInches(p.specs.screen.value);
      if (inches > 0) map.set(inches, { value: inches, label: `${inches}"`, rank: inches });
    } else if (category === 'weight') {
      const kg = parseWeightKg(p.weight);
      if (kg !== null) map.set(kg, { value: kg, label: `${kg} kg`, rank: kg });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rank - b.rank);
}
