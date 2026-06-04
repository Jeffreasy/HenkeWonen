import { formatEuro } from "../../lib/money";
import { StatCard } from "../ui/StatCard";

type QuoteStatsProps = {
  total: number;
  draftCount: number;
  totalValue: number;
};

export function QuoteStats({ total, draftCount, totalValue }: QuoteStatsProps) {
  return (
    <section className="grid three-column">
      <StatCard label="Offertes" value={total} tone="info" />
      <StatCard label="Concepten" value={draftCount} tone="warning" />
      <StatCard label="Totaalwaarde" value={formatEuro(totalValue)} tone="success" />
    </section>
  );
}
