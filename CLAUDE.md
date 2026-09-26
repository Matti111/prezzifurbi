# Prezzi Furbi (prezzifurbi.it)

Portale di comparazione prezzi per notebook/PC (nuovi, ricondizionati, usati), rivolto
a un pubblico italiano che vuole capire il reale rapporto qualità/prezzo prima di
comprare. Repo GitHub: https://github.com/Matti111/prezzifurbi (privato).

## Stack e architettura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind, in `src/`. Card prodotto con
  timbri ("Scelta Furba" 🦊, "Best Buy" ⚡, "Cheaper" 🏷️), tag di utilizzo (Gaming/
  Creatività/Programmazione/Studio/Lavoro/Home), filtri dinamici per specifica
  tecnica e utilizzo, slider budget, confronto benchmark CPU/GPU. In cima al sito
  c'è `ConstructionBanner.tsx` ("Sito in fase di aggiornamento..."), aggiunto
  2026-09-21 e ancora attivo: toglierlo quando prezzi/link saranno considerati
  stabili (nessuna data/condizione precisa fissata, è una valutazione da fare).
- **Motore del valore** (2026-09-22, da specifica utente — vedi `src/utils/valuation.ts`):
  principio centrale "non guardiamo lo sconto, guardiamo il valore". Nessuna
  percentuale di sconto viene mai fabbricata: `originalPrice` esiste solo se una
  fonte lo dichiara davvero (es. "più basso ultimi 30gg" di MediaWorld). Quando
  manca, il "prezzo tipico" è la mediana di prodotti comparabili nello stesso
  pool contestuale (mai il catalogo intero), mostrato solo con ≥3 comparabili.
  La volpe 🦊 è rara per design: il backend assegna un timbro candidato su
  soglie assolute (`evaluate_laptop`, **mai sullo sconto**), il frontend
  (`qualifiesForFox`) la mostra solo se il prodotto è anche tra il 15% più
  conveniente per almeno uno dei suoi `useCases`, altrimenti si vede come Best
  Buy. `findDominator` calcola la dominanza (stesso pool contestuale): i
  prodotti dominati non spariscono, restano dietro "Mostra alternative".
  `freshnessLevel` è il semaforo 🟢/🟡/🔴 su `lastUpdated`.
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

## File locali che NON sono su git (da ricreare se serve lavorare in locale)

- `.env` (copia di `.env.example`) — serve solo per lanciare `test_db.py` a mano
- `node_modules/`, `.venv/`, `dist/` — rigenerabili con `npm install` e
  `pip install requests playwright && playwright install --with-deps firefox`

Le API key vere e le credenziali FTP esistono **solo** nei GitHub Secrets del repo
(mai leggibili in chiaro una volta salvati) — se servono in locale, recuperarle
dalle fonti originali (developer.ebay.com, area cPanel Keliweb, ecc.), non da qui.
