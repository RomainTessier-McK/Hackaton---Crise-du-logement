import { useMemo, useState } from "react";
import { fsas, labelFor } from "../data/dataset";
import type { FsaRecord } from "../data/types";
import { fmtPct, fmtNum, heatColor } from "../lib/format";
import FsaDrawer from "../components/FsaDrawer";

type DemoKey = "seniorShare" | "oneParentShare" | "recentImmigrantShare" | "visibleMinorityShare";

const DEMOS: { key: DemoKey; label: string }[] = [
  { key: "oneParentShare", label: "One-parent families" },
  { key: "recentImmigrantShare", label: "Recent immigrants (2016–21)" },
  { key: "seniorShare", label: "Seniors 65+" },
  { key: "visibleMinorityShare", label: "Visible minority" },
];

function percentileRanks(values: { fsa: string; v: number }[]): Record<string, number> {
  const sorted = values.slice().sort((a, b) => a.v - b.v);
  const n = sorted.length;
  const out: Record<string, number> = {};
  sorted.forEach((item, i) => {
    out[item.fsa] = n > 1 ? (i / (n - 1)) * 100 : 50;
  });
  return out;
}

export default function StressCluster() {
  const [active, setActive] = useState<Record<DemoKey, boolean>>({
    oneParentShare: true,
    recentImmigrantShare: true,
    seniorShare: false,
    visibleMinorityShare: false,
  });
  const [sel, setSel] = useState<FsaRecord | null>(null);
  const [brief, setBrief] = useState<FsaRecord | null>(null);

  const eligible = useMemo(() => fsas.filter((f) => f.pctTenantStir30 != null), []);

  const stressRank = useMemo(
    () => percentileRanks(eligible.map((f) => ({ fsa: f.fsa, v: f.pctTenantStir30! }))),
    [eligible]
  );

  const demoRanks = useMemo(() => {
    const map: Record<DemoKey, Record<string, number>> = {} as any;
    for (const d of DEMOS) {
      const vals = eligible.filter((f) => f[d.key] != null).map((f) => ({ fsa: f.fsa, v: f[d.key] as number }));
      map[d.key] = percentileRanks(vals);
    }
    return map;
  }, [eligible]);

  const selectedDemos = DEMOS.filter((d) => active[d.key]);

  const scored = useMemo(() => {
    return eligible
      .map((f) => {
        const demoParts = selectedDemos.map((d) => demoRanks[d.key][f.fsa]).filter((x) => x != null);
        const demoScore = demoParts.length ? demoParts.reduce((s, x) => s + x, 0) / demoParts.length : null;
        const stress = stressRank[f.fsa];
        const compound = demoScore != null && stress != null ? (stress + demoScore) / 2 : null;
        return { f, demoScore, compound };
      })
      .filter((r) => r.compound != null)
      .sort((a, b) => b.compound! - a.compound!);
  }, [eligible, selectedDemos, demoRanks, stressRank]);

  const top = scored.slice(0, 12);
  const maxCompound = scored.length ? scored[0].compound! : 100;

  return (
    <>
      <div className="page-head">
        <div className="audience">Pitch 3 · For FRAPRU &amp; comités logement</div>
        <h2>Stress Cluster Alert</h2>
        <p>
          Intersect renter cost-burden with demographic vulnerability to surface FSAs where economic stress compounds
          with social fragility. Pick the dimensions that matter for your campaign; the compound score recomputes live,
          then generate a per-FSA canvassing brief.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3>Vulnerability dimensions</h3>
        <div className="card-sub">Compound score = average of (renter cost-burden percentile, selected demographic percentiles).</div>
        <div className="flexrow">
          {DEMOS.map((d) => (
            <label
              key={d.key}
              className="chip"
              style={{
                cursor: "pointer",
                background: active[d.key] ? "var(--blue)" : "rgba(10,61,125,0.08)",
                color: active[d.key] ? "#fff" : "var(--blue)",
              }}
            >
              <input
                type="checkbox"
                checked={active[d.key]}
                onChange={() => setActive((a) => ({ ...a, [d.key]: !a[d.key] }))}
                style={{ width: "auto", margin: 0 }}
              />
              {d.label}
            </label>
          ))}
        </div>
        {selectedDemos.length === 0 && (
          <div className="note" style={{ marginTop: 14 }}>Select at least one demographic dimension to compute the compound score.</div>
        )}
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>Priority FSAs by compound vulnerability</h3>
          <div className="card-sub">Top 12. Click a row to open the profile or generate a brief.</div>
          <table className="data">
            <thead>
              <tr>
                <th>FSA</th>
                <th className="num">Compound</th>
                <th className="num">Burden</th>
                <th className="num">Demo score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.f.fsa} className="row-click" onClick={() => setSel(r.f)}>
                  <td>
                    <b>{r.f.fsa}</b>
                    <div className="muted small">{labelFor(r.f.fsa) || r.f.cmhcZoneName || r.f.region}</div>
                  </td>
                  <td className="num" style={{ fontWeight: 700, color: heatColor(r.compound! / 100) }}>
                    {r.compound!.toFixed(0)}
                  </td>
                  <td className="num">{fmtPct(r.f.pctTenantStir30)}</td>
                  <td className="num">{r.demoScore!.toFixed(0)}</td>
                  <td className="num">
                    <button
                      className="btn ghost no-print"
                      style={{ padding: "3px 10px", fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrief(r.f);
                      }}
                    >
                      Brief
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Compound vulnerability heat grid</h3>
          <div className="card-sub">All scored FSAs, ranked. Darker red = higher compound vulnerability.</div>
          <div className="heatgrid">
            {scored.map((r) => (
              <div
                key={r.f.fsa}
                className={`tile${sel?.fsa === r.f.fsa ? " sel" : ""}`}
                style={{ background: heatColor(r.compound! / maxCompound) }}
                title={`${r.f.fsa} · compound ${r.compound!.toFixed(0)}`}
                onClick={() => setSel(r.f)}
              >
                {r.f.fsa}
              </div>
            ))}
          </div>
          <div className="legend">
            <span>Lower</span>
            <span className="ramp" />
            <span>Higher</span>
          </div>
        </div>
      </div>

      {brief && (
        <div className="card">
          <div className="flexrow between no-print" style={{ marginBottom: 14 }}>
            <h3>Canvassing brief — {brief.fsa}</h3>
            <div className="flexrow">
              <button className="btn cyan" onClick={() => window.print()}>Print / Save as PDF</button>
              <button className="btn ghost" onClick={() => setBrief(null)}>Close</button>
            </div>
          </div>
          <CanvassingBrief fsa={brief} demos={selectedDemos} />
        </div>
      )}

      <FsaDrawer fsa={sel} onClose={() => setSel(null)} />
    </>
  );
}

function CanvassingBrief({ fsa, demos }: { fsa: FsaRecord; demos: { key: DemoKey; label: string }[] }) {
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const demoLine = (k: DemoKey) => {
    const v = fsa[k];
    const d = DEMOS.find((x) => x.key === k)!;
    return `• ${d.label}: ${fmtPct(v as number | null)}`;
  };
  return (
    <div className="doc">
      <h4>CANVASSING BRIEF — {fsa.fsa}</h4>
      {labelFor(fsa.fsa) || fsa.cmhcZoneName || fsa.region}{"\n"}
      Prepared {today} · {fsa.region}
      {"\n\n"}
      Why this FSA. {fsa.fsa} combines high renter cost-burden ({fmtPct(fsa.pctTenantStir30)} of renters spending ≥30%
      of income on shelter) with elevated demographic vulnerability. There are approximately {fmtNum(fsa.renterHouseholds)}{" "}
      renter households here, of which only {fmtPct(fsa.pctSubsidized)} are in subsidised housing.
      {"\n\n"}
      Demographic profile.{"\n"}
      {demos.map((d) => demoLine(d.key)).join("\n")}
      {"\n\n"}
      Doorstep script (FR). « Bonjour, nous sommes du comité logement. Saviez-vous que dans le quartier {fsa.fsa},
      une grande part des locataires consacrent plus de 30 % de leur revenu au loyer ? Connaissez-vous vos droits en
      cas de hausse de loyer ? »
      {"\n\n"}
      Doorstep script (EN). "Hi, we're from the housing committee. Did you know that in {fsa.fsa}, a large share of
      renters spend more than 30% of their income on rent? Do you know your rights if your rent goes up?"
      {"\n\n"}
      Logistics.{"\n"}
      • Suggested team size: {Math.max(2, Math.round((fsa.renterHouseholds ?? 1000) / 1500))} volunteers.{"\n"}
      • Priority: renter-dense buildings; bring tenants'-rights leaflets (FR/EN).{"\n"}
      • Follow-up: collect SMS opt-ins for rent-increase alerts.
      {"\n\n"}
      <span style={{ fontSize: 11, color: "#888" }}>
        Sources: StatsCan Census 2021 (98-401-X2021013). Compound vulnerability = average of cost-burden and selected
        demographic percentiles across {fsa.region} FSAs.
      </span>
    </div>
  );
}
