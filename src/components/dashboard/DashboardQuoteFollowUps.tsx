import { ArrowRight } from "lucide-react";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { QuoteStatus } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";
import { CollapsiblePanel } from "../ui/layout/CollapsiblePanel";

export type DashboardQuoteFollowUp = {
  id: string;
  offertenummer: string;
  titel: string;
  status: QuoteStatus;
  totaalInclBtw: number;
  customerName: string;
  projectTitle?: string;
  gewijzigdOp: number;
};

type DashboardQuoteFollowUpsProps = {
  isLoading: boolean;
  quoteFollowUps: DashboardQuoteFollowUp[];
};

export function DashboardQuoteFollowUps({
  isLoading,
  quoteFollowUps
}: DashboardQuoteFollowUpsProps) {
  return (
    <CollapsiblePanel
      eyebrow="Offertes"
      title="Opvolgen"
      description="Concepten afmaken en verzonden offertes nalopen."
      action={
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/offertes">
          Offertes
        </a>
      }
    >
      {isLoading ? (
        <div className="dashboard-work-list" aria-busy="true" aria-label="Offertes laden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="dashboard-work-item" key={index}>
              <span className="dashboard-work-copy">
                <Skeleton width={84} height={20} />
                <Skeleton width="45%" height={15} />
                <Skeleton width="75%" height={12} />
              </span>
            </div>
          ))}
        </div>
      ) : quoteFollowUps.length > 0 ? (
        <div className="dashboard-work-list">
          {quoteFollowUps.map((quote) => (
            <a className="dashboard-work-item" href={`/portal/offertes/${quote.id}`} key={quote.id}>
              <span className="dashboard-work-copy">
                <Badge variant={quote.status === "draft" ? "warning" : "info"}>
                  {formatQuoteStatus(quote.status)}
                </Badge>
                <strong>{quote.offertenummer}</strong>
                <small className="muted">
                  {quote.titel} - {quote.customerName}
                </small>
              </span>
              <span className="dashboard-work-meta">
                <strong>{formatEuro(quote.totaalInclBtw)}</strong>
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
    </CollapsiblePanel>
  );
}
