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
from datetime import datetime, timezone
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


def _today_iso() -> str:
    """Data odierna (UTC) in formato ISO, usata per lastUpdated e priceHistory."""
    return datetime.now(timezone.utc).date().isoformat()


# --- CONFIGURAZIONE AFFILIAZIONI ---
CONFIG = {
    "awin_affid": os.environ.get("AWIN_AFFID", "3095611"),  # Publisher ID Awin (Prezzifurbi)
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
    # Non assumere 144Hz solo perché il venditore scrive "gaming" nel titolo: molti
    # laptop marketing come "gaming" hanno in realtà un pannello 60Hz standard
    refresh = f'{refresh_match.group(1)}Hz' if refresh_match else '60Hz'
    
    # Tipo pannello
    panel = 'OLED' if 'oled' in text_lower else ('IPS' if 'ips' in text_lower else 'LED')
    
    val = f'{size} {res}'
    if refresh != '60Hz':
        val += f' {refresh}'
    val += f' {panel}'
    
    return {"value": val, "size": size, "refresh": refresh, "panel": panel, "res": res}


def extract_gpu(text: str) -> Dict[str, Any]:
    text_upper = text.upper()

    # Normalizza "RTX4060" (venditore senza spazio) in "RTX 4060" così i controlli
    # letterali sotto riconoscono il modello a prescindere da come è scritto
    text_upper = re.sub(r'(RTX|GTX)\s*(\d{3,4})', r'\1 \2', text_upper)

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
        
    # NVIDIA Quadro Workstation - silicio debole (benchmark reali: T2000 ~17,
    # T1000/P620 ~14 su una scala 0-100 comparabile a RTX 4050 ~45): NON sono
    # GPU da gaming, quindi restano su tier basso nonostante il nome "professionale".
    if 'QUADRO T2000' in text_upper or 'T2000' in text_upper:
        return {"value": "NVIDIA Quadro T2000 (4GB GDDR6 ISV)", "tier": 2, "dedicated": True}
    if 'QUADRO T1000' in text_upper or 'T1000' in text_upper:
        return {"value": "NVIDIA Quadro T1000 (4GB GDDR6)", "tier": 1, "dedicated": True}
    if 'QUADRO P620' in text_upper or 'P620' in text_upper:
        return {"value": "NVIDIA Quadro P620 (4GB GDDR5)", "tier": 1, "dedicated": True}
        
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
    if 'VEGA' in text_upper:
        return {"value": "AMD Radeon Vega Graphics integrata", "tier": 1, "dedicated": False}
        
    return {"value": "Intel UHD Graphics integrata", "tier": 1, "dedicated": False}


# Tier (1=debole, 4=top) derivati dai punteggi reali NotebookCheck.net per fascia di
# generazione (stessa fonte/tabella usata lato frontend in hardwareBenchmarks.ts).
# A differenza della vecchia logica, qui i3/i5/i7/i9 vengono valutati SEPARATAMENTE
# dentro ogni generazione invece di condividere lo stesso tier: un i5 e un i9 della
# stessa generazione non sono equivalenti.
_INTEL_TIER = {
    ('legacy', '3'): 1, ('legacy', '5'): 1, ('legacy', '7'): 2, ('legacy', '9'): 2,
    ('10-11', '3'): 2, ('10-11', '5'): 2, ('10-11', '7'): 2, ('10-11', '9'): 3,
    ('12', '3'): 3, ('12', '5'): 3, ('12', '7'): 4, ('12', '9'): 4,
    ('13-14', '3'): 3, ('13-14', '5'): 4, ('13-14', '7'): 4, ('13-14', '9'): 4,
}
_RYZEN_TIER = {
    ('legacy', '3'): 1, ('legacy', '5'): 2, ('legacy', '7'): 3, ('legacy', '9'): 3,
    ('7000', '3'): 2, ('7000', '5'): 3, ('7000', '7'): 3, ('7000', '9'): 4,
}
_CORE_ULTRA_TIER = {'5': 3, '7': 3, '9': 4}


def extract_cpu(text: str) -> Dict[str, Any]:
    text_clean = text.replace("  ", " ")

    # Intel Core Ultra
    m = re.search(r'(Core\s+Ultra\s+([579])\s+\d+[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel {m.group(1)}", "tier": _CORE_ULTRA_TIER[m.group(2)]}

    # Intel Core 3/5/7 (nuova nomenclatura 2024+, senza "i" né "Ultra": es. "Core 5-210H")
    m = re.search(r'(Core\s+([357])[- ]?(\d{3})[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel {m.group(1)}", "tier": _INTEL_TIER[('13-14', m.group(2))]}

    # Intel 13a e 14a Gen
    m = re.search(r'(i([579])[- ]1[34]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": _INTEL_TIER[('13-14', m.group(2))]}

    # Intel 12a Gen
    m = re.search(r'(i([579])[- ]12\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": _INTEL_TIER[('12', m.group(2))]}

    # Intel 10a e 11a Gen
    m = re.search(r'(i([579])[- ]1[01]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": _INTEL_TIER[('10-11', m.group(2))]}

    # Intel 8a/9a Gen (o generazione non riconosciuta)
    m = re.search(r'(i([579])[- ][89]\d{3}[a-zA-Z]*)', text_clean, re.I)
    if m:
        return {"value": f"Intel Core {m.group(1).replace(' ', '-')}", "tier": _INTEL_TIER[('legacy', m.group(2))]}

    # AMD Ryzen
    m = re.search(r'(Ryzen\s+([579])\s+([5-8]\d{3})[a-zA-Z]*)', text_clean, re.I)
    if m:
        bracket = '7000' if m.group(3).startswith('7') else 'legacy'
        return {"value": f"AMD {m.group(1)}", "tier": _RYZEN_TIER[(bracket, m.group(2))]}

    # Famiglia CPU dichiarata ma senza numero di modello riconoscibile (es. un
    # venditore che scrive "i7-16GB", dove "16GB" è la RAM non un modello CPU):
    # non ricadere comunque su "i5" come se non ci fosse nessuna informazione,
    # usa almeno la famiglia giusta con un tier generico (fascia "legacy").
    m = re.search(r'\bi([579])\b', text_clean, re.I)
    if m:
        fam = m.group(1)
        return {"value": f"Intel Core i{fam} Multicore", "tier": _INTEL_TIER[('legacy', fam)]}

    m = re.search(r'\bRyzen\s+([579])\b', text_clean, re.I)
    if m:
        fam = m.group(1)
        return {"value": f"AMD Ryzen {fam} Multicore", "tier": _RYZEN_TIER[('legacy', fam)]}

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


def extract_weight(text: str) -> Optional[str]:
    """Cerca un peso esplicito nel testo (es. '1,49 kg', '1.5kg'). None se assente,
    cosi' il chiamante puo' ricadere sulla stima di default in base alla condizione."""
    m = re.search(r'(\d[.,]\d{1,2})\s*kg', text.lower())
    if not m:
        return None
    kg = float(m.group(1).replace(',', '.'))
    if kg < 0.8 or kg > 5:
        return None
    return f"{kg:.2f} kg"


# --- 2. IL MOTORE DI VALUTAZIONE DELLA VOLPE 🦊 ---

def compute_gpu_indicator(tier: int, price: int) -> str:
    """Freccia GPU dal tier (1-5, vedi extract_gpu) relativo al prezzo pagato.
    Condivisa tra evaluate_laptop() e regenerate_indicators() così le card e la
    rigenerazione del catalogo esistente non possono mai andare fuori sincrono."""
    if tier >= 4 and price <= 800:
        return "double_up"
    if tier >= 3 or (tier >= 2 and price <= 450):
        return "up"
    if tier == 2 or (tier == 1 and price <= 350):
        return "neutral"
    return "down"


def derive_use_cases(gpu: Dict[str, Any], cpu: Dict[str, Any], ram: Dict[str, Any], weight_kg: Optional[float], price: int) -> List[str]:
    """Tag di utilizzo (Gaming/Home/Lavoro/Studio/Creatività/Programmazione) dalle
    specifiche reali: un prodotto può avere più utilizzi, mai un punteggio unico.
    Sostituisce la vecchia categoria singola come contesto per volpe e filtri."""
    tags = []
    gpu_strong = gpu["dedicated"] and gpu["tier"] >= 3
    gpu_professional = "quadro" in gpu["value"].lower()

    if gpu_strong:
        tags.append("gaming")
    if gpu_strong or gpu_professional or (ram["gb"] >= 32 and cpu["tier"] >= 3):
        tags.append("creativita")
    if ram["gb"] >= 16 and cpu["tier"] >= 2:
        tags.append("programmazione")
    if (weight_kg is not None and weight_kg < 2) or price <= 500:
        tags.append("studio")
    if not (ram["gb"] <= 8 and cpu["tier"] <= 1):
        tags.append("lavoro")
    if not tags:
        tags.append("home")
    return tags


def compute_cpu_indicator(tier: int, price: int) -> str:
    """Freccia CPU dal tier (1-4, vedi extract_cpu), stessa logica di compute_gpu_indicator."""
    if tier >= 4 and price <= 750:
        return "double_up"
    if tier >= 3:
        return "up"
    if tier >= 2:
        return "neutral"
    return "down"


def evaluate_laptop(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Applica la formula di valutazione Prezzi Furbi:
    - Frecce di benchmark su Schermo, GPU, CPU, RAM, SSD
    - Selezione automatica di TOP (verdi) e FLOP (rossi)
    - Assegnazione del timbro (Scelta Furba, Best Buy, Cheaper but Good)
    - Rating a stelle e Verdetto della Volpe
    """
    price = raw.get("price", 500)
    
    full_text = f"{raw.get('title', '')} {raw.get('specs_text', '')} {raw.get('description', '')}"
    
    screen = extract_screen(full_text)
    gpu = extract_gpu(full_text)
    cpu = extract_cpu(full_text)
    ram = extract_ram(full_text)
    ssd = extract_ssd(full_text)

    weight_text = extract_weight(full_text)
    weight_kg = float(weight_text.split()[0]) if weight_text else None
    use_cases = derive_use_cases(gpu, cpu, ram, weight_kg, price)
    
    # 1. Calcolo Frecce Benchmark (relativo al prezzo)
    gpu_ind = compute_gpu_indicator(gpu["tier"], price)
    cpu_ind = compute_cpu_indicator(cpu["tier"], price)
        
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
        if 'RTX 40' in gpu["value"].upper() or re.search(r'RTX\s*4\d{3}', gpu["value"].upper()):
            top_list.append("Scheda grafica NVIDIA RTX serie 40 con DLSS 3.5 e Frame Generation")
        else:
            top_list.append("Scheda grafica NVIDIA RTX dedicata di fascia alta con DLSS e Frame Generation")
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
    # Punteggio di VALORE puro: solo specifiche reali relative al prezzo pagato
    # (già calcolate sopra), mai lo sconto dichiarato dal venditore.
    score = (
        (3 if gpu_ind == "double_up" else 1.5 if gpu_ind == "up" else 0) +
        (2.5 if cpu_ind == "double_up" else 1 if cpu_ind == "up" else 0) +
        (2 if ram_ind == "double_up" else 1 if ram_ind == "up" else 0) +
        (1.5 if ssd_ind == "double_up" else 0.5 if ssd_ind == "up" else 0)
    )

    stamp = "nessuno"
    if gpu["tier"] >= 4 and ram["gb"] >= 16 and price <= 850:
        if ram["gb"] >= 32 or cpu["tier"] >= 4:
            stamp = "best_buy"
        else:
            stamp = "scelta_furba"
    elif price <= 480 and ram["gb"] >= 16 and not ssd["is_hdd"]:
        stamp = "cheaper_good"
    elif score >= 6.0:
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
        rationale = f"La massima potenza hardware sul mercato per {price}€: GPU di livello, processore top e componentistica da fascia alta."
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
        "useCases": use_cases,
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
        
    if "ebay" in store_lower:
        if CONFIG["ebay_campid"] != "YOUR_EBAY_CAMPID":
            import urllib.parse
            parts = urllib.parse.urlsplit(raw_url)
            query = urllib.parse.parse_qsl(parts.query)
            query += [
                ("mkevt", "1"),
                ("mkcid", "1"),
                ("mkrid", "724-53478-19255-0"),
                ("campid", CONFIG["ebay_campid"]),
                ("toolid", "10001"),
            ]
            return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
        return raw_url
        
    return raw_url


# --- 4. SCRAPER & DEAL INGESTION PIPELINE ---

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

# Budget di chiamate API eBay per questo singolo run (il workflow gira una volta a
# notte, quindi "budget giornaliero" = budget di questo processo). Il limite reale
# dell'account eBay Browse API è 5000 chiamate/giorno: teniamo un margine ampio
# sotto quella soglia per non rischiare mai di saturarla, anche in caso di bug o
# di una notte con moltissimi annunci nuovi da valutare in dettaglio.
DAILY_API_BUDGET = 4000
_ebay_api_calls_used = 0

# Tetto di sicurezza sui NUOVI prodotti aggiunti in una notte (non limita gli
# aggiornamenti di prezzo su annunci già noti, solo la crescita del catalogo).
# Il pool ampio di query di Fase 1 può campionare centinaia di annunci nuovi in
# un run solo (verificato il 2026-09-22: ~275 in una notte) — troppo per una
# revisione umana della qualità. Alzare o rimuovere quando la qualità è verificata
# su più notti consecutive a ritmo più contenuto.
MAX_NEW_PRODUCTS_PER_RUN = 60


def _ebay_budget_allows(cost: int = 1) -> bool:
    """Controlla (e consuma) budget prima di ogni chiamata reale all'API eBay.
    Ritorna False senza consumare nulla se andremmo oltre DAILY_API_BUDGET."""
    global _ebay_api_calls_used
    if _ebay_throttled or _ebay_api_calls_used + cost > DAILY_API_BUDGET:
        return False
    _ebay_api_calls_used += cost
    return True


# Ritmo minimo tra chiamate reali all'API eBay: il tetto DAILY_API_BUDGET protegge
# dal limite giornaliero (5000/giorno) ma non da un limite di frequenza a breve
# termine (query/secondo) - scoperto il 2026-09-22 quando un run lanciato subito
# dopo un altro molto attivo ha ricevuto 429 "Too many requests" su OGNI chiamata,
# fin dalla prima, sparate tutte a distanza di millisecondi l'una dall'altra.
# 1.0s (1 chiamata/sec) è CONFERMATO sicuro: 3 notti consecutive a budget pieno
# (4000/4000 chiamate) senza un solo 429 (23-25/09/2026). Ma con budget pieno
# significa ~67 minuti di sola fase di ricerca. 0.35s (~2,9 chiamate/sec) è un
# esperimento per accorciare i run: nessun limite eBay documentato per questo
# tier, ma il circuit breaker sotto lo rende a basso rischio - se è troppo
# veloce si ferma da solo dopo pochi 429 invece di rompere tutto il run.
_EBAY_MIN_CALL_INTERVAL = 0.35  # secondi
_ebay_last_call_at = 0.0
# Circuit breaker: dopo troppi 429 consecutivi il problema non è "riprova", è che
# l'endpoint è throttled per questo run - continuare a martellarlo spreca solo
# tempo. Una volta scattato, tutte le chiamate successive vengono saltate subito.
_EBAY_MAX_CONSECUTIVE_429 = 3
_ebay_consecutive_429 = 0
_ebay_throttled = False


def _ebay_rate_limit_pace():
    """Aspetta il tempo minimo dall'ultima chiamata reale, per non superare un
    eventuale limite di frequenza a breve termine dell'API eBay."""
    global _ebay_last_call_at
    wait = _EBAY_MIN_CALL_INTERVAL - (time.time() - _ebay_last_call_at)
    if wait > 0:
        time.sleep(wait)
    _ebay_last_call_at = time.time()


def _ebay_note_response(status_code: int):
    """Aggiorna il circuit breaker in base all'esito dell'ultima chiamata reale."""
    global _ebay_consecutive_429, _ebay_throttled
    if status_code == 429:
        _ebay_consecutive_429 += 1
        if _ebay_consecutive_429 >= _EBAY_MAX_CONSECUTIVE_429:
            _ebay_throttled = True
            print(f" 🛑 [eBay Browse API] {_ebay_consecutive_429} risposte 429 consecutive: endpoint throttled, salto le chiamate rimanenti di questo run")
    else:
        _ebay_consecutive_429 = 0


def _numeric_listing_id(raw: str) -> str:
    """Normalizza un itemId eBay (es. 'v1|227306323358|0') o un itemWebUrl
    (es. '.../itm/227306323358?...') nello stesso identificativo numerico stabile,
    usato come identità dell'offerta indipendentemente dal prezzo (mai titolo+prezzo:
    il prezzo cambia, l'annuncio no)."""
    if not raw:
        return ""
    m = re.search(r'(\d{9,})', raw)
    return m.group(1) if m else raw


# Liste di caratteristiche usate per generare le query "spec" mirate (vedi
# build_ebay_query_pool): combinazioni scelte a mano (GPU da sola, CPU+RAM), non il
# prodotto cartesiano completo GPU×RAM×CPU che esploderebbe a decine di query inutili.
EBAY_GPUS = ["RTX 3050", "RTX 4050", "RTX 4060", "RTX 4070", "RTX 5050", "RTX 5060"]
EBAY_CPUS = ["i5", "i7", "i9", "Ryzen 5", "Ryzen 7", "Ryzen 9"]
EBAY_RAM_SIZES = ["16GB", "32GB"]


def build_ebay_query_pool() -> List[Dict[str, Any]]:
    """Costruisce il pool di query categorizzate (discovery/spec/ricondizionato),
    ognuna con la propria fascia di prezzo massima. Sostituisce la vecchia lista
    piatta di 2-5 frasi fisse: qui le query sono decine, organizzate per scopo,
    così il catalogo non dipende solo dalle combinazioni scelte a mano in partenza."""
    pool: List[Dict[str, Any]] = []

    # Discovery: query generiche, trovano prodotti che le query "spec" sotto non
    # intercetterebbero mai (non tutti i venditori scrivono GPU/CPU nel titolo)
    for q in ["notebook", "laptop", "computer portatile", "notebook pc"]:
        pool.append({"query": q, "category": "discovery", "max_price": 2000})

    # Spec: GPU da sola (copre tutta la gamma, comprese le fasce alte poco frequenti)
    for gpu in EBAY_GPUS:
        pool.append({"query": f"notebook {gpu}", "category": "spec", "max_price": 2500})
    pool.append({"query": "notebook Quadro", "category": "spec", "max_price": 2000})

    # Spec: CPU + RAM (targeted, non tutte le combinazioni con GPU per evitare
    # l'esplosione cartesiana menzionata nella specifica)
    for cpu in EBAY_CPUS:
        for ram in EBAY_RAM_SIZES:
            pool.append({"query": f"notebook {cpu} {ram}", "category": "spec", "max_price": 1800})

    # Ricondizionato/usato: categoria separata, il motore del valore la tratta
    # diversamente (confronto con l'equivalente nuovo, non con lo storico dell'usato)
    for q in [
        "notebook ricondizionato", "notebook refurbished", "notebook usato",
        "notebook ricondizionato i7", "notebook ricondizionato 16GB",
        "notebook ricondizionato 32GB", "notebook ricondizionato 64GB",
        "notebook ricondizionato RTX", "notebook ricondizionato Ryzen 7",
    ]:
        max_p = 2200 if "64GB" in q else 1600
        pool.append({"query": q, "category": "refurbished", "max_price": max_p})

    return pool


# Rotazione degli ordinamenti supportati dalla Browse API (vedi developer.ebay.com):
# "" = Best Match (default), gli altri sono valori letterali del parametro `sort`.
# Evita di vedere sempre gli stessi risultati in prima pagina per ogni query.
EBAY_SORT_ROTATION = ["", "newlyListed", "price", "endingSoonest"]


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


def ebay_browse_search(
    keywords: str, min_price: int = 150, max_price: int = 2500,
    limit: int = 200, offset: int = 0, sort: str = "",
) -> List[Dict[str, Any]]:
    """Cerca annunci reali su eBay.it (solo Compralo Subito) tramite la Browse API ufficiale.
    limit=200 (il massimo per chiamata dell'API) per campionare il mercato in poche
    chiamate; offset/sort permettono paginazione e rotazione degli ordinamenti da
    parte del chiamante (vedi build_ebay_query_pool / EBAY_SORT_ROTATION)."""
    if not _ebay_budget_allows():
        print(" 🛑 [eBay Browse API] Budget chiamate esaurito per questo run, ricerca saltata")
        return []

    token = get_ebay_access_token()
    if not token:
        return []

    filters = ["buyingOptions:{FIXED_PRICE}", f"price:[{min_price}..{max_price}]", "priceCurrency:EUR"]

    try:
        params = {
            "q": keywords,
            "filter": ",".join(filters),
            "limit": min(limit, 200),
            "offset": offset,
        }
        if sort:
            params["sort"] = sort
        _ebay_rate_limit_pace()
        resp = requests.get(
            "https://api.ebay.com/buy/browse/v1/item_summary/search",
            headers={
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_IT",
            },
            params=params,
            timeout=20,
        )
        _ebay_note_response(resp.status_code)
        if resp.status_code != 200:
            print(f" ⚠️  [eBay Browse API] Errore ricerca ({resp.status_code}): {resp.text[:300]}")
            return []
        return resp.json().get("itemSummaries", []) or []
    except Exception as e:
        print(f" ⚠️  [eBay Browse API] Eccezione durante la ricerca: {e}")
        return []


def get_ebay_item_details(item_id: str) -> str:
    """Recupera descrizione e 'specifiche articolo' (item aspects) reali di un annuncio eBay.

    I titoli eBay sono spesso troppo corti per contenere tutte le specifiche (es. la
    dimensione dello schermo), mentre gli 'item specifics' inseriti dal venditore sono
    dati strutturati molto più affidabili. Il testo restituito qui viene aggiunto al
    testo analizzato dai parser (extract_screen, extract_cpu, ecc.) così le sigle tipo
    '13,3 pollici' vengono trovate anche se assenti dal titolo.
    """
    if not item_id:
        return ""
    if not _ebay_budget_allows():
        return ""
    token = get_ebay_access_token()
    if not token:
        return ""
    try:
        import urllib.parse
        _ebay_rate_limit_pace()
        resp = requests.get(
            f"https://api.ebay.com/buy/browse/v1/item/{urllib.parse.quote(item_id, safe='')}",
            headers={"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_IT"},
            timeout=15,
        )
        _ebay_note_response(resp.status_code)
        if resp.status_code != 200:
            return ""
        data = resp.json()
        parts = [data.get("shortDescription", "") or ""]
        for aspect in data.get("localizedAspects", []) or []:
            name = aspect.get("name", "")
            value = aspect.get("value", "")
            if name and value:
                parts.append(f"{name}: {value}")
        return " ".join(parts)
    except Exception as e:
        print(f" ⚠️  [eBay Browse API] Impossibile recuperare le specifiche dell'annuncio: {e}")
        return ""


def _map_ebay_condition(condition_text: str) -> str:
    """Il ricondizionato ha un confronto di valore diverso dall'usato generico
    (vedi valuation.ts): distinguerlo dalla condizione eBay invece di appiattire
    tutto ciò che non è 'new' su 'Usato'."""
    if "refurb" in condition_text or "rigenerat" in condition_text:
        return "Ricondizionato"
    if "new" in condition_text:
        return "Nuovo"
    return "Usato"


BAD_TITLE_WORDS = ['cover', 'custodia', 'borsa', 'caricatore', 'alimentatore', 'cavo', 'adesivo',
                    'batteria per', 'schermo per', 'solo per pezzi', 'guasto', 'rotto', 'per ricambi']


def discover_ebay_deals(
    query_spec: Dict[str, Any], known_listing_ids: set, pages: int = 2,
) -> List[Dict[str, Any]]:
    """Campiona il mercato eBay.it per una query (non 'trova le 2 migliori offerte':
    quella selezione spetta al motore del valore a valle, vedi CLAUDE.md). Pagina i
    risultati, ruota l'ordinamento per giorno così le stesse query non mostrano
    sempre gli stessi primi risultati, e salta il fetch dettagli (che costa una
    chiamata API) per gli annunci già noti in catalogo — a quelli serve solo
    aggiornare il prezzo, non rivalutare le specifiche."""
    query, max_price = query_spec["query"], query_spec.get("max_price", 1800)
    sort_index = (hash(query) + datetime.now(timezone.utc).toordinal()) % len(EBAY_SORT_ROTATION)
    sort = EBAY_SORT_ROTATION[sort_index]
    print(f"\n🔍 [eBay Browse API] '{query}' (sort={sort or 'best match'}, {pages} pagine, max {max_price}€)...")

    all_items: List[Dict[str, Any]] = []
    for page in range(pages):
        batch = ebay_browse_search(query, min_price=150, max_price=max_price, limit=200, offset=page * 200, sort=sort)
        if not batch:
            break  # niente altre pagine o budget esaurito: ebay_browse_search ha già loggato il motivo
        all_items.extend(batch)
        if len(batch) < 200:
            break  # ultima pagina reale

    deals = []
    seen_this_query = set()
    for it in all_items:
        title = it.get("title", "")
        if not title or any(bad in title.lower() for bad in BAD_TITLE_WORDS):
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

        listing_id = _numeric_listing_id(it.get("itemId", "") or item_web_url)
        if not listing_id or listing_id in seen_this_query:
            continue  # stesso annuncio ricomparso in più pagine/ordinamenti di questa query
        seen_this_query.add(listing_id)

        condition_text = (it.get("condition") or "").lower()
        mapped_condition = _map_ebay_condition(condition_text)

        brand = title.split()[0] if title.split() else "Notebook"
        model = " ".join(title.split()[1:4])
        image_url = (it.get("image") or {}).get("imageUrl", "")

        # Annuncio già in catalogo: serve solo il prezzo aggiornato (sync_catalog lo
        # riconosce da listingId), non ha senso spendere una chiamata API per
        # rivalutare specifiche che non cambiano da un annuncio esistente.
        already_known = listing_id in known_listing_ids
        item_details = "" if already_known else get_ebay_item_details(it.get("itemId", ""))

        # Mai inventare un prezzo di riferimento: usa il "prezzo originale" reale
        # di eBay solo se il venditore lo ha impostato (marketingPrice), altrimenti
        # niente originalPrice (la card mostra il prezzo netto, senza sconto finto).
        real_original = None
        try:
            mp_val = (it.get("marketingPrice") or {}).get("originalPrice", {}).get("value")
            if mp_val and float(mp_val) > price_val:
                real_original = round(float(mp_val))
        except (TypeError, ValueError):
            pass

        deal = {
            "title": title,
            "brand": brand,
            "model": model,
            "price": round(price_val),
            "condition": mapped_condition,
            "store": "eBay.it",
            "raw_url": item_web_url,
            "listingId": listing_id,
            "imageUrl": image_url or "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80",
            "specs_text": f"{title} {item_details}".strip(),
        }
        if real_original:
            deal["originalPrice"] = real_original
        deals.append(deal)

    print(f" ✅ Campionati {len(all_items)} annunci, {len(deals)} validi ({sum(1 for d in deals if d['listingId'] in known_listing_ids)} già noti, solo aggiornamento prezzo)")
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
        price_changed = new_price is not None and old_price != round(new_price)
        if new_price is not None:
            product["price"] = round(new_price)
        if detail_url:
            product["affiliateUrl"] = detail_url
        if image_url:
            product["imageUrl"] = image_url

        if price_changed:
            today = _today_iso()
            print(f" 🔄 {product['title'][:40]}: {old_price}€ -> {round(new_price)}€ (prezzo live verificato)")
            product["lastUpdated"] = today
            product.setdefault("priceHistory", []).append({"price": round(new_price), "date": today})
        updated += 1

    return updated


# --- 5. SINCRONIZZAZIONE CON PRODUCTS.JSON ---

DIRECT_PRODUCT_URLS = {
    "tulpar-t5-i7-rtx4060": {"url": "https://www.amazon.it/dp/B0D2R83MY4", "store": "Amazon.it"},
    "aukabrex-16-i7-6500u": {"url": "https://www.amazon.it/dp/B0H6WSJSHV", "store": "Amazon.it"},
    "cyclus-16-ryzen5-vega": {"url": "https://www.amazon.it/dp/B0G1FZ5F8N", "store": "Amazon.it"},
    "hp-omen-15-rtx5050": {"url": "https://www.amazon.it/dp/B0GQZ5W9D1", "store": "Amazon.it"},
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
            p["affiliateUrl"] = wrap_affiliate_link("Amazon.it", "https://www.amazon.it/dp/B0BYZ28Z8H")
            cleaned += 1
            print(f" 🎯 Scheda prodotto diretta: {p['title'][:35]} -> {p['affiliateUrl']}")
            
    if cleaned > 0:
        print(f" 🚀 Aggiornati con successo {cleaned} prodotti con SCHEDA PRODOTTO DIRETTA (zero pagine di ricerca)!")


def regenerate_indicators(catalog: List[Dict[str, Any]]) -> int:
    """Ricalcola SOLO le frecce CPU/GPU (specs.cpu.indicator / specs.gpu.indicator)
    di ogni prodotto già nel catalogo, con extract_cpu/extract_gpu e le soglie
    aggiornate. Non tocca timbro, rating, verdetto o pro/contro: quelli restano
    quelli originali. Serve a tenere le frecce sincronizzate con i dati reali di
    benchmark ogni volta che la tabella di riferimento viene aggiornata."""
    updated = 0
    for p in catalog:
        specs = p.get("specs", {})
        cpu_spec = specs.get("cpu")
        gpu_spec = specs.get("gpu")
        price = p.get("price", 500)

        if cpu_spec:
            cpu = extract_cpu(cpu_spec.get("value", ""))
            new_ind = compute_cpu_indicator(cpu["tier"], price)
            if cpu_spec.get("indicator") != new_ind:
                print(f" 🔄 CPU {p.get('title','')[:35]}: {cpu_spec.get('indicator')} -> {new_ind}")
                cpu_spec["indicator"] = new_ind
                updated += 1

        if gpu_spec:
            gpu = extract_gpu(gpu_spec.get("value", ""))
            new_ind = compute_gpu_indicator(gpu["tier"], price)
            if gpu_spec.get("indicator") != new_ind:
                print(f" 🔄 GPU {p.get('title','')[:35]}: {gpu_spec.get('indicator')} -> {new_ind}")
                gpu_spec["indicator"] = new_ind
                updated += 1

    return updated


def sync_catalog(new_items: List[Dict[str, Any]]):
    """Integra le nuove offerte nel catalogo del sito. L'identità di un'offerta è
    `listingId` (stabile, non cambia col prezzo), mai titolo+prezzo: lo stesso
    annuncio visto una seconda volta a un prezzo diverso aggiorna la entry
    esistente (con storico prezzi) invece di crearne una nuova."""
    path = CONFIG["products_file"]

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    else:
        catalog = []

    # Sanifica eventuali vecchi link prima di aggiungere nuove offerte
    sanitize_catalog(catalog)

    existing_ids = {p["id"] for p in catalog}
    listing_index: Dict[str, Dict[str, Any]] = {p["listingId"]: p for p in catalog if p.get("listingId")}
    added_count = 0
    updated_count = 0
    replaced_count = 0
    today = _today_iso()

    def spec_fingerprint(specs: Dict[str, Any], condition: str):
        # Stesse 5 specifiche + condizione = quasi certamente lo stesso identico
        # modello di portatile in vendita da un altro negozio/venditore
        return (
            specs["screen"]["value"], specs["gpu"]["value"], specs["cpu"]["value"],
            specs["ram"]["value"], specs["ssd"]["value"], condition,
        )

    fingerprint_index: Dict[Any, Dict[str, Any]] = {
        spec_fingerprint(p["specs"], p["condition"]): p for p in catalog
    }

    for item in new_items:
        listing_id = item.get("listingId", "")

        # Stessa offerta già in catalogo: aggiorna prezzo/storico, non ricrea né
        # rivaluta le specifiche (che per un annuncio esistente non cambiano)
        existing = listing_index.get(listing_id) if listing_id else None
        if existing:
            if existing["price"] != item["price"]:
                existing.setdefault("priceHistory", []).append({"price": item["price"], "date": today})
                print(f" 🔄 Prezzo aggiornato: '{existing['title'][:45]}' {existing['price']}€ -> {item['price']}€")
                existing["price"] = item["price"]
                updated_count += 1
            existing["lastUpdated"] = today
            existing["affiliateUrl"] = wrap_affiliate_link(item["store"], item["raw_url"])
            continue

        # Tetto di sicurezza sulla crescita per notte (vedi MAX_NEW_PRODUCTS_PER_RUN):
        # non limita gli aggiornamenti di prezzo sopra, solo i prodotti genuinamente nuovi
        if added_count >= MAX_NEW_PRODUCTS_PER_RUN:
            continue

        # Valuta con il motore della Volpe
        evaluation = evaluate_laptop(item)

        # Stesso portatile (specifiche identiche) già in catalogo da un altro
        # negozio/venditore: teniamo solo il prezzo più basso
        fp = spec_fingerprint(evaluation["specs"], item["condition"])
        twin = fingerprint_index.get(fp)
        if twin:
            if item["price"] < twin["price"]:
                catalog.remove(twin)
                existing_ids.discard(twin["id"])
                if twin.get("listingId"):
                    listing_index.pop(twin["listingId"], None)
                print(f" 🔁 Sostituita offerta duplicata (stesse specifiche): '{twin['title']}' ({twin['price']}€) -> '{item['title']}' ({item['price']}€)")
                replaced_count += 1
            else:
                print(f" ⏭️  Scartata offerta duplicata (stesse specifiche, prezzo più alto): '{item['title']}' ({item['price']}€), già presente a {twin['price']}€")
                continue

        # ID leggibile ma stabile: basato sul listingId (mai sul prezzo, che cambia)
        clean_name = re.sub(r'[^a-zA-Z0-9]+', '-', item["title"].lower()).strip('-')
        id_suffix = listing_id[-8:] if listing_id else str(item["price"])
        pid = f"{clean_name[:30]}-{id_suffix}"
        if pid in existing_ids:
            pid = f"{pid}-{len(catalog)}"  # collisione rara di slug: rende comunque unico

        # Mai inventare un prezzo di riferimento: originalPrice solo se la fonte
        # ne fornisce davvero uno (es. "più basso ultimi 30gg" mostrato dal
        # negozio stesso), altrimenti il campo resta assente.
        real_original_price = item.get("originalPrice")

        product_entry = {
            "id": pid,
            "listingId": listing_id,
            "title": item["title"],
            "brand": item.get("brand", "Notebook"),
            "model": item.get("model", ""),
            "category": "lavoro_ufficio" if item["condition"] == "Ricondizionato" else "gaming_ai",
            "useCases": evaluation["useCases"],
            "condition": item["condition"],
            "price": item["price"],
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
            "weight": extract_weight(f"{item['title']} {item.get('specs_text', '')}") or ("1.80 kg" if item["condition"] == "Ricondizionato" else "2.20 kg"),
            "warranty": "12 Mesi di Garanzia Inclusa",
            "lastUpdated": today,
            "priceHistory": [{"price": item["price"], "date": today}],
        }
        if real_original_price:
            product_entry["originalPrice"] = real_original_price

        catalog.append(product_entry)
        existing_ids.add(pid)
        if listing_id:
            listing_index[listing_id] = product_entry
        fingerprint_index[fp] = product_entry
        added_count += 1
        print(f" 🦊 Aggiunta offerta: {product_entry['title']} ({product_entry['price']} €) -> Timbro: {product_entry['stamp']}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    replaced_note = f", {replaced_count} sostituite con un prezzo migliore" if replaced_count else ""
    updated_note = f", {updated_count} prezzi aggiornati" if updated_count else ""
    print(f"\n🎉 Catalogo sincronizzato con successo! ({len(catalog)} offerte totali presenti sul sito, +{added_count} nuove aggiunte{replaced_note}{updated_note})")
    if added_count >= MAX_NEW_PRODUCTS_PER_RUN:
        print(f" 🛑 Tetto MAX_NEW_PRODUCTS_PER_RUN ({MAX_NEW_PRODUCTS_PER_RUN}) raggiunto: altri candidati trovati stanotte non sono stati aggiunti, verranno ritrovati alle prossime notti")


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

async def verify_catalog_links(concurrency: int = 8):
    """Verifica ogni link del catalogo per accertarsi che NON dia errore 404 / 'impossibile
    trovare la pagina'. Controlli in parallelo (una pagina Playwright per slot di
    concorrenza, stesso browser): con la discovery ampliata in Fase 1 il catalogo
    cresce molto più in fretta, e un controllo sequenziale (uno alla volta, fino a
    12s ciascuno) diventava il vero collo di bottiglia del run notturno — una volta
    ha fatto durare il job oltre 55 minuti fino alla cancellazione, senza mai
    arrivare al commit. La concorrenza taglia il tempo totale di un fattore ~concurrency."""
    path = CONFIG["products_file"]
    with open(path, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    print(f"\n🔍 Test live di verifica per tutti i {len(catalog)} prodotti presenti sul sito (concorrenza {concurrency})...")
    semaphore = asyncio.Semaphore(concurrency)

    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)

        async def check_one(idx: int, p_item: Dict[str, Any]):
            url = p_item.get("affiliateUrl", "")
            title = p_item.get("title", "")
            store = p_item.get("store", "")
            async with semaphore:
                page = await browser.new_page(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
                    viewport={"width": 1280, "height": 900}
                )
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
                finally:
                    await page.close()

        await asyncio.gather(*(check_one(idx, item) for idx, item in enumerate(catalog, 1)))
        await browser.close()
    return True

async def main():
    print("=" * 65)
    print("🦊 PREZZI FURBI - AGGIORNAMENTO CATALOGO & VERIFICA")
    print("=" * 65)

    path = CONFIG["products_file"]
    catalog: List[Dict[str, Any]] = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            catalog = json.load(f)

        # 1. Applica le schede prodotto dirette garantite (mai pagine di ricerca)
        sanitize_catalog(catalog)

        # 2. Ricalcola le frecce CPU/GPU con le soglie/tier aggiornate (non tocca
        #    timbro, rating o testi: solo specs.cpu.indicator e specs.gpu.indicator)
        indicators_updated = regenerate_indicators(catalog)

        # 3. Prezzo, link diretto e immagine live per i prodotti Amazon (Creators API)
        updated = refresh_amazon_catalog_prices(catalog)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)

        print(f"\n✅ {indicators_updated} frecce CPU/GPU ricalcolate, {updated} prodotti Amazon aggiornati con prezzo live dalla Creators API.")

    # 4. Campiona il mercato eBay (Browse API) su un pool ampio di query categorizzate
    #    (discovery/spec/ricondizionato, vedi build_ebay_query_pool) invece delle
    #    2-5 frasi fisse di prima: qui decidiamo COSA è interessante dopo aver
    #    raccolto i dati, non chiediamo all'API di scegliere per noi in anticipo.
    #    known_listing_ids evita di sprecare budget a rivalutare annunci già noti.
    known_listing_ids = {p["listingId"] for p in catalog if p.get("listingId")}
    query_pool = build_ebay_query_pool()
    print(f"\n🌐 [eBay Browse API] Pool di {len(query_pool)} query, budget {DAILY_API_BUDGET} chiamate, {len(known_listing_ids)} annunci già noti in catalogo")

    new_ebay_items = []
    for query_spec in query_pool:
        if _ebay_api_calls_used >= DAILY_API_BUDGET:
            print(f" 🛑 Budget chiamate eBay esaurito ({_ebay_api_calls_used}/{DAILY_API_BUDGET}): query rimanenti saltate")
            break
        new_ebay_items.extend(discover_ebay_deals(query_spec, known_listing_ids, pages=2))

    print(f"\n📊 [eBay Browse API] {_ebay_api_calls_used}/{DAILY_API_BUDGET} chiamate usate in questo run")

    if new_ebay_items:
        sync_catalog(new_ebay_items)

    # 5. Verifica live di ogni link del catalogo (richiede Playwright, va bene anche in CI)
    if os.environ.get("SKIP_LINK_VERIFY") != "1":
        await verify_catalog_links()

    # 6. Screenshot solo su richiesta esplicita: richiedono il sito avviato su
    #    localhost:5173 e un percorso locale, quindi non fanno parte del job automatico.
    if os.environ.get("CAPTURE_SCREENSHOTS") == "1":
        await take_live_screenshots()

    print("\n" + "=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
