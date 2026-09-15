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

export const CPU_BENCHMARKS: Record<string, number> = {
  'Intel i9': 61,
  'Intel i7': 52,
  'Intel i5': 46,
  'Intel i3': 35,
  'Ryzen 9': 51,
  'Ryzen 7': 48,
  'Ryzen 5': 42,
  'Ryzen 3': 20,
  'Core Ultra 9': 50,
  'Core Ultra 7': 48,
  'Core Ultra 5': 46,
};

export const BENCHMARK_SOURCE = 'NotebookCheck.net – Mobile GPU/CPU Benchmark List';
