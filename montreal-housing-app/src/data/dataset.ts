import raw from "./fsaData.json";
import type { Dataset, FsaRecord } from "./types";

export const dataset = raw as unknown as Dataset;

export const fsas: FsaRecord[] = dataset.fsas;

export const fsaByCode: Record<string, FsaRecord> = Object.fromEntries(
  fsas.map((f) => [f.fsa, f])
);

/** FSAs that have a usable renter cost-burden figure. */
export const burdenFsas = fsas.filter((f) => f.pctTenantStir30 != null);

/** Neighbourhood labels for the most relevant FSAs (downtown cluster + notable). */
export const FSA_LABELS: Record<string, string> = {
  H3B: "Downtown core — Place Ville Marie / Bell Centre",
  H3A: "McGill University / Golden Square Mile",
  H3G: "Concordia (Sir-George-Williams) / Guy-Concordia",
  H3H: "Shaughnessy Village / Atwater",
  H2X: "Quartier des Spectacles / Place des Arts",
  H2Z: "Old Montreal / Vieux-Port",
  H3Z: "Westmount-Saint-Pierre / NDG edge",
  H3Y: "Upper Westmount",
  H3C: "Griffintown / Cité-du-Multimédia",
  H2W: "Plateau-Mont-Royal (west)",
  H3V: "Côte-des-Neiges (north)",
  H3T: "Université de Montréal / CDN",
  J7B: "Mirabel / Saint-Janvier",
  J4X: "Brossard (west) / DIX30",
  J7H: "Blainville / Sainte-Thérèse",
  H9R: "Pointe-Claire / Dorval",
};

export function labelFor(fsa: string): string {
  return FSA_LABELS[fsa] ?? "";
}
