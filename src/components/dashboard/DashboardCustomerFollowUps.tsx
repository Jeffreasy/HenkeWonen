import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { Badge } from "../ui/data-display/Badge";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";
import { CollapsiblePanel } from "../ui/layout/CollapsiblePanel";

type FollowUpSignal = {
  contactId: string;
  klantId: string;
  klantNaam: string;
  titel: string;
  type: string;
  uitgeleendItemNaam?: string;
  opvolgenOp?: number;
  verwachteRetourdatum?: number;
};

type CustomerFollowUpsResult = {
  followUps: FollowUpSignal[];
  overdueLoans: FollowUpSignal[];
};

type DashboardCustomerFollowUpsProps = {
  session: AppSession;
};

function dateText(value?: number) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

/**
 * Klantopvolging op het dashboard: contactmomenten met een (verlopen)
 * opvolgdatum en uitgeleende items waarvan de retourdatum is verstreken.
 * Voorheen zag niemand een te laat staalboek tenzij hij toevallig de
 * klantkaart opende.
 */
export function DashboardCustomerFollowUps({ session }: DashboardCustomerFollowUpsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [signals, setSignals] = useState<CustomerFollowUpsResult>({ followUps: [], overdueLoans: [] });

  useEffect(() => {
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = (await client.query(api.portal.customerFollowUps, {
          tenantSlug: session.tenantId
        })) as CustomerFollowUpsResult;
        if (active) {
          setSignals(result);
        }
      } catch (loadError) {
        console.error(loadError);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [session]);

  const total = signals.followUps.length + signals.overdueLoans.length;

  return (
    <CollapsiblePanel
      eyebrow="Klanten"
      title="Klantopvolging"
      description="Afgesproken opvolgingen en uitgeleende items die terug moeten."
      action={
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/klanten">
          Klanten
        </a>
      }
    >
      {isLoading ? (
        <div className="dashboard-work-list" aria-busy="true" aria-label="Klantopvolging laden">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="dashboard-work-item" key={index}>
              <span className="dashboard-work-copy">
                <Skeleton width={84} height={20} />
                <Skeleton width="55%" height={15} />
              </span>
            </div>
          ))}
        </div>
      ) : total > 0 ? (
        <div className="dashboard-work-list">
          {signals.followUps.map((signal) => (
            <a
              className="dashboard-work-item"
              href={`/portal/klanten/${signal.klantId}`}
              key={signal.contactId}
            >
              <span className="dashboard-work-copy">
                <Badge variant="warning">Opvolgen</Badge>
                <strong>{signal.klantNaam}</strong>
                <small className="muted">{signal.titel}</small>
              </span>
              <span className="dashboard-work-meta">
                <small className="muted">afgesproken {dateText(signal.opvolgenOp)}</small>
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </a>
          ))}
          {signals.overdueLoans.map((signal) => (
            <a
              className="dashboard-work-item"
              href={`/portal/klanten/${signal.klantId}`}
              key={signal.contactId}
            >
              <span className="dashboard-work-copy">
                <Badge variant="danger">Retour te laat</Badge>
                <strong>{signal.klantNaam}</strong>
                <small className="muted">{signal.uitgeleendItemNaam ?? signal.titel}</small>
              </span>
              <span className="dashboard-work-meta">
                <small className="muted">verwacht {dateText(signal.verwachteRetourdatum)}</small>
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Geen openstaande klantopvolging"
          description="Geen verlopen opvolgafspraken of te laat geretourneerde items."
        />
      )}
    </CollapsiblePanel>
  );
}
