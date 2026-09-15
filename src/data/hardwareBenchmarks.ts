/**
 * Indici di prestazione relativa (circa 0-100) per famiglia di CPU/GPU, presi dal
 * "Perf. Rating" di NotebookCheck.net - Mobile Graphics Cards / Mobile Processors
 * Benchmark List (consultato il 16/09/2026), che aggrega benchmark reali (3DMark,
 * Cinebench, ecc.) su hardware effettivamente testato in laptop.
 *
 * Le famiglie non ancora presenti in tabella usano una stima approssimativa nel
 * parser (vedi specTags.ts) finché non viene aggiunto il valore reale qui.
 */

export const GPU_BENCHMARKS: Record<string, number> = {
  'RTX 5090': 85,
  'RTX 5080': 78,
  'RTX 5070': 65,
  'RTX 5060': 52,
  'RTX 5050': 42,
  'RTX 4090': 72,
  'RTX 4080': 69,
  'RTX 4070': 57,
  'RTX 4060': 53,
  'RTX 4050': 45,
  'RTX 3080': 48,
  'RTX 3070': 49,
  'RTX 3060': 41,
  'RTX 3050': 25,
  'GTX 1650': 24,
  'Quadro T2000': 17,
  'Quadro P620': 14,
  'Radeon 780M': 22,
  'Radeon 680M': 18,
  'Radeon integrata': 15,
  'Iris Xe': 11,
  'UHD Graphics': 6,
};

/**
 * A differenza delle GPU (dove "RTX 4060" già identifica da solo famiglia+generazione),
 * per le CPU la stessa etichetta ("Intel i7") copre chip di generazioni molto diverse
 * con prestazioni reali molto distanti (un i7 di 10a gen ~33 contro un i7 di 13a/14a
 * gen ~52). Per questo il punteggio è indicizzato per fascia di generazione: la label
 * del tag resta "Intel i7" (per non moltiplicare i pulsanti filtro), ma il punteggio
 * usato per ordinamento e grafico riflette la generazione reale del chip.
 *
 * Chiave: "<famiglia>|<fascia>". Fasce: legacy (8a/9a gen o Ryzen serie 4000/5000
 * "vecchio corso"), 10-11 (10a/11a gen), 12 (12a gen), 13-14 (13a/14a gen), 7000
 * (Ryzen serie 7000).
 */
export const CPU_GEN_BENCHMARKS: Record<string, number> = {
  'Intel i3|legacy': 14,
  'Intel i5|legacy': 19,
  'Intel i7|legacy': 25,
  'Intel i9|legacy': 28,
  'Intel i3|10-11': 24,
  'Intel i5|10-11': 31,
  'Intel i7|10-11': 33,
  'Intel i9|10-11': 38,
  'Intel i3|12': 35,
  'Intel i5|12': 45,
  'Intel i7|12': 50,
  'Intel i9|12': 56,
  'Intel i3|13-14': 40,
  'Intel i5|13-14': 50,
  'Intel i7|13-14': 52,
  'Intel i9|13-14': 61,
  'Core Ultra 5|na': 46,
  'Core Ultra 7|na': 48,
  'Core Ultra 9|na': 50,
  'Ryzen 3|legacy': 18,
  'Ryzen 5|legacy': 34,
  'Ryzen 7|legacy': 36,
  'Ryzen 9|legacy': 40,
  'Ryzen 3|7000': 20,
  'Ryzen 5|7000': 47,
  'Ryzen 7|7000': 48,
  'Ryzen 9|7000': 51,
};

export const BENCHMARK_SOURCE = 'NotebookCheck.net – Mobile GPU/CPU Benchmark List';
