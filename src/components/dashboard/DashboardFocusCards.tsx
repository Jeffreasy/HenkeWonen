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
      icon: ClipboardCheck,
      tone: "warning"
    },
    {
      label: "Open offertes",
      value: openQuoteCount,
      description: "Concepten en verzonden offertes",
      href: "/portal/offertes",
      icon: FileText,
      tone: "info"
    },
    {
      label: "Lopende uitvoering",
      value: plannedWorkCount,
      description: "Inmeting, bestelling of uitvoering",
      href: "/portal/dossiers",
      icon: BriefcaseBusiness,
      tone: "success"
    }
  ] as const;

  return (
    <section className="grid dashboard-grid" aria-label="Belangrijkste werkvoorraad">
      {focusCards.map((card) => {
        const Icon = card.icon;

        return (
          <a
            className={`card metric dashboard-focus-card dashboard-focus-card-${card.tone}`}
            href={card.href}
            key={card.label}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="muted">{card.label}</span>
            <strong>{loadingValue(isLoading, card.value)}</strong>
            <small className="muted">{card.description}</small>
          </a>
        );
      })}
    </section>
  );
}
