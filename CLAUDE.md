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
  `products.json` se cambiato → `npm ci && npm run build` → deploy di `dist/` su
  Kaliweb via FTP (`SamKirkland/FTP-Deploy-Action`).
- **Hosting**: il provider si chiama **Keliweb** (non "Kaliweb" — nome corretto,
  attenzione a non confondersi), hosting cPanel classico. Sito servito da file
  statici via FTP, nessun backend server-side.

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

## Deploy automatico — stato da verificare

Il workflow ha lo step di build+deploy FTP aggiunto (commit `e2e6bc6`), e i secret
GitHub sono stati impostati dall'utente:
`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `AMAZON_CREATORS_CLIENT_ID`,
`AMAZON_CREATORS_CLIENT_SECRET`, `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`,
`FTP_REMOTE_DIR` (quest'ultimo probabilmente `/public_html/`, standard cPanel).

**Non è mai stato confermato un run notturno completo con successo end-to-end del
deploy FTP** — gli ultimi aggiornamenti del sito live sono stati fatti con upload
manuale (`npm run build` + FileZilla). Prima cosa da fare in una nuova sessione:
controllare i log dell'ultimo run schedulato su GitHub Actions e verificare che lo
step "Pubblica su Kaliweb via FTP" sia andato a buon fine.

## TODO aperti

1. **Verificare il deploy FTP automatico** (vedi sopra) — se fallisce, il problema
   più probabile è `FTP_REMOTE_DIR` sbagliato o placeholder non sostituito
2. Quando Back Market IT / MediaWorld IT approvano su Awin: recuperare il loro
   Merchant ID (MID) dalla scheda programma su MyAwin e aggiungere un branch in
   `wrap_affiliate_link()` analogo a quello rimosso per Refurbed (usare il formato
   `https://www.awin1.com/cread.php?awinmid={MID}&awinaffid={AFFID}&clickref=prezzifurbi&ued={url-encoded-destination}`)
3. Amazon Creators API: nessuna azione necessaria, si sblocca da sola raggiunta la
   soglia di 10 vendite/30gg — non generare acquisti artificiali/coordinati con
   amici per raggiungerla apposta, rischia di far segnalare l'account Associates
   dai sistemi antifrode Amazon
4. Il parser specifiche eBay è stato migliorato di recente (commit `2f1d3ea`) per
   leggere le "item specifics" reali invece di indovinare dal titolo — non ancora
   verificato su un run notturno reale dopo la modifica, controllare la qualità dei
   prossimi prodotti eBay aggiunti automaticamente
5. In generale: quando si aggiungono nuovi prodotti (specialmente eBay, dati meno
   strutturati), ricontrollare a occhio le specifiche sul sito live — il parser è a
   regex, non infallibile

## File locali che NON sono su git (da ricreare se serve lavorare in locale)

- `.env` (copia di `.env.example`) — serve solo per lanciare `test_db.py` a mano
- `node_modules/`, `.venv/`, `dist/` — rigenerabili con `npm install` e
  `pip install requests playwright && playwright install --with-deps firefox`

Le API key vere e le credenziali FTP esistono **solo** nei GitHub Secrets del repo
(mai leggibili in chiaro una volta salvati) — se servono in locale, recuperarle
dalle fonti originali (developer.ebay.com, area cPanel Keliweb, ecc.), non da qui.
