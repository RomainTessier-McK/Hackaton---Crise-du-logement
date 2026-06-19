import { useMemo, useState } from "react";
import { acq, acqFsas, acqListings, type AcqListing } from "../data/acquisition";
import { fmtMoney } from "../lib/format";
import { labelFor } from "../data/dataset";

const regionByFsa: Record<string, string> = Object.fromEntries(
  acqFsas.map((f) => [f.fsa, f.region ?? "—"])
);

type Kind = "all" | "plex" | "lot";
type Sort = "price-asc" | "price-desc" | "beds-desc";

const BATCH = 48;

export default function ListingsBrowser() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [region, setRegion] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sort, setSort] = useState<Sort>("price-asc");
  const [limit, setLimit] = useState(BATCH);
  const [active, setActive] = useState<AcqListing | null>(null);

  const regions = useMemo(
    () => Array.from(new Set(acqFsas.map((f) => f.region).filter(Boolean))) as string[],
    []
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = acqListings.filter((l) => {
      if (kind !== "all" && l.kind !== kind) return false;
      if (region !== "all" && l.fsa && regionByFsa[l.fsa] !== region) return false;
      if (maxPrice > 0 && (l.price ?? Infinity) > maxPrice) return false;
      if (needle) {
        const hay = `${l.address ?? ""} ${l.municipality ?? ""} ${l.fsa ?? ""} ${l.category ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    rows = rows.slice().sort((a, b) => {
      if (sort === "price-asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (sort === "price-desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      return (b.bedrooms ?? 0) - (a.bedrooms ?? 0);
    });
    return rows;
  }, [q, kind, region, maxPrice, sort]);

  const shown = filtered.slice(0, limit);

  return (
    <>
      <div className="page-head">
        <div className="audience">Live market · Centris.ca</div>
        <h2>Listings Browser</h2>
        <p>
          {acq.meta.plexTotal + acq.meta.lotTotal} for-sale properties scraped from Centris on{" "}
          {new Date(acq.meta.scrapedAt).toLocaleDateString("en-CA")} — plexes and development lots across the study area.
          Filter, browse the photos, and open any listing on Centris for the full gallery.
        </p>
      </div>

      <div className="card no-print" style={{ marginBottom: 18 }}>
        <div className="filters-grid">
          <label className="field">
            Search
            <input type="text" placeholder="Address, city, FSA…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(BATCH); }} />
          </label>
          <label className="field">
            Type
            <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setLimit(BATCH); }}>
              <option value="all">All ({acqListings.length})</option>
              <option value="plex">Plexes ({acq.meta.plexTotal})</option>
              <option value="lot">Lots / land ({acq.meta.lotTotal})</option>
            </select>
          </label>
          <label className="field">
            Region
            <select value={region} onChange={(e) => { setRegion(e.target.value); setLimit(BATCH); }}>
              <option value="all">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Max price
            <select value={maxPrice} onChange={(e) => { setMaxPrice(Number(e.target.value)); setLimit(BATCH); }}>
              <option value={0}>No max</option>
              <option value={500000}>$500k</option>
              <option value={750000}>$750k</option>
              <option value={1000000}>$1M</option>
              <option value={1500000}>$1.5M</option>
              <option value={2000000}>$2M</option>
            </select>
          </label>
          <label className="field">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
              <option value="beds-desc">Bedrooms ↓</option>
            </select>
          </label>
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {filtered.length} matching {filtered.length === 1 ? "listing" : "listings"}
        </div>
      </div>

      <div className="gallery">
        {shown.map((l) => (
          <div key={l.mls} className="listing-card" onClick={() => setActive(l)}>
            <div className="listing-photo">
              {l.image ? (
                <img src={l.image} alt={l.category ?? "Listing"} loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
              ) : (
                <div className="listing-noimg">No photo</div>
              )}
              {l.photoCount ? <span className="listing-photocount">{l.photoCount} 📷</span> : null}
              <span className={`listing-kind ${l.kind}`}>{l.kind === "plex" ? "Plex" : l.kind === "lot" ? "Lot" : "Other"}</span>
            </div>
            <div className="listing-body">
              <div className="listing-price">{fmtMoney(l.price)}</div>
              <div className="listing-cat">{l.category?.replace(" for sale", "")}</div>
              <div className="listing-addr">{l.address}</div>
              <div className="listing-muni">{l.municipality}</div>
              <div className="listing-foot">
                {l.fsa && <span className="chip" style={{ fontSize: 11, padding: "2px 8px" }}>{l.fsa}</span>}
                {l.bedrooms != null && <span className="muted small">{l.bedrooms} bdr</span>}
                {l.bathrooms != null && <span className="muted small">{l.bathrooms} bath</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {shown.length < filtered.length && (
        <div className="flexrow no-print" style={{ justifyContent: "center", marginTop: 22 }}>
          <button className="btn" onClick={() => setLimit((n) => n + BATCH)}>
            Show more ({filtered.length - shown.length} left)
          </button>
        </div>
      )}

      {active && <ListingModal listing={active} onClose={() => setActive(null)} />}
    </>
  );
}

function ListingModal({ listing, onClose }: { listing: AcqListing; onClose: () => void }) {
  return (
    <div className="drawer-overlay" onClick={onClose} style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="listing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} style={{ position: "absolute", top: 10, right: 14, zIndex: 2 }}>
          ✕
        </button>
        <div className="listing-modal-photo">
          {listing.image ? <img src={listing.image} alt={listing.category ?? "Listing"} /> : <div className="listing-noimg">No photo</div>}
        </div>
        <div className="listing-modal-body">
          <div className="listing-price" style={{ fontSize: 30 }}>{fmtMoney(listing.price)}</div>
          <h3 style={{ marginTop: 4 }}>{listing.category?.replace(" for sale", "")}</h3>
          <div className="muted" style={{ marginTop: 6 }}>{listing.address}</div>
          <div className="muted">{listing.municipality}</div>
          <div className="flexrow" style={{ margin: "14px 0", gap: 18 }}>
            {listing.fsa && <span className="chip">{listing.fsa}{labelFor(listing.fsa) ? ` · ${labelFor(listing.fsa)}` : ""}</span>}
            {listing.bedrooms != null && <span><b>{listing.bedrooms}</b> bedrooms</span>}
            {listing.bathrooms != null && <span><b>{listing.bathrooms}</b> bath</span>}
            {listing.photoCount != null && <span><b>{listing.photoCount}</b> photos</span>}
          </div>
          <div className="note">
            We show the primary photo here. Open the full listing on Centris to see all {listing.photoCount ?? ""} photos,
            the description, and broker contact.
          </div>
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noreferrer">
              <button className="btn cyan" style={{ marginTop: 16 }}>View full listing on Centris ↗</button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
