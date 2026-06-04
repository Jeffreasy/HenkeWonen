import { StatCard } from "../ui/StatCard";

type ProjectStatsProps = {
  total: number;
  activeCount: number;
  quotePhaseCount: number;
};

export function ProjectStats({ total, activeCount, quotePhaseCount }: ProjectStatsProps) {
  return (
    <section className="grid three-column">
      <StatCard label="Projecten" value={total} tone="info" />
      <StatCard label="Lopend" value={activeCount} tone="warning" />
      <StatCard label="In offertefase" value={quotePhaseCount} />
    </section>
  );
}
