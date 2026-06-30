import { StatPills } from "../ui/data-display/StatPills";

type DossierStatsProps = {
  customersCount: number;
  openProjectsCount: number;
  openQuotesCount: number;
  isLoading?: boolean;
};

export function DossierStats({
  customersCount,
  openProjectsCount,
  openQuotesCount,
  isLoading
}: DossierStatsProps) {
  return (
    <StatPills
      ariaLabel="Dossier-overzicht"
      loading={isLoading}
      items={[
        { label: "Klanten", value: customersCount },
        { label: "Lopende projecten", value: openProjectsCount },
        { label: "Open offertes", value: openQuotesCount }
      ]}
    />
  );
}
