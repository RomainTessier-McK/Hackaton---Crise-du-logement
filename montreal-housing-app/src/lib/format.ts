export const fmtMoney = (v: number | null | undefined, digits = 0): string =>
  v == null ? "—" : `$${v.toLocaleString("en-CA", { maximumFractionDigits: digits })}`;

export const fmtPct = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v.toFixed(digits)}%`;

export const fmtNum = (v: number | null | undefined): string =>
  v == null ? "—" : v.toLocaleString("en-CA");

export const fmtSigned = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;

/** Cost-burden severity tiers used across the suite. */
export type Severity = "low" | "moderate" | "high" | "severe";

export function burdenSeverity(burden: number | null | undefined): Severity {
  if (burden == null) return "low";
  if (burden >= 40) return "severe";
  if (burden >= 30) return "high";
  if (burden >= 20) return "moderate";
  return "low";
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#1f9d76",
  moderate: "#d4a017",
  high: "#e8742c",
  severe: "#cf3a3a",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Manageable",
  moderate: "Watch",
  high: "Cost-burdened",
  severe: "Severe",
};

/** STIR badge (renter affordability) thresholds: green <30, amber 30-40, red >=40. */
export function stirBadge(stir: number | null | undefined): {
  tier: Severity;
  color: string;
  label: string;
} {
  if (stir == null) return { tier: "low", color: "#7a8aa0", label: "—" };
  if (stir >= 40) return { tier: "severe", color: SEVERITY_COLOR.severe, label: "Severe burden" };
  if (stir >= 30) return { tier: "high", color: SEVERITY_COLOR.high, label: "Cost-burdened" };
  return { tier: "low", color: SEVERITY_COLOR.low, label: "Affordable" };
}

/** Linear interpolation of a value across a green→red heat ramp (0..1). */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // green -> yellow -> orange -> red
  const stops = [
    [31, 157, 118],
    [212, 160, 23],
    [232, 116, 44],
    [207, 58, 58],
  ];
  const seg = clamped * (stops.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const c = a.map((av, k) => Math.round(av + (b[k] - av) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
