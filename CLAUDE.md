# Prezzi Furbi (prezzifurbi.it)

Portale di comparazione prezzi per notebook/PC (nuovi, ricondizionati, usati), rivolto
a un pubblico italiano che vuole capire il reale rapporto qualità/prezzo prima di
comprare. Repo GitHub: https://github.com/Matti111/prezzifurbi (privato).

## Stack e architettura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind, in `src/`. Card prodotto con
  timbri ("Scelta Furba" 🦊, "Best Buy" ⚡, "Cheaper" 🏷️), tag di utilizzo (Gaming/
  Creatività/Programmazione/Studio/Lavoro/Home), filtri dinamici per specifica
  tecnica e utilizzo, slider budget, confronto benchmark CPU/GPU. In cima al sito
  confronto benchmark CPU/GPU. `ConstructionBanner.tsx` ("Sito in fase di
  aggiornamento..."), aggiunto 2026-09-21, **rimosso il 2026-09-28** su
  richiesta esplicita dell'utente ("tutti i link sono funzionanti") — file e
  import cancellati, non solo nascosto.
  **RAM/Storage/Dimensione schermo: soglia min/max, non più bottoni a valore
  esatto** (2026-09-28, richiesta utente): `FilterState.ramRange/ssdRange/
  screenRange` (`RangeFilter { min: number|null; max: number|null }` in
  `types/product.ts`) sostituiscono quei tre tag da `SpecTagSelection`
  (CPU/GPU/Peso restano bottoni esatti in `FiltersBar.tsx`, non toccati). UI:
  `RangeSliderField` in `FiltersBar.tsx`, due `<input type="range">` impilati
  (soglia min + soglia max) invece di un vero doppio cursore — scelto apposta
  perché più semplice da verificare senza poter far girare Vite in locale su
  questa macchina. **Scatta solo su taglie che esistono davvero in catalogo**
  (2026-09-28, richiesta esplicita dopo il primo giro: uno slider continuo
  poteva far scegliere es. "9GB" di RAM, taglia che nessun prodotto ha):
  `distinctSortedValues()` in `specTags.ts` calcola i valori REALMENTE
  presenti nel pool filtrato corrente (es. RAM `[4,8,16,24,32,64]`) e lo
  slider muove un INDICE su quell'array, non il valore continuo — `min`/`max`
  dell'`<input>` sono `0`/`lastIndex`, mai il valore in GB/pollici stesso.
  `matchesRange()` (invariata): un valore non riconosciuto dal parser (≤0)
  non combacia mai con una soglia attiva (stessa cautela già applicata ai tag
  esatti cpu/gpu).
- **Motore del valore** (2026-09-22, da specifica utente — vedi `src/utils/valuation.ts`):
  principio centrale "non guardiamo lo sconto, guardiamo il valore". Nessuna
  percentuale di sconto viene mai fabbricata: `originalPrice` esiste solo se una
  fonte lo dichiara davvero (es. "più basso ultimi 30gg" di MediaWorld). Quando
  manca, il "prezzo tipico" è la mediana di prodotti comparabili nello stesso
  pool contestuale (mai il catalogo intero), mostrato solo con ≥3 comparabili.
  La volpe 🦊 è rara per design: il backend assegna un timbro candidato su
  soglie assolute (`evaluate_laptop`, **mai sullo sconto**: `best_buy` per
  l'hardware al massimo assoluto, `scelta_furba` per un punteggio di valore
  alto senza essere al vertice), il frontend (`qualifiesForFox`) la mostra
  solo se il prodotto è anche tra il 15% più conveniente per almeno uno dei
  suoi `useCases`. **Simmetrica tra i due timbri candidati** (2026-09-28,
  segnalato dall'utente su un MSI Pulse 17 RTX 4060/i7/64GB/1TB a 823€ — al
  vertice hardware MA anche il più economico della sua fascia, eppure restava
  sempre ⚡ Best Buy): prima solo `scelta_furba` poteva diventare 🦊 (o
  ripiegare su Best Buy se non superava il confronto), un `best_buy` non
  diventava MAI fox nemmeno superando lo stesso identico confronto — ora
  `effectiveStamp` in `ProductCard.tsx`/`ProductDetailModal.tsx` (prima
  quest'ultimo usava il timbro grezzo del backend, badge diverso da quello
  sulla card appena cliccata) è simmetrica: se `qualifiesForFox` passa, il
  prodotto è sempre 🦊 a prescindere dal bucket di partenza. `findDominator`
  calcola la dominanza (stesso pool contestuale): i prodotti dominati non
  spariscono, restano dietro "Mostra alternative". `freshnessLevel` è il
  semaforo 🟢/🟡/🔴 su `lastUpdated`.
  **GPU workstation mai più spacciate per GeForce** (2026-09-28, segnalato
  dall'utente: "confronto prestazioni" mostrava righe fantasma "RTX 3000*/
  2000*/1000*" che non esistono come GPU GeForce). Causa: `extract_gpu()` in
  `test_db.py` e `parseGpuTag()` in `specTags.ts` etichettavano "RTX 2000 Ada"/
  "RTX 1000 Ada" (Nvidia RTX Ada Generation, workstation) e "Quadro RTX 3000"
  (Turing, workstation) come "NVIDIA GeForce RTX 2000/1000/3000 dedicata" —
  un numero che non esiste in nessuna GPU GeForce reale, con un punteggio
  stimato gonfiato di conseguenza. Corretto in entrambi i posti (controllo
  Ada/Quadro RTX **prima** del fallback RTX generico): ora
  "NVIDIA RTX {n} Ada Generation (Workstation)"/"NVIDIA Quadro RTX {n}
  (Workstation)", stima di rank più bassa e onesta (nessun dato reale in
  `GPU_BENCHMARKS`, resta con l'asterisco "*" come tutte le stime non
  sourced). 3 prodotti già in catalogo corretti retroattivamente.
- **Dati**: `src/data/products.json` — il catalogo. Aggiornato in parte a mano, in
  parte automaticamente ogni notte. Ogni prodotto ha `useCases`, `lastUpdated`,
  `priceHistory` (accumulato ad ogni cambio di prezzo reale — nessuna UI dedicata
  ancora, serve a costruire uno storico vero nel tempo).
- **Automazione**: `test_db.py` (Python) — un unico script monolitico che fa tutto:
  - Parser hardware a regex (`extract_screen`, `extract_gpu`, `extract_cpu`,
    `extract_ram`, `extract_ssd`, `extract_weight`) che legge titolo + descrizione +
    "item specifics" e ne deduce le caratteristiche. `extract_cpu` ha un fallback
    per famiglia dichiarata senza numero di modello (es. "i7-16GB", dove 16GB è
    la RAM non un modello CPU) che preserva almeno i5/i7/i9/Ryzen invece di
    ricadere sempre su "Intel Core i5 Multicore" (fix 2026-09-22, ha corretto
    7 prodotti già in catalogo con la CPU sbagliata)
    **Riscrittura estesa di `extract_cpu`/`extract_gpu`/`extract_ram`
    (2026-09-28)**, partita da un solo caso segnalato dall'utente (un Celeron
    N4000 mostrato come "Intel Core i5") ma allargata controllando quanti
    prodotti fossero ancora sul fallback generico i5 — da lì sono emersi molti
    più bug reali, non ipotetici:
    - **Manufacturer sbagliato, non solo modello**: `Celeron`/`Pentium`
      (nessun pattern li intercettava, finivano su "i5"), `AMD A-series`
      ("Radeon A6-9225" → tier 1, prima "i5"), `AMD Ryzen AI` (numerazione
      2024+ a 3 cifre tipo "Ryzen AI 5 340", diversa dai Ryzen classici),
      `Ryzen` abbreviato "R5"/"R7" (alcuni venditori scrivono così invece di
      "Ryzen 5"/"Ryzen 7" per esteso — trovato sul Cyclus, uno dei 4 prodotti
      Amazon curati a mano il 2026-09-21, sbagliato da allora), `Apple
      Silicon M1-M5` (un MacBook mostrava "Intel Core i5" — stesso bug anche
      in `extract_gpu`, "Intel UHD Graphics" per la GPU integrata Apple) e
      `Intel Core M` (chip fanless 2015-2017, tier nettamente più debole di
      un vero i5 ma trattato come tale).
    - **Modello Intel perso per il conteggio cifre**: i regex per gen
      10-14 richiedevano un numero a lunghezza fissa (3 o 5 cifre) — le serie
      U/P/G a basso consumo (4 cifre, es. "1145G7"/"1235U"/"1340P") non
      combaciavano mai e cadevano sul fallback, pur essendo scritte chiare nel
      titolo. Esteso a `\d{2,3}` dopo il prefisso di generazione.
    - **Suffisso "G7" troncato in "G" durante il primo giro di fix sopra**:
      il suffisso letterale `[a-zA-Z]*` non catturava la cifra finale delle
      serie G (es. "1145G7" → "1145G"): nessun suffisso Intel reale finisce
      per lettera nuda senza cifra, quindi diventato `[a-zA-Z]{0,2}\d?`.
    - **Separatore rigido a un carattere**: "I5 - 13420H" (spazio+trattino+
      spazio, es. HP Victus) non combaciava con `[- ]` (un solo carattere) —
      ora `\s*-?\s*`, e valore ricostruito da gruppi separati (famiglia +
      modello) invece di un `.replace(' ', '-')` sull'intero match, che con
      un separatore variabile avrebbe lasciato doppi trattini.
    - **Gen 4a-9a limitata alla sola 8a/9a**: `[89]\d{3}` è diventato
      `[4-9]\d{3}` — 6a/7a gen (es. "i5-6200U", comunissimo tra i
      ricondizionati in catalogo) e 4a/5a (es. "i5-4200U") restavano sul
      fallback pur avendo lo stesso tier 'legacy' già corretto per l'8a/9a.
    - **`extract_ram` non forzava più solo il fallback, ma anche valori VERI**:
      un vecchio whitelist `if gb not in [8,16,24,32,64]: gb = 16` sovrascriveva
      con 16GB qualunque valore realmente estratto ma "non standard" (12GB,
      4GB, 6GB, 20GB...) — non solo il fallback quando NON si trovava nulla.
      Trovato perché un titolo diceva chiaramente "RAM 12GB" e la card mostrava
      16GB. Ora il numero estratto si tiene così com'è, salvo un range di
      sanità 2-128GB (per non scambiare per errore una taglia di storage letta
      dal testo come se fosse RAM).
    Verificato con `evaluate_laptop()` rieseguito su tutti i titoli del
    catalogo (0 eccezioni) prima e dopo ogni giro di modifiche. Corretti
    retroattivamente 46 prodotti già in catalogo (CPU/RAM/GPU/SSD), ognuno
    solo quando il titolo dava un segnale esplicito e verificabile (mai una
    riscrittura totale delle specifiche) — stesso approccio del fix CPU del
    2026-09-22.
  - **`category`/`idealFor` non più legati alla sola condizione dell'annuncio
    (2026-09-28)**: prima erano `"lavoro_ufficio"` se Ricondizionato,
    altrimenti **sempre** `"gaming_ai"`/`"Gaming, AI e uso intenso."` — anche
    su un Celeron Usato senza GPU dedicata (trovato controllando la card
    dettaglio dello stesso prodotto Celeron segnalato dall'utente: diceva
    "Ideale per: Gaming, AI e uso intenso.", in contraddizione diretta con le
    sue specifiche). Nuove `derive_category()`/`derive_ideal_for()` derivano
    entrambi i campi dagli stessi `useCases` già calcolati da
    `derive_use_cases()` — mai più dalla condizione. Riapplicato a tutto il
    catalogo esistente (tutti e 201 i prodotti avevano il vecchio idealFor
    generico condizione-based, ora sostituito).
  - **Testo di `topHighlights`/`stampRationale` con capacità hardcoded invece
    che reale (2026-09-28)**: lo stesso bug già corretto il 2026-09-27 per
    "Maxi SSD da 1 TB" (mostrato anche su dischi da 2TB) esisteva ANCORA in
    due punti non toccati allora — segnalato dall'utente su un MSI Pulse 17
    con 64GB di RAM la cui scheda "Top" diceva "32 GB di RAM" (la soglia è
    `ram["gb"] >= 32`, ma il testo generato restava sempre "32 GB" fisso) e
    trovato per estensione anche nel rationale `cheaper_good` ("monta 16GB di
    RAM" anche su prodotti da 24/32GB, soglia `ram["gb"] >= 16`). Entrambi ora
    interpolano `ram['gb']` invece del numero fisso. 12 prodotti già in
    catalogo corretti (4 + 8).
  - Motore di valutazione "la Volpe" (`evaluate_laptop`) che calcola frecce
    benchmark, badge, TOP/FLOP, rating, `useCases` (`derive_use_cases`) — **senza
    mai usare lo sconto dichiarato**, né nel punteggio né nel prezzo di riferimento
  - **Discovery eBay (Fase 1, 2026-09-22)**: `build_ebay_query_pool()` genera ~32
    query categorizzate (discovery/spec/ricondizionato, da `EBAY_GPUS`/`EBAY_CPUS`/
    `EBAY_RAM_SIZES`, combinazioni mirate non cartesiane) invece delle 2-5 frasi
    fisse di prima. `discover_ebay_deals()` campiona il mercato (fino a 200
    risultati/pagina, 2 pagine/query, `sort` ruotato per giorno tra i valori
    supportati dalla Browse API) — non decide più lui cosa è interessante, si
    limita a raccogliere. Identità dell'offerta = `listingId` (itemId eBay,
    normalizzato da `_numeric_listing_id()`), **mai più titolo+prezzo**: lo stesso
    annuncio a un prezzo diverso aggiorna `priceHistory` invece di creare un
    duplicato. `DAILY_API_BUDGET = 4000` (limite reale eBay: 5000/giorno) conta
    sia le chiamate di ricerca sia le `get_ebay_item_details()`, e queste ultime
    vengono saltate per annunci già noti (risparmio budget). `sync_catalog()` ha
    **due livelli** di deduplica: `listingId` per "stesso identico annuncio"
    (aggiorna prezzo/storico) + il vecchio `spec_fingerprint`/`fingerprint_index`
    (stesse 5 specifiche+condizione) per "stesso portatile, venditore diverso"
    tra annunci genuinamente nuovi — tiene solo il più economico dei due, invariato
    dalla sessione precedente. Raggruppamento cross-store vero (stesso notebook
    su negozi diversi, es. eBay+Amazon+MediaWorld) resta fuori scope — vedi TODO #6.
    `verify_catalog_links()` ora controlla i link in parallelo (`asyncio.Semaphore(8)`,
    fix 2026-09-22): prima era sequenziale e con un catalogo cresciuto ha fatto
    cancellare un run dopo 55 minuti senza mai arrivare al commit. Dopo il fix il
    run è sceso a ~16 minuti, ma ha rivelato che il pool ampio trova **~270-280
    prodotti nuovi in un solo run** (da 20 a ~290) — troppi per una revisione
    umana della qualità. `MAX_NEW_PRODUCTS_PER_RUN = 60` in `sync_catalog()`
    mette un tetto alla crescita per notte (non limita gli aggiornamenti di
    prezzo su annunci già noti, solo i prodotti genuinamente nuovi) finché la
    qualità non è verificata su più notti — alzare o rimuovere quando lo è.
    **Filtro ricambi/accessori** (trovato 2026-09-26 dall'utente su un prodotto
    live — un alimentatore venduto come se fosse un laptop RTX4060): il tetto
    di prezzo minimo (150€, uguale per quasi tutte le query) intercetta anche
    schede madri sciolte, RAM SODIMM e alimentatori compatibili — i parser
    leggono CPU/GPU/RAM dal titolo del ricambio e lo fanno passare per un
    notebook intero. Su 289 prodotti, **44 (15%) erano in realtà ricambi**,
    rimossi. `_is_bad_ebay_title()` ora esclude titoli che iniziano con "Per "
    (segnale fortissimo: un venditore non apre mai così il titolo se sta
    vendendo davvero il laptop) più `scheda madre`/`motherboard`/`ricambio`/
    `sodimm`/`adattatore originale`/`power supply` in `BAD_TITLE_WORDS` — non
    filtra il generico "adattatore"/"adapter" da solo per non escludere
    laptop veri venduti con caricabatterie incluso (falso positivo verificato:
    "DELL Latitude 5480... + adattatore AC")
    **Giro 2 dello stesso filtro** (stesso giorno, segnalato di nuovo
    dall'utente su prodotti live — un SSD sciolto e un dock eGPU mostrati come
    notebook): il primo giro non copriva zaini/borse per notebook ("zaino",
    "tracolla", "backpack"), dock eGPU ("dock", "egpu"), SSD/RAM/batterie
    sciolte quando il NOME del componente è la prima parola del titolo
    (`BAD_TITLE_PREFIXES`, nuovo: un venditore che vende il laptop apre il
    titolo col marchio/modello, non col nome del componente). Trovato anche un
    problema distinto e più subdolo: **annunci "multi-configurazione"**
    (titolo tipo "8/16 GB 256/512/1TB/2TB" con più opzioni RAM/storage
    elencate) dove il prezzo mostrato dalla Browse API è quello della
    configurazione più economica, ma il parser leggeva sempre il valore più
    alto della lista — la card mostrava specifiche che non corrispondevano
    al prezzo (es. "189€" con 16GB/2TB, quando 189€ compra solo la base).
    `_MULTI_CONFIG_PATTERN` richiede **almeno 3 numeri incatenati da "/"** per
    escludere l'annuncio, apposta per non confondere una config fissa
    abbreviata (es. "16/256GB" = 16GB RAM + 256GB SSD, un solo slash, prezzo
    valido) con vere alternative multiple. Verificato senza falsi positivi su
    tutto il catalogo (245→226 prodotti, -19: 8 accessori + 11 multi-config).
    **Giro 3 (2026-09-27)**, ancora segnalato dall'utente su prodotti live —
    RAM/dischi sciolti (SO-DIMM, SSD SanDisk, HDD Seagate Exos) brandizzati sul
    **produttore del componente** (SanDisk/Crucial/Seagate/Fujitsu) invece che
    su un modello di laptop: `BAD_TITLE_PREFIXES` guarda solo la prima parola,
    quindi non li intercettava. Aggiunte parole segnale indipendenti dalla
    posizione: `'per notebook'`/`'per portatile'` (RAM/batteria descritta come
    compatibile con un modello, stesso concetto di "per ricambi" ma per
    componenti anziché il laptop stesso), `'mem ram'`, `'so-dimm'` (con
    trattino — `'sodimm'` senza trattino non la intercettava, bug distinto),
    `'caddy'`, `'seagate exos'`, `'disco rigido interno'`, `'difettoso'`
    (venditore dichiara l'articolo guasto nel titolo stesso). Anche corretto
    un caso mancato in `BAD_TITLE_PREFIXES`: "Nuovo disco rigido DELL..." non
    iniziava per "disco rigido" a causa del prefisso di condizione ("Nuovo ")
    — nuovo `_CONDITION_PREFIX_PATTERN` rimuove "Nuovo"/"Usato"/"Ricondizionato"/
    ecc. dall'inizio del titolo prima del controllo prefissi. Trovato anche un
    **tablet mislabeled da laptop**: "HP ElitePad 900 G2" (tablet Windows senza
    tastiera/cerniera) — aggiunta la parola `'elitepad'`. Verificato senza falsi
    positivi su tutto il catalogo (226→215 prodotti, -11).
    **Giro 3, aggiunta (2026-09-28)**: stesso giorno del giro 4 sotto, trovato
    un **iPad Air M3** passato indenne al giro 3 perché il parser CPU
    riconosceva "M3" come Apple Silicon valido senza controllare che il
    prodotto fosse davvero un notebook — aggiunta la parola `'ipad'` (stesso
    trattamento di `'elitepad'`). -1 prodotto (215→214).
    **Giro 4 (2026-09-28)**: controllando a ritroso quali prodotti fossero
    ancora sul fallback CPU generico (vedi sopra, riscrittura estesa del
    parser) per capire se mancassero altre famiglie CPU, ~13 sono risultati
    in realtà accessori/ricambi/lotti mai notebook interi, semplicemente
    senza un modello CPU riconoscibile — non trovati chiedendo direttamente
    ma incrociando dati: dock/port replicator sciolti (`'docking station'`,
    `'replicatore di porte'`), un tablet Fujitsu Arrows Tab (`'arrows tab'`),
    ricambi "compatibile per"/"per laptop" (schermi/pannelli LCD sciolti),
    assemblaggi schermo/tastiera sciolti (`'schermo montaggio'`, `'tastiera
    palmrest'`), penne USB (`'chiavetta usb'`, `'chiavetta di memoria'`), SSD/
    HDD sciolti (`'unità a stato solido'`, `'hard disk'`), un lotto di RAM
    (`'lotto ram'`) e un lotto di notebook DIVERSI venduti come un unico
    annuncio (`'multibrand'`). Verificato senza falsi positivi su tutto il
    catalogo prima di rimuovere (214→201 prodotti, -13). Il lavoro di questa
    sessione (parser + filtro) è stato riapplicato tale e quale dopo aver
    unito 2 run notturni del bot nel frattempo passati (312 prodotti dopo il
    merge, mai toccati a mano — script idempotenti basati sul contenuto, non
    sulla posizione): trovato un accessorio in più tra i nuovi arrivati
    ("Display di Espansione per Laptop..." catturato da `'per laptop'`),
    stessa procedura di verifica. **Catalogo finale: 298 prodotti.**
    **Giro 5 (2026-09-28)**: trovati per caso controllando il testo
    `cheaper_good` con capacità hardcoded (vedi sopra) due lotti bulk "SCATOLA
    di 7/8 laptop - MIX di Asus, Acer, Dell..." — stesso problema di
    "multibrand"/"ex leasing" (giro 4) con wording diverso. Aggiunta
    `'scatola di'`. -2 prodotti (298→296).
    **Giro 6 (2026-09-28)**, segnalato dall'utente su un prodotto live: "1 pz
    per display portatile 13,3 pollici LQ133M1JX20" (pannello LCD di
    ricambio) — "per display" non era coperto da nessuna parola esistente
    (`'per laptop'`/`'schermo per'` richiedono un wording diverso). Aggiunta
    `'per display'`. -1 prodotto (296→295).
    **Rate limit — RISOLTO, confermato su 4 notti** (scoperto 2026-09-22, risolto
    e verificato 23→26/09/2026): un run lanciato subito dopo un altro molto
    attivo aveva ricevuto 429 "Too many requests" su OGNI chiamata, fin dalla
    prima — un limite di frequenza a breve termine, mai documentato
    esplicitamente da eBay per questo tier, diverso dal tetto giornaliero
    (5000/giorno). `_ebay_rate_limit_pace()` (pausa minima tra chiamate reali)
    + un circuit breaker (`_ebay_throttled`, scatta dopo 3 risposte 429
    consecutive e salta il resto del run) come rete di sicurezza. **A 1
    chiamata/secondo: 4 notti consecutive (23-26/09), ~4000/4000 chiamate
    usate ogni volta, zero 429.** Il pool trova ogni notte ben più dei 60
    prodotti che `MAX_NEW_PRODUCTS_PER_RUN` fa passare (catalogo cresciuto
    20→234 in 4 notti, +60/notte al tetto). Costo reale: a 1 chiamata/sec con
    budget pieno la sola fase di ricerca richiede **~67 minuti** (run totali
    ~70-75 min). **Provato e SCARTATO (2026-09-26)**: `_EBAY_MIN_CALL_INTERVAL`
    abbassato a 0.35s (~2,9 chiamate/sec) per accorciare i run — il circuit
    breaker ha protetto i dati come previsto, ma è scattato per davvero dopo
    ~1000 chiamate (429 reali, non un falso allarme): quel ritmo supera il
    vero limite eBay. Tornato a 1.0s. **Nota per un'ottimizzazione diversa**:
    dato che il tetto dei 60 nuovi prodotti/notte viene raggiunto ben prima di
    esaurire il budget di 4000 chiamate (in questo test, a sole 1003 chiamate
    erano già stati trovati i 60 prodotti), il vero spreco non è la velocità
    ma continuare a interrogare tutte le 32 query anche dopo aver già
    raggiunto il tetto — fermare la scoperta appena il tetto è raggiunto
    accorcerebbe i run senza bisogno di rischiare un ritmo più veloce
  - Integrazioni: Amazon Creators API, eBay Browse API. **Refurbed.it rimosso
    interamente** (2026-09-21): mai stato trovato un programma di affiliazione
    Refurbed attivo su Awin per questo account, quindi niente tracciamento/
    commissione possibile — rimossi sia i prodotti Refurbed dal catalogo sia la
    funzione di scraping Playwright (`scrape_refurbed_deals`, non più nel codice)
  - `wrap_affiliate_link()` — genera i link di affiliazione per ogni store
  - `sync_catalog()` — scrive su `src/data/products.json`
- **CI/CD**: `.github/workflows/refresh-catalog.yml` — gira ogni notte alle 6:00 UTC
  (+ trigger manuale). Pipeline: esegue `test_db.py` → commit/push di
  `products.json` se cambiato. Il deploy del sito è gestito interamente da Vercel
  (vedi Hosting sotto), quindi il workflow **non builda né deploya** — si limita ad
  aggiornare `products.json` sul branch `main`.
- **Hosting**: il sito è servito da **Vercel** (Git integration: ogni push su `main`
  triggera automaticamente build + deploy lato Vercel, incluso quello generato dal
  commit notturno del workflow sopra). Il dominio `prezzifurbi.it` ha i nameserver
  puntati su `ns1/ns2.vercel-dns.com`. **Keliweb non è più in uso** (2026-09-21): il
  vecchio step di deploy FTP verso Keliweb nel workflow falliva sempre con
  "Timeout (control socket)" perché il DNS del dominio non punta più a Keliweb da
  tempo — è stato rimosso dal workflow. Se in futuro serve riattivare Keliweb,
  bisogna prima ripuntare i nameserver del dominio.

  **🟡 PROBLEMA 2026-09-26, sbloccatosi da solo — da confermare stanotte.** Il
  deploy Vercel si era fermato al 23/09 per 3 giorni (commit automatici del 24,
  25, 26/09 tutti riusciti su GitHub, dati validi, ma il sito serviva ancora
  20 prodotti). Poi, dopo un push manuale (non del bot) il 26/09 sera, il sito
  è tornato a pubblicare correttamente (226 prodotti, `Last-Modified`
  aggiornato in tempo reale). Causa non identificata con certezza — non
  verificato via dashboard/API Vercel, solo osservato che ha ricominciato a
  funzionare. **Resta un dubbio concreto**: i push che hanno "sbloccato" il
  deploy erano fatti con l'account umano (`Matti111`), non con l'identità del
  bot (`prezzifurbi-bot`) usata dal workflow notturno — se il problema era un
  filtro specifico sull'autore/messaggio dei commit (es. "Ignored Build Step"
  su Vercel), potrebbe ripresentarsi al prossimo commit automatico del bot.
  **Da verificare**: controllare dopo il run schedulato delle 6:00 UTC che il
  sito rifletta il nuovo commit `chore: aggiornamento automatico...` — se
  torna a bloccarsi, il problema è specifico ai commit del bot e va comunque
  controllato via dashboard Vercel (tab Deployments / Ignored Build Step).

## Stato attuale dei programmi di affiliazione

| Programma | Stato | Note |
|---|---|---|
| Amazon Associates | ✅ Attivo | Tag `prezzifurbi-21` su tutti i link Amazon, funziona e genera commissioni |
| Amazon Creators API | ⏳ Bloccato | Credenziali corrette (auth OK), ma serve **10 vendite idonee negli ultimi 30 giorni** prima che l'account sia eleggibile (403 finché non si raggiunge la soglia). Non blocca nulla: senza API i prezzi Amazon restano semplicemente statici finché non si aggiornano a mano o si sblocca l'accesso |
| eBay Partner Network | ✅ Attivo | Campaign ID `5339209756`. Link generati appendendo `mkevt/mkcid/mkrid/campid/toolid` **direttamente sull'URL prodotto eBay** — **non** usare mai `rover.ebay.com/rover/...` come redirect diretto, quel formato restituisce solo un pixel di tracciamento 1×1, non un redirect (bug reale già risolto, vedi commit `0d0cf6a`) |
| eBay Browse API | ✅ Attivo | Serviva richiedere l'**esenzione da Marketplace Account Deletion** (Alerts & Notifications su developer.ebay.com) perché l'app non gestisce dati membri eBay, altrimenti la keyset Production resta disabilitata |
| Awin (network) | ✅ Approvato | Publisher ID `3095611` (in `CONFIG["awin_affid"]`, override via env `AWIN_AFFID`) |
| Awin → Refurbed | ❌ Rimosso definitivamente | Mai stato trovato un programma Refurbed attivo su Awin per questo account (Merchant ID `18037` usato in precedenza non era mai stato verificato). 2026-09-21: rimossi anche tutti i prodotti Refurbed dal catalogo e la funzione di scraping — Refurbed non è più una fonte del sito |
| Awin → Back Market IT | ⏳ In attesa di approvazione | |
| Awin → MediaWorld IT | ⏳ In attesa di approvazione | |
| Awin → Unieuro IT | ⏳ In attesa di approvazione | Richiesta inviata 2026-09-21 |
| Awin → Euronics IT | ⏳ In attesa di approvazione | Richiesta inviata 2026-09-21 |
| Awin → Cyberport | 🔲 Non richiesto | Nessun programma IT specifico su Awin, solo AT/DE/EE/PL. Valutato ma non prioritario (commission rate basso, 2,3%) |

## Deploy — risolto (2026-09-21)

Il vecchio step di deploy FTP verso Keliweb falliva sempre con "Timeout (control
socket)": il dominio `prezzifurbi.it` ha i nameserver puntati su Vercel
(`ns1/ns2.vercel-dns.com`) da tempo, quindi `FTP_SERVER` non raggiungeva mai
Keliweb. Il sito era già live e funzionante su **Vercel** (Git integration:
push su `main` → build + deploy automatico lato Vercel), semplicemente non
tramite questo workflow. Lo step FTP e lo step di build Node sono stati rimossi
da `refresh-catalog.yml`: ora il workflow si limita ad aggiornare
`products.json` e pushare su `main`, e Vercel fa il resto da solo. I secret
`FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD`/`FTP_REMOTE_DIR` sono rimasti su
GitHub ma non sono più usati da nessun workflow — Keliweb non è più in uso.

## Catalogo Amazon — sostituito (2026-09-21)

I 7 prodotti Amazon precedenti sono stati rimossi e sostituiti con 4 nuovi (link
forniti dall'utente, risolti e verificati uno per uno in browser, poi valutati
con il vero `evaluate_laptop()` — non simulato a mano):

| id | ASIN | Note |
|---|---|---|
| `tulpar-t5-i7-rtx4060` | `B0D2R83MY4` | i7-12700H + RTX 4060. **Segnato "Attualmente non disponibile" su Amazon al momento dell'aggiunta** — aggiunto comunque su richiesta esplicita, ricontrollare periodicamente se è tornato in stock |
| `aukabrex-16-i7-6500u` | `B0H6WSJSHV` | i7-6500U (2015), **nessuna GPU dedicata** nonostante il nome "Gaming Laptop" — categorizzato `lavoro_ufficio`, non `gaming_ai` |
| `cyclus-16-ryzen5-vega` | `B0G1FZ5F8N` | Ryzen 5 3500U + Vega 8 integrata, stesso discorso — categorizzato `lavoro_ufficio` |
| `hp-omen-15-rtx5050` | `B0GQZ5W9D1` | Vero gaming laptop: Intel Core 5-210H + RTX 5050 8GB, 2K 165Hz |

Nessuno dei 4 mostrava un vero prezzo di listino/sconto su Amazon al momento
dell'aggiunta: **`originalPrice` è stato impostato uguale al prezzo attuale
(nessuno sconto finto mostrato)**, coerente con quanto promesso in
`AffiliateDisclaimer.tsx` ("Niente prezzi civetta o sconti finti"). Il resto
del catalogo (soprattutto le offerte eBay automatiche) continua invece a
stimare `originalPrice` come `price * 1.35` quando la fonte non ne fornisce uno
reale — è un'incoerenza nota, non ancora risolta a livello di pipeline.

Durante la valutazione di questi 4 prodotti sono emersi e sono stati corretti
in `test_db.py` tre problemi reali del parser (non teorici — causavano dati
sbagliati su questi stessi prodotti):
- `extract_screen`: il refresh rate non viene più assunto "144Hz" solo perché
  il titolo contiene la parola "gaming" (causava un falso claim 144Hz su
  laptop con schermo 60Hz normale)
- `extract_gpu`: aggiunto riconoscimento "VEGA" (grafica integrata AMD) — prima
  finiva nel fallback generico "Intel UHD Graphics", sbagliando produttore
- `extract_gpu`/`evaluate_laptop`: aggiunto riconoscimento RTX serie 50
  (es. RTX 5050) e ammorbidito il testo pregi hardcoded "serie 40 con DLSS
  3.5" (falso per una RTX 50) in un testo generico per tier GPU alto
- `extract_cpu`: aggiunto riconoscimento della nuova nomenclatura Intel
  "Core 3/5/7" (2024+, senza "i" né "Ultra", es. "Core 5-210H") — prima
  finiva nel fallback generico "Intel Core i5 Multicore"

Aggiunto anche un 5° prodotto manuale, `dell-precision-7540-i9-quadro`, da
**MediaWorld.it** (marketplace, venduto da PCrefurb Scandinavia IT) — questo sì
con uno sconto reale verificato (999€ vs "più basso ultimi 30gg" 1599€ mostrato
da MediaWorld stessa). **Link diretto senza tracciamento** (store nuovo,
`wrap_affiliate_link()` non ha ancora un branch MediaWorld — vedi TODO #1):
aggiunto comunque su richiesta esplicita nonostante l'assenza di commissione,
stessa logica già applicata a Refurbed prima della rimozione. La card mostra
"Link non verificato" in `ProductCard.tsx` (stesso trattamento di Amazon).

## TODO aperti

1. Quando Back Market IT / MediaWorld IT / Unieuro IT / Euronics IT approvano su
   Awin: recuperare il loro Merchant ID (MID) dalla scheda programma su MyAwin e
   aggiungere un branch in `wrap_affiliate_link()` (usare il formato
   `https://www.awin1.com/cread.php?awinmid={MID}&awinaffid={AFFID}&clickref=prezzifurbi&ued={url-encoded-destination}`)
5. Verificare se `tulpar-t5-i7-rtx4060` (ASIN `B0D2R83MY4`) è tornato disponibile
   su Amazon — era segnato "Attualmente non disponibile" quando è stato aggiunto
   al catalogo il 2026-09-21
2. Amazon Creators API: nessuna azione necessaria, si sblocca da sola raggiunta la
   soglia di 10 vendite/30gg — non generare acquisti artificiali/coordinati con
   amici per raggiungerla apposta, rischia di far segnalare l'account Associates
   dai sistemi antifrode Amazon
3. Il parser specifiche eBay è stato migliorato di recente (commit `2f1d3ea`) per
   leggere le "item specifics" reali invece di indovinare dal titolo — non ancora
   verificato su un run notturno reale dopo la modifica, controllare la qualità dei
   prossimi prodotti eBay aggiunti automaticamente
4. In generale: quando si aggiungono nuovi prodotti (specialmente eBay, dati meno
   strutturati), ricontrollare a occhio le specifiche sul sito live — il parser è a
   regex, non infallibile
6. **Raggruppamento offerte identiche tra negozi diversi** (es. stesso Dell XPS 15
   venduto da MediaWorld/Unieuro/eBay/Amazon in un'unica scheda con "altre
   offerte") — esplicitamente rimandato durante l'implementazione del motore del
   valore (2026-09-22): richiede un vero algoritmo di matching prodotto (non solo
   fingerprint sulle 5 specifiche, serve normalizzazione brand/modello) e la
   separazione formale prodotto/offerta nello schema dati. Con ~19 prodotti su 3
   fonti quasi sempre non sovrapposte l'investimento non si giustificava ancora;
   da rivalutare quando il catalogo cresce
7. Soglie del motore del valore (in `src/utils/valuation.ts` e `evaluate_laptop`
   in `test_db.py`) sono punti di partenza ragionevoli ma non ancora tarati su
   dati reali di più settimane: soglia punteggio volpe (`score >= 6.0`), soglia
   percentile volpe contestuale (15%), soglie semaforo freschezza (10/30 giorni),
   minimo comparabili per prezzo tipico (3) — aggiustarli se in pratica la volpe
   compare troppo/poco spesso o il semaforo sembra troppo aggressivo/permissivo
8. **RISOLTO 2026-09-26**: il consumo di budget eBay e i 429 sono stati
   verificati su 4 notti reali consecutive (23-26/09), tutte a budget pieno
   (~4000/4000 chiamate) e zero 429 con pacing a 1 chiamata/sec. Provato
   anche un ritmo più veloce (0.35s, ~2,9 chiamate/sec) lo stesso giorno per
   accorciare i run da ~70 minuti: il circuit breaker ha protetto i dati ma è
   scattato per davvero dopo ~1000 chiamate (429 reali) — quel ritmo supera
   il vero limite eBay, si è tornati a 1.0s (confermato sicuro). Idea per
   accorciare i run senza rischiare la velocità: fermare la scoperta appena
   `MAX_NEW_PRODUCTS_PER_RUN` è raggiunto invece di interrogare comunque
   tutte le 32 query (il tetto di 60 viene raggiunto ben prima di esaurire
   il budget — in un test, a sole 1003 chiamate su 4000)
8b. **🟡 Deploy Vercel bloccato al 23/09, sbloccatosi da solo il 26/09 sera**
   dopo un push manuale (non del bot) — vedi sezione Hosting sopra. Causa non
   confermata. **Verificare dopo il prossimo run schedulato (6:00 UTC)** che
   anche il commit automatico del bot (`prezzifurbi-bot`) faccia scattare il
   deploy come i push manuali — se si riblocca solo con quello, il problema è
   specifico all'autore/messaggio del commit (controllare "Ignored Build
   Step" nelle impostazioni Vercel del progetto)
9. Fase 2/3/4 della discovery (statistiche/Query Yield per query, rotazione basata
   sul rendimento invece che deterministica per data, budget diviso dinamicamente
   tra discovery/high-value/coverage/exploration, generazione di query dai gap di
   copertura e dai filtri usati dagli utenti) esplicitamente NON implementate ora
   — richiedono uno stato persistente tra le notti (nuovo file, es.
   `query_stats.json`) e hanno senso solo quando c'è abbastanza storico/catalogo
   perché quei segnali siano significativi
10. **Un prodotto (2026-09-28) ha avuto lo storage corretto a mano**: un annuncio
    eBay "multi-variante" (333€ compra la configurazione 1TB, 2TB costa 343€ a
    parte) dove l'informazione sulle varianti stava solo nella DESCRIZIONE, non
    nel titolo — il pattern `_MULTI_CONFIG_PATTERN` (giro 2, numeri incatenati
    da "/") non può intercettarlo perché il titolo non ha quel formato. Nessuna
    regex generalizzabile trovata da un solo caso: se ricompare, valutare se
    vale la pena leggere le "item specifics"/varianti reali della Browse API
    invece di indovinare dal solo testo (limite noto della pipeline, vedi anche
    TODO #3/#4)
11. Famiglie CPU rimaste sul fallback generico "Intel Core i5 Multicore" per
    scelta, non per bug (rischio/beneficio troppo basso per continuare ad
    espandere `extract_cpu`): nomenclatura Intel di prima generazione mobile
    ("i5-M560", "i5 540"), "AMD Athlon Silver/Gold" senza prefisso Ryzen (es.
    "AMD 3020E") — il tier resta comunque prudente (non gonfiato) anche senza
    un'etichetta precisa, quindi non urgente

## File locali che NON sono su git (da ricreare se serve lavorare in locale)

- `.env` (copia di `.env.example`) — serve solo per lanciare `test_db.py` a mano
- `node_modules/`, `.venv/`, `dist/` — rigenerabili con `npm install` e
  `pip install requests playwright && playwright install --with-deps firefox`

Le API key vere e le credenziali FTP esistono **solo** nei GitHub Secrets del repo
(mai leggibili in chiaro una volta salvati) — se servono in locale, recuperarle
dalle fonti originali (developer.ebay.com, area cPanel Keliweb, ecc.), non da qui.
