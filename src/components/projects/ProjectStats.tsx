import { StatPills } from "../ui/data-display/StatPills";

type ProjectStatsProps = {
  total: number;
  activeCount: number;
  quotePhaseCount: number;
  isLoading?: boolean;
};

export function ProjectStats({ total, activeCount, quotePhaseCount, isLoading }: ProjectStatsProps) {
  return (
    <StatPills
      ariaLabel="Project-overzicht"
      loading={isLoading}
      items={[
        { label: "Projecten", value: total },
        { label: "Lopend", value: activeCount },
        { label: "In offertefase", value: quotePhaseCount }
      ]}
    />
  );
}
