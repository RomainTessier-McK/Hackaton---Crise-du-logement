import { useMemo, useState } from "react";
import { fsas, fsaByCode, labelFor } from "../data/dataset";
import { fmtMoney, fmtPct, stirBadge } from "../lib/format";

const sortedFsas = fsas.slice().sort((a, b) => a.fsa.localeCompare(b.fsa));

export default function StirScore() {
  const [fsaCode, setFsaCode] = useState("H3A");
  const [rent, setRent] = useState(1450);
  const [income, setIncome] = useState(42000);
  const [household, setHousehold] = useState(1);
  const [rentShock, setRentShock] = useState(0);
  const [incomeShock, setIncomeShock] = useState(0);
  const [showLetter, setShowLetter] = useState(false);

  const fsa = fsaByCode[fsaCode];

  const adjRent = rent * (1 + rentShock / 100);
  const adjIncome = income * (1 + incomeShock / 100);
  const stir = adjIncome > 0 ? (adjRent * 12) / adjIncome * 100 : null;
  const badge = stirBadge(stir);

  const fsaMedianStir =
    fsa.medianRenterShelter != null && fsa.medianHouseholdIncome != null
      ? (fsa.medianRenterShelter * 12) / fsa.medianHouseholdIncome * 100
      : null;

  // Peer recommender: same region, lower median rent, with cost-burden context.
  const peers = useMemo(() => {
    if (fsa.medianRenterShelter == null) return [];
    return fsas
      .filter(
        (f) =>
          f.fsa !== fsa.fsa &&
          f.region === fsa.region &&
          f.medianRenterShelter != null &&
          f.medianRenterShelter < fsa.medianRenterShelter! &&
          f.pctTenantStir30 != null
      )
      .sort((a, b) => a.medianRenterShelter! - b.medianRenterShelter!)
      .slice(0, 3);
  }, [fsa]);

  return (
    <>
      <div className="page-head">
        <div className="audience">Pitch 1 · For renters</div>
        <h2>STIR-Score Montréal</h2>
        <p>
          A pre-rent advisory tool. Enter your FSA, monthly rent and household income to get your Shelter-cost-to-Income
          Ratio, see how you compare to your neighbourhood, model a rent or income shock, find cheaper peer FSAs, and
          generate a landlord letter with comparable-rent evidence.
        </p>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>Your situation</h3>
          <div className="card-sub">No account required — nothing leaves your browser.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field">Forward Sortation Area</label>
              <select value={fsaCode} onChange={(e) => setFsaCode(e.target.value)}>
                {sortedFsas.map((f) => (
                  <option key={f.fsa} value={f.fsa}>
                    {f.fsa}
                    {labelFor(f.fsa) ? ` — ${labelFor(f.fsa)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">Household size</label>
              <select value={household} onChange={(e) => setHousehold(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">Monthly rent (incl. utilities)</label>
              <input type="number" value={rent} onChange={(e) => setRent(Number(e.target.value))} />
            </div>
            <div>
              <label className="field">Annual household income (pre-tax)</label>
              <input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value))} />
            </div>
          </div>

          <div className="spacer" />
          <label className="field">
            Rent shock: {rentShock >= 0 ? "+" : ""}
            {rentShock}% &nbsp;({fmtMoney(adjRent)}/mo)
          </label>
          <input type="range" min={-10} max={30} value={rentShock} onChange={(e) => setRentShock(Number(e.target.value))} />
          <label className="field" style={{ marginTop: 12 }}>
            Income shock: {incomeShock >= 0 ? "+" : ""}
            {incomeShock}% &nbsp;({fmtMoney(adjIncome)}/yr)
          </label>
          <input type="range" min={-20} max={20} value={incomeShock} onChange={(e) => setIncomeShock(Number(e.target.value))} />

          <div className="note" style={{ marginTop: 16 }}>
            A 30% STIR is the conventional cost-burden line; 50% is "severely burdened". CMHC reported roughly 8–15% rent
            growth across the CMA in the last year — try the rent shock slider to preview your lease renewal.
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3>Your STIR</h3>
          <div className="card-sub">Share of income spent on shelter</div>
          <div className="stir-badge" style={{ background: badge.color }}>
            <div className="big">{stir != null ? `${stir.toFixed(0)}%` : "—"}</div>
            <div className="lbl">{badge.label}</div>
            <div className="desc">
              {badge.tier === "severe"
                ? "Above 40% — severe burden. See the tenant-rights resources and consider the landlord letter."
                : badge.tier === "high"
                ? "30–40% — cost-burdened by the standard Canadian threshold."
                : "Below 30% — within the conventional affordability range."}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="metric-row">
              <span className="k">Your monthly rent (after shock)</span>
              <span className="v">{fmtMoney(adjRent)}</span>
            </div>
            <div className="metric-row">
              <span className="k">{fsa.fsa} median renter shelter (2021)</span>
              <span className="v">{fmtMoney(fsa.medianRenterShelter)}</span>
            </div>
            <div className="metric-row">
              <span className="k">{fsa.fsa} median renter STIR</span>
              <span className="v">{fmtPct(fsaMedianStir)}</span>
            </div>
            <div className="metric-row">
              <span className="k">{fsa.fsa} renters cost-burdened</span>
              <span className="v">{fmtPct(fsa.pctTenantStir30)}</span>
            </div>
            <div className="metric-row">
              <span className="k">CMHC 1BR asking rent (Oct 2025)</span>
              <span className="v">{fmtMoney(fsa.cmhcBed1_2025)}{fsa.cmhcBed1Yoy != null ? ` (${fsa.cmhcBed1Yoy > 0 ? "+" : ""}${fsa.cmhcBed1Yoy}% YoY)` : ""}</span>
            </div>
          </div>

          <div className="flexrow" style={{ marginTop: "auto", paddingTop: 18 }}>
            <button className="btn" onClick={() => setShowLetter((s) => !s)}>
              {showLetter ? "Hide landlord letter" : "Generate landlord letter"}
            </button>
            {badge.tier === "severe" && (
              <a className="btn ghost" href="https://rclalq.qc.ca/en/housing-committees/" target="_blank" rel="noreferrer">
                Find a comité logement
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3>Peer FSAs — similar area, lower median rent</h3>
        <div className="card-sub">
          Three FSAs in {fsa.region} with lower median renter shelter cost than {fsa.fsa}.
        </div>
        {peers.length === 0 ? (
          <p className="muted">{fsa.fsa} is already at or below the regional rent floor — no cheaper peers found.</p>
        ) : (
          <div className="grid cols-3">
            {peers.map((p) => (
              <div key={p.fsa} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
                <div className="flexrow between">
                  <b style={{ fontSize: 18 }}>{p.fsa}</b>
                  <span className="chip">{fmtMoney(p.medianRenterShelter)}/mo</span>
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>{labelFor(p.fsa) || p.cmhcZoneName || p.region}</div>
                <div className="metric-row" style={{ marginTop: 10 }}>
                  <span className="k">vs your FSA</span>
                  <span className="v" style={{ color: "var(--green)" }}>
                    −{fmtMoney((fsa.medianRenterShelter ?? 0) - (p.medianRenterShelter ?? 0))}/mo
                  </span>
                </div>
                <div className="metric-row">
                  <span className="k">Renters burdened</span>
                  <span className="v">{fmtPct(p.pctTenantStir30)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLetter && (
        <div className="card">
          <div className="flexrow between no-print" style={{ marginBottom: 14 }}>
            <h3>Landlord letter — draft</h3>
            <button className="btn cyan" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </div>
          <LandlordLetter
            fsa={fsa.fsa}
            rent={adjRent}
            stir={stir}
            cmhc1br={fsa.cmhcBed1_2025}
            cmhcYoy={fsa.cmhcBed1Yoy}
            medianShelter={fsa.medianRenterShelter}
            peers={peers.map((p) => ({ fsa: p.fsa, rent: p.medianRenterShelter }))}
          />
        </div>
      )}
    </>
  );
}

function LandlordLetter({
  fsa,
  rent,
  stir,
  cmhc1br,
  cmhcYoy,
  medianShelter,
  peers,
}: {
  fsa: string;
  rent: number;
  stir: number | null;
  cmhc1br: number | null;
  cmhcYoy: number | null;
  medianShelter: number | null;
  peers: { fsa: string; rent: number | null }[];
}) {
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="doc">
      <h4>Re: Rent review for my unit in {fsa}</h4>
      {today}
      {"\n\n"}
      Dear Landlord,
      {"\n\n"}
      I am writing regarding the rent for my unit. Based on publicly available housing data for our neighbourhood
      (Forward Sortation Area {fsa}), I would like to discuss whether the current rent of {fmtMoney(rent)} per month is
      aligned with the local market.
      {"\n\n"}
      The relevant benchmarks are:
      {"\n"}• Statistics Canada 2021 Census median renter shelter cost in {fsa}: {fmtMoney(medianShelter)} per month.
      {"\n"}• CMHC Rental Market Report 2025 average 1-bedroom asking rent for this zone: {fmtMoney(cmhc1br)}
      {cmhcYoy != null ? ` (${cmhcYoy > 0 ? "+" : ""}${cmhcYoy}% year-over-year)` : ""}.
      {stir != null ? `\n• At my income, this rent represents approximately ${stir.toFixed(0)}% of my household income (the recognised affordability threshold is 30%).` : ""}
      {peers.length
        ? `\n\nFor reference, comparable nearby areas show lower median rents: ${peers
            .map((p) => `${p.fsa} (${fmtMoney(p.rent)}/mo)`)
            .join(", ")}.`
        : ""}
      {"\n\n"}
      I value our tenancy and hope we can keep the rent reasonable and in line with these figures. I would appreciate
      the opportunity to discuss this. Thank you for your time and consideration.
      {"\n\n"}
      Sincerely,
      {"\n"}
      ______________________________
      {"\n"}
      Tenant — Unit in {fsa}
      {"\n\n"}
      <span style={{ fontSize: 11, color: "#888" }}>
        Sources: Statistics Canada Census 2021 (98-401-X2021013); CMHC Rental Market Report 2025, Table 1.1.2.
        Figures are neighbourhood medians/averages and are provided as context, not a legal determination.
      </span>
    </div>
  );
}
