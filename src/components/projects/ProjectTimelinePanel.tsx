import { Archive, CheckCircle, FileText, Send, ShoppingCart } from "lucide-react";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type { PortalQuote } from "../../lib/portalTypes";
import type { PortalWorkflowEvent } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Timeline } from "../ui/data-display/Timeline";

type ProjectAction =
  | "quote_accepted"
  | "supplier_order_created"
  | "invoice_created"
  | "bookkeeper_export_sent"
  | "closed"
  | "cancelled";

type ProjectTimelinePanelProps = {
  workflowEvents: PortalWorkflowEvent[];
  latestQuote?: Omit<PortalQuote, "lines"> | null;
  canEdit: boolean;
  onProcessAction: (action: ProjectAction) => void;
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

function eventLabel(type: PortalWorkflowEvent["type"]) {
  const labels: Record<string, string> = {
    customer_contact: "Klantcontact",
    quote_created: "Offerte aangemaakt",
    measurement_requested: "Inmeting aangevraagd",
    measurement_planned: "Inmeting gepland",
    measurement_completed: "Inmeting afgerond",
    quote_sent: "Offerte verzonden",
    quote_accepted: "Offerte akkoord",
    quote_rejected: "Offerte afgewezen/verlopen",
    thank_you_letter_sent: "Bedankbrief verzonden",
    execution_planned: "Uitvoering gepland",
    supplier_order_created: "Leveranciersbestelling aangemaakt",
    invoice_created: "Factuur aangemaakt",
    payment_reminder_sent: "Betalingsherinnering verzonden",
    payment_received: "Betaling ontvangen",
    bookkeeper_export_sent: "Export naar boekhouder verzonden",
    closed: "Gesloten"
  };

  return labels[type] ?? "Dossiermoment";
}

export function ProjectTimelinePanel({
  workflowEvents,
  latestQuote,
  canEdit,
  onProcessAction
}: ProjectTimelinePanelProps) {
  const hasQuote = Boolean(latestQuote);
  const canCreateInvoice = latestQuote?.status === "accepted";
  const quoteContext = latestQuote
    ? `${latestQuote.offertenummer} - ${formatQuoteStatus(latestQuote.status)}`
    : undefined;

  return (
    <section className="panel project-timeline-panel">
      <SectionHeader
        compact
        title="Dossiermomenten"
        description="Statusacties en klantcontact bij elkaar."
        actions={
          canEdit ? (
            <div className="project-action-row">
              <Button
                onClick={() => onProcessAction("quote_accepted")}
                disabled={!hasQuote}
                size="sm"
                variant="secondary"
                leftIcon={<CheckCircle size={14} aria-hidden="true" />}
                title={
                  quoteContext ??
                  "Maak eerst een offerte aan voordat je akkoord verwerkt."
                }
              >
                Offerte akkoord
              </Button>
              <Button
                onClick={() => onProcessAction("supplier_order_created")}
                size="sm"
                variant="secondary"
                leftIcon={<ShoppingCart size={14} aria-hidden="true" />}
              >
                Leverancier bestellen
              </Button>
              <Button
                onClick={() => onProcessAction("invoice_created")}
                disabled={!canCreateInvoice}
                size="sm"
                variant="secondary"
                leftIcon={<FileText size={14} aria-hidden="true" />}
                title={
                  latestQuote
                    ? `Laatste offerte: ${quoteContext}`
                    : "Maak of accepteer eerst een offerte voordat je een factuur aanmaakt."
                }
              >
                Factuur aanmaken
              </Button>
              <Button
                onClick={() => onProcessAction("bookkeeper_export_sent")}
                size="sm"
                variant="secondary"
                leftIcon={<Send size={14} aria-hidden="true" />}
              >
                Export boekhouder
              </Button>
              <Button
                onClick={() => onProcessAction("closed")}
                size="sm"
                variant="ghost"
                leftIcon={<Archive size={14} aria-hidden="true" />}
              >
                Project afsluiten
              </Button>
            </div>
          ) : null
        }
      />
      <Timeline
        emptyState={
          <EmptyState
            title="Nog geen dossiermomenten"
            description="Gebruik de acties hierboven om opvolging vast te leggen."
          />
        }
        items={workflowEvents.map((event) => ({
          id: event.id,
          title: event.titel,
          description: event.omschrijving,
          meta: dateText(event.aangemaaktOp),
          badge: eventLabel(event.type),
          tone: event.zichtbaarVoorKlant ? "info" : "neutral"
        }))}
      />
    </section>
  );
}
