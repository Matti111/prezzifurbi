export type IndicatorLevel = 'double_up' | 'up' | 'neutral' | 'down';

export type StampType = 'scelta_furba' | 'best_buy' | 'cheaper_good' | 'nessuno';

export type ConditionType = 'Nuovo' | 'Ricondizionato' | 'Usato';

/** Utilizzi per cui il prodotto è adatto, derivati dalle specifiche reali (mai
 * da un punteggio unico): un prodotto può averne più di uno contemporaneamente. */
export type UseCase = 'gaming' | 'creativita' | 'programmazione' | 'studio' | 'lavoro' | 'home';

export interface PriceHistoryEntry {
  price: number;
  date: string; // ISO
}

export type SpecKey = 'screen' | 'gpu' | 'cpu' | 'ram' | 'ssd';

export interface SpecItem {
  value: string;
  indicator: IndicatorLevel;
  note?: string;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: 'gaming_ai' | 'lavoro_ufficio' | 'budget_studenti';
  useCases: UseCase[];
  condition: ConditionType;
  price: number;
  originalPrice?: number;
  store: string;
  affiliateUrl: string;
  imageUrl: string;
  rating: number; // 0 to 5 (es. 4.8)
  stamp: StampType;
  stampRationale: string;
  lastUpdated?: string; // ISO date, per il semaforo di freschezza
  priceHistory?: PriceHistoryEntry[];
  specs: {
    screen: SpecItem;
    gpu: SpecItem;
    cpu: SpecItem;
    ram: SpecItem;
    ssd: SpecItem;
  };
  topHighlights: string[]; // Chicche e vantaggi in verde
  topComment?: string;
  flopWarnings: string[];  // Difetti e compromessi in rosso
  flopComment?: string;
  idealFor: string;
  weight?: string;
  warranty?: string;
}

export type SortOption = 'price_asc' | 'price_desc' | 'gpu' | 'cpu' | 'ram' | 'ssd' | 'deal_score';

export type SpecTagCategory = 'cpu' | 'ram' | 'ssd' | 'gpu' | 'screen' | 'weight';
export type SpecTagSelection = Partial<Record<SpecTagCategory, string | number>>;

export interface FilterState {
  searchQuery: string;
  stamp: StampType | 'all';
  category: 'all' | 'gaming_ai' | 'lavoro_ufficio' | 'budget_studenti';
  useCases: UseCase[]; // vuoto = nessun filtro (tutti gli utilizzi)
  condition: 'all' | ConditionType;
  maxPrice: number;
  specTags: SpecTagSelection;
  gpuFilter: string;
  sortBy: SortOption;
}
