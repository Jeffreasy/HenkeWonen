import { Skeleton } from "../ui/feedback/Skeleton";

type PriorityCounts = {
  red: number;
  orange: number;
  green: number;
};

type FieldPrioritySummaryProps = {
  priorityCounts: PriorityCounts;
  /** Toont de tellingen als shimmer-skeleton (zelfde pil-structuur/hoogte) i.p.v. het
   * blok te verbergen — voorkomt zowel een 0-sprong als een layout-sprong bij laden. */
  loading?: boolean;
};

export function FieldPrioritySummary({ priorityCounts, loading = false }: FieldPrioritySummaryProps) {
  return (
    <div className="field-priority-summary" aria-label="Urgentie overzicht" aria-busy={loading || undefined}>
      <span className="field-priority-pill field-priority-pill-red">
        <strong>{loading ? <Skeleton width={20} height={18} style={{ display: "inline-block" }} /> : priorityCounts.red}</strong>
        Rood
        <small>vandaag of morgen</small>
      </span>
      <span className="field-priority-pill field-priority-pill-orange">
        <strong>{loading ? <Skeleton width={20} height={18} style={{ display: "inline-block" }} /> : priorityCounts.orange}</strong>
        Oranje
        <small>binnenkort of onbekend</small>
      </span>
      <span className="field-priority-pill field-priority-pill-green">
        <strong>{loading ? <Skeleton width={20} height={18} style={{ display: "inline-block" }} /> : priorityCounts.green}</strong>
        Groen
        <small>op schema</small>
      </span>
    </div>
  );
}
