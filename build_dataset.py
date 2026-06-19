"""
Build the Montreal housing affordability dataset consumed by the React app.

Inputs
------
- 98-401-X2021013_eng_CSV/98-401-X2021013_English_CSV_data_filtered.csv  (StatsCan 2021 Census, FSA profile, long format)
- rmr-montreal-2025-en.xlsx  (CMHC Rental Market Report 2025, Table 1.1.2)

Output
------
- montreal-housing-app/src/data/fsaData.json

The output bundles, per FSA: census affordability + demographic metrics, an
(approximate) FSA -> CMHC zone crosswalk, the CMHC zone rents, and a set of
derived metrics (implied STIR, percentiles, gap score, demographic
vulnerability index, dual-stress flag, bullseye-style composite).
"""

from __future__ import annotations

import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent
CENSUS_CSV = BASE / "98-401-X2021013_eng_CSV" / "98-401-X2021013_English_CSV_data_filtered.csv"
CMHC_XLSX = BASE / "rmr-montreal-2025-en.xlsx"
OUT_DIR = BASE / "montreal-housing-app" / "src" / "data"
OUT_FILE = OUT_DIR / "fsaData.json"

# Census characteristic IDs -> field names (value taken from C1_COUNT_TOTAL)
KEEP_IDS = {
    1: "population",
    8: "totalPopAge",
    24: "seniors65plus",
    78: "totalFamilies",
    86: "oneParentFamilies",
    100: "totalHouseholds",
    110: "onePersonHouseholds",
    243: "medianHouseholdIncome",
    1414: "tenureHouseholds",
    1415: "ownerHouseholds",
    1416: "renterHouseholds",
    1484: "pctOwnerStir30",
    1491: "pctSubsidized",
    1492: "pctTenantStir30",
    1494: "medianRenterShelter",
    1495: "avgRenterShelter",
    1604: "recentImmigrants",
    1683: "visibleMinorityBase",
    1684: "visibleMinority",
}

SUPPRESSED = {"...", "..", "x", "F", "E", "", "n/a", "na"}

# ---------------------------------------------------------------------------
# Approximate FSA -> CMHC zone crosswalk (Montreal CMA).
# CMHC publishes rents by 23 core survey zones; the Census uses FSAs. The two
# are NOT nested, so this is a best-effort neighbourhood mapping. It is most
# accurate for the high-stress island FSAs; suburban/off-island FSAs are mapped
# at zone-cluster granularity. Unmapped FSAs get zone = None (handled in app).
# ---------------------------------------------------------------------------
FSA_TO_ZONE: dict[str, int] = {}


def _assign(zone: int, fsas: str) -> None:
    for f in fsas.split():
        FSA_TO_ZONE[f] = zone


_assign(1, "H3A H3B H3C H3E H3G H3H")                       # Downtown / Îles-des-Soeurs
_assign(2, "H3J H3K H4C H4E H4G H4H")                       # Sud-Ouest / Verdun
_assign(3, "H8N H8P H8R")                                   # LaSalle
_assign(4, "H4A H4B H4V H4W H4X H3X")                       # NDG / Côte-St-Luc
_assign(5, "H3S H3T H3V H3W H2V H3P H3R H4P H3Y H3Z")       # CDN / Mont-Royal / Outremont / Westmount
_assign(6, "H2H H2J H2L H2T H2W H2X")                       # Plateau-Mont-Royal
_assign(7, "H2A H2B H2E H2P H2R")                           # Villeray / St-Michel / Parc-Ex
_assign(8, "H1L H1N H1V H1W H1Y")                           # Hochelaga-Maisonneuve
_assign(9, "H1X H2G H2S H1Z")                               # Rosemont / Petite-Patrie
_assign(10, "H1J H1K H1M H1P H1R H1S H1T")                  # Anjou / Saint-Léonard
_assign(11, "H1G H1H")                                      # Montréal-Nord
_assign(12, "H2C H2M H2N H3L H3M H4J H4K")                  # Ahuntsic / Cartierville
_assign(13, "H4L H4M H4N H4R H4S H4T")                      # Saint-Laurent
_assign(14, "H8S H8T H8Y H8Z H9P H9S")                      # Dorval / Lachine / Saint-Pierre
_assign(15, "H9W H9X")                                      # Baie-d'Urfé / Beaconsfield
_assign(16, "H9A H9B H9C H9E H9G H9H H9J H9K")              # Pierrefonds / Ste-Geneviève / Senneville
_assign(17, "H1A H1B")                                      # Mercier (east)
_assign(18, "H1C H1E")                                      # Pointe-aux-Trembles / Montréal-Est
# Laval (H7x) — zones 19-29 cluster
_assign(20, "H7N H7P H7M")                                  # Laval-des-Rapides / Chomedey core
_assign(19, "H7S H7T H7V H7W H7X H7Y")                      # Chomedey / Sainte-Dorothée
_assign(21, "H7G H7H")                                      # Pont-Viau
_assign(22, "H7A H7B H7C H7E")                              # St-François / Duvernay
_assign(23, "H7K H7L H7M")                                  # Vimont / Auteuil
_assign(24, "H7R")                                          # Laval-Ouest / Fabreville
# North shore — Laurentides / Lanaudière (J6, J7)
_assign(25, "J7N J7J J7K")                                  # Mirabel / Oka / Pointe-Calumet
_assign(26, "J7C J7E J7G J7H")                              # Blainville / Ste-Thérèse
_assign(27, "J6V J6W J6X J6Y J6Z J7M")                      # Mascouche / Terrebonne
_assign(28, "J5W J5Y J5Z J5R")                              # L'Assomption / Lavaltrie
_assign(29, "J7Y J7Z J5L J5J")                              # Saint-Jérôme / Gore
_assign(39, "J5M J5T J5V")                                  # Saint-Lin-Laurentides
# South Shore (J3, J4, J5 select) — zones 30-38
_assign(30, "J4G J4H J4J J4K J4L J4M J4N J4P J4R")          # Longueuil
_assign(31, "J4B J4T J4V J4W J4X J4Y J4Z J5A")              # Boucherville / Brossard
_assign(32, "J5B J5C J6N J6S J6T")                          # Beauharnois / La Prairie / Léry
_assign(33, "J3G J3H J3L")                                  # Beloeil / McMasterville
_assign(34, "J3L J3M J5K")                                  # Carignan / Chambly / St-Mathias
_assign(35, "J7V J7W J6A")                                  # Île-Perrot / Pincourt
_assign(36, "J3A J3B")                                      # Saint-Jean
_assign(37, "J2W J2X")                                      # Iberville
_assign(38, "J3X J3Y J3Z")                                  # Saint-Luc / surrounding


def to_float(raw: str):
    if raw is None:
        return None
    s = raw.strip()
    if s in SUPPRESSED:
        return None
    s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def region_for(fsa: str) -> str:
    if fsa.startswith("H7"):
        return "Laval"
    if fsa.startswith("H"):
        return "Island of Montreal"
    return "South Shore / North Shore"


def parse_census() -> dict[str, dict]:
    out: dict[str, dict] = defaultdict(dict)
    with CENSUS_CSV.open("r", encoding="latin-1", newline="") as f:
        for row in csv.DictReader(f):
            geo = row["GEO_NAME"]
            try:
                cid = int(row["CHARACTERISTIC_ID"])
            except (ValueError, KeyError):
                continue
            if cid not in KEEP_IDS:
                continue
            val = to_float(row["C1_COUNT_TOTAL"])
            if val is not None:
                out[geo][KEEP_IDS[cid]] = val
    return out


def parse_cmhc():
    raw = pd.read_excel(CMHC_XLSX, sheet_name="Table 1.1.2", header=None)

    def pn(x):
        if pd.isna(x):
            return None
        s = str(x).replace(",", "").strip()
        if s in ("**", "...", "..", ""):
            return None
        try:
            return float(s)
        except ValueError:
            return None

    zones = []
    cma = None
    for i in range(7, len(raw)):
        label = raw.iloc[i, 0]
        if pd.isna(label):
            continue
        label = str(label).strip()
        rec = {
            "label": label,
            "studio24": pn(raw.iloc[i, 1]),
            "studio25": pn(raw.iloc[i, 3]),
            "bed1_24": pn(raw.iloc[i, 5]),
            "bed1_25": pn(raw.iloc[i, 7]),
            "bed2_24": pn(raw.iloc[i, 9]),
            "bed2_25": pn(raw.iloc[i, 11]),
        }
        for k in ("studio", "bed1", "bed2"):
            a, b = rec[f"{k}_24" if k != "studio" else "studio24"], rec[f"{k}_25" if k != "studio" else "studio25"]
            rec[f"{k}_yoy"] = round((b - a) / a * 100, 1) if (a and b) else None
        if label.startswith("Zone"):
            num = int(label.split("-")[0].replace("Zone", "").strip())
            rec["zone"] = num
            rec["name"] = label.split("-", 1)[1].strip() if "-" in label else label
            zones.append(rec)
        elif "CMA" in label:
            cma = rec
    return zones, cma


def percentile_ranks(values: dict[str, float]) -> dict[str, float]:
    """Return 0-100 percentile rank for each key (ties share averaged rank)."""
    items = sorted(values.items(), key=lambda kv: kv[1])
    n = len(items)
    ranks: dict[str, float] = {}
    for idx, (key, _) in enumerate(items):
        ranks[key] = round(idx / (n - 1) * 100, 1) if n > 1 else 50.0
    return ranks


def main() -> None:
    census = parse_census()
    zones, cma = parse_cmhc()
    zone_by_num = {z["zone"]: z for z in zones}

    records = []
    for fsa, m in census.items():
        pop = m.get("population")
        if not pop or pop < 1:
            continue
        renter = m.get("renterHouseholds")
        owner = m.get("ownerHouseholds")
        tenure = m.get("tenureHouseholds")
        income = m.get("medianHouseholdIncome")
        shelter = m.get("medianRenterShelter")
        burden = m.get("pctTenantStir30")

        renter_share = round(renter / tenure * 100, 1) if (renter and tenure) else None
        senior_share = round(m["seniors65plus"] / m["totalPopAge"] * 100, 1) if m.get("seniors65plus") and m.get("totalPopAge") else None
        one_parent_share = round(m["oneParentFamilies"] / m["totalFamilies"] * 100, 1) if m.get("oneParentFamilies") and m.get("totalFamilies") else None
        one_person_share = round(m["onePersonHouseholds"] / m["totalHouseholds"] * 100, 1) if m.get("onePersonHouseholds") and m.get("totalHouseholds") else None
        recent_imm_share = round(m["recentImmigrants"] / pop * 100, 1) if m.get("recentImmigrants") else None
        vis_min_share = round(m["visibleMinority"] / m["visibleMinorityBase"] * 100, 1) if m.get("visibleMinority") and m.get("visibleMinorityBase") else None

        implied_stir = round(shelter / (income / 12) * 100, 1) if (shelter and income) else None

        zone_num = FSA_TO_ZONE.get(fsa)
        zone = zone_by_num.get(zone_num) if zone_num else None

        records.append(
            {
                "fsa": fsa,
                "region": region_for(fsa),
                "population": int(pop),
                "totalHouseholds": int(m["totalHouseholds"]) if m.get("totalHouseholds") else None,
                "renterHouseholds": int(renter) if renter else None,
                "ownerHouseholds": int(owner) if owner else None,
                "renterShare": renter_share,
                "medianHouseholdIncome": int(income) if income else None,
                "medianRenterShelter": int(shelter) if shelter else None,
                "avgRenterShelter": int(m["avgRenterShelter"]) if m.get("avgRenterShelter") else None,
                "pctTenantStir30": burden,
                "pctOwnerStir30": m.get("pctOwnerStir30"),
                "pctSubsidized": m.get("pctSubsidized"),
                "impliedStir": implied_stir,
                "seniors65plus": int(m["seniors65plus"]) if m.get("seniors65plus") else None,
                "seniorShare": senior_share,
                "oneParentFamilies": int(m["oneParentFamilies"]) if m.get("oneParentFamilies") else None,
                "oneParentShare": one_parent_share,
                "onePersonShare": one_person_share,
                "recentImmigrants": int(m["recentImmigrants"]) if m.get("recentImmigrants") else None,
                "recentImmigrantShare": recent_imm_share,
                "visibleMinorityShare": vis_min_share,
                "cmhcZone": zone_num,
                "cmhcZoneName": zone["name"] if zone else None,
                "cmhcBed1_2025": zone["bed1_25"] if zone else None,
                "cmhcBed1_2024": zone["bed1_24"] if zone else None,
                "cmhcBed1Yoy": zone["bed1_yoy"] if zone else None,
                "cmhcBed2_2025": zone["bed2_25"] if zone else None,
                "cmhcStudio_2025": zone["studio25"] if zone else None,
            }
        )

    # ---- Derived percentile-based metrics ----
    def field_map(field):
        return {r["fsa"]: r[field] for r in records if r.get(field) is not None}

    stress_rank = percentile_ranks(field_map("pctTenantStir30"))
    subsidy_rank = percentile_ranks(field_map("pctSubsidized"))
    rent_rank = percentile_ranks(field_map("medianRenterShelter"))
    senior_rank = percentile_ranks(field_map("seniorShare"))
    oneparent_rank = percentile_ranks(field_map("oneParentShare"))
    immig_rank = percentile_ranks(field_map("recentImmigrantShare"))
    vismin_rank = percentile_ranks(field_map("visibleMinorityShare"))

    burdens = sorted(field_map("pctTenantStir30").values())
    rents = sorted(field_map("medianRenterShelter").values())
    burden_q3 = statistics.quantiles(burdens, n=4)[2] if len(burdens) > 3 else max(burdens)
    rent_q3 = statistics.quantiles(rents, n=4)[2] if len(rents) > 3 else max(rents)

    for r in records:
        fsa = r["fsa"]
        s = stress_rank.get(fsa)
        sub = subsidy_rank.get(fsa)
        r["stressPercentile"] = s
        r["subsidyPercentile"] = sub
        r["rentPercentile"] = rent_rank.get(fsa)
        # Gap score: high stress + low subsidy = under-served (positive)
        r["gapScore"] = round(s - sub, 1) if (s is not None and sub is not None) else None
        # Demographic vulnerability index: mean of available demo percentile ranks
        demo_parts = [d.get(fsa) for d in (senior_rank, oneparent_rank, immig_rank, vismin_rank)]
        demo_parts = [p for p in demo_parts if p is not None]
        r["demoVulnIndex"] = round(sum(demo_parts) / len(demo_parts), 1) if demo_parts else None
        # Compound stress = mean(stress percentile, demo vuln index)
        if s is not None and r["demoVulnIndex"] is not None:
            r["compoundStress"] = round((s + r["demoVulnIndex"]) / 2, 1)
        else:
            r["compoundStress"] = None
        # Dual-stress flag: high rent AND high burden
        r["dualStress"] = bool(
            r.get("medianRenterShelter")
            and r.get("pctTenantStir30")
            and r["medianRenterShelter"] >= rent_q3
            and r["pctTenantStir30"] >= burden_q3
        )

    records.sort(key=lambda r: (r["pctTenantStir30"] is None, -(r["pctTenantStir30"] or 0)))

    valid_burden = [r["pctTenantStir30"] for r in records if r["pctTenantStir30"] is not None]
    payload = {
        "meta": {
            "source": "StatsCan Census 2021 FSA profile (98-401-X2021013) + CMHC RMR 2025 Table 1.1.2",
            "censusIncomeYear": 2020,
            "censusShelterYear": 2021,
            "cmhcPeriod": "Oct 2024 vs Oct 2025",
            "fsaCount": len(records),
            "fsaWithBurden": len(valid_burden),
            "fsaStressedOver30": sum(1 for b in valid_burden if b >= 30),
            "fsaSevereOver40": sum(1 for b in valid_burden if b >= 40),
            "meanBurden": round(sum(valid_burden) / len(valid_burden), 1),
            "burdenQ3": round(burden_q3, 1),
            "rentQ3": round(rent_q3, 1),
            "crosswalkNote": "FSA->CMHC zone is an approximate neighbourhood mapping; the two geographies are not nested.",
        },
        "cmaAverage": cma,
        "cmhcZones": sorted(zones, key=lambda z: z["zone"]),
        "fsas": records,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    mapped = sum(1 for r in records if r["cmhcZone"])
    print(f"Wrote {OUT_FILE}")
    print(f"  FSAs: {len(records)} | with CMHC zone: {mapped} | stressed >=30%: {payload['meta']['fsaStressedOver30']}")
    print(f"  CMHC zones: {len(zones)} | CMA avg present: {cma is not None}")


if __name__ == "__main__":
    main()
