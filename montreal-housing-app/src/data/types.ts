export interface FsaRecord {
  fsa: string;
  region: string;
  population: number;
  totalHouseholds: number | null;
  renterHouseholds: number | null;
  ownerHouseholds: number | null;
  renterShare: number | null;
  medianHouseholdIncome: number | null;
  medianRenterShelter: number | null;
  avgRenterShelter: number | null;
  pctTenantStir30: number | null;
  pctOwnerStir30: number | null;
  pctSubsidized: number | null;
  impliedStir: number | null;
  seniors65plus: number | null;
  seniorShare: number | null;
  oneParentFamilies: number | null;
  oneParentShare: number | null;
  onePersonShare: number | null;
  recentImmigrants: number | null;
  recentImmigrantShare: number | null;
  visibleMinorityShare: number | null;
  cmhcZone: number | null;
  cmhcZoneName: string | null;
  cmhcBed1_2025: number | null;
  cmhcBed1_2024: number | null;
  cmhcBed1Yoy: number | null;
  cmhcBed2_2025: number | null;
  cmhcStudio_2025: number | null;
  stressPercentile: number | null;
  subsidyPercentile: number | null;
  rentPercentile: number | null;
  gapScore: number | null;
  demoVulnIndex: number | null;
  compoundStress: number | null;
  dualStress: boolean;
}

export interface CmhcZone {
  label: string;
  zone: number;
  name: string;
  studio24: number | null;
  studio25: number | null;
  bed1_24: number | null;
  bed1_25: number | null;
  bed2_24: number | null;
  bed2_25: number | null;
  studio_yoy: number | null;
  bed1_yoy: number | null;
  bed2_yoy: number | null;
}

export interface DatasetMeta {
  source: string;
  censusIncomeYear: number;
  censusShelterYear: number;
  cmhcPeriod: string;
  fsaCount: number;
  fsaWithBurden: number;
  fsaStressedOver30: number;
  fsaSevereOver40: number;
  meanBurden: number;
  burdenQ3: number;
  rentQ3: number;
  crosswalkNote: string;
}

export interface Dataset {
  meta: DatasetMeta;
  cmaAverage: CmhcZone;
  cmhcZones: CmhcZone[];
  fsas: FsaRecord[];
}
