import { Product, SpecTagCategory, SpecTagSelection } from '../types/product';
import { CPU_BENCHMARKS, GPU_BENCHMARKS } from '../data/hardwareBenchmarks';

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

export interface WeightBucket {
  index: number;
  label: string;
  maxKg: number;
}

const WEIGHT_BUCKETS: WeightBucket[] = [
  { index: 0, label: '< 2 kg', maxKg: 2 },
  { index: 1, label: '< 2.5 kg', maxKg: 2.5 },
  { index: 2, label: '< 3 kg', maxKg: 3 },
  { index: 3, label: '3 kg+', maxKg: Infinity },
];

/** Peso in kg da una stringa tipo "2.40 kg", o null se assente/non interpretabile. */
export function parseWeightKg(value?: string): number | null {
  if (!value) return null;
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

export function weightBucketFor(value?: string): WeightBucket | null {
  const kg = parseWeightKg(value);
  if (kg === null) return null;
  return WEIGHT_BUCKETS.find((b) => kg < b.maxKg) ?? WEIGHT_BUCKETS[WEIGHT_BUCKETS.length - 1];
}

/** Applica il punteggio reale da benchmark se la famiglia è in tabella, altrimenti
 * tiene la stima euristica passata come fallback (finché qualcuno non aggiunge il
 * dato reale in hardwareBenchmarks.ts). */
function withBenchmark(table: Record<string, number>, label: string, fallbackRank: number): ParsedTag {
  if (label in table) {
    return { label, rank: table[label], sourced: true };
  }
  return { label, rank: fallbackRank, sourced: false };
}

export function parseCpuTag(value: string): ParsedTag {
  let m = value.match(/Core\s+Ultra\s+([579])/i);
  if (m) return withBenchmark(CPU_BENCHMARKS, `Core Ultra ${m[1]}`, 40 + parseInt(m[1], 10));

  m = value.match(/\bi([3579])\b/i);
  if (m) return withBenchmark(CPU_BENCHMARKS, `Intel i${m[1]}`, 30 + parseInt(m[1], 10));

  m = value.match(/Ryzen\s+([3579])/i);
  if (m) return withBenchmark(CPU_BENCHMARKS, `Ryzen ${m[1]}`, 30 + parseInt(m[1], 10));

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0, sourced: false };
}

export function parseGpuTag(value: string): ParsedTag {
  let m = value.match(/RTX\s?(\d{3,4})/i);
  if (m) return withBenchmark(GPU_BENCHMARKS, `RTX ${m[1]}`, 40 + parseInt(m[1], 10) / 100);

  m = value.match(/GTX\s?(\d{3,4})/i);
  if (m) return withBenchmark(GPU_BENCHMARKS, `GTX ${m[1]}`, 15 + parseInt(m[1], 10) / 100);

  m = value.match(/Quadro\s?([A-Za-z0-9]+)/i);
  if (m) return withBenchmark(GPU_BENCHMARKS, `Quadro ${m[1]}`, 16);

  m = value.match(/Radeon\s?(\d{3}[A-Za-z]?)/i);
  if (m) return withBenchmark(GPU_BENCHMARKS, `Radeon ${m[1]}`, 15 + parseInt(m[1], 10) / 100);

  if (/Iris\s?Xe/i.test(value)) return withBenchmark(GPU_BENCHMARKS, 'Iris Xe', 11);
  if (/Radeon/i.test(value)) return withBenchmark(GPU_BENCHMARKS, 'Radeon integrata', 15);
  if (/UHD Graphics/i.test(value)) return withBenchmark(GPU_BENCHMARKS, 'UHD Graphics', 6);

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0, sourced: false };
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
      return weightBucketFor(p.weight)?.index ?? -1;
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
      const bucket = weightBucketFor(p.weight);
      if (bucket) map.set(bucket.index, { value: bucket.index, label: bucket.label, rank: bucket.index });
    } else {
      const tag = category === 'cpu' ? parseCpuTag(p.specs.cpu.value) : parseGpuTag(p.specs.gpu.value);
      map.set(tag.label, { value: tag.label, label: tag.label, rank: tag.rank, sourced: tag.sourced });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rank - b.rank);
}
