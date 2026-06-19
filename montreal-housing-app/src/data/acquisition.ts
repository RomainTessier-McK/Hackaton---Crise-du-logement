import raw from "./acquisitionData.json";

export interface AcqListing {
  mls: string;
  fsa: string | null;
  category: string | null;
  kind: "plex" | "lot" | "other";
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  address: string | null;
  municipality: string | null;
  lat: number | null;
  lng: number | null;
  image: string | null;
  photoCount: number | null;
  url: string | null;
}

export interface AcqFsa {
  fsa: string;
  region: string | null;
  plexCount: number;
  lotCount: number;
  medianPlexPrice: number | null;
  minPlexPrice: number | null;
  gapScore: number | null;
  stressPercentile: number | null;
  subsidyPercentile: number | null;
  compoundStress: number | null;
  demoVulnIndex: number | null;
  dualStress: boolean;
  pctTenantStir30: number | null;
  pctSubsidized: number | null;
  renterHouseholds: number | null;
  acquisitionScore: number | null;
  renovictionRisk: number | null;
}

export interface AcqMeta {
  scrapedAt: string;
  source: string;
  totalListings: number;
  geocoded: number;
  fsasWithSupply: number;
  plexTotal: number;
  lotTotal: number;
  note: string;
}

export interface AcqData {
  meta: AcqMeta;
  fsas: AcqFsa[];
  listings: AcqListing[];
}

export const acq = raw as unknown as AcqData;
export const acqFsas: AcqFsa[] = acq.fsas;
export const acqListings: AcqListing[] = acq.listings;

export const listingsByFsa: Record<string, AcqListing[]> = acqListings.reduce(
  (m, l) => {
    if (l.fsa) (m[l.fsa] ??= []).push(l);
    return m;
  },
  {} as Record<string, AcqListing[]>
);
