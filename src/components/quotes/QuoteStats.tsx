import { formatEuro } from "../../lib/money";
import { StatPills } from "../ui/data-display/StatPills";

type QuoteStatsProps = {
  total: number;
  draftCount: number;
  totalValue: number;
};

export function QuoteStats({ total, draftCount, totalValue }: QuoteStatsProps) {
  return (
    <StatPills
      ariaLabel="Offerte-overzicht"
      items={[
        { label: "Offertes", value: total },
        { label: "Concepten", value: draftCount },
        { label: "Totaalwaarde", value: formatEuro(totalValue) }
      ]}
    />
  );
}
