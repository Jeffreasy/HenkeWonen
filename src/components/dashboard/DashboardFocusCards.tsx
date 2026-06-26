import { BriefcaseBusiness, ClipboardCheck, FileText } from "lucide-react";

type DashboardFocusCardsProps = {
  isLoading: boolean;
  workItemCount: number;
  openQuoteCount: number;
  plannedWorkCount: number;
};

function loadingValue(isLoading: boolean, value: number) {
  return isLoading ? "..." : new Intl.NumberFormat("nl-NL").format(value);
}

export function DashboardFocusCards({
  isLoading,
  workItemCount,
  openQuoteCount,
  plannedWorkCount
}: DashboardFocusCardsProps) {
  const focusCards = [
    {
      label: "Vandaag oppakken",
      value: workItemCount,
      description: "Dossiers die aandacht vragen",
      href: "#werkoverzicht",
      icon: ClipboardCheck
    },
    {
      label: "Open offertes",
      value: openQuoteCount,
      description: "Concepten en verzonden offertes",
      href: "/portal/offertes",
      icon: FileText
    },
    {
      label: "Lopende uitvoering",
      value: plannedWorkCount,
      description: "Inmeting, bestelling of uitvoering",
      href: "/portal/dossiers",
      icon: BriefcaseBusiness
    }
  ] as const;

  return (
    <section className="dashboard-stat-strip" aria-label="Belangrijkste werkvoorraad">
      {focusCards.map((card) => {
        const Icon = card.icon;

        return (
          <a
            className="dashboard-stat-pill"
            href={card.href}
            key={card.label}
            title={card.description}
          >
            <Icon size={16} aria-hidden="true" />
            <strong>{loadingValue(isLoading, card.value)}</strong>
            <span className="muted">{card.label}</span>
          </a>
        );
      })}
    </section>
  );
}
