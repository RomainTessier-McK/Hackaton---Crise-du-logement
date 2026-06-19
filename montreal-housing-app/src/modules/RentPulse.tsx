import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { dataset, fsas } from "../data/dataset";
import { fmtMoney, fmtPct, fmtSigned, heatColor } from "../lib/format";

export default function RentPulse() {
  const { cmhcZones, cmaAverage } = dataset;
  const [bedType, setBedType] = useState<"studio" | "bed1" | "bed2">("bed1");

  const key25 = bedType === "studio" ? "studio25" : bedType === "bed1" ? "bed1_25" : "bed2_25";
  const key24 = bedType === "studio" ? "studio24" : bedType === "bed1" ? "bed1_24" : "bed2_24";
  const keyYoy = bedType === "studio" ? "studio_yoy" : bedType === "bed1" ? "bed1_yoy" : "bed2_yoy";
  const bedLabel = bedType === "studio" ? "Studio" : bedType === "bed1" ? "1-bedroom" : "2-bedroom";

  const zonesYoy = useMemo(
    () =>
      cmhcZones
        .filter((z) => z[keyYoy] != null)
        .map((z) => ({ zone: `Z${z.zone}`, name: z.name, yoy: z[keyYoy] as number, rent: z[key25] as number }))
        .sort((a, b) => b.yoy - a.yoy),
    [cmhcZones, keyYoy, key25]
  );

  const maxAbsYoy = Math.max(...zonesYoy.map((z) => Math.abs(z.yoy)), 1);

  // Rent-shock overlay: project 2021 census shelter forward by the CMA YoY for this bed type,
  // and recompute implied STIR for the most-stressed FSAs.
  const cmaYoy = (cmaAverage[keyYoy] as number) ?? 10;
  const projection = useMemo(() => {
    return fsas
      .filter((f) => f.impliedStir != null && f.medianHouseholdIncome != null)
      .map((f) => {
        const projectedShelter = (f.medianRenterShelter ?? 0) * (1 + cmaYoy / 100);
        const projStir = (projectedShelter * 12) / f.medianHouseholdIncome! * 100;
        return { fsa: f.fsa, current: f.impliedStir!, projected: projStir };
      })
      .sort((a, b) => b.projected - a.projected)
      .slice(0, 12);
  }, [cmaYoy]);

  return (
    <>
      <div className="page-head">
        <div className="audience">Pitch 4 · For CMHC &amp; market analysts</div>
        <h2>Rent Pulse Montréal</h2>
        <p>
          The CMHC survey anchors to October rents while real-market rents move continuously. This view tracks the
          official 2024→2025 rent shift per zone and projects the census 2021 affordability picture forward by the CMA
          rent growth — the gap a live-listing feed would close in production.
        </p>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <div className="kpi accent-amber">
          <div className="val">{fmtPct(cmaAverage.bed2_yoy)}</div>
          <div className="lbl">CMA average 2-bedroom rent growth, Oct 2024 → Oct 2025</div>
        </div>
        <div className="kpi">
          <div className="val">{fmtMoney(cmaAverage.bed1_25)}</div>
          <div className="lbl">CMA average 1-bedroom asking rent (Oct 2025), up from {fmtMoney(cmaAverage.bed1_24)}</div>
        </div>
        <div className="kpi accent-red">
          <div className="val">{fmtPct(cmaAverage.studio_yoy)}</div>
          <div className="lbl">CMA average studio rent growth — the fastest-rising unit type</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="flexrow between">
          <div>
            <h3>Rent growth by CMHC zone</h3>
            <div className="card-sub">Year-over-year change in average {bedLabel.toLowerCase()} rent, Oct 2024 → Oct 2025.</div>
          </div>
          <div className="flexrow no-print">
            {(["studio", "bed1", "bed2"] as const).map((b) => (
              <button
                key={b}
                className={`btn ${bedType === b ? "" : "ghost"}`}
                style={{ padding: "7px 14px", fontSize: 13 }}
                onClick={() => setBedType(b)}
              >
                {b === "studio" ? "Studio" : b === "bed1" ? "1BR" : "2BR"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={zonesYoy} margin={{ top: 10, right: 16, bottom: 50, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebf1" />
            <XAxis dataKey="zone" tick={{ fontSize: 10 }} angle={-90} textAnchor="end" interval={0} height={50} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, fontSize: 12, borderRadius: 6 }}>
                    <b>{d.name}</b>
                    <div>YoY: {fmtSigned(d.yoy)}%</div>
                    <div>Oct 2025 rent: {fmtMoney(d.rent)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="yoy" radius={[3, 3, 0, 0]}>
              {zonesYoy.map((z, i) => (
                <Cell key={i} fill={z.yoy < 0 ? "#1f9d76" : heatColor(z.yoy / maxAbsYoy)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h3>Rent-shock overlay — projected 2025 STIR</h3>
          <div className="card-sub">
            Census 2021 implied STIR vs the same FSA after applying the CMA {bedLabel.toLowerCase()} growth ({fmtSigned(cmaYoy)}%). Top 12 most exposed.
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={projection} margin={{ top: 10, right: 12, bottom: 40, left: -16 }} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebf1" />
              <XAxis dataKey="fsa" tick={{ fontSize: 10 }} angle={-90} textAnchor="end" interval={0} height={44} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: any, n) => [`${(v as number).toFixed(0)}%`, n === "current" ? "Census 2021" : "Projected 2025"]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="current" name="Census 2021" fill="#9fb4c9" radius={[3, 3, 0, 0]} />
              <Line dataKey="projected" name="Projected 2025" stroke="#cf3a3a" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>CMHC zone rent table</h3>
          <div className="card-sub">Average {bedLabel.toLowerCase()} rent, Oct 2024 vs Oct 2025.</div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th className="num">Oct 24</th>
                  <th className="num">Oct 25</th>
                  <th className="num">YoY</th>
                </tr>
              </thead>
              <tbody>
                {cmhcZones
                  .filter((z) => z[key25] != null)
                  .sort((a, b) => (b[keyYoy] ?? -99) - (a[keyYoy] ?? -99))
                  .map((z) => (
                    <tr key={z.zone}>
                      <td>
                        <b>Z{z.zone}</b> <span className="muted small">{z.name}</span>
                      </td>
                      <td className="num">{fmtMoney(z[key24] as number)}</td>
                      <td className="num">{fmtMoney(z[key25] as number)}</td>
                      <td
                        className="num"
                        style={{ fontWeight: 700, color: (z[keyYoy] ?? 0) < 0 ? "var(--green)" : "var(--red)" }}
                      >
                        {z[keyYoy] != null ? `${fmtSigned(z[keyYoy] as number)}%` : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="note">
        Production note: in a live build, the bars above are anchored by CMHC's official survey and overlaid with a
        rolling 4-week median from scraped asking-rent listings (Kijiji/Centris), FSA-tagged via the Postal Code
        Conversion File — exposing the dollars-per-month lag per zone. Here the overlay uses the CMA YoY as the shock
        proxy on the 2021 census baseline.
      </div>
    </>
  );
}
