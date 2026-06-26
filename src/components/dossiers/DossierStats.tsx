import { StatPills } from "../ui/data-display/StatPills";

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
    <StatPills
      ariaLabel="Dossier-overzicht"
      items={[
        { label: "Klanten", value: customersCount },
        { label: "Lopende projecten", value: openProjectsCount },
        { label: "Open offertes", value: openQuotesCount }
      ]}
    />
  );
}
