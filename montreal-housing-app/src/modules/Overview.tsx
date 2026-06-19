import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { dataset, burdenFsas, labelFor } from "../data/dataset";
import type { FsaRecord } from "../data/types";
import { fmtMoney, fmtPct, fmtNum, heatColor, SEVERITY_COLOR, burdenSeverity } from "../lib/format";
import FsaDrawer from "../components/FsaDrawer";

export default function Overview() {
  const { meta, cmaAverage } = dataset;
  const [sel, setSel] = useState<FsaRecord | null>(null);

  const histogram = useMemo(() => {
    const bins = [
      { name: "<15%", lo: 0, hi: 15, count: 0 },
      { name: "15–20%", lo: 15, hi: 20, count: 0 },
      { name: "20–25%", lo: 20, hi: 25, count: 0 },
      { name: "25–30%", lo: 25, hi: 30, count: 0 },
      { name: "30–35%", lo: 30, hi: 35, count: 0 },
      { name: "35–40%", lo: 35, hi: 40, count: 0 },
      { name: "40–50%", lo: 40, hi: 50, count: 0 },
      { name: "50%+", lo: 50, hi: 999, count: 0 },
    ];
    for (const f of burdenFsas) {
      const b = f.pctTenantStir30!;
      const bin = bins.find((x) => b >= x.lo && b < x.hi);
      if (bin) bin.count++;
    }
    return bins;
  }, []);

  const top10 = useMemo(
    () => burdenFsas.slice().sort((a, b) => b.pctTenantStir30! - a.pctTenantStir30!).slice(0, 10),
    []
  );

  const regions = useMemo(() => {
    const map = new Map<string, { region: string; burden: number[]; rent: number[]; income: number[] }>();
    for (const f of burdenFsas) {
      if (!map.has(f.region)) map.set(f.region, { region: f.region, burden: [], rent: [], income: [] });
      const g = map.get(f.region)!;
      if (f.pctTenantStir30 != null) g.burden.push(f.pctTenantStir30);
      if (f.medianRenterShelter != null) g.rent.push(f.medianRenterShelter);
      if (f.medianHouseholdIncome != null) g.income.push(f.medianHouseholdIncome);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    return Array.from(map.values()).map((g) => ({
      region: g.region,
      n: g.burden.length,
      burden: avg(g.burden),
      rent: avg(g.rent),
      income: avg(g.income),
    }));
  }, []);

  const scatter = useMemo(
    () =>
      burdenFsas
        .filter((f) => f.medianRenterShelter != null && f.medianHouseholdIncome != null)
        .map((f) => ({
          fsa: f.fsa,
          x: f.medianHouseholdIncome!,
          y: f.pctTenantStir30!,
          z: f.renterHouseholds ?? 200,
          dual: f.dualStress,
          ref: f,
        })),
    []
  );

  const maxBurden = Math.max(...burdenFsas.map((f) => f.pctTenantStir30!));

  return (
    <>
      <div className="page-head">
        <div className="audience">Phase 1 · Analysis</div>
        <h2>Where is rent eating the largest share of income — and who is exposed?</h2>
        <p>
          Across {meta.fsaWithBurden} Montréal-area FSAs with material renter populations,{" "}
          <b>{meta.fsaStressedOver30} have at least 30% of renters cost-burdened</b> (spending ≥30% of income on
          shelter). The stress is concentrated, structural, and — per CMHC's 2025 survey — worsening: average
          2-bedroom rent across the CMA grew {fmtPct(cmaAverage.bed2_yoy)} year-over-year.
        </p>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <div className="kpi accent-red">
          <div className="val">{((meta.fsaStressedOver30 / meta.fsaWithBurden) * 100).toFixed(1)}%</div>
          <div className="lbl">of FSAs have ≥30% of renters cost-burdened ({meta.fsaStressedOver30} of {meta.fsaWithBurden})</div>
        </div>
        <div className="kpi">
          <div className="val">{fmtPct(top10[0].pctTenantStir30, 1)}</div>
          <div className="lbl">renters cost-burdened in the worst FSA, <b>{top10[0].fsa}</b> ({labelFor(top10[0].fsa)})</div>
        </div>
        <div className="kpi accent-amber">
          <div className="val">{fmtPct(cmaAverage.bed2_yoy)}</div>
          <div className="lbl">YoY growth in CMA average 2-bedroom rent, Oct 2024 → Oct 2025</div>
        </div>
        <div className="kpi accent-cyan">
          <div className="val">{meta.fsaSevereOver40}</div>
          <div className="lbl">FSAs in severe territory — ≥40% of renters cost-burdened</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>The headline distribution</h3>
          <div className="card-sub">
            Count of FSAs by share of renters cost-burdened. The right tail past 30% is the policy target.
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={histogram} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebf1" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v} FSAs`, "Count"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {histogram.map((b, i) => (
                  <Cell key={i} fill={b.lo >= 40 ? SEVERITY_COLOR.severe : b.lo >= 30 ? SEVERITY_COLOR.high : "#0a3d7d"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Stress vs income — the dual-stress map</h3>
          <div className="card-sub">
            Each dot is an FSA: income (x) vs % renters cost-burdened (y), sized by renter households. Red dots are
            high-rent <i>and</i> high-burden — real stress, not affluent enclaves.
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 6, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf1" />
              <XAxis
                type="number"
                dataKey="x"
                name="Income"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                domain={["dataMin - 5000", "dataMax + 5000"]}
              />
              <YAxis type="number" dataKey="y" name="Burden" tick={{ fontSize: 11 }} unit="%" />
              <ZAxis type="number" dataKey="z" range={[20, 320]} />
              <ReferenceLine y={30} stroke={SEVERITY_COLOR.high} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, fontSize: 12, borderRadius: 6 }}>
                      <b>{d.fsa}</b>
                      <div>Burden: {fmtPct(d.y)}</div>
                      <div>Income: {fmtMoney(d.x)}</div>
                      <div>Renters: {fmtNum(d.z)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatter} onClick={(e: any) => { const r = e?.ref ?? e?.payload?.ref; if (r) setSel(r); }}>
                {scatter.map((d, i) => (
                  <Cell key={i} fill={d.dual ? SEVERITY_COLOR.severe : "#0a3d7d"} fillOpacity={d.dual ? 0.85 : 0.45} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3>Top 10 most stressed FSAs</h3>
        <div className="card-sub">Click any row for the full profile. Downtown forms one contiguous cluster within 4 km of McGill and Concordia.</div>
        <table className="data">
          <thead>
            <tr>
              <th>FSA</th>
              <th>Where it is</th>
              <th className="num">% renters ≥30% STIR</th>
              <th className="num">Median rent</th>
              <th className="num">Median income</th>
              <th className="num">Renter HH</th>
              <th className="num">% subsidized</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((f) => (
              <tr key={f.fsa} className="row-click" onClick={() => setSel(f)}>
                <td>
                  <b>{f.fsa}</b> {f.dualStress && <span className="dual-flag">DUAL</span>}
                </td>
                <td className="muted">{labelFor(f.fsa) || f.cmhcZoneName || "—"}</td>
                <td className="num" style={{ color: SEVERITY_COLOR[burdenSeverity(f.pctTenantStir30)], fontWeight: 700 }}>
                  {fmtPct(f.pctTenantStir30)}
                </td>
                <td className="num">{fmtMoney(f.medianRenterShelter)}</td>
                <td className="num">{fmtMoney(f.medianHouseholdIncome)}</td>
                <td className="num">{fmtNum(f.renterHouseholds)}</td>
                <td className="num">{fmtPct(f.pctSubsidized)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Region comparison</h3>
          <div className="card-sub">Island stress runs higher than the suburbs despite similar headline rents.</div>
          <table className="data">
            <thead>
              <tr>
                <th>Region</th>
                <th className="num">FSAs</th>
                <th className="num">Avg burden</th>
                <th className="num">Avg renter shelter</th>
                <th className="num">Avg income</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region}>
                  <td>{r.region}</td>
                  <td className="num">{r.n}</td>
                  <td className="num">{fmtPct(r.burden)}</td>
                  <td className="num">{fmtMoney(r.rent)}</td>
                  <td className="num">{fmtMoney(r.income)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Cost-burden heat grid</h3>
          <div className="card-sub">All {burdenFsas.length} FSAs, colored by % renters cost-burdened. Click a tile.</div>
          <div className="heatgrid">
            {burdenFsas
              .slice()
              .sort((a, b) => b.pctTenantStir30! - a.pctTenantStir30!)
              .map((f) => (
                <div
                  key={f.fsa}
                  className="tile"
                  style={{ background: heatColor(f.pctTenantStir30! / maxBurden) }}
                  title={`${f.fsa} · ${fmtPct(f.pctTenantStir30)}`}
                  onClick={() => setSel(f)}
                >
                  {f.fsa}
                </div>
              ))}
          </div>
          <div className="legend">
            <span>0%</span>
            <span className="ramp" />
            <span>{fmtPct(maxBurden, 0)}</span>
          </div>
        </div>
      </div>

      <div className="note" style={{ marginTop: 22 }}>
        Caveats: Census income reflects 2020 and shelter 2021; CMHC rents are Oct 2025 — real-time STIR is higher than
        shown. Income is all-household, not renter-only. FSA↔CMHC zone is an approximate crosswalk (the two geographies
        are not nested). Small-sample FSAs (e.g. J7B, H3Y) can be noisy.
      </div>

      <FsaDrawer fsa={sel} onClose={() => setSel(null)} />
    </>
  );
}
