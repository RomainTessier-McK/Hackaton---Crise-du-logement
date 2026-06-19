import { useState } from "react";
import { dataset } from "./data/dataset";
import Overview from "./modules/Overview";
import StirScore from "./modules/StirScore";
import SubsidyGap from "./modules/SubsidyGap";
import StressCluster from "./modules/StressCluster";
import RentPulse from "./modules/RentPulse";

type TabId = "overview" | "stir" | "subsidy" | "cluster" | "rentpulse";

interface Tab {
  id: TabId;
  label: string;
  ico: string;
  tag?: string;
  section: string;
}

const TABS: Tab[] = [
  { id: "overview", label: "Affordability Overview", ico: "▣", section: "Analysis" },
  { id: "stir", label: "STIR-Score Montréal", ico: "◉", tag: "Renters", section: "Products" },
  { id: "subsidy", label: "Subsidy Gap Finder", ico: "◰", tag: "City", section: "Products" },
  { id: "cluster", label: "Stress Cluster Alert", ico: "◍", tag: "Orgs", section: "Products" },
  { id: "rentpulse", label: "Rent Pulse Montréal", ico: "◑", tag: "CMHC", section: "Products" },
];

export default function App() {
  const [tab, setTab] = useState<TabId>("overview");

  const sections = Array.from(new Set(TABS.map((t) => t.section)));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="kicker">Hackathon · Theme 2</div>
          <h1>Montréal Rental Housing Affordability</h1>
          <div className="sub">
            {dataset.meta.fsaCount} Forward Sortation Areas · Census 2021 × CMHC RMR 2025
          </div>
        </div>
        <nav className="nav">
          {sections.map((sec) => (
            <div key={sec}>
              <div className="nav-section">{sec}</div>
              {TABS.filter((t) => t.section === sec).map((t) => (
                <button
                  key={t.id}
                  className={t.id === tab ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  <span className="ico">{t.ico}</span>
                  <span>{t.label}</span>
                  {t.tag && <span className="tag">{t.tag}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          Sources: StatsCan Census 2021 FSA Profile (98-401-X2021013); CMHC Rental Market
          Report 2025, Table 1.1.2. Income reference 2020, shelter 2021, rents Oct&nbsp;2024–2025.
        </div>
      </aside>

      <main className="main">
        <div className="page">
          {tab === "overview" && <Overview />}
          {tab === "stir" && <StirScore />}
          {tab === "subsidy" && <SubsidyGap />}
          {tab === "cluster" && <StressCluster />}
          {tab === "rentpulse" && <RentPulse />}
        </div>
      </main>
    </div>
  );
}
