import { StatCard } from "../ui/StatCard";

type DossierStatsProps = {
  customersCount: number;
  openProjectsCount: number;
  openQuotesCount: number;
};

export function DossierStats({
  customersCount,
  openProjectsCount,
  openQuotesCount
}: DossierStatsProps) {
  return (
    <section className="grid three-column">
      <StatCard label="Klanten" value={customersCount} tone="info" />
      <StatCard label="Lopende projecten" value={openProjectsCount} tone="warning" />
      <StatCard label="Open offertes" value={openQuotesCount} tone="success" />
    </section>
  );
}
