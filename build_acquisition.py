"""
Build the Acquisition & Risk dataset for the web app (Tab B).

Inputs
------
- Raw data/centris/centris_sales_raw.json   (scraped Centris for-sale listings)
- Raw data/lfsa000b21a_e/.../lfsa000b21a_e.shp  (StatsCan 2021 FSA boundaries)
- montreal-housing-app/src/data/fsaData.json   (census affordability metrics)

What it does
------------
1. Spatially joins each listing's lat/lng to its FSA (point-in-polygon).
2. Aggregates plex / lot supply per FSA.
3. Merges with the affordability metrics (gap score, compound stress, etc.).
4. Derives two actionable signals:
   - acquisitionScore  : where subsidized-housing need is high AND plexes are
                         currently for sale (feature 5 — acquisition targeting).
   - renovictionRisk   : where vulnerable renters concentrate AND plexes are for
                         sale, i.e. speculative buy-up risk (feature 6).

Output
------
- montreal-housing-app/src/data/acquisitionData.json
"""
from __future__ import annotations

import json
from pathlib import Path

import shapefile  # pyshp
from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

BASE = Path(__file__).resolve().parent
CENTRIS = BASE / "Raw data" / "centris" / "centris_sales_raw.json"
SHP = BASE / "Raw data" / "lfsa000b21a_e" / "lfsa000b21a_e" / "lfsa000b21a_e.shp"
FSA_DATA = BASE / "montreal-housing-app" / "src" / "data" / "fsaData.json"
OUT = BASE / "montreal-housing-app" / "src" / "data" / "acquisitionData.json"

PLEX_TYPES = {"Duplex", "Triplex", "Quadruplex", "Quintuplex"}


def is_plex(category: str | None) -> bool:
    return bool(category) and any(t in category for t in PLEX_TYPES)


def is_lot(category: str | None) -> bool:
    return bool(category) and ("Lot" in category or "Land" in category)


def load_fsa_polygons():
    """Return (codes, prepared shapely geoms, STRtree) for H/J FSAs."""
    r = shapefile.Reader(str(SHP), encoding="latin-1", encodingErrors="replace")
    fields = [f[0] for f in r.fields[1:]]
    code_idx = fields.index("CFSAUID")
    geoms, codes = [], []
    for sr in r.iterShapeRecords():
        code = sr.record[code_idx]
        if not code or code[0] not in ("H", "J"):
            continue
        geoms.append(shape(sr.shape.__geo_interface__))
        codes.append(code)
    return codes, geoms, STRtree(geoms)


def main() -> None:
    raw = json.loads(CENTRIS.read_text(encoding="utf-8"))
    listings = raw["listings"]

    codes, geoms, tree = load_fsa_polygons()

    # Shapefile CRS (StatsCan Lambert) -> transformer from WGS84 lon/lat.
    crs = CRS.from_wkt(Path(str(SHP).replace(".shp", ".prj")).read_text())
    to_shp = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

    assigned = 0
    for l in listings:
        l["fsa"] = None
        if not l.get("lat") or not l.get("lng"):
            continue
        x, y = to_shp.transform(l["lng"], l["lat"])
        pt = Point(x, y)
        for idx in tree.query(pt):
            if geoms[idx].contains(pt):
                l["fsa"] = codes[idx]
                assigned += 1
                break

    # ---- aggregate per FSA ----
    fsa_agg: dict[str, dict] = {}
    for l in listings:
        f = l.get("fsa")
        if not f:
            continue
        a = fsa_agg.setdefault(f, {"plex": [], "lot": []})
        if is_plex(l.get("category")):
            a["plex"].append(l)
        elif is_lot(l.get("category")):
            a["lot"].append(l)

    # ---- merge with affordability metrics ----
    fdata = json.loads(FSA_DATA.read_text(encoding="utf-8"))
    fmap = {r["fsa"]: r for r in fdata["fsas"]}

    def median(vals):
        vals = sorted(v for v in vals if v is not None)
        n = len(vals)
        if n == 0:
            return None
        return vals[n // 2] if n % 2 else round((vals[n // 2 - 1] + vals[n // 2]) / 2)

    fsa_rows = []
    for f, agg in fsa_agg.items():
        base = fmap.get(f, {})
        plex_prices = [p["price"] for p in agg["plex"] if p.get("price")]
        plex_count = len(agg["plex"])
        lot_count = len(agg["lot"])
        gap = base.get("gapScore")
        compound = base.get("compoundStress")

        # acquisition: need (gap) realized only where plexes are buyable
        acq = round(gap, 1) if (gap is not None and plex_count > 0) else None
        # renoviction risk: vulnerability realized where plexes are buyable
        reno = round(compound, 1) if (compound is not None and plex_count > 0) else None

        fsa_rows.append(
            {
                "fsa": f,
                "region": base.get("region"),
                "plexCount": plex_count,
                "lotCount": lot_count,
                "medianPlexPrice": median(plex_prices),
                "minPlexPrice": int(min(plex_prices)) if plex_prices else None,
                "gapScore": gap,
                "stressPercentile": base.get("stressPercentile"),
                "subsidyPercentile": base.get("subsidyPercentile"),
                "compoundStress": compound,
                "demoVulnIndex": base.get("demoVulnIndex"),
                "dualStress": base.get("dualStress", False),
                "pctTenantStir30": base.get("pctTenantStir30"),
                "pctSubsidized": base.get("pctSubsidized"),
                "renterHouseholds": base.get("renterHouseholds"),
                "acquisitionScore": acq,
                "renovictionRisk": reno,
            }
        )

    fsa_rows.sort(key=lambda r: (r["acquisitionScore"] is None, -(r["acquisitionScore"] or 0)))

    # trim listing payload to what the UI needs
    slim = [
        {
            "mls": l["mls"],
            "fsa": l.get("fsa"),
            "category": l.get("category"),
            "kind": "plex" if is_plex(l.get("category")) else ("lot" if is_lot(l.get("category")) else "other"),
            "price": l.get("price"),
            "bedrooms": l.get("bedrooms"),
            "bathrooms": l.get("bathrooms"),
            "address": l.get("address"),
            "municipality": l.get("municipality"),
            "lat": l.get("lat"),
            "lng": l.get("lng"),
            "image": l.get("image"),
            "photoCount": l.get("photoCount"),
            "url": l.get("url"),
        }
        for l in listings
        if l.get("fsa")
    ]

    payload = {
        "meta": {
            "scrapedAt": raw.get("scrapedAt"),
            "source": "Centris.ca for-sale listings × StatsCan 2021 FSA boundaries × Census affordability",
            "totalListings": len(listings),
            "geocoded": assigned,
            "fsasWithSupply": len(fsa_rows),
            "plexTotal": sum(r["plexCount"] for r in fsa_rows),
            "lotTotal": sum(r["lotCount"] for r in fsa_rows),
            "note": "Listings are a current sample (up to ~20 per geography, deduped). Coordinates point-in-polygon joined to FSAs.",
        },
        "fsas": fsa_rows,
        "listings": slim,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUT}")
    print(f"  listings: {len(listings)} | geocoded to FSA: {assigned}")
    print(f"  FSAs with supply: {len(fsa_rows)} | plexes: {payload['meta']['plexTotal']} | lots: {payload['meta']['lotTotal']}")
    top = [r for r in fsa_rows if r["acquisitionScore"] is not None][:5]
    print("  Top acquisition targets (high gap + plexes for sale):")
    for r in top:
        print(f"    {r['fsa']}: gap={r['acquisitionScore']} plexes={r['plexCount']} medianPlex=${r['medianPlexPrice']}")


if __name__ == "__main__":
    main()
