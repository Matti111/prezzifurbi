export type IndicatorLevel = 'double_up' | 'up' | 'neutral' | 'down';

export type StampType = 'scelta_furba' | 'best_buy' | 'cheaper_good' | 'nessuno';

export type ConditionType = 'Nuovo' | 'Ricondizionato' | 'Usato';

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
  condition: ConditionType;
  price: number;
  originalPrice?: number;
  store: string;
  affiliateUrl: string;
  imageUrl: string;
  rating: number; // 0 to 5 (es. 4.8)
  stamp: StampType;
  stampRationale: string;
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

export type SpecTagCategory = 'cpu' | 'ram' | 'ssd' | 'gpu';
export type SpecTagSelection = Partial<Record<SpecTagCategory, string | number>>;

export interface FilterState {
  searchQuery: string;
  stamp: StampType | 'all';
  category: 'all' | 'gaming_ai' | 'lavoro_ufficio' | 'budget_studenti';
  condition: 'all' | ConditionType;
  maxPrice: number;
  specTags: SpecTagSelection;
  gpuFilter: string;
  sortBy: SortOption;
}
