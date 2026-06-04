import { ArrowRight } from "lucide-react";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { QuoteStatus } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

export type DashboardQuoteFollowUp = {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  totalIncVat: number;
  customerName: string;
  projectTitle?: string;
  updatedAt: number;
};

type DashboardQuoteFollowUpsProps = {
  isLoading: boolean;
  quoteFollowUps: DashboardQuoteFollowUp[];
};

export function DashboardQuoteFollowUps({ isLoading, quoteFollowUps }: DashboardQuoteFollowUpsProps) {
  return (
    <section className="panel">
      <div className="dashboard-section-header">
        <div>
          <p className="eyebrow">Offertes</p>
          <h2>Opvolgen</h2>
          <p className="muted">Concepten afmaken en verzonden offertes nalopen.</p>
        </div>
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/offertes">
          Offertes
        </a>
      </div>

      {isLoading ? (
        <div className="empty-state">Offertes laden.</div>
      ) : quoteFollowUps.length > 0 ? (
        <div className="dashboard-work-list">
          {quoteFollowUps.map((quote) => (
            <a className="dashboard-work-item" href={`/portal/offertes/${quote.id}`} key={quote.id}>
              <span className="dashboard-work-copy">
                <Badge variant={quote.status === "draft" ? "warning" : "info"}>
                  {formatQuoteStatus(quote.status)}
                </Badge>
                <strong>{quote.quoteNumber}</strong>
                <small className="muted">
                  {quote.title} - {quote.customerName}
                </small>
              </span>
              <span className="dashboard-work-meta">
                <strong>{formatEuro(quote.totalIncVat)}</strong>
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Geen open offertes"
          description="Er staan geen concepten of verzonden offertes open voor opvolging."
        />
      )}
    </section>
  );
}
