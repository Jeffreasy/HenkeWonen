type PriorityCounts = {
  red: number;
  orange: number;
  green: number;
};

type FieldPrioritySummaryProps = {
  priorityCounts: PriorityCounts;
};

export function FieldPrioritySummary({ priorityCounts }: FieldPrioritySummaryProps) {
  return (
    <div className="field-priority-summary" aria-label="Urgentie overzicht">
      <span className="field-priority-pill field-priority-pill-red">
        <strong>{priorityCounts.red}</strong>
        Rood
        <small>vandaag of morgen</small>
      </span>
      <span className="field-priority-pill field-priority-pill-orange">
        <strong>{priorityCounts.orange}</strong>
        Oranje
        <small>binnenkort of onbekend</small>
      </span>
      <span className="field-priority-pill field-priority-pill-green">
        <strong>{priorityCounts.green}</strong>
        Groen
        <small>op schema</small>
      </span>
    </div>
  );
}
