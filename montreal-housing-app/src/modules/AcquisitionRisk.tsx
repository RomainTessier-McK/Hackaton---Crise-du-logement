import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { acq, acqFsas, listingsByFsa, type AcqFsa } from "../data/acquisition";
import { fmtMoney, fmtPct, fmtNum, heatColor } from "../lib/format";
import { labelFor } from "../data/dataset";

export default function AcquisitionRisk() {
  const [sel, setSel] = useState<AcqFsa | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  const targets = useMemo(
    () => acqFsas.filter((f) => f.acquisitionScore != null).sort((a, b) => b.acquisitionScore! - a.acquisitionScore!),
    []
  );
  const renoTargets = useMemo(
    () => acqFsas.filter((f) => f.renovictionRisk != null && f.plexCount > 0).sort((a, b) => b.renovictionRisk! - a.renovictionRisk!),
    []
  );

  const acqCount = targets.filter((f) => (f.acquisitionScore ?? 0) > 0).length;

  const scatter = renoTargets.map((f) => ({
    fsa: f.fsa,
    x: f.plexCount,
    y: f.compoundStress!,
    z: f.renterHouseholds ?? 200,
    risk: f.renovictionRisk!,
    ref: f,
  }));

  const selListings = sel ? (listingsByFsa[sel.fsa] ?? []) : [];
  const selPlex = selListings.filter((l) => l.kind === "plex").sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const selLot = selListings.filter((l) => l.kind === "lot").sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  return (
    <>
      <div className="page-head">
        <div className="audience">Features 5 &amp; 6 · For Ville de Montréal, OMHM &amp; community orgs</div>
        <h2>Acquisition &amp; Risk</h2>
        <p>
          Live Centris for-sale listings ({acq.meta.plexTotal} plexes and {acq.meta.lotTotal} lots, geocoded to FSA)
          overlaid on the affordability metrics. Two signals: where the city should <b>acquire</b> (high subsidy need
          and stock currently for sale) and where vulnerable renters face <b>renoviction / speculative buy-up</b> risk.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <div className="kpi accent-cyan">
          <div className="val">{acq.meta.plexTotal}</div>
          <div className="lbl">plexes currently for sale (sample)</div>
        </div>
        <div className="kpi">
          <div className="val">{acq.meta.lotTotal}</div>
          <div className="lbl">lots / land for sale</div>
        </div>
        <div className="kpi accent-amber">
          <div className="val">{acq.meta.fsasWithSupply}</div>
          <div className="lbl">FSAs with for-sale supply</div>
        </div>
        <div className="kpi accent-red">
          <div className="val">{acqCount}</div>
          <div className="lbl">under-served FSAs with plexes on the market</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>Acquisition targets — where to buy</h3>
          <div className="card-sub">
            FSAs ranked by subsidy gap (need) that have plexes for sale right now. Click a row to see the actual buildings.
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>FSA</th>
                <th className="num">Gap</th>
                <th className="num">Plexes</th>
                <th className="num">Median price</th>
                <th className="num">From</th>
              </tr>
            </thead>
            <tbody>
              {targets.slice(0, 12).map((f) => (
                <tr key={f.fsa} className="row-click" onClick={() => setSel(f)} style={sel?.fsa === f.fsa ? { background: "rgba(45,204,211,0.12)" } : undefined}>
                  <td>
                    <b>{f.fsa}</b>
                    {f.dualStress && <span className="dual-flag" style={{ marginLeft: 6 }}>DUAL</span>}
                  </td>
                  <td className="num" style={{ color: "#cf3a3a", fontWeight: 700 }}>
                    {f.acquisitionScore! >= 0 ? "+" : ""}
                    {f.acquisitionScore!.toFixed(0)}
                  </td>
                  <td className="num">{f.plexCount}</td>
                  <td className="num">{fmtMoney(f.medianPlexPrice)}</td>
                  <td className="num">{fmtMoney(f.minPlexPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flexrow no-print" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => setShowBrief((s) => !s)}>
              {showBrief ? "Hide acquisition brief" : "Generate acquisition brief"}
            </button>
            <button className="btn ghost" onClick={() => downloadCsv(targets)}>
              Export targets (CSV)
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Renoviction radar</h3>
          <div className="card-sub">
            Compound vulnerability (y) vs plexes for sale (x), bubble = renter households, colour = renoviction risk.
            Top-right = vulnerable renters in a neighbourhood being actively bought up. Click a dot.
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 14, bottom: 6, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf1" />
              <XAxis type="number" dataKey="x" name="Plexes for sale" tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Vulnerability" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <ZAxis type="number" dataKey="z" range={[20, 340]} />
              <ReferenceLine y={66} stroke="#cf3a3a" strokeDasharray="4 4" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, fontSize: 12, borderRadius: 6 }}>
                      <b>{d.fsa}</b>
                      <div>Vulnerability: {d.y.toFixed(0)}/100</div>
                      <div>Plexes for sale: {d.x}</div>
                      <div>Renoviction risk: {d.risk.toFixed(0)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatter} onClick={(e: any) => { const r = e?.ref ?? e?.payload?.ref; if (r) setSel(r); }}>
                {scatter.map((d, i) => (
                  <Cell key={i} fill={heatColor(d.risk / 100)} fillOpacity={0.78} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="legend">
            <span>lower risk</span>
            <span className="ramp" />
            <span>higher risk</span>
          </div>
        </div>
      </div>

      {sel && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="flexrow between">
            <h3>
              Listings in {sel.fsa}
              {labelFor(sel.fsa) ? ` — ${labelFor(sel.fsa)}` : ""}
            </h3>
            <button className="btn ghost no-print" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setSel(null)}>
              Close
            </button>
          </div>
          <div className="card-sub">
            Vulnerability {sel.compoundStress != null ? `${sel.compoundStress.toFixed(0)}/100` : "—"} · Renter burden{" "}
            {fmtPct(sel.pctTenantStir30)} · Subsidized {fmtPct(sel.pctSubsidized)} · Subsidy gap{" "}
            {sel.gapScore != null ? `${sel.gapScore >= 0 ? "+" : ""}${sel.gapScore.toFixed(0)}` : "—"}
          </div>

          {selPlex.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, margin: "10px 0 6px" }}>Plexes ({selPlex.length})</h4>
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Address</th>
                    <th className="num">Units (bdr)</th>
                    <th className="num">Price</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {selPlex.map((l) => (
                    <tr key={l.mls}>
                      <td>{l.category?.replace(" for sale", "")}</td>
                      <td>{l.address}</td>
                      <td className="num">{l.bedrooms ?? "—"}</td>
                      <td className="num">{fmtMoney(l.price)}</td>
                      <td className="no-print">
                        {l.url && (
                          <a href={l.url} target="_blank" rel="noreferrer">
                            View ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {selLot.length > 0 && (
            <div className="note" style={{ marginTop: 14 }}>
              Also {selLot.length} lot{selLot.length > 1 ? "s" : ""} / land parcel{selLot.length > 1 ? "s" : ""} for sale here
              (from {fmtMoney(Math.min(...selLot.map((l) => l.price ?? Infinity)))}) — potential new-build subsidized sites.
            </div>
          )}
          {selPlex.length === 0 && selLot.length === 0 && <div className="muted small">No geocoded listings in this FSA.</div>}
        </div>
      )}

      {showBrief && (
        <div className="card">
          <div className="flexrow between no-print" style={{ marginBottom: 14 }}>
            <h3>Acquisition brief — draft</h3>
            <button className="btn cyan" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </div>
          <AcquisitionBrief targets={targets.filter((f) => (f.acquisitionScore ?? 0) > 0).slice(0, 5)} />
        </div>
      )}

      <div className="note">
        {acq.meta.note} Scraped {new Date(acq.meta.scrapedAt).toLocaleDateString("en-CA")} from Centris.ca. Renoviction
        risk = compound vulnerability realized where plexes are actively for sale; not a prediction of any specific owner's intent.
      </div>
    </>
  );
}

function downloadCsv(rows: AcqFsa[]) {
  const header = ["fsa", "region", "acquisition_gap", "renoviction_risk", "plex_count", "lot_count", "median_plex_price", "min_plex_price", "pct_tenant_stir30", "pct_subsidized", "renter_households"];
  const lines = rows.map((r) =>
    [r.fsa, r.region, r.acquisitionScore, r.renovictionRisk, r.plexCount, r.lotCount, r.medianPlexPrice, r.minPlexPrice, r.pctTenantStir30, r.pctSubsidized, r.renterHouseholds].join(",")
  );
  const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "acquisition_targets.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function AcquisitionBrief({ targets }: { targets: AcqFsa[] }) {
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="doc">
      <h4>BRIEF — Non-market acquisition opportunities</h4>
      To: Service de l'habitation / OMHM acquisition team{"\n"}
      From: Acquisition &amp; Risk module (automated draft){"\n"}
      Date: {today}{"\n"}
      Re: Under-served FSAs with plex stock currently on the market
      {"\n\n"}
      Rationale. The FSAs below combine the highest subsidy gaps (renter cost-burden far exceeding the local subsidized
      footprint) with existing-building plex supply for sale today. Acquiring occupied plexes preserves affordability and
      avoids displacement, and can be faster than new construction. Indicative asking prices are drawn from a current
      Centris sample.
      {"\n\n"}
      {targets.map((f, i) => {
        const plex = (listingsByFsa[f.fsa] ?? []).filter((l) => l.kind === "plex").sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        return (
          <span key={f.fsa}>
            {i + 1}. {f.fsa}
            {labelFor(f.fsa) ? ` — ${labelFor(f.fsa)}` : ""}{"\n"}
            {"   "}Subsidy gap: +{f.acquisitionScore!.toFixed(0)} · Renter burden: {fmtPct(f.pctTenantStir30)} · Subsidized:{" "}
            {fmtPct(f.pctSubsidized)} · Renter HH: {fmtNum(f.renterHouseholds)}{"\n"}
            {"   "}Plexes for sale: {f.plexCount} · Median ask: {fmtMoney(f.medianPlexPrice)} · From: {fmtMoney(f.minPlexPrice)}{"\n"}
            {plex.slice(0, 3).map((l) => (
              <span key={l.mls}>
                {"      • "}
                {l.category?.replace(" for sale", "")} — {l.address}, {fmtMoney(l.price)}
                {"\n"}
              </span>
            ))}
            {"\n"}
          </span>
        );
      })}
      Recommended actions.{"\n"}
      • Commission valuations on the listed plexes in the top-3 FSAs and check tenant occupancy.{"\n"}
      • Coordinate with the Right of First Refusal (droit de préemption) zones where they overlap.{"\n"}
      • For FSAs with high renoviction risk, prioritise occupied buildings to protect sitting tenants.
      {"\n\n"}
      <span style={{ fontSize: 11, color: "#888" }}>
        Sources: Centris.ca for-sale listings (current sample, deduped, point-in-polygon joined to FSAs); StatsCan Census
        2021 (98-401-X2021013); CMHC RMR 2025. Asking prices are indicative, not appraisals.
      </span>
    </div>
  );
}
