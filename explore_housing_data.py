"""Exploratory cross-analysis of Census FSA + CMHC rent data."""
import csv
from collections import defaultdict
from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parent
csv_path = base / "98-401-X2021013_eng_CSV" / "98-401-X2021013_English_CSV_data_filtered.csv"

KEY_IDS = {
    1: "population_2021",
    243: "median_hh_income_2020",
    1416: "renter_households",
    1491: "pct_subsidized_tenant",
    1492: "pct_renters_cost_burdened_30plus",
    1494: "median_monthly_renter_shelter_cost",
    314: "median_income_one_parent_families",
}

fsa_data = defaultdict(dict)
geos = set()

with csv_path.open("r", encoding="latin-1", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        geo = row["GEO_NAME"]
        geos.add(geo)
        try:
            cid = int(row["CHARACTERISTIC_ID"])
        except ValueError:
            continue
        if cid not in KEY_IDS:
            continue
        val = row["C1_COUNT_TOTAL"]
        if val and val not in ("...", "..", "x", "F", "E"):
            try:
                fsa_data[geo][KEY_IDS[cid]] = float(val)
            except ValueError:
                pass

rows = [{"GEO_NAME": geo, **fsa_data.get(geo, {})} for geo in sorted(geos)]
census = pd.DataFrame(rows)

print("=== CENSUS FILTERED DATA ===")
print(f"FSAs in filtered file: {len(geos)}")
print("Census metrics coverage:")
for col in census.columns:
    if col != "GEO_NAME":
        print(f"  {col}: {census[col].notna().sum()}/{len(census)}")

if "pct_renters_cost_burdened_30plus" in census.columns:
    top = census.dropna(subset=["pct_renters_cost_burdened_30plus"]).sort_values(
        "pct_renters_cost_burdened_30plus", ascending=False
    ).head(15)
    print("\nTop 15 FSAs by % renters cost-burdened:")
    for _, r in top.iterrows():
        shelter = r.get("median_monthly_renter_shelter_cost", float("nan"))
        income = r.get("median_hh_income_2020", float("nan"))
        print(
            f"  {r['GEO_NAME']}: {r['pct_renters_cost_burdened_30plus']:.1f}% | "
            f"renter shelter ${shelter:.0f} | HH income ${income:.0f}"
        )
    valid = census["pct_renters_cost_burdened_30plus"].notna()
    print(
        f"\nFSAs with >=30% cost-burdened renters: "
        f"{(census.loc[valid, 'pct_renters_cost_burdened_30plus'] >= 30).sum()} / {valid.sum()}"
    )
    print(f"Mean cost-burden rate: {census.loc[valid, 'pct_renters_cost_burdened_30plus'].mean():.1f}%")

xlsx = base / "rmr-montreal-2025-en.xlsx"
raw = pd.read_excel(xlsx, sheet_name="Table 1.1.2", header=None)

def parse_num(x):
    if pd.isna(x):
        return None
    s = str(x).replace(",", "").strip()
    if s in ("**", "...", "..", ""):
        return None
    try:
        return float(s)
    except ValueError:
        return None

data_rows = []
for i in range(7, len(raw)):
    zone = raw.iloc[i, 0]
    if pd.isna(zone):
        continue
    zone = str(zone).strip()
    if not zone.startswith("Zone"):
        continue
    data_rows.append(
        {
            "zone": zone,
            "studio_oct24": parse_num(raw.iloc[i, 1]),
            "studio_oct25": parse_num(raw.iloc[i, 3]),
            "bed1_oct24": parse_num(raw.iloc[i, 5]),
            "bed1_oct25": parse_num(raw.iloc[i, 7]),
            "bed2_oct24": parse_num(raw.iloc[i, 9]),
            "bed2_oct25": parse_num(raw.iloc[i, 11]),
        }
    )

cmhc = pd.DataFrame(data_rows)
print(f"\n=== CMHC TABLE 1.1.2 ===\nCMHC zones parsed: {len(cmhc)}")
for col in ("studio", "bed1", "bed2"):
    cmhc[f"{col}_yoy_pct"] = (cmhc[f"{col}_oct25"] - cmhc[f"{col}_oct24"]) / cmhc[f"{col}_oct24"] * 100

print("\nCMHC rent YoY growth (Oct 2024 -> Oct 2025):")
for _, r in cmhc.iterrows():
    parts = []
    for col, label in (("studio", "Studio"), ("bed1", "1BR"), ("bed2", "2BR")):
        y = r.get(f"{col}_yoy_pct")
        if pd.notna(y):
            parts.append(f"{label}: {y:+.1f}%")
    if parts:
        print(f"  {r['zone'][:55]} | {' | '.join(parts)}")

print("\nCMHC CMA averages (bottom of sheet):")
print(raw.iloc[55:64, [0, 1, 4, 7, 10, 13, 16]].to_string())

census["implied_stir_census"] = (
    census["median_monthly_renter_shelter_cost"] / (census["median_hh_income_2020"] / 12) * 100
)
stress = census.dropna(
    subset=["implied_stir_census", "pct_renters_cost_burdened_30plus"]
).sort_values("pct_renters_cost_burdened_30plus", ascending=False).head(10)
print("\n=== TOP STRESSED FSAs (census-only) ===")
for _, r in stress.iterrows():
    print(
        f"  {r['GEO_NAME']}: burden {r['pct_renters_cost_burdened_30plus']:.1f}%, "
        f"shelter ${r['median_monthly_renter_shelter_cost']:.0f}, "
        f"implied STIR {r['implied_stir_census']:.1f}%"
    )

sub = census.dropna(subset=["pct_subsidized_tenant", "pct_renters_cost_burdened_30plus"])
if len(sub) > 5:
    print(
        f"\nCorrelation subsidized % vs cost-burden %: "
        f"{sub['pct_subsidized_tenant'].corr(sub['pct_renters_cost_burdened_30plus']):.3f}"
    )

both = census.dropna(subset=["median_monthly_renter_shelter_cost", "pct_renters_cost_burdened_30plus"])
med_rent = both["median_monthly_renter_shelter_cost"].median()
med_burden = both["pct_renters_cost_burdened_30plus"].median()
high_high = both[
    (both["median_monthly_renter_shelter_cost"] >= med_rent)
    & (both["pct_renters_cost_burdened_30plus"] >= med_burden)
]
high_rent_low = both[
    (both["median_monthly_renter_shelter_cost"] >= med_rent)
    & (both["pct_renters_cost_burdened_30plus"] < med_burden)
]
print(f"\nMedian renter shelter: ${med_rent:.0f} | Median cost-burden: {med_burden:.1f}%")
print(f"High rent + high burden FSAs: {len(high_high)}")
print(f"High rent + low burden FSAs (affluent): {len(high_rent_low)}")
if len(high_rent_low):
    print("  Examples:", ", ".join(sorted(high_rent_low["GEO_NAME"].head(8).tolist())))
