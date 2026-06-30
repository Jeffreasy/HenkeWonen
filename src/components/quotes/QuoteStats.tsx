import { formatEuro } from "../../lib/money";
import { StatPills } from "../ui/data-display/StatPills";

type QuoteStatsProps = {
  total: number;
  draftCount: number;
  totalValue: number;
  isLoading?: boolean;
};

export function QuoteStats({ total, draftCount, totalValue, isLoading }: QuoteStatsProps) {
  return (
    <StatPills
      ariaLabel="Offerte-overzicht"
      loading={isLoading}
      items={[
        { label: "Offertes", value: total },
        { label: "Concepten", value: draftCount },
        { label: "Totaalwaarde", value: formatEuro(totalValue), skeletonWidth: 72 }
      ]}
    />
  );
}
