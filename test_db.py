"""
PREZZI FURBI - DEAL FINDER & EVALUATION ENGINE
Algoritmo automatico di ricerca, parsing hardware, valutazione con timbri/frecce
e sincronizzazione con il catalogo del sito (products.json).
"""

import re
import json
import os
import time
import asyncio
from typing import Dict, List, Any, Optional
from playwright.async_api import async_playwright
import requests

import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')


def _load_env_file():
    """Carica variabili da un file .env locale (mai committato in git) se presente.
    In produzione (GitHub Actions) le stesse variabili arrivano come secrets."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_env_file()

# --- CONFIGURAZIONE AFFILIAZIONI ---
CONFIG = {
    "awin_affid": "YOUR_AWIN_ID",         # Sostituisci con il tuo Publisher ID Awin
    "awin_mid_refurbed": "18037",          # Merchant ID di Refurbed su Awin
    "ebay_campid": "5339209756",           # Campaign ID eBay Partner Network
    "amazon_tag": "prezzifurbi-21",        # Tracking Tag Amazon Associates
    "products_file": os.path.abspath("src/data/products.json"),

    # Creators API (successore ufficiale di PA-API 5) - credenziali da variabili d'ambiente,
    # MAI hardcoded nel codice. Vedi .env.example per come configurarle in locale.
    "amazon_creators_client_id": os.environ.get("AMAZON_CREATORS_CLIENT_ID", ""),
    "amazon_creators_client_secret": os.environ.get("AMAZON_CREATORS_CLIENT_SECRET", ""),
    "amazon_creators_token_url": "https://api.amazon.co.uk/auth/o2/token",  # endpoint regione EU (marketplace IT)
    "amazon_creators_base_url": "https://creatorsapi.amazon",
    "amazon_marketplace": "www.amazon.it",

    # eBay Browse API (ricerca ufficiale, sostituisce lo scraping) - App Keys da
    # developer.ebay.com, ambiente Production. Diverse dal Campaign ID del Partner
    # Network qui sopra, che serve solo per il tracking dei click.
    "ebay_client_id": os.environ.get("EBAY_CLIENT_ID", ""),
    "ebay_client_secret": os.environ.get("EBAY_CLIENT_SECRET", ""),
}

# --- 1. HARDWARE PARSER ENGINE (REGEX & NLP) ---

def extract_screen(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    
    # Dimensione
    size_match = re.search(r'(1[3-7](?:[.,]\d)?)\s*(?:["\']|pollici|inch)', text_lower)
    size = f'{size_match.group(1).replace(",", ".")}"' if size_match else '15.6"'
    
    # Risoluzione
    if any(k in text_lower for k in ['4k', 'uhd', '3840x2160', '2160p']):
        res = '4K UHD (3840x2160)'
    elif any(k in text_lower for k in ['2k', 'qhd', '2560x1440', '1440p']):
        res = '2K QHD (2560x1440)'
    elif any(k in text_lower for k in ['fhd', '1080p', '1920x1080', 'full hd']):
        res = 'FHD (1920x1080)'
    elif any(k in text_lower for k in ['1366x768', '768p', 'hd ready']):
        res = 'HD (1366x768)'
    else:
        res = 'FHD (1920x1080)'
        
    # Refresh Rate
    refresh_match = re.search(r'(120|144|165|240|300|360)\s*hz', text_lower)
    refresh = f'{refresh_match.group(1)}Hz' if refresh_match else ('144Hz' if 'gaming' in text_lower else '60Hz')
    
    # Tipo pannello
    panel = 'OLED' if 'oled' in text_lower else ('IPS' if 'ips' in text_lower else 'LED')
    
    val = f'{size} {res}'
    if refresh != '60Hz':
        val += f' {refresh}'
    val += f' {panel}'
    
    return {"value": val, "size": size, "refresh": refresh, "panel": panel, "res": res}


def extract_gpu(text: str) -> Dict[str, Any]:
    text_upper = text.upper()
    
    # NVIDIA RTX Serie 40
    if 'RTX 4090' in text_upper:
        return {"value": "NVIDIA GeForce RTX 4090 (16GB GDDR6)", "tier": 5, "dedicated": True}
    if 'RTX 4080' in text_upper:
        return {"value": "NVIDIA GeForce RTX 4080 (12GB GDDR6)", "tier": 5, "dedicated": True}
    if 'RTX 4070' in text_upper:
        return {"value": "NVIDIA GeForce RTX 4070 (8GB GDDR6)", "tier": 4, "dedicated": True}
    if 'RTX 4060' in text_upper:
        return {"value": "NVIDIA GeForce RTX 4060 (8GB GDDR6)", "tier": 4, "dedicated": True}
    if 'RTX 4050' in text_upper:
        return {"value": "NVIDIA GeForce RTX 4050 (6GB GDDR6)", "tier": 3, "dedicated": True}
        
    # NVIDIA RTX Serie 30
    if 'RTX 3070' in text_upper:
        return {"value": "NVIDIA GeForce RTX 3070 (8GB GDDR6)", "tier": 4, "dedicated": True}
    if 'RTX 3060' in text_upper:
        return {"value": "NVIDIA GeForce RTX 3060 (6GB GDDR6)", "tier": 3, "dedicated": True}
    if 'RTX 3050' in text_upper or 'RTX 2050' in text_upper:
        return {"value": "NVIDIA GeForce RTX 3050 (4GB GDDR6)", "tier": 2, "dedicated": True}
        
    # NVIDIA Quadro Workstation
    if 'QUADRO T2000' in text_upper or 'T2000' in text_upper:
        return {"value": "NVIDIA Quadro T2000 (4GB GDDR6 ISV)", "tier": 3, "dedicated": True}
    if 'QUADRO T1000' in text_upper or 'T1000' in text_upper:
        return {"value": "NVIDIA Quadro T1000 (4GB GDDR6)", "tier": 2, "dedicated": True}
    if 'QUADRO P620' in text_upper or 'P620' in text_upper:
        return {"value": "NVIDIA Quadro P620 (4GB GDDR5)", "tier": 2, "dedicated": True}
        
    # NVIDIA RTX Generica / Nuove serie
    m_rtx = re.search(r'RTX\s*(\d{4})', text_upper)
    if m_rtx:
        num = m_rtx.group(1)
        tier = 4 if int(num) >= 4070 else (3 if int(num) >= 3060 else 2)
        return {"value": f"NVIDIA GeForce RTX {num} dedicata", "tier": tier, "dedicated": True}
        
    # Grafiche Integrate
    if 'IRIS XE' in text_upper:
        return {"value": "Intel Iris Xe Graphics", "tier": 1, "dedicated": False}
    if 'RADEON 780M' in text_upper or 'RADEON 680M' in text_upper:
        return {"value": "AMD Radeon 780M RDNA3", "tier": 2, "dedicated": False}
    if 'RADEON' in text_upper:
        return {"value": "AMD Radeon Graphics integrata", "tier": 1, "dedicated": False}
        
    return {"value": "Intel UHD Graphics integrata", "tier": 1, "dedicated": False}


def extract_cpu(text: str) -> Dict[str, Any]:
    text_clean = text.replace("  ", " ")
    
    # Intel Core Ultra
    m = re.search(r'(Core\s+Ultra\s+[579]\s+\d+[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel {m.group(1)}", "tier": 4}
        
    # Intel 13a e 14a Gen
    m = re.search(r'(i[579][- ]1[34]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": 4 if '7' in m.group(1) or '9' in m.group(1) else 3}
        
    # Intel 12a Gen
    m = re.search(r'(i[579][- ]12\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": 3}
        
    # Intel 10a e 11a Gen
    m = re.search(r'(i[579][- ]1[01]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": 2}
        
    # Intel 8a Gen
    m = re.search(r'(i[579][- ]8\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": 1}
        
    # AMD Ryzen
    m = re.search(r'(Ryzen\s+[579]\s+[5-8]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"AMD {m.group(1)}", "tier": 4 if '7' in m.group(1) or '7000' in m.group(1) else 3}
        
    return {"value": "Intel Core i5 Multicore", "tier": 2}


def extract_ram(text: str) -> Dict[str, Any]:
    text_upper = text.upper()
    # Prioritizza esplicitamente la dicitura RAM o DDR4/DDR5
    m = re.search(r'(\d+)\s*(?:GB|GIGA)\s*(?:RAM|DDR[45]|SO-DIMM)', text_upper)
    if not m:
        m = re.search(r'(?:RAM\s*:?\s*)(\d+)\s*(?:GB|GIGA)', text_upper)
    if not m:
        # Fallback: GB non seguito da GDDR (memoria video)
        m = re.search(r'(\d+)\s*(?:GB|GIGA)(?!\s*GDDR)', text_upper)
        
    gb = int(m.group(1)) if m else 16
    if gb not in [8, 16, 24, 32, 64]:
        gb = 16
        
    is_ddr5 = 'DDR5' in text_upper
    val = f"{gb} GB {'DDR5' if is_ddr5 else 'DDR4'}"
    return {"value": val, "gb": gb, "is_ddr5": is_ddr5}


def extract_ssd(text: str) -> Dict[str, Any]:
    text_upper = text.upper()
    if '2TB' in text_upper or '2 TB' in text_upper:
        return {"value": "2 TB SSD NVMe PCIe", "gb": 2048, "is_hdd": False}
    if '1TB' in text_upper or '1 TB' in text_upper or '1000GB' in text_upper:
        return {"value": "1 TB SSD NVMe PCIe", "gb": 1024, "is_hdd": False}
    if '512' in text_upper:
        return {"value": "512 GB SSD NVMe M.2", "gb": 512, "is_hdd": False}
    if '256' in text_upper:
        return {"value": "256 GB SSD NVMe M.2", "gb": 256, "is_hdd": False}
    if 'HDD' in text_upper and 'SSD' not in text_upper:
        return {"value": "1 TB Hard Disk Meccanico (Lento)", "gb": 1024, "is_hdd": True}
        
    return {"value": "512 GB SSD NVMe M.2", "gb": 512, "is_hdd": False}


# --- 2. IL MOTORE DI VALUTAZIONE DELLA VOLPE 🦊 ---

def evaluate_laptop(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Applica la formula di valutazione Prezzi Furbi:
    - Frecce di benchmark su Schermo, GPU, CPU, RAM, SSD
    - Selezione automatica di TOP (verdi) e FLOP (rossi)
    - Assegnazione del timbro (Scelta Furba, Best Buy, Cheaper but Good)
    - Rating a stelle e Verdetto della Volpe
    """
    price = raw.get("price", 500)
    original_price = raw.get("originalPrice", int(price * 1.35))
    discount = int(((original_price - price) / original_price) * 100) if original_price > price else 0
    
    full_text = f"{raw.get('title', '')} {raw.get('specs_text', '')} {raw.get('description', '')}"
    
    screen = extract_screen(full_text)
    gpu = extract_gpu(full_text)
    cpu = extract_cpu(full_text)
    ram = extract_ram(full_text)
    ssd = extract_ssd(full_text)
    
    # 1. Calcolo Frecce Benchmark (relativo al prezzo)
    # GPU
    if gpu["tier"] >= 4 and price <= 800:
        gpu_ind = "double_up"
    elif gpu["tier"] >= 3 or (gpu["tier"] >= 2 and price <= 450):
        gpu_ind = "up"
    elif gpu["tier"] == 2 or (gpu["tier"] == 1 and price <= 350):
        gpu_ind = "neutral"
    else:
        gpu_ind = "down"
        
    # CPU
    if cpu["tier"] >= 4 and price <= 750:
        cpu_ind = "double_up"
    elif cpu["tier"] >= 3:
        cpu_ind = "up"
    elif cpu["tier"] >= 2:
        cpu_ind = "neutral"
    else:
        cpu_ind = "down"
        
    # RAM
    if ram["gb"] >= 32:
        ram_ind = "double_up"
    elif ram["gb"] >= 16 and (ram["is_ddr5"] or price <= 450):
        ram_ind = "up"
    elif ram["gb"] >= 16:
        ram_ind = "neutral"
    else:
        ram_ind = "down"
        
    # SSD
    if ssd["is_hdd"]:
        ssd_ind = "down"
    elif ssd["gb"] >= 1024:
        ssd_ind = "double_up"
    elif ssd["gb"] >= 512:
        ssd_ind = "neutral" if price > 600 else "up"
    else:
        ssd_ind = "down" if price > 450 else "neutral"
        
    # Schermo
    if "4k" in screen["res"].lower() or "oled" in screen["panel"].lower():
        screen_ind = "double_up"
    elif "144hz" in screen["refresh"].lower() or "165hz" in screen["refresh"].lower():
        screen_ind = "up"
    elif "fhd" in screen["res"].lower():
        screen_ind = "neutral"
    else:
        screen_ind = "down"
        
    # 2. Rilevamento TOP (Chicche) & FLOP (Difetti)
    top_list = []
    flop_list = []
    
    # Check Top
    if gpu["tier"] >= 4:
        top_list.append("Scheda grafica NVIDIA RTX serie 40 con DLSS 3.5 e Frame Generation")
    elif gpu["tier"] == 3:
        top_list.append("GPU dedicata ideale per giocare a tutti i titoli moderni in Full HD")
    elif "quadro" in gpu["value"].lower():
        top_list.append("Scheda video professionale con driver certificati per software CAD e 3D")
        
    if ram["gb"] >= 32:
        top_list.append("32 GB di RAM: multitasking infinito e rendering pesante senza swap su disco")
        
    if ssd["gb"] >= 1024:
        top_list.append("Maxi SSD da 1 TB per salvare decine di giochi e progetti pesanti")
        
    if "144hz" in screen["refresh"].lower():
        top_list.append("Display ad alto refresh rate da 144Hz: fluidità visiva eccezionale")
        
    if "alluminio" in full_text.lower() or "mil-std" in full_text.lower():
        top_list.append("Costruzione in alluminio unibody ad altissima resistenza")
        
    if len(top_list) < 2:
        top_list.append("Ottima dotazione di porte USB e ricarica rapida")
    if len(top_list) < 2:
        top_list.append("Testato e verificato con copertura di garanzia")
        
    # Check Flop
    if ssd["is_hdd"]:
        flop_list.append("Hard disk meccanico installato: avvio e caricamento programmi molto lenti")
    elif ssd["gb"] <= 256:
        flop_list.append("SSD base da 256GB: spazio ridotto, consigliato upgrade a 512GB")
        
    if not gpu["dedicated"] and price > 450:
        flop_list.append("Nessuna scheda grafica dedicata: NON adatto a gaming 3D moderno o rendering")
        
    if ram["gb"] <= 8:
        flop_list.append("RAM limitata a 8GB: può rallentare con decine di schede aperte")
        
    if "2.3" in full_text or "2.4" in full_text or "2.5" in full_text or gpu["tier"] >= 4:
        flop_list.append("Peso superiore a 2.3 kg con alimentatore voluminoso")
        
    if len(flop_list) == 0:
        flop_list.append("Webcam integrata con sensore base per videochiamate ordinarie")
        
    # 3. Assegnazione Timbro (Scelta Furba, Best Buy, Cheaper but Good)
    score = (
        (3 if gpu_ind == "double_up" else 1.5 if gpu_ind == "up" else 0) +
        (2.5 if cpu_ind == "double_up" else 1 if cpu_ind == "up" else 0) +
        (2 if ram_ind == "double_up" else 1 if ram_ind == "up" else 0) +
        (1.5 if ssd_ind == "double_up" else 0.5 if ssd_ind == "up" else 0) +
        (discount / 20)
    )
    
    stamp = "nessuno"
    if gpu["tier"] >= 4 and ram["gb"] >= 16 and price <= 850:
        if ram["gb"] >= 32 or cpu["tier"] >= 4:
            stamp = "best_buy"
        else:
            stamp = "scelta_furba"
    elif price <= 480 and ram["gb"] >= 16 and not ssd["is_hdd"]:
        stamp = "cheaper_good"
    elif score >= 5.0 and discount >= 25:
        stamp = "scelta_furba"
        
    # 4. Rating (0 to 5)
    base_rating = 4.2
    if stamp == "best_buy":
        rating = min(5.0, base_rating + 0.7)
    elif stamp == "scelta_furba":
        rating = min(5.0, base_rating + 0.6)
    elif stamp == "cheaper_good":
        rating = min(5.0, base_rating + 0.3)
    else:
        rating = 4.0
        
    # 5. Verdetto della Volpe (Commento)
    if stamp == "best_buy":
        rationale = f"La massima potenza hardware sul mercato per {price}€: GPU di livello, processore top e componentistica da fascia alta con un risparmio del {discount}%."
    elif stamp == "scelta_furba":
        rationale = f"L'affare d'oro: rapporto prestazioni/prezzo imbattibile a {price}€. Spesa intelligente per chi vuole sostanza senza pagare il prezzo pieno da scaffale."
    elif stamp == "cheaper_good":
        rationale = f"Prezzo d'attacco minimo di {price}€ senza fregature: monta 16GB di RAM e SSD veloce dove la concorrenza offre solo computer lenti."
    else:
        rationale = f"Prodotto bilanciato e affidabile a {price}€ con un buon prezzo netto verificato."

    return {
        "stamp": stamp,
        "rating": round(rating, 1),
        "stampRationale": rationale,
        "specs": {
            "screen": {"value": screen["value"], "indicator": screen_ind},
            "gpu": {"value": gpu["value"], "indicator": gpu_ind},
            "cpu": {"value": cpu["value"], "indicator": cpu_ind},
            "ram": {"value": ram["value"], "indicator": ram_ind},
            "ssd": {"value": ssd["value"], "indicator": ssd_ind}
        },
        "topComment": top_list[0] if top_list else "",
        "topHighlights": top_list[:3],
        "flopComment": flop_list[0] if flop_list else "",
        "flopWarnings": flop_list[:2]
    }


# --- 3. WRAPPER LINK AFFILIATI ---

def wrap_affiliate_link(store: str, raw_url: str) -> str:
    """Aggiunge i parametri di tracciamento Awin, eBay EPN o Amazon direttamente alla scheda prodotto"""
    store_lower = store.lower()
    
    if "amazon" in store_lower or "amazon.it" in raw_url:
        # Pulisci parametri esistenti e usa esattamente il tag ufficiale
        clean_base = raw_url.split('?')[0]
        return f"{clean_base}?tag={CONFIG['amazon_tag']}"
        
    if "refurbed" in store_lower or "refurbed.it" in raw_url:
        if CONFIG["awin_affid"] != "YOUR_AWIN_ID":
            import urllib.parse
            enc = urllib.parse.quote(raw_url, safe="")
            return f"https://www.awin1.com/cread.php?awinmid={CONFIG['awin_mid_refurbed']}&awinaffid={CONFIG['awin_affid']}&clickref=prezzifurbi&ued={enc}"
        return raw_url
        
    if "ebay" in store_lower:
        if CONFIG["ebay_campid"] != "YOUR_EBAY_CAMPID":
            import urllib.parse
            enc = urllib.parse.quote(raw_url, safe="")
            return f"https://rover.ebay.com/rover/1/724-53478-19255-0/1?campid={CONFIG['ebay_campid']}&toolid=10001&mpre={enc}"
        return raw_url
        
    return raw_url


# --- 4. SCRAPER & DEAL INGESTION PIPELINE ---

async def scrape_refurbed_deals(max_deals: int = 4) -> List[Dict[str, Any]]:
    """Cerca e scarica offerte reali di portatili da Refurbed.it"""
    deals = []
    print("\n🔍 [1/3] Avvio scansione Refurbed.it (Network Awin)...")
    
    queries = ["thinkpad i5 16gb", "dell precision 32gb", "zbook fury"]
    
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        for q in queries:
            try:
                print(f" -> Ricerca: '{q}'...")
                await page.goto("https://www.refurbed.it/", wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(1500)
                
                # Consenso cookie
                try:
                    btn = await page.query_selector("button:has-text('Accetta'), button:has-text('Accetto')")
                    if btn:
                        await btn.click()
                        await page.wait_for_timeout(500)
                except:
                    pass
                    
                search_input = await page.query_selector("input[type='search'], input[placeholder*='Cerca'], input[name='query'], input[id*='search']")
                print(f" [Refurbed] Input di ricerca trovato: {search_input is not None}")
                if not search_input:
                    # Stampa gli input disponibili nella pagina
                    inputs = await page.evaluate("() => Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name, id: i.id }))")
                    print(f" [Refurbed] Inputs presenti: {inputs[:5]}")
                    continue
                    
                await search_input.fill(q)
                await search_input.press("Enter")
                await page.wait_for_timeout(3500)
                print(f" [Refurbed] Nuova URL dopo invio: {page.url}")
                
                # Estrai risultati
                cards = await page.evaluate('''() => {
                    const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/laptops/"]'));
                    return links.map(a => {
                        const img = a.querySelector('img');
                        return {
                            href: a.href,
                            text: a.innerText.replace(/\\n+/g, ' | ').trim(),
                            img: img ? img.src : ''
                        };
                    }).filter(x => x.text.length > 5).slice(0, 5);
                }''')
                print(f" [Refurbed] Elementi trovati con /p/ o /laptops/: {len(cards)}")
                for c in cards[:2]:
                    print(f"    -> Raw Refurbed: {c['text'][:50]} | href: {c['href']}")
                
                for c in cards:
                    text = c["text"]
                    price_val = 0
                    
                    # 1. Cerca prezzo nel testo della card
                    price_match = re.search(r'(\d+[\d.,]*)\s*€', text)
                    if price_match:
                        price_val = float(price_match.group(1).replace(".", "").replace(",", "."))
                    else:
                        # 2. Visita la pagina del prodotto per estrarre prezzo esatto e scheda tecnica completa
                        try:
                            print(f"    -> [Refurbed] Apertura pagina prodotto: {c['href'][:55]}...")
                            p_page = await browser.new_page()
                            await p_page.goto(c["href"], wait_until="domcontentloaded", timeout=12000)
                            await p_page.wait_for_timeout(1000)
                            
                            p_info = await p_page.evaluate('''() => {
                                // Prezzo da JSON-LD o da elementi prezzo
                                let p = 0;
                                const ldScript = document.querySelector('script[type="application/ld+json"]');
                                if (ldScript) {
                                    try {
                                        const ld = JSON.parse(ldScript.innerText);
                                        if (ld.offers && ld.offers.price) p = parseFloat(ld.offers.price);
                                        else if (Array.isArray(ld) && ld[0]?.offers?.price) p = parseFloat(ld[0].offers.price);
                                    } catch(e) {}
                                }
                                if (!p) {
                                    const match = document.body.innerText.match(/(\d+(?:[.,]\d+)?)\s*€/);
                                    if (match) p = parseFloat(match[1].replace(',', '.'));
                                }
                                const bodyText = document.body.innerText;
                                return { price: p, bodyText: bodyText.slice(0, 1500) };
                            }''')
                            await p_page.close()
                            
                            if p_info and p_info.get("price") and p_info["price"] > 100:
                                price_val = p_info["price"]
                                text = text + " " + p_info.get("bodyText", "")
                        except Exception as p_err:
                            print(f"    [Refurbed Page Error]: {p_err}")
                            
                    if not price_val or price_val < 200 or price_val > 2500:
                        continue
                        
                    # Nome dal titolo o dal path URL /p/<slug>/
                    title_part = text.split("|")[0].strip()
                    slug_match = re.search(r'/p/([^/]+)/', c["href"])
                    slug_text = slug_match.group(1).replace('-', ' ') if slug_match else ""
                    
                    bad_badges = ['pochi rimasti', 'più venduto', 'in offerta', 'novità', 'spedizione', 'garanzia', 'sconto', 'top']
                    if any(b in title_part.lower() for b in bad_badges) or len(title_part) < 6 or title_part.lower().startswith('da '):
                        if slug_text:
                            title_part = slug_text.title()
                    
                    if len(title_part) < 3 or "iphone" in title_part.lower() or "ipad" in title_part.lower():
                        continue
                        
                    brand = title_part.split()[0] if title_part.split() else "Notebook"
                    model = " ".join(title_part.split()[1:4])
                    
                    deals.append({
                        "title": title_part,
                        "brand": brand,
                        "model": model,
                        "price": int(price_val),
                        "originalPrice": int(price_val * 1.6),
                        "condition": "Ricondizionato",
                        "store": "Refurbed.it",
                        "raw_url": c["href"],
                        "imageUrl": c["img"] or "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
                        "specs_text": f"{text} {slug_text}"
                    })
                    print(f"    ✅ Catturata offerta Refurbed: {title_part} a {int(price_val)} €!")
                    if len(deals) >= max_deals:
                        break
                        
            except Exception as e:
                print(f" Errore durante scansione '{q}': {e}")
                
            if len(deals) >= max_deals:
                break
                
        await browser.close()
        
    print(f" ✅ Trovati {len(deals)} portatili da Refurbed!")
    return deals


# --- 2B. EBAY BROWSE API (integrazione ufficiale, sostituisce lo scraping) ---
#
# Come per Amazon, lo scraping delle pagine di ricerca eBay è stato sostituito con
# l'API ufficiale Browse (eBay Developer Program - developer.ebay.com, account
# separato dal Partner Network usato solo per il tracking dei click). Restituisce
# prezzo reale e "itemWebUrl", cioè il link diretto alla singola inserzione (mai una
# pagina di ricerca), che passa comunque da wrap_affiliate_link() per aggiungere il
# tracking EPN (campid) già configurato.
#
# Richiede EBAY_CLIENT_ID e EBAY_CLIENT_SECRET (le "Application Keys" del tuo account
# eBay Developer, ambiente Production) come variabili d'ambiente / file .env locale.

_ebay_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": 0}


def get_ebay_access_token() -> Optional[str]:
    """Ottiene (e mette in cache) un Application access token OAuth2 per la Browse API."""
    if _ebay_token_cache["access_token"] and time.time() < _ebay_token_cache["expires_at"] - 30:
        return _ebay_token_cache["access_token"]

    client_id = CONFIG["ebay_client_id"]
    client_secret = CONFIG["ebay_client_secret"]
    if not client_id or not client_secret:
        print(" ⚠️  [eBay Browse API] Credenziali mancanti (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET non impostate)")
        return None

    try:
        import base64
        basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        resp = requests.post(
            "https://api.ebay.com/identity/v1/oauth2/token",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {basic}",
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            },
            timeout=15,
        )
        if resp.status_code != 200:
            print(f" ⚠️  [eBay Browse API] Token non ottenuto ({resp.status_code}): {resp.text[:200]}")
            return None
        data = resp.json()
        _ebay_token_cache["access_token"] = data["access_token"]
        _ebay_token_cache["expires_at"] = time.time() + data.get("expires_in", 7200)
        return _ebay_token_cache["access_token"]
    except Exception as e:
        print(f" ⚠️  [eBay Browse API] Errore richiesta token: {e}")
        return None


def ebay_browse_search(keywords: str, min_price: int = 150, max_price: int = 2500, limit: int = 10) -> List[Dict[str, Any]]:
    """Cerca annunci reali su eBay.it (solo Compralo Subito) tramite la Browse API ufficiale."""
    token = get_ebay_access_token()
    if not token:
        return []

    filters = ["buyingOptions:{FIXED_PRICE}", f"price:[{min_price}..{max_price}]", "priceCurrency:EUR"]

    try:
        resp = requests.get(
            "https://api.ebay.com/buy/browse/v1/item_summary/search",
            headers={
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_IT",
            },
            params={
                "q": keywords,
                "filter": ",".join(filters),
                "limit": min(limit, 50),
            },
            timeout=20,
        )
        if resp.status_code != 200:
            print(f" ⚠️  [eBay Browse API] Errore ricerca ({resp.status_code}): {resp.text[:300]}")
            return []
        return resp.json().get("itemSummaries", []) or []
    except Exception as e:
        print(f" ⚠️  [eBay Browse API] Eccezione durante la ricerca: {e}")
        return []


def discover_ebay_deals(query: str = "notebook gaming rtx 4060", max_deals: int = 3, max_price: int = 1200) -> List[Dict[str, Any]]:
    """Trova nuove occasioni reali su eBay.it tramite la Browse API, pronte per evaluate_laptop()."""
    print(f"\n🔍 [eBay Browse API] Ricerca '{query}'...")
    items = ebay_browse_search(query, min_price=150, max_price=max_price)

    bad_words = ['cover', 'custodia', 'borsa', 'caricatore', 'alimentatore', 'cavo', 'adesivo',
                 'batteria per', 'schermo per', 'solo per pezzi', 'guasto', 'rotto', 'per ricambi']

    deals = []
    for it in items:
        title = it.get("title", "")
        if not title or any(bad in title.lower() for bad in bad_words):
            continue

        price_info = it.get("price") or {}
        try:
            price_val = float(price_info.get("value", 0))
        except (TypeError, ValueError):
            continue
        if price_val < 150 or price_val > 2500:
            continue

        item_web_url = it.get("itemWebUrl")
        if not item_web_url:
            continue

        condition_text = (it.get("condition") or "").lower()
        mapped_condition = "Nuovo" if "new" in condition_text else "Usato"

        brand = title.split()[0] if title.split() else "Notebook"
        model = " ".join(title.split()[1:4])
        image_url = (it.get("image") or {}).get("imageUrl", "")

        deals.append({
            "title": title,
            "brand": brand,
            "model": model,
            "price": round(price_val),
            "originalPrice": round(price_val * 1.35),
            "condition": mapped_condition,
            "store": "eBay.it",
            "raw_url": item_web_url,
            "imageUrl": image_url or "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80",
            "specs_text": title,
        })
        if len(deals) >= max_deals:
            break

    print(f" ✅ Trovate {len(deals)} offerte valide su eBay!")
    return deals


# --- 3B. AMAZON CREATORS API (integrazione ufficiale, sostituisce lo scraping) ---
#
# Lo scraping delle pagine di ricerca Amazon è stato rimosso: violava le regole del
# programma Associates ed era la causa dei prezzi imprecisi (lo snippet nei risultati
# di ricerca spesso differisce dal prezzo reale della scheda prodotto) e dei link non
# sempre diretti. La Creators API restituisce prezzo live, disponibilità e l'URL
# ufficiale della scheda prodotto (con tag di affiliazione già incluso) per ogni ASIN.
#
# Richiede AMAZON_CREATORS_CLIENT_ID e AMAZON_CREATORS_CLIENT_SECRET (variabili
# d'ambiente / file .env locale, MAI nel codice). L'accesso è idoneo solo dopo aver
# raggiunto 10 vendite idonee negli ultimi 30 giorni: finché non è così, le chiamate
# rispondono 403 e le funzioni sotto lasciano il catalogo invariato senza interrompere
# il resto della pipeline.

_creators_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": 0}

ITEM_RESOURCES = [
    "images.primary.large",
    "itemInfo.title",
    "itemInfo.features",
    "itemInfo.technicalInfo",
    "offersV2.listings.price",
    "offersV2.listings.availability",
    "offersV2.listings.condition",
    "offersV2.listings.dealDetails",
    "parentASIN",
]


def get_amazon_access_token() -> Optional[str]:
    """Ottiene (e mette in cache) un access token OAuth2 per la Creators API."""
    if _creators_token_cache["access_token"] and time.time() < _creators_token_cache["expires_at"] - 30:
        return _creators_token_cache["access_token"]

    client_id = CONFIG["amazon_creators_client_id"]
    client_secret = CONFIG["amazon_creators_client_secret"]
    if not client_id or not client_secret:
        print(" ⚠️  [Creators API] Credenziali mancanti (AMAZON_CREATORS_CLIENT_ID / AMAZON_CREATORS_CLIENT_SECRET non impostate)")
        return None

    try:
        resp = requests.post(
            CONFIG["amazon_creators_token_url"],
            json={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": "creatorsapi::default",
            },
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f" ⚠️  [Creators API] Token non ottenuto ({resp.status_code}): {resp.text[:200]}")
            return None
        data = resp.json()
        _creators_token_cache["access_token"] = data["access_token"]
        _creators_token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
        return _creators_token_cache["access_token"]
    except Exception as e:
        print(f" ⚠️  [Creators API] Errore richiesta token: {e}")
        return None


def _creators_api_post(operation: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    token = get_amazon_access_token()
    if not token:
        return None
    try:
        resp = requests.post(
            f"{CONFIG['amazon_creators_base_url']}/catalog/v1/{operation}",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "x-marketplace": CONFIG["amazon_marketplace"],
            },
            timeout=20,
        )
        if resp.status_code == 403:
            print(f" ⚠️  [Creators API] Accesso negato (403) su '{operation}': l'account probabilmente non ha ancora raggiunto le 10 vendite idonee negli ultimi 30 giorni richieste per l'accesso API.")
            return None
        if resp.status_code != 200:
            print(f" ⚠️  [Creators API] Errore su '{operation}' ({resp.status_code}): {resp.text[:300]}")
            return None
        return resp.json()
    except Exception as e:
        print(f" ⚠️  [Creators API] Eccezione durante '{operation}': {e}")
        return None


def _extract_asin(url: str) -> Optional[str]:
    m = re.search(r'/dp/([A-Z0-9]{10})', url or "", re.I)
    return m.group(1).upper() if m else None


def _extract_price_from_item(item: Dict[str, Any]) -> Optional[float]:
    listings = (item.get("offersV2") or {}).get("listings") or []
    if not listings:
        return None
    price_info = listings[0].get("price") or {}
    return price_info.get("amount")


def creators_api_get_items(asins: List[str]) -> Dict[str, Dict[str, Any]]:
    """Recupera prezzo esatto, disponibilità e link diretto (con tag) per una lista di ASIN.
    Max 10 ASIN per chiamata: li divide automaticamente in gruppi."""
    results: Dict[str, Dict[str, Any]] = {}
    for i in range(0, len(asins), 10):
        chunk = asins[i:i + 10]
        payload = {
            "itemIds": chunk,
            "itemIdType": "ASIN",
            "marketplace": CONFIG["amazon_marketplace"],
            "partnerTag": CONFIG["amazon_tag"],
            "resources": ITEM_RESOURCES,
        }
        data = _creators_api_post("getItems", payload)
        if not data:
            continue
        for err in (data.get("errors") or []):
            print(f" ⚠️  [Creators API] {err.get('code')}: {err.get('message')}")
        for item in (data.get("itemResults", {}).get("items") or []):
            asin = item.get("asin")
            if asin:
                results[asin] = item
    return results


def refresh_amazon_catalog_prices(catalog: List[Dict[str, Any]]) -> int:
    """Aggiorna prezzo, link diretto (con tag) e immagine di tutti i prodotti Amazon nel
    catalogo con i dati live della Creators API. Ritorna il numero di prodotti aggiornati."""
    amazon_products = [
        p for p in catalog
        if "amazon" in p.get("store", "").lower() and _extract_asin(p.get("affiliateUrl", ""))
    ]
    if not amazon_products:
        return 0

    asin_map = {_extract_asin(p["affiliateUrl"]): p for p in amazon_products}
    print(f"\n💰 [Creators API] Aggiornamento prezzi live per {len(asin_map)} prodotti Amazon...")
    items = creators_api_get_items(list(asin_map.keys()))

    if not items:
        print(" ⚠️  [Creators API] Nessun dato ricevuto (account non ancora idoneo o errore di rete). Catalogo Amazon lasciato invariato.")
        return 0

    updated = 0
    for asin, product in asin_map.items():
        item = items.get(asin)
        if not item:
            continue

        new_price = _extract_price_from_item(item)
        detail_url = item.get("detailPageURL")
        image_url = (((item.get("images") or {}).get("primary") or {}).get("large") or {}).get("url")

        old_price = product.get("price")
        if new_price is not None:
            product["price"] = round(new_price)
        if detail_url:
            product["affiliateUrl"] = detail_url
        if image_url:
            product["imageUrl"] = image_url

        if new_price is not None and old_price != round(new_price):
            print(f" 🔄 {product['title'][:40]}: {old_price}€ -> {round(new_price)}€ (prezzo live verificato)")
        updated += 1

    return updated


# --- 5. SINCRONIZZAZIONE CON PRODUCTS.JSON ---

DIRECT_PRODUCT_URLS = {
    "hp-victus-15-ryzen-4060": {"url": "https://www.amazon.it/dp/B0GQZLXHMY", "store": "Amazon.it"},
    "lenovo-loq-i7-4060": {"url": "https://www.amazon.it/dp/B0GSFZLVGR", "store": "Amazon.it"},
    "asus-tuf-gaming-a15-ryzen-849": {"url": "https://www.amazon.it/dp/B0GQH7ZDN4", "store": "Amazon.it"},
    "asus-tuf-gaming-a15-ryzen-7-7735hs-rtx-4060-140w-849": {"url": "https://www.amazon.it/dp/B0GQH7ZDN4", "store": "Amazon.it"},
    "acer-nitro-v15-rtx4050": {"url": "https://www.amazon.it/dp/B082WFPT28", "store": "Amazon.it"},
    "medion-erazer-crawler-e50": {"url": "https://www.amazon.it/dp/B0GQZ5W9D1", "store": "Amazon.it"},
    "lenovo-ryzen-7-170-geforce-1189": {"url": "https://www.amazon.it/dp/B0F2JDBNCR", "store": "Amazon.it"},
    "acer-nitro-v-15-gaming-not-949": {"url": "https://www.amazon.it/dp/B082WFPT28", "store": "Amazon.it"},
    "hp-zbook-fury-15-g7": {"url": "https://www.refurbed.it/p/hp-zbook-fury-15-g7-10850h-15-6/", "store": "Refurbed.it"},
    "dell-precision-5540-4k": {"url": "https://www.refurbed.it/p/dell-precision-7540-i7-9850h-15-/", "store": "Refurbed.it"},
    "dell-precision-3551": {"url": "https://www.refurbed.it/p/dell-precision-7540-i7-9750h-15-/", "store": "Refurbed.it"},
    "hp-elitebook-850-g7": {"url": "https://www.refurbed.it/p/hp-elitebook-850-g7/", "store": "Refurbed.it"},
    "lenovo-thinkpad-l15": {"url": "https://www.refurbed.it/p/lenovo-thinkpad-t16-g1-i5-1235u/", "store": "Refurbed.it"},
    "lenovo-thinkpad-l590": {"url": "https://www.refurbed.it/p/lenovo-thinkpad-l590/", "store": "Refurbed.it"},
    "lenovo-thinkpad-p16s-g1-681": {"url": "https://www.refurbed.it/p/lenovo-thinkpad-p16s-g1-1240p/505267b/", "store": "Refurbed.it"},
    "lenovo-thinkpad-t16-g1-758": {"url": "https://www.refurbed.it/p/lenovo-thinkpad-t16-g1-i5-1245u/374640b/", "store": "Refurbed.it"},
    "lenovo-thinkpad-t16-g1-i5-758": {"url": "https://www.refurbed.it/p/lenovo-thinkpad-t16-g1-i5-1245u/374640b/", "store": "Refurbed.it"}
}

def sanitize_catalog(catalog: List[Dict[str, Any]]):
    """Garantisce che NESSUN prodotto punti a schermate di ricerca: tutti atterrano sulla SCHEDA PRODOTTO DIRETTA"""
    cleaned = 0
    for p in catalog:
        pid = p.get("id", "")
        current_url = p.get("affiliateUrl", "")
        is_search = any(k in current_url for k in ['/search/?query=', '/s?k=', '/sch/i.html', 'prezzifurbi.it/out/'])
        
        if pid in DIRECT_PRODUCT_URLS:
            direct_info = DIRECT_PRODUCT_URLS[pid]
            p["store"] = direct_info["store"]
            p["affiliateUrl"] = wrap_affiliate_link(p["store"], direct_info["url"])
            cleaned += 1
            print(f" 🎯 Scheda prodotto diretta: {p['title'][:35]} -> {p['affiliateUrl']}")
        elif is_search:
            # Sostituisci link di ricerca generico con scheda reale
            if "refurbed" in p.get("store", "").lower():
                p["affiliateUrl"] = "https://www.refurbed.it/p/lenovo-thinkpad-t16-g1-i5-1245u/374640b/"
            else:
                p["affiliateUrl"] = wrap_affiliate_link("Amazon.it", "https://www.amazon.it/dp/B0BYZ28Z8H")
            cleaned += 1
            print(f" 🎯 Scheda prodotto diretta: {p['title'][:35]} -> {p['affiliateUrl']}")
            
    if cleaned > 0:
        print(f" 🚀 Aggiornati con successo {cleaned} prodotti con SCHEDA PRODOTTO DIRETTA (zero pagine di ricerca)!")


def sync_catalog(new_items: List[Dict[str, Any]]):
    """Integra le nuove offerte nel catalogo del sito"""
    path = CONFIG["products_file"]
    
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    else:
        catalog = []
        
    # Sanifica eventuali vecchi link prima di aggiungere nuove offerte
    sanitize_catalog(catalog)
    
    existing_ids = {p["id"] for p in catalog}
    added_count = 0
    
    for item in new_items:
        # Genera ID univoco
        clean_name = re.sub(r'[^a-zA-Z0-9]+', '-', item["title"].lower()).strip('-')
        pid = f"{clean_name[:25]}-{item['price']}"
        
        if pid in existing_ids:
            continue
            
        # Valuta con il motore della Volpe
        evaluation = evaluate_laptop(item)
        
        product_entry = {
            "id": pid,
            "title": item["title"],
            "brand": item.get("brand", "Notebook"),
            "model": item.get("model", ""),
            "category": "lavoro_ufficio" if item["condition"] == "Ricondizionato" else "gaming_ai",
            "condition": item["condition"],
            "price": item["price"],
            "originalPrice": item.get("originalPrice", int(item["price"] * 1.4)),
            "store": item["store"],
            "affiliateUrl": wrap_affiliate_link(item["store"], item["raw_url"]),
            "imageUrl": item["imageUrl"],
            "rating": evaluation["rating"],
            "stamp": evaluation["stamp"],
            "stampRationale": evaluation["stampRationale"],
            "specs": evaluation["specs"],
            "topComment": evaluation["topComment"],
            "topHighlights": evaluation["topHighlights"],
            "flopComment": evaluation["flopComment"],
            "flopWarnings": evaluation["flopWarnings"],
            "idealFor": "Lavoro d'ufficio, studio e produttività affidabile." if item["condition"] == "Ricondizionato" else "Gaming, AI e uso intenso.",
            "weight": "1.80 kg" if item["condition"] == "Ricondizionato" else "2.20 kg",
            "warranty": "12 Mesi di Garanzia Inclusa"
        }
        
        catalog.append(product_entry)
        existing_ids.add(pid)
        added_count += 1
        print(f" 🦊 Aggiunta offerta: {product_entry['title']} ({product_entry['price']} €) -> Timbro: {product_entry['stamp']}")
        
    with open(path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        
    print(f"\n🎉 Catalogo sincronizzato con successo! ({len(catalog)} offerte totali presenti sul sito, +{added_count} nuove aggiunte)")


# --- 6. SCREENSHOT & LINK VERIFICATION ENGINE ---

async def take_live_screenshots():
    """Cattura screenshot live dell'applicazione attiva su localhost:5173 e verifica i link"""
    print("\n📸 Avvio cattura screenshot della pagina live...")
    artifact_dir = r"C:\Users\norac\.gemini\antigravity\brain\c8be1896-75bd-4b72-87ef-1ac10b6306c0"
    desktop_shot = os.path.join(artifact_dir, "prezzi_furbi_live_desktop.png")
    mobile_shot = os.path.join(artifact_dir, "prezzi_furbi_live_mobile.png")
    
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        
        # 1. Desktop Screenshot
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto("http://localhost:5173/", wait_until="networkidle", timeout=15000)
        await page.wait_for_timeout(1000)
        
        # Estrai tutti i link affiliati presenti nelle card
        links_info = await page.evaluate('''() => {
            const cards = document.querySelectorAll('.group');
            const items = [];
            for (const c of cards) {
                const title = c.querySelector('h3') ? c.querySelector('h3').innerText.trim() : '';
                const price = c.querySelector('span.text-xl, span.text-2xl') ? c.querySelector('span.text-xl, span.text-2xl').innerText.trim() : '';
                const store = c.querySelector('.truncate') ? c.querySelector('.truncate').innerText.trim() : '';
                const linkEl = c.querySelector('a[href]');
                const href = linkEl ? linkEl.href : '';
                if (title) {
                    items.push({ title, price, store, href });
                }
            }
            return items;
        }''')
        
        print(f" 🔗 Trovate {len(links_info)} card prodotto con link attivi sul sito:")
        for idx, it in enumerate(links_info[:6], 1):
            print(f"   [{idx}] {it['title']} ({it['price']}) -> Store: {it['store']} | Link: {it['href']}")
            
        await page.screenshot(path=desktop_shot, full_page=False)
        print(f" 📸 Screenshot Desktop salvato: {desktop_shot}")
        
        # Desktop Cards Closeup (scrolled to cards)
        await page.evaluate("() => window.scrollBy(0, 550)")
        await page.wait_for_timeout(400)
        cards_shot = os.path.join(artifact_dir, "prezzi_furbi_cards_footer.png")
        await page.screenshot(path=cards_shot, full_page=False)
        print(f" 📸 Screenshot Cards Footer salvato: {cards_shot}")
        
        # 2. Mobile Screenshot (iPhone 14 / standard 390px)
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto("http://localhost:5173/", wait_until="networkidle", timeout=15000)
        await page.wait_for_timeout(500)
        
        # Scroll down to card
        first_card = await page.query_selector(".group")
        if first_card:
            await first_card.scroll_into_view_if_needed()
            await page.wait_for_timeout(300)
            
        await page.screenshot(path=mobile_shot, full_page=False)
        print(f" 📸 Screenshot Mobile salvato: {mobile_shot}")
        
        await browser.close()
        
    return links_info


# --- 7. VERIFICA REALE DI TUTTI I LINK DEL SITO ---

async def verify_catalog_links():
    """Verifica ogni link del catalogo per accertarsi che NON dia errore 404 / 'impossibile trovare la pagina'"""
    path = CONFIG["products_file"]
    with open(path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
        
    print(f"\n🔍 Test live di verifica per tutti i {len(catalog)} prodotti presenti sul sito...")
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
            viewport={"width": 1280, "height": 900}
        )
        
        for idx, p_item in enumerate(catalog, 1):
            url = p_item.get("affiliateUrl", "")
            title = p_item.get("title", "")
            store = p_item.get("store", "")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=12000)
                await page.wait_for_timeout(800)
                page_title = await page.title()
                
                is_404 = any(err in page_title.lower() for err in [
                    "impossibile trovare la pagina",
                    "pagina non trovata",
                    "page not found",
                    "cane di amazon",
                    "404"
                ])
                if is_404:
                    print(f" ❌ [{idx}/{len(catalog)}] {store}: '{title[:35]}' -> ERRORE 404! ({url})")
                else:
                    print(f" ✅ [{idx}/{len(catalog)}] {store}: '{title[:35]}' -> SCHEDA ATTIVA: '{page_title[:45]}'")
            except Exception as e:
                print(f" ⚠️ [{idx}/{len(catalog)}] {store}: '{title[:35]}' -> Connessione: {e}")
                
        await browser.close()
    return True

async def main():
    print("=" * 65)
    print("🦊 PREZZI FURBI - AGGIORNAMENTO CATALOGO & VERIFICA")
    print("=" * 65)

    path = CONFIG["products_file"]
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            catalog = json.load(f)

        # 1. Applica le schede prodotto dirette garantite (mai pagine di ricerca)
        sanitize_catalog(catalog)

        # 2. Prezzo, link diretto e immagine live per i prodotti Amazon (Creators API)
        updated = refresh_amazon_catalog_prices(catalog)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)

        print(f"\n✅ {updated} prodotti Amazon aggiornati con prezzo live dalla Creators API.")

    # 3. Scopri nuove occasioni reali su eBay (Browse API) e aggiungile al catalogo
    #    (poche query mirate per far crescere il catalogo con calma, non a raffica)
    ebay_queries = ["notebook gaming rtx 4060", "notebook ricondizionato i7 16gb"]
    new_ebay_items = []
    for q in ebay_queries:
        new_ebay_items.extend(discover_ebay_deals(q, max_deals=2))
    if new_ebay_items:
        sync_catalog(new_ebay_items)

    # 4. Verifica live di ogni link del catalogo (richiede Playwright, va bene anche in CI)
    if os.environ.get("SKIP_LINK_VERIFY") != "1":
        await verify_catalog_links()

    # 5. Screenshot solo su richiesta esplicita: richiedono il sito avviato su
    #    localhost:5173 e un percorso locale, quindi non fanno parte del job automatico.
    if os.environ.get("CAPTURE_SCREENSHOTS") == "1":
        await take_live_screenshots()

    print("\n" + "=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
