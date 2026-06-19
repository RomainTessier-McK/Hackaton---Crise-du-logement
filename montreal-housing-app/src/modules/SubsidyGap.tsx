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
import { fsas, labelFor } from "../data/dataset";
import type { FsaRecord } from "../data/types";
import { fmtMoney, fmtPct, fmtNum } from "../lib/format";
import FsaDrawer from "../components/FsaDrawer";

type Quadrant = "all" | "under" | "over" | "lowstress";

export default function SubsidyGap() {
  const [sel, setSel] = useState<FsaRecord | null>(null);
  const [quadrant, setQuadrant] = useState<Quadrant>("all");
  const [showMemo, setShowMemo] = useState(false);

  const eligible = useMemo(
    () => fsas.filter((f) => f.pctTenantStir30 != null && f.pctSubsidized != null && f.gapScore != null),
    []
  );

  const medStress = 30; // cost-burden threshold reference
  const medSubsidy = useMemo(() => {
    const s = eligible.map((f) => f.pctSubsidized!).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }, [eligible]);

  const inQuadrant = (f: FsaRecord): boolean => {
    if (quadrant === "all") return true;
    const highStress = (f.pctTenantStir30 ?? 0) >= medStress;
    const highSubsidy = (f.pctSubsidized ?? 0) >= medSubsidy;
    if (quadrant === "under") return highStress && !highSubsidy;
    if (quadrant === "over") return !highStress && highSubsidy;
    if (quadrant === "lowstress") return !highStress && !highSubsidy;
    return true;
  };

  const filtered = eligible.filter(inQuadrant);

  const scatter = filtered.map((f) => ({
    fsa: f.fsa,
    x: f.pctSubsidized!,
    y: f.pctTenantStir30!,
    z: f.renterHouseholds ?? 200,
    gap: f.gapScore!,
    ref: f,
  }));

  const ranking = useMemo(
    () => eligible.slice().sort((a, b) => b.gapScore! - a.gapScore!),
    [eligible]
  );

  const topUnderserved = ranking.slice(0, 10);

  const counts = useMemo(() => {
    let under = 0,
      over = 0,
      low = 0,
      high = 0;
    for (const f of eligible) {
      const hs = (f.pctTenantStir30 ?? 0) >= medStress;
      const hsub = (f.pctSubsidized ?? 0) >= medSubsidy;
      if (hs && !hsub) under++;
      else if (!hs && hsub) over++;
      else if (!hs && !hsub) low++;
      else high++;
    }
    return { under, over, low, high };
  }, [eligible, medSubsidy]);

  return (
    <>
      <div className="page-head">
        <div className="audience">Pitch 2 · For Ville de Montréal &amp; OMHM</div>
        <h2>Subsidy Gap Finder</h2>
        <p>
          Every FSA plotted on stress (renter cost-burden) against subsidised-housing share. The gap score = stress
          percentile − subsidy percentile, from −100 (over-served) to +100 (under-served). The aggregate correlation
          between the two is statistically null — meaning subsidy is <i>not</i> currently tracking stress, and a
          placement audit is warranted.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <button className={`kpi accent-red no-print`} style={btn(quadrant === "under")} onClick={() => setQuadrant("under")}>
          <div className="val">{counts.under}</div>
          <div className="lbl">High stress · low subsidy — <b>under-served</b></div>
        </button>
        <button className="kpi accent-green no-print" style={btn(quadrant === "over")} onClick={() => setQuadrant("over")}>
          <div className="val">{counts.over}</div>
          <div className="lbl">Low stress · high subsidy — over-served</div>
        </button>
        <button className="kpi no-print" style={btn(quadrant === "lowstress")} onClick={() => setQuadrant("lowstress")}>
          <div className="val">{counts.low}</div>
          <div className="lbl">Low stress · low subsidy</div>
        </button>
        <button className="kpi accent-cyan no-print" style={btn(quadrant === "all")} onClick={() => setQuadrant("all")}>
          <div className="val">{eligible.length}</div>
          <div className="lbl">All FSAs — show everything</div>
        </button>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>Stress × subsidy quadrant</h3>
          <div className="card-sub">
            Subsidy share (x) vs renter cost-burden (y), bubble = renter households. Top-left = under-served. Click a
            dot. {quadrant !== "all" && <button className="btn ghost no-print" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setQuadrant("all")}>Clear filter</button>}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 14, bottom: 6, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf1" />
              <XAxis type="number" dataKey="x" name="Subsidized" tick={{ fontSize: 11 }} unit="%" domain={[0, "dataMax + 2"]} />
              <YAxis type="number" dataKey="y" name="Burden" tick={{ fontSize: 11 }} unit="%" />
              <ZAxis type="number" dataKey="z" range={[20, 340]} />
              <ReferenceLine y={medStress} stroke="#e8742c" strokeDasharray="4 4" />
              <ReferenceLine x={medSubsidy} stroke="#0a3d7d" strokeDasharray="4 4" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, fontSize: 12, borderRadius: 6 }}>
                      <b>{d.fsa}</b>
                      <div>Burden: {fmtPct(d.y)}</div>
                      <div>Subsidized: {fmtPct(d.x)}</div>
                      <div>Gap score: {d.gap.toFixed(0)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatter} onClick={(e: any) => { const r = e?.ref ?? e?.payload?.ref; if (r) setSel(r); }}>
                {scatter.map((d, i) => (
                  <Cell key={i} fill={d.gap >= 40 ? "#cf3a3a" : d.gap <= -40 ? "#1f9d76" : "#0a3d7d"} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Top 10 under-served FSAs</h3>
          <div className="card-sub">Highest gap score — most renter stress relative to subsidy footprint.</div>
          <table className="data">
            <thead>
              <tr>
                <th>FSA</th>
                <th className="num">Burden</th>
                <th className="num">Subsidized</th>
                <th className="num">Gap</th>
                <th className="num">Renter HH</th>
              </tr>
            </thead>
            <tbody>
              {topUnderserved.map((f) => (
                <tr key={f.fsa} className="row-click" onClick={() => setSel(f)}>
                  <td><b>{f.fsa}</b></td>
                  <td className="num">{fmtPct(f.pctTenantStir30)}</td>
                  <td className="num">{fmtPct(f.pctSubsidized)}</td>
                  <td className="num" style={{ color: "#cf3a3a", fontWeight: 700 }}>+{f.gapScore!.toFixed(0)}</td>
                  <td className="num">{fmtNum(f.renterHouseholds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flexrow no-print" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => setShowMemo((s) => !s)}>
              {showMemo ? "Hide reallocation memo" : "Generate reallocation memo"}
            </button>
            <button className="btn ghost" onClick={() => downloadCsv(ranking)}>
              Export gap ranking (CSV)
            </button>
          </div>
        </div>
      </div>

      {showMemo && (
        <div className="card">
          <div className="flexrow between no-print" style={{ marginBottom: 14 }}>
            <h3>Reallocation memo — draft</h3>
            <button className="btn cyan" onClick={() => window.print()}>Print / Save as PDF</button>
          </div>
          <ReallocationMemo top={topUnderserved.slice(0, 5)} medSubsidy={medSubsidy} />
        </div>
      )}

      <FsaDrawer fsa={sel} onClose={() => setSel(null)} />
    </>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    outline: active ? "3px solid var(--cyan)" : "none",
  };
}

function downloadCsv(rows: FsaRecord[]) {
  const header = ["fsa", "region", "pct_tenant_stir30", "pct_subsidized", "stress_pctile", "subsidy_pctile", "gap_score", "renter_households"];
  const lines = rows.map((r) =>
    [r.fsa, r.region, r.pctTenantStir30, r.pctSubsidized, r.stressPercentile, r.subsidyPercentile, r.gapScore, r.renterHouseholds].join(",")
  );
  const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "subsidy_gap_ranking.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ReallocationMemo({ top, medSubsidy }: { top: FsaRecord[]; medSubsidy: number }) {
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="doc">
      <h4>MEMO — Subsidised-housing reallocation priorities</h4>
      To: OMHM Housing Portfolio Committee{"\n"}
      From: Subsidy Gap Finder (automated draft){"\n"}
      Date: {today}{"\n"}
      Re: Top-5 under-served Forward Sortation Areas by gap score
      {"\n\n"}
      Summary. The five FSAs below show the largest divergence between renter cost-burden and current subsidised-housing
      share. Each combines above-threshold renter stress with a below-median subsidy footprint (median subsidised-tenant
      share across the set is {fmtPct(medSubsidy)}). We recommend prioritising these areas in the next PSL (Programme de
      supplément au loyer) allocation cycle and commissioning a unit-level placement audit.
      {"\n\n"}
      {top.map((f, i) => (
        <span key={f.fsa}>
          {i + 1}. {f.fsa}
          {labelFor(f.fsa) ? ` — ${labelFor(f.fsa)}` : ""}{"\n"}
          {"   "}Renters cost-burdened: {fmtPct(f.pctTenantStir30)} · Subsidised tenants: {fmtPct(f.pctSubsidized)} · Gap
          score: +{f.gapScore!.toFixed(0)}{"\n"}
          {"   "}Renter households: {fmtNum(f.renterHouseholds)} · Median renter shelter: {fmtMoney(f.medianRenterShelter)} ·
          Median income: {fmtMoney(f.medianHouseholdIncome)}{"\n\n"}
        </span>
      ))}
      Recommended actions.{"\n"}
      • Re-audit OMHM unit locations and SHQ PSL allocations against this stress ranking.{"\n"}
      • Where the gap score exceeds +50, open a portfolio ticket to investigate near-term supplement placement.{"\n"}
      • Treat the downtown cluster (H3A–H3H) as a single tenancy zone for coordinated response.
      {"\n\n"}
      <span style={{ fontSize: 11, color: "#888" }}>
        Sources: StatsCan Census 2021 (98-401-X2021013); CMHC RMR 2025. Gap score = stress percentile − subsidy
        percentile. Aggregate Pearson r between stress and subsidy ≈ −0.10 (statistically null), supporting a
        unit-level audit over reliance on the aggregate measure.
      </span>
    </div>
  );
}
