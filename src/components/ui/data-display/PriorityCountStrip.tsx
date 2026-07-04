import { Skeleton } from "../feedback/Skeleton";

export type PriorityCounts = {
  red: number;
  orange: number;
  green: number;
};

type PriorityLabels = {
  red: string;
  orange: string;
  green: string;
};

/** Standaard: de buitendienst-formulering (bezoekurgentie op datum). */
const DEFAULT_LABELS: PriorityLabels = {
  red: "vandaag of morgen",
  orange: "binnenkort of onbekend",
  green: "op schema"
};

type PriorityCountStripProps = {
  counts: PriorityCounts;
  /** Sublabels per kleur; laat weg voor de buitendienst-standaard. */
  labels?: PriorityLabels;
  /** Toont skeletons i.p.v. de tellingen — voorkomt een 0-sprong en layout-sprong bij laden. */
  loading?: boolean;
  ariaLabel?: string;
};

/**
 * Gedeelde rood/oranje/groen-urgentiestrip. De buitendienst-planning en het
 * winkel-dashboard tonen dezelfde verkeerslicht-taal; alleen de sublabels
 * verschillen per context.
 */
export function PriorityCountStrip({
  counts,
  labels = DEFAULT_LABELS,
  loading = false,
  ariaLabel = "Urgentie overzicht"
}: PriorityCountStripProps) {
  const rows = [
    { key: "red", title: "Rood", count: counts.red, sub: labels.red },
    { key: "orange", title: "Oranje", count: counts.orange, sub: labels.orange },
    { key: "green", title: "Groen", count: counts.green, sub: labels.green }
  ] as const;

  return (
    <div className="priority-strip" aria-label={ariaLabel} aria-busy={loading || undefined}>
      {rows.map((row) => (
        <span key={row.key} className={`priority-pill priority-pill-${row.key}`}>
          <strong>
            {loading ? (
              <Skeleton width={20} height={18} style={{ display: "inline-block" }} />
            ) : (
              row.count
            )}
          </strong>
          {row.title}
          <small>{row.sub}</small>
        </span>
      ))}
    </div>
  );
}
