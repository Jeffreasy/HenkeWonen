import { formatEuro } from "../../lib/money";

type DashboardInvoiceStripProps = {
  openAmount: number;
  overdueCount: number;
  isLoading: boolean;
};

export function DashboardInvoiceStrip({
  openAmount,
  overdueCount,
  isLoading
}: DashboardInvoiceStripProps) {
  if (isLoading) {
    return null;
  }

  const hasActivity = openAmount > 0 || overdueCount > 0;

  if (!hasActivity) {
    return null;
  }

  return (
    <section className="invoice-strip" aria-label="Factuuroverzicht">
      <div className="invoice-strip-inner">
        <div className="invoice-strip-meta">
          <span className="invoice-strip-label">Openstaande facturen</span>
          <strong className="invoice-strip-amount">{formatEuro(openAmount)}</strong>
        </div>

        {overdueCount > 0 ? (
          <div className="invoice-strip-overdue">
            <span className="invoice-strip-overdue-badge">
              {overdueCount} {overdueCount === 1 ? "factuur te laat" : "facturen te laat"}
            </span>
          </div>
        ) : (
          <div className="invoice-strip-ok">
            <span>Geen achterstallige betalingen</span>
          </div>
        )}

        <a href="/portal/facturen" className="ui-button ui-button-secondary ui-button-sm">
          Facturen bekijken
        </a>
      </div>
    </section>
  );
}
