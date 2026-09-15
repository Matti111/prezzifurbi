import { Product, SpecTagCategory, SpecTagSelection } from '../types/product';

export interface ParsedTag {
  label: string;
  rank: number;
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

export function parseCpuTag(value: string): ParsedTag {
  let m = value.match(/Core\s+Ultra\s+([579])/i);
  if (m) return { label: `Core Ultra ${m[1]}`, rank: 400 + parseInt(m[1], 10) };

  m = value.match(/\bi([3579])\b/i);
  if (m) return { label: `Intel i${m[1]}`, rank: 300 + parseInt(m[1], 10) };

  m = value.match(/Ryzen\s+([3579])/i);
  if (m) return { label: `Ryzen ${m[1]}`, rank: 300 + parseInt(m[1], 10) };

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0 };
}

export function parseGpuTag(value: string): ParsedTag {
  let m = value.match(/RTX\s?(\d{3,4})/i);
  if (m) return { label: `RTX ${m[1]}`, rank: 1000 + parseInt(m[1], 10) };

  m = value.match(/GTX\s?(\d{3,4})/i);
  if (m) return { label: `GTX ${m[1]}`, rank: 500 + parseInt(m[1], 10) };

  m = value.match(/Quadro\s?([A-Za-z0-9]+)/i);
  if (m) return { label: `Quadro ${m[1]}`, rank: 700 };

  m = value.match(/Radeon\s?(\d{3}[A-Za-z]?)/i);
  if (m) return { label: `Radeon ${m[1]}`, rank: 200 + parseInt(m[1], 10) / 10 };

  if (/Iris\s?Xe/i.test(value)) return { label: 'Iris Xe', rank: 100 };
  if (/Radeon/i.test(value)) return { label: 'Radeon integrata', rank: 150 };
  if (/UHD Graphics/i.test(value)) return { label: 'UHD Graphics', rank: 50 };

  return { label: value.split(' ').slice(0, 2).join(' '), rank: 0 };
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
    } else {
      const tag = category === 'cpu' ? parseCpuTag(p.specs.cpu.value) : parseGpuTag(p.specs.gpu.value);
      map.set(tag.label, { value: tag.label, label: tag.label, rank: tag.rank });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rank - b.rank);
}
