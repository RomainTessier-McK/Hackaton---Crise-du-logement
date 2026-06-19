import type { FsaRecord } from "../data/types";
import { fmtMoney, fmtNum, fmtPct, burdenSeverity, SEVERITY_COLOR, SEVERITY_LABEL } from "../lib/format";
import { labelFor } from "../data/dataset";

interface Props {
  fsa: FsaRecord | null;
  onClose: () => void;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="metric-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export default function FsaDrawer({ fsa, onClose }: Props) {
  if (!fsa) return null;
  const sev = burdenSeverity(fsa.pctTenantStir30);
  const label = labelFor(fsa.fsa);
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          ✕
        </button>
        <div className="kicker" style={{ color: "var(--blue)", fontWeight: 700, letterSpacing: 1.4, fontSize: 11 }}>
          {fsa.region}
        </div>
        <h2 style={{ fontSize: 34, marginTop: 4 }}>{fsa.fsa}</h2>
        {label && <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>{label}</p>}

        <div
          className="flexrow"
          style={{ marginTop: 14, marginBottom: 18 }}
        >
          <span className="pill" style={{ background: SEVERITY_COLOR[sev] }}>
            {SEVERITY_LABEL[sev]}
          </span>
          {fsa.dualStress && <span className="dual-flag">HIGH RENT + HIGH BURDEN</span>}
        </div>

        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Affordability</h3>
        <Row k="Renters cost-burdened (≥30% STIR)" v={fmtPct(fsa.pctTenantStir30)} />
        <Row k="Implied renter STIR (2021)" v={fmtPct(fsa.impliedStir)} />
        <Row k="Median renter shelter cost" v={fmtMoney(fsa.medianRenterShelter)} />
        <Row k="Median household income (2020)" v={fmtMoney(fsa.medianHouseholdIncome)} />
        <Row k="Tenant households in subsidized housing" v={fmtPct(fsa.pctSubsidized)} />
        <Row k="Owner households ≥30% STIR" v={fmtPct(fsa.pctOwnerStir30)} />

        <div className="spacer" />
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Households</h3>
        <Row k="Population (2021)" v={fmtNum(fsa.population)} />
        <Row k="Renter households" v={fmtNum(fsa.renterHouseholds)} />
        <Row k="Renter share of tenure" v={fmtPct(fsa.renterShare)} />

        <div className="spacer" />
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Demographics</h3>
        <Row k="Seniors 65+" v={fmtPct(fsa.seniorShare)} />
        <Row k="One-parent families" v={fmtPct(fsa.oneParentShare)} />
        <Row k="One-person households" v={fmtPct(fsa.onePersonShare)} />
        <Row k="Recent immigrants (2016–21)" v={fmtPct(fsa.recentImmigrantShare)} />
        <Row k="Visible minority" v={fmtPct(fsa.visibleMinorityShare)} />

        <div className="spacer" />
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>CMHC market (Oct 2025)</h3>
        <Row k="CMHC zone" v={fsa.cmhcZoneName ? `${fsa.cmhcZone} · ${fsa.cmhcZoneName}` : "—"} />
        <Row k="Avg 1-bedroom rent" v={fmtMoney(fsa.cmhcBed1_2025)} />
        <Row k="Avg 2-bedroom rent" v={fmtMoney(fsa.cmhcBed2_2025)} />
        <Row k="1BR rent YoY" v={fsa.cmhcBed1Yoy != null ? `${fsa.cmhcBed1Yoy > 0 ? "+" : ""}${fsa.cmhcBed1Yoy}%` : "—"} />

        <div className="spacer" />
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Composite scores</h3>
        <Row k="Stress percentile" v={fsa.stressPercentile != null ? fsa.stressPercentile.toFixed(0) : "—"} />
        <Row k="Subsidy percentile" v={fsa.subsidyPercentile != null ? fsa.subsidyPercentile.toFixed(0) : "—"} />
        <Row k="Gap score (stress − subsidy)" v={fsa.gapScore != null ? fsa.gapScore.toFixed(0) : "—"} />
        <Row k="Demographic vulnerability" v={fsa.demoVulnIndex != null ? fsa.demoVulnIndex.toFixed(0) : "—"} />
      </div>
    </div>
  );
}
