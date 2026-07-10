import { BriefcaseBusiness, ClipboardCheck, FileText, Receipt } from "lucide-react";
import { formatEuro } from "../../lib/money";

type DashboardFocusCardsProps = {
  isLoading: boolean;
  workItemCount: number;
  openQuoteCount: number;
  plannedWorkCount: number;
  /** Openstaand factuurbedrag + achterstallige facturen (vierde KPI-pill). */
  invoiceStats?: { openAmount: number; overdueCount: number };
};

function loadingValue(isLoading: boolean, value: number) {
  return isLoading ? "..." : new Intl.NumberFormat("nl-NL").format(value);
}

export function DashboardFocusCards({
  isLoading,
  workItemCount,
  openQuoteCount,
  plannedWorkCount,
  invoiceStats
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
      label: "Lopend werk",
      value: plannedWorkCount,
      description: "Geplande inmetingen en bestellingen",
      href: "/portal/dossiers",
      icon: BriefcaseBusiness
    }
  ] as const;
  // Facturen als vierde KPI op dezelfde rij (verving de aparte factuurbalk):
  // alleen tonen bij activiteit, met alarmkleur zodra er iets te laat is.
  const showInvoicePill =
    !isLoading && invoiceStats && (invoiceStats.openAmount > 0 || invoiceStats.overdueCount > 0);

  return (
    <section className="dashboard-stat-strip" aria-label="Belangrijkste werkvoorraad">
      {focusCards.map((card) => {
        const Icon = card.icon;
        const valueText = loadingValue(isLoading, card.value);

        return (
          <a
            className="dashboard-stat-pill"
            href={card.href}
            key={card.label}
            title={card.description}
            aria-label={`${card.label}: ${valueText} — ${card.description}`}
          >
            <Icon size={16} aria-hidden="true" />
            <strong>{valueText}</strong>
            <span className="muted">{card.label}</span>
          </a>
        );
      })}
      {showInvoicePill ? (
        <a
          className={
            invoiceStats.overdueCount > 0
              ? "dashboard-stat-pill dashboard-stat-pill-alert"
              : "dashboard-stat-pill"
          }
          href="/portal/facturen"
          title="Openstaande facturen"
          aria-label={`Openstaande facturen: ${formatEuro(invoiceStats.openAmount)}${invoiceStats.overdueCount > 0 ? ` — ${invoiceStats.overdueCount} te laat` : ""}`}
        >
          <Receipt size={16} aria-hidden="true" />
          <strong>{formatEuro(invoiceStats.openAmount)}</strong>
          <span className="muted">
            {invoiceStats.overdueCount > 0
              ? `openstaand · ${invoiceStats.overdueCount} te laat`
              : "openstaand"}
          </span>
        </a>
      ) : null}
    </section>
  );
}
