import { useState, useMemo } from 'react';
import { Product, FilterState, StampType, SpecKey } from './types/product';
import rawProducts from './data/products.json';
import { Navbar } from './components/Navbar';
import { FiltersBar } from './components/FiltersBar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { AffiliateDisclaimer } from './components/AffiliateDisclaimer';
import { productMatchesSelection } from './utils/specTags';
import { Shield, Flame, CheckCircle2 } from 'lucide-react';

const products = rawProducts as Product[];

const initialFilters: FilterState = {
  searchQuery: '',
  stamp: 'all',
  category: 'all',
  condition: 'all',
  maxPrice: 1200,
  specTags: {},
  gpuFilter: 'all',
  sortBy: 'deal_score',
};

export function App() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  // Determine which spec row should be highlighted in green across cards
  const highlightedSpec: SpecKey = useMemo(() => {
    if (filters.sortBy === 'cpu') return 'cpu';
    if (filters.sortBy === 'ram') return 'ram';
    if (filters.sortBy === 'ssd') return 'ssd';
    return 'gpu';
  }, [filters.sortBy]);

  // Prodotti filtrati per tutto tranne prezzo e tag di specifica: è la base su cui
  // i tag sotto lo slider del budget calcolano disponibilità e prezzo minimo, così
  // restano stabili mentre l'utente sposta lo slider o seleziona i tag stessi.
  const baseFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchBrand = p.brand.toLowerCase().includes(q);
        const matchModel = p.model.toLowerCase().includes(q);
        const matchGpu = p.specs.gpu.value.toLowerCase().includes(q);
        const matchCpu = p.specs.cpu.value.toLowerCase().includes(q);
        if (!matchTitle && !matchBrand && !matchModel && !matchGpu && !matchCpu) {
          return false;
        }
      }

      // Stamp filter
      if (filters.stamp !== 'all' && p.stamp !== filters.stamp) {
        return false;
      }

      // Condition filter
      if (filters.condition !== 'all' && p.condition !== filters.condition) {
        return false;
      }

      // Category
      if (filters.category !== 'all' && p.category !== filters.category) {
        return false;
      }

      return true;
    });
  }, [filters.searchQuery, filters.stamp, filters.condition, filters.category]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return baseFilteredProducts
      .filter((p) => {
        // Max Price
        if (p.price > filters.maxPrice) {
          return false;
        }

        // Tag di specifica (CPU/RAM/SSD/GPU)
        if (!productMatchesSelection(p, filters.specTags)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'price_asc') {
          return a.price - b.price;
        }
        if (filters.sortBy === 'price_desc') {
          return b.price - a.price;
        }

        // Sort by GPU Power
        if (filters.sortBy === 'gpu') {
          const gpuScore = (p: Product) => {
            if (p.specs.gpu.indicator === 'double_up') return 100;
            if (p.specs.gpu.indicator === 'up') return 70;
            if (p.specs.gpu.indicator === 'neutral') return 40;
            return 10;
          };
          return gpuScore(b) - gpuScore(a) || a.price - b.price;
        }

        // Sort by CPU Power
        if (filters.sortBy === 'cpu') {
          const cpuScore = (p: Product) => {
            if (p.specs.cpu.indicator === 'double_up') return 100;
            if (p.specs.cpu.indicator === 'up') return 70;
            if (p.specs.cpu.indicator === 'neutral') return 40;
            return 10;
          };
          return cpuScore(b) - cpuScore(a) || a.price - b.price;
        }

        // Sort by RAM Capacity
        if (filters.sortBy === 'ram') {
          const ramVal = (p: Product) => {
            const m = p.specs.ram.value.match(/(\d+)\s*GB/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          return ramVal(b) - ramVal(a) || a.price - b.price;
        }

        // Sort by SSD Capacity
        if (filters.sortBy === 'ssd') {
          const ssdVal = (p: Product) => {
            if (p.specs.ssd.value.includes('1 TB') || p.specs.ssd.value.includes('1TB')) return 1024;
            if (p.specs.ssd.value.includes('512')) return 512;
            if (p.specs.ssd.value.includes('256')) return 256;
            return 128;
          };
          return ssdVal(b) - ssdVal(a) || a.price - b.price;
        }

        // Default: 'deal_score'
        const stampWeight: Record<StampType, number> = {
          scelta_furba: 40,
          best_buy: 30,
          cheaper_good: 25,
          nessuno: 0,
        };
        const scoreA = stampWeight[a.stamp] + a.rating * 10 - (a.price / 80);
        const scoreB = stampWeight[b.stamp] + b.rating * 10 - (b.price / 80);
        return scoreB - scoreA;
      });
  }, [baseFilteredProducts, filters.maxPrice, filters.specTags, filters.sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white w-full max-w-full overflow-x-hidden">
      
      {/* Navbar */}
      <Navbar
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => handleFilterChange({ searchQuery: q })}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        totalDeals={products.length}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-5 pb-6 sm:pt-7 sm:pb-8 border-b border-slate-900 bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-56 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-2.5 sm:space-y-3">
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              <span>🦊</span>
              <span>Confronto Notebook Trasparente Senza Fregature</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight px-1">
              Compra con la furbizia di chi <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                conosce davvero l'hardware.
              </span>
            </h1>

            {/* Quick Feature Badges */}
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>3 Timbri Intelligenti</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Frecce Benchmark</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                <Shield className="w-3 h-3 text-sky-400" />
                <span>Stato & Colore da Nuovo a Usato</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 w-full overflow-hidden">
        
        {/* Filters and Controls */}
        <FiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          resultCount={filteredProducts.length}
          productsForTags={baseFilteredProducts}
        />

        {/* Product Cards Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                highlightedSpec={highlightedSpec}
                onSelect={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 sm:py-20 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3 sm:space-y-4 px-4">
            <span className="text-4xl sm:text-5xl select-none">🦊</span>
            <h3 className="text-lg sm:text-xl font-bold text-white">Nessun portatile trovato</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Nessuna offerta corrisponde ai filtri selezionati. Prova a modificare i parametri di ricerca o ad azzerare i filtri.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all"
            >
              Azzera tutti i filtri
            </button>
          </div>
        )}

      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* How it works Guide Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      {/* Affiliate Compliance & Footer */}
      <AffiliateDisclaimer
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
      />

    </div>
  );
}
