# Montréal Rental Housing Affordability

> Turning open census and rental-market data into an interactive intelligence platform that shows **who is being priced out of Montréal, where, and what to do about it.**

Hackathon Theme 2 submission. This repository contains the full data pipeline, the cleaned datasets, and a React web app that lets renters, the city, community organizations, and analysts explore rental affordability across **183 Forward Sortation Areas (FSAs)** in the Greater Montréal area.

---

## 1. The problem (the short version)

Rent in Montréal is rising much faster than incomes, and the pain is not spread evenly — it is concentrated in specific neighbourhoods and specific groups of people.

A household is considered **cost-burdened** when it spends **30% or more of its income on shelter** (the international standard, "STIR" = Shelter-cost-To-Income Ratio). Above 50% is **severely** burdened.

From the data in this repo:

| Headline | Value |
|---|---|
| Average 1-bedroom rent, Montréal CMA (2025) | **$1,131/mo** (+7.6% in one year) |
| Average 2-bedroom rent (2025) | **$1,346/mo** (+14.5% in one year) |
| Average studio rent (2025) | **$1,005/mo** (+12.7% in one year) |
| FSAs where ≥30% of renters are cost-burdened | **65 of 182** |
| FSAs where ≥40% of renters are cost-burdened | **15** |
| Mean share of cost-burdened renters across FSAs | **28.3%** |

So the core question we set out to answer:

> **Where in Montréal is rental housing least affordable, who lives there, and where would intervention have the most impact?**

---

## 2. The analysis — from the big picture to the hard problems

The analysis is built to be read in layers. Anyone can grasp the top; each layer adds precision.

### Layer 1 — Rents are outrunning incomes (everyone)
CMHC's 2025 Rental Market Report shows double-digit year-over-year rent growth across most of the metro area, while census incomes (2020 reference) have not kept pace. The result is a rising STIR for renters almost everywhere.

### Layer 2 — The pain is geographic (planners & citizens)
Cost burden is not uniform. We rank all 183 FSAs by the share of renters spending ≥30% of income on shelter and map them as a heat grid. A cluster of central and lower-income FSAs sits far above the metro average, while some suburban areas remain comparatively affordable.

### Layer 3 — "Dual stress": high rent **and** high burden (targeting)
A neighbourhood can be expensive but wealthy (high rent, low burden) or cheap but struggling (low rent, high burden). The neighbourhoods that need attention most are in **both** the top quartile of rent **and** the top quartile of cost burden. We flag these as **dual-stress** FSAs.

### Layer 4 — The subsidy gap (where the city should act)
We compare each FSA's **stress percentile** against its **share of subsidized housing**. FSAs with high stress but low subsidized supply are **under-served** — a positive `gapScore` highlights exactly where subsidized capacity is misaligned with need.

### Layer 5 — Compound vulnerability (who is most exposed)
Affordability stress lands hardest on certain populations. We build a **demographic vulnerability index** from percentile ranks of seniors (65+), one-parent families, recent immigrants, and visible-minority share, then blend it with cost-burden stress into a **compound stress** score to surface the FSAs where economic and social vulnerability overlap.

### Key metrics, defined

| Metric | Meaning |
|---|---|
| **STIR / cost burden** | Shelter cost ÷ income. ≥30% = burdened, ≥40–50% = severe. |
| **`impliedStir`** | Median renter shelter cost ÷ (median household income ÷ 12). |
| **`stress/subsidy/rentPercentile`** | 0–100 rank of an FSA vs. all others on that dimension. |
| **`gapScore`** | `stressPercentile − subsidyPercentile`; high = high need, low subsidy. |
| **`demoVulnIndex`** | Mean of available demographic percentile ranks. |
| **`compoundStress`** | Mean of stress percentile and demographic vulnerability. |
| **`dualStress`** | `true` when an FSA is in the top quartile of **both** rent and burden. |

---

## 3. The platform — what you can actually do

The app has one analytical overview plus four "product" modules, each aimed at a different audience and a different decision.

| Module | Audience | What it does |
|---|---|---|
| **Affordability Overview** | Everyone | KPIs, cost-burden distribution, dual-stress scatter, top-10 most-stressed FSAs, region comparison, and an interactive heat grid. The "read this first" dashboard. |
| **STIR-Score Montréal** | Renters | Enter your FSA + rent + income → personal STIR badge, rent/income **shock sliders** to simulate a raise or a rent hike, a list of cheaper peer FSAs, and a **printable landlord letter**. |
| **Subsidy Gap Finder** | Ville de Montréal / OMHM | Stress × subsidy **quadrant chart**, gap-score ranking of under-served FSAs, a reallocation **memo**, and CSV export. |
| **Stress Cluster Alert** | FRAPRU / comités logement | Pick the demographic dimensions that matter, compute **compound vulnerability** per FSA, get a priority ranking + heat grid, and generate a **canvassing brief**. |
| **Rent Pulse Montréal** | CMHC / analysts | CMHC zone-level rent year-over-year, a rent-shock overlay that **projects 2025 STIR**, and a full zone rent table. |

Cross-cutting features: click any FSA to open a **detail drawer**, color-coded severity throughout, and print-to-PDF document views for the letter / memo / brief.

---

## 4. Architecture & stack

```
Open data (StatsCan + CMHC)
        │
        ▼
build_dataset.py  ── pandas / csv ──►  fsaData.json   (single bundled dataset)
        │                                   │
   (FSA→zone crosswalk,                      ▼
    percentiles, derived           React + TypeScript + Vite
    metrics)                       Recharts visualizations
                                   custom "consulting" CSS theme
                                        │
                                        ▼
                                   Browser SPA (no backend)
```

**Why this shape:** the heavy lifting (cleaning, pivoting, crosswalk, metric derivation) happens once in Python and is baked into a single static JSON. The front end is a fully static single-page app with **no server or database**, so it deploys anywhere and loads instantly.

| Layer | Technology |
|---|---|
| Data pipeline | **Python 3**, `pandas`, `openpyxl`, stdlib `csv`/`json`/`statistics` |
| Front end | **React 18 + TypeScript**, bundled with **Vite** |
| Charts | **Recharts** (bar, scatter, quadrant) + a custom CSS heat grid |
| Styling | Hand-written CSS design system (navy/serif "consulting" aesthetic) |
| Package manager | **pnpm** |
| Hosting | Any static host (build output in `montreal-housing-app/dist/`) |

---

## 5. Data sources

| Source | Used for |
|---|---|
| **StatsCan 2021 Census Profile, FSA (98-401-X2021013)** | Population, tenure, income, shelter cost, cost-burden %, subsidized %, demographics |
| **CMHC Rental Market Report 2025, Table 1.1.2** | Average studio / 1-bed / 2-bed rents by survey zone, 2024 vs 2025 |
| **`Raw data/` bundle** (see below) | Supplementary datasets for further analysis |

The `Raw data/` folder additionally collects: the FSA census subset, the CMHC RMR xlsx, CRA individual tax statistics by FSA (2021), Ville de Montréal building permits, StatsCan housing starts (filtered to Montréal), and the 2021 FSA boundary file — assembled for extending the analysis (e.g. supply-side and income cross-checks).

> **Note:** Very large source files (the full 615 MB census CSV, the 154 MB boundary zip, and its extract) are intentionally **git-ignored** — they exceed GitHub's 100 MB limit and are freely re-downloadable.

---

## 6. Repository structure

```
.
├── README.md                     ← you are here
├── build_dataset.py              ← main pipeline: census + CMHC → fsaData.json
├── filter_census_by_geo.py       ← filters the raw census CSV to Montréal FSAs
├── explore_housing_data.py       ← exploratory cross-analysis
├── explore_demographics.py       ← demographic breakdowns by region
├── 98-401-X2021013_eng_CSV/      ← census data + metadata (filtered subset tracked)
├── Raw data/                     ← supplementary dataset bundle
├── *.html                        ← hackathon brief / kickoff decks
└── montreal-housing-app/         ← the React application
    ├── src/
    │   ├── App.tsx               ← layout + tab navigation
    │   ├── modules/              ← Overview, StirScore, SubsidyGap, StressCluster, RentPulse
    │   ├── components/           ← HeatGrid, FsaDrawer
    │   ├── data/                 ← fsaData.json, dataset.ts, types.ts
    │   ├── lib/format.ts         ← formatting + severity helpers
    │   └── styles.css            ← design system
    └── package.json
```

---

## 7. Getting started

### Run the web app

```bash
cd montreal-housing-app
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # type-check + production build to dist/
```

### Regenerate the dataset (optional)

```bash
pip install pandas openpyxl
python build_dataset.py
# writes montreal-housing-app/src/data/fsaData.json
```

### Re-filter the raw census (optional)

```bash
python filter_census_by_geo.py path/to/98-401-X2021013_English_CSV_data.csv
# keeps FSAs starting with H, J3T, J3X, J3Z, J4–J7
```

---

## 8. Methodology notes & caveats

These are surfaced in-app as well, because honesty about data limitations is part of the analysis:

- **Time mismatch:** census income is 2020 and shelter cost is 2021, while CMHC rents are 2024–2025. Real-time STIR is therefore **higher** than the census-based figures shown.
- **Income basis:** median household income is **all households**, not renters only, which understates true renter burden.
- **Geography:** FSA ↔ CMHC zone is an **approximate neighbourhood crosswalk** — the two geographies are not nested. It is most accurate for dense island FSAs and coarser for suburban areas.
- **Small samples:** a few low-population FSAs (e.g. J7B, H3Y) can be statistically noisy.
- **Suppressed values:** StatsCan/CMHC suppression symbols (`x`, `F`, `...`, `**`) are treated as missing.

---

## 9. Possible extensions

- Wire the `Raw data/` supply-side datasets (building permits, housing starts) into a supply-vs-demand view.
- Replace the approximate FSA→zone crosswalk with a true spatial join using the 2021 FSA boundary file.
- Add CRA income-by-FSA to refine the affordability denominator.
- Time-series rent tracking as future CMHC reports are released.
