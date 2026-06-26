import { StatPills } from "../ui/data-display/StatPills";

type ProjectStatsProps = {
  total: number;
  activeCount: number;
  quotePhaseCount: number;
};

export function ProjectStats({ total, activeCount, quotePhaseCount }: ProjectStatsProps) {
  return (
    <StatPills
      ariaLabel="Project-overzicht"
      items={[
        { label: "Projecten", value: total },
        { label: "Lopend", value: activeCount },
        { label: "In offertefase", value: quotePhaseCount }
      ]}
    />
  );
}
