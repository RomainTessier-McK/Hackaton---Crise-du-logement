import csv
from collections import defaultdict
from pathlib import Path

import pandas as pd

csv_path = Path(__file__).resolve().parent / "98-401-X2021013_eng_CSV" / "98-401-X2021013_English_CSV_data_filtered.csv"
ids = {1: "pop", 15: "age_20_24", 1416: "renters", 1492: "burden", 1494: "shelter", 243: "income"}
data = defaultdict(dict)

with csv_path.open("r", encoding="latin-1", newline="") as f:
    for row in csv.DictReader(f):
        try:
            cid = int(row["CHARACTERISTIC_ID"])
        except ValueError:
            continue
        if cid not in ids:
            continue
        val = row["C1_COUNT_TOTAL"]
        if val and val not in ("...", "..", "x", "F", "E"):
            try:
                data[row["GEO_NAME"]][ids[cid]] = float(val)
            except ValueError:
                pass

rows = []
for geo, metrics in data.items():
    if metrics.get("pop") and metrics.get("age_20_24"):
        metrics["pct_young_adult"] = metrics["age_20_24"] / metrics["pop"] * 100
    rows.append({"GEO_NAME": geo, **metrics})

df = pd.DataFrame(rows)
print("Downtown / student FSAs:")
for geo in ["H3A", "H3B", "H3G", "H3H", "H2X", "H4A"]:
    match = df[df.GEO_NAME == geo]
    if len(match):
        r = match.iloc[0]
        print(
            f"  {geo}: age 20-24={r.get('pct_young_adult', 0):.1f}%, "
            f"burden={r.get('burden', 0):.1f}%, renters={r.get('renters', 0):.0f}"
        )

df["region"] = df.GEO_NAME.apply(lambda x: "H-island" if x.startswith("H") else "J-south/laval")
print("\nRegional averages:")
print(
    df.groupby("region")
    .agg(burden=("burden", "mean"), shelter=("shelter", "mean"), income=("income", "mean"), young=("pct_young_adult", "mean"))
    .round(1)
    .to_string()
)
