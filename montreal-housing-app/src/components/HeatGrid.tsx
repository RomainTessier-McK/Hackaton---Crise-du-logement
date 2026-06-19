import { heatColor } from "../lib/format";
import type { FsaRecord } from "../data/types";

interface Props {
  fsas: FsaRecord[];
  /** Returns the 0..1 normalized intensity for an FSA, or null to grey it out. */
  value: (f: FsaRecord) => number | null;
  selected?: string | null;
  onSelect?: (fsa: FsaRecord) => void;
  lowLabel?: string;
  highLabel?: string;
}

export default function HeatGrid({
  fsas,
  value,
  selected,
  onSelect,
  lowLabel = "Low",
  highLabel = "High",
}: Props) {
  return (
    <div>
      <div className="heatgrid">
        {fsas.map((f) => {
          const v = value(f);
          const bg = v == null ? "#cdd5de" : heatColor(v);
          return (
            <div
              key={f.fsa}
              className={`tile${selected === f.fsa ? " sel" : ""}`}
              style={{ background: bg }}
              title={`${f.fsa}${f.cmhcZoneName ? " · " + f.cmhcZoneName : ""}`}
              onClick={() => onSelect?.(f)}
            >
              {f.fsa}
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span>{lowLabel}</span>
        <span className="ramp" />
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
