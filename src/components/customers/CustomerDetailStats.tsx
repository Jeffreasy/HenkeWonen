import { StatCard } from "../ui/data-display/StatCard";

type CustomerDetailStatsProps = {
  projectsCount: number;
  contactsCount: number;
  openLoanedItemsCount: number;
};

export function CustomerDetailStats({
  projectsCount,
  contactsCount,
  openLoanedItemsCount
}: CustomerDetailStatsProps) {
  return (
    <section className="grid three-column">
      <StatCard label="Projecten" value={projectsCount} tone="info" />
      <StatCard label="Contactmomenten" value={contactsCount} />
      <StatCard
        label="Nog uitgeleend"
        value={openLoanedItemsCount}
        tone={openLoanedItemsCount > 0 ? "warning" : "success"}
      />
    </section>
  );
}
