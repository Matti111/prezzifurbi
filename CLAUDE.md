# Prezzi Furbi (prezzifurbi.it)

Portale di comparazione prezzi per notebook/PC (nuovi, ricondizionati, usati), rivolto
a un pubblico italiano che vuole capire il reale rapporto qualità/prezzo prima di
comprare. Repo GitHub: https://github.com/Matti111/prezzifurbi (privato).

## Stack e architettura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind, in `src/`. Card prodotto con
  timbri ("Scelta Furba" 🦊, "Best Buy" ⚡, "Cheaper" 🏷️), filtri per specifica tecnica,
  slider budget, confronto benchmark CPU/GPU.
- **Dati**: `src/data/products.json` — il catalogo. Aggiornato in parte a mano, in
  parte automaticamente ogni notte.
- **Automazione**: `test_db.py` (Python) — un unico script monolitico che fa tutto:
  - Parser hardware a regex (`extract_screen`, `extract_gpu`, `extract_cpu`,
    `extract_ram`, `extract_ssd`, `extract_weight`) che legge titolo + descrizione +
    "item specifics" e ne deduce le caratteristiche
  - Motore di valutazione "la Volpe" (`evaluate_laptop`) che calcola frecce
    benchmark, badge, TOP/FLOP, rating
  - Integrazioni: Amazon Creators API, eBay Browse API, scraping Playwright di
    Refurbed.it
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

## Stato attuale dei programmi di affiliazione

| Programma | Stato | Note |
|---|---|---|
| Amazon Associates | ✅ Attivo | Tag `prezzifurbi-21` su tutti i link Amazon, funziona e genera commissioni |
| Amazon Creators API | ⏳ Bloccato | Credenziali corrette (auth OK), ma serve **10 vendite idonee negli ultimi 30 giorni** prima che l'account sia eleggibile (403 finché non si raggiunge la soglia). Non blocca nulla: senza API i prezzi Amazon restano semplicemente statici finché non si aggiornano a mano o si sblocca l'accesso |
| eBay Partner Network | ✅ Attivo | Campaign ID `5339209756`. Link generati appendendo `mkevt/mkcid/mkrid/campid/toolid` **direttamente sull'URL prodotto eBay** — **non** usare mai `rover.ebay.com/rover/...` come redirect diretto, quel formato restituisce solo un pixel di tracciamento 1×1, non un redirect (bug reale già risolto, vedi commit `0d0cf6a`) |
| eBay Browse API | ✅ Attivo | Serviva richiedere l'**esenzione da Marketplace Account Deletion** (Alerts & Notifications su developer.ebay.com) perché l'app non gestisce dati membri eBay, altrimenti la keyset Production resta disabilitata |
| Awin (network) | ✅ Approvato | Publisher ID `3095611` (in `CONFIG["awin_affid"]`, override via env `AWIN_AFFID`) |
| Awin → Refurbed | ❌ Rimosso | Non è mai stato trovato un programma Refurbed attivo su Awin per questo account. Il Merchant ID `18037` usato in precedenza non era mai stato verificato ed è stato rimosso dal codice. I prodotti Refurbed restano in catalogo (scraping Playwright) ma con **link diretti senza tracciamento** |
| Awin → Back Market IT | ⏳ In attesa di approvazione | |
| Awin → MediaWorld IT | ⏳ In attesa di approvazione | |
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

## TODO aperti

1. Quando Back Market IT / MediaWorld IT approvano su Awin: recuperare il loro
   Merchant ID (MID) dalla scheda programma su MyAwin e aggiungere un branch in
   `wrap_affiliate_link()` analogo a quello rimosso per Refurbed (usare il formato
   `https://www.awin1.com/cread.php?awinmid={MID}&awinaffid={AFFID}&clickref=prezzifurbi&ued={url-encoded-destination}`)
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

## File locali che NON sono su git (da ricreare se serve lavorare in locale)

- `.env` (copia di `.env.example`) — serve solo per lanciare `test_db.py` a mano
- `node_modules/`, `.venv/`, `dist/` — rigenerabili con `npm install` e
  `pip install requests playwright && playwright install --with-deps firefox`

Le API key vere e le credenziali FTP esistono **solo** nei GitHub Secrets del repo
(mai leggibili in chiaro una volta salvati) — se servono in locale, recuperarle
dalle fonti originali (developer.ebay.com, area cPanel Keliweb, ecc.), non da qui.
