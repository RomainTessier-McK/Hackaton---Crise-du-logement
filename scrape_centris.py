"""
Scrape Centris.ca for-sale listings (plexes / lots) across the Greater Montréal
study area, for the Acquisition & Risk module.

How it works
------------
Each Centris search URL (category~for-sale~geography) renders ~20 listing cards
as plain HTML. Centris' AJAX pagination requires replicating internal query
codes that change often, so instead we enumerate many geographies (Montréal
boroughs + suburban cities that cover the H + J FSAs) and take the cards each
returns, de-duplicating by MLS number. This trades exhaustive depth for
robustness — a wide, current sample rather than every single listing.

Per listing we extract: mls, category, price, beds, baths, address,
municipality, lat, lng, url. Coordinates are later joined to FSAs.

This is rate-limited and writes a dated raw snapshot plus a latest file. Unknown
geographies that 404 are skipped automatically.

Usage
-----
    python scrape_centris.py
    python scrape_centris.py --categories plexes --regions montreal-island laval
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE = Path(__file__).resolve().parent
OUT_DIR = BASE / "Raw data" / "centris"
SNAP_DIR = OUT_DIR / "snapshots"

HOME = "https://www.centris.ca"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

CATEGORIES = ["plexes", "lots"]

# Geographies covering the study area (H + J3T/J3X/J3Z/J4-J7 FSAs). Island is
# subdivided into boroughs to get more than the 20-card cap of a single search.
# Slugs that don't exist are skipped (404).
REGIONS = [
    # Island (whole + boroughs)
    "montreal-island",
    "montreal-ahuntsic-cartierville",
    "montreal-anjou",
    "montreal-cote-des-neiges-notre-dame-de-grace",
    "montreal-lachine",
    "montreal-lasalle",
    "montreal-le-plateau-mont-royal",
    "montreal-le-sud-ouest",
    "montreal-mercier-hochelaga-maisonneuve",
    "montreal-montreal-nord",
    "montreal-outremont",
    "montreal-pierrefonds-roxboro",
    "montreal-riviere-des-prairies-pointe-aux-trembles",
    "montreal-rosemont-la-petite-patrie",
    "montreal-saint-laurent",
    "montreal-saint-leonard",
    "montreal-verdun",
    "montreal-ville-marie",
    "montreal-villeray-saint-michel-parc-extension",
    # Laval (H7)
    "laval",
    # South Shore (J3, J4, J5)
    "longueuil",
    "brossard",
    "boucherville",
    "saint-lambert",
    "chambly",
    "beloeil",
    "saint-jean-sur-richelieu",
    "la-prairie",
    # North Shore (J6, J7)
    "terrebonne",
    "mascouche",
    "repentigny",
    "blainville",
    "sainte-therese",
    "saint-jerome",
    "mirabel",
]

DELAY = 1.2  # seconds between requests (polite)


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": UA,
            "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )
    return s


def parse_cards(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    out = []
    for c in soup.select("div.property-thumbnail-item"):
        rec: dict = {}
        sku = c.select_one('meta[itemprop="sku"]')
        rec["mls"] = sku["content"].strip() if sku and sku.get("content") else None

        price = c.select_one('meta[itemprop="price"]')
        rec["price"] = float(price["content"]) if price and price.get("content") else None

        cat = c.select_one("div.category div")
        rec["category"] = cat.get_text(strip=True) if cat else None

        addr_divs = c.select("div.address div")
        rec["address"] = addr_divs[0].get_text(strip=True) if len(addr_divs) > 0 else None
        rec["municipality"] = addr_divs[1].get_text(strip=True) if len(addr_divs) > 1 else None

        cac = c.select_one("div.cac")
        sdb = c.select_one("div.sdb")
        rec["bedrooms"] = int(cac.get_text(strip=True)) if cac and cac.get_text(strip=True).isdigit() else None
        rec["bathrooms"] = int(sdb.get_text(strip=True)) if sdb and sdb.get_text(strip=True).isdigit() else None

        geo = c.select_one("span.ll-match-score")
        if geo and geo.get("data-lat") and geo.get("data-lng"):
            try:
                rec["lat"] = float(geo["data-lat"])
                rec["lng"] = float(geo["data-lng"])
            except ValueError:
                rec["lat"] = rec["lng"] = None
        else:
            rec["lat"] = rec["lng"] = None

        img = c.select_one('img[itemprop="image"]')
        src = img.get("src") if img else None
        if src:
            # bump the thumbnail to a larger render
            src = re.sub(r"w=\d+", "w=640", re.sub(r"h=\d+", "h=480", src))
        rec["image"] = src

        photo_btn = c.select_one("div.photo-buttons button")
        if photo_btn:
            digits = "".join(ch for ch in photo_btn.get_text() if ch.isdigit())
            rec["photoCount"] = int(digits) if digits else None
        else:
            rec["photoCount"] = None

        link = c.select_one("a.a-more-detail")
        rec["url"] = HOME + link["href"] if link and link.get("href") else None

        if rec["mls"]:
            out.append(rec)
    return out


def looks_blocked(text: str) -> bool:
    low = text[:2000].lower()
    return any(k in low for k in ("incapsula", "request unsuccessful", "_incapsula_resource", "captcha"))


def scrape_search(session: requests.Session, category: str, region: str) -> list[dict]:
    slug = f"{category}~for-sale~{region}"
    try:
        r = session.get(f"{HOME}/en/{slug}", timeout=30)
    except requests.RequestException as e:
        print(f"  {slug}: error {e}", file=sys.stderr)
        return []
    if r.status_code == 404:
        print(f"  {slug}: 404 (skip)", file=sys.stderr)
        return []
    if r.status_code != 200 or looks_blocked(r.text):
        print(f"  {slug}: status {r.status_code} / blocked", file=sys.stderr)
        return []
    listings = parse_cards(r.text)
    for l in listings:
        l["searchCategory"] = category
        l["searchRegion"] = region
    print(f"  {slug}: {len(listings)}", file=sys.stderr)
    return listings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--categories", nargs="*", default=CATEGORIES)
    ap.add_argument("--regions", nargs="*", default=REGIONS)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_DIR.mkdir(parents=True, exist_ok=True)

    session = new_session()
    try:
        session.get(HOME, timeout=30)
    except requests.RequestException as e:
        print(f"Cannot reach Centris: {e}", file=sys.stderr)
        return 2

    all_listings: list[dict] = []
    for cat in args.categories:
        print(f"[{cat}]", file=sys.stderr)
        for region in args.regions:
            all_listings.extend(scrape_search(session, cat, region))
            time.sleep(DELAY)

    dedup = {l["mls"]: l for l in all_listings}
    listings = list(dedup.values())

    if not listings:
        print("\nNo listings scraped — likely blocked by Centris anti-bot.", file=sys.stderr)
        return 1

    today = dt.date.today().isoformat()
    payload = {
        "scrapedAt": dt.datetime.now().isoformat(timespec="seconds"),
        "source": "centris.ca",
        "method": "multi-geography HTML search (20-card cap per geography, deduped by MLS)",
        "categories": args.categories,
        "regions": args.regions,
        "count": len(listings),
        "listings": listings,
    }
    (SNAP_DIR / f"centris_sales_{today}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "centris_sales_raw.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    with_geo = sum(1 for l in listings if l.get("lat"))
    print(f"\nWrote Raw data/centris/centris_sales_raw.json")
    print(f"  unique listings: {len(listings)} | with lat/lng: {with_geo}")
    cats: dict[str, int] = {}
    for l in listings:
        cats[l["category"]] = cats.get(l["category"], 0) + 1
    for k, v in sorted(cats.items(), key=lambda kv: -kv[1]):
        print(f"    {v:>4}  {k}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
