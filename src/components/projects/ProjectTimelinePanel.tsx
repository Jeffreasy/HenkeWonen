import type { PortalWorkflowEvent } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { Timeline } from "../ui/Timeline";

type ProjectAction =
  | "quote_accepted"
  | "supplier_order_created"
  | "invoice_created"
  | "bookkeeper_export_sent"
  | "closed"
  | "cancelled";

type ProjectTimelinePanelProps = {
  workflowEvents: PortalWorkflowEvent[];
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
    quote_sent: "Offerte verzonden",
    quote_accepted: "Offerte akkoord",
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
  canEdit,
  onProcessAction
}: ProjectTimelinePanelProps) {
  return (
    <section className="panel project-timeline-panel">
      <SectionHeader
        compact
        title="Dossiermomenten"
        description="Statusacties en klantcontact bij elkaar."
        actions={
          canEdit ? (
            <div className="project-action-row">
              <Button onClick={() => onProcessAction("quote_accepted")} size="sm" variant="secondary">
                Akkoord
              </Button>
              <Button onClick={() => onProcessAction("supplier_order_created")} size="sm" variant="secondary">
                Bestellen
              </Button>
              <Button onClick={() => onProcessAction("invoice_created")} size="sm" variant="secondary">
                Factuur
              </Button>
              <Button onClick={() => onProcessAction("bookkeeper_export_sent")} size="sm" variant="secondary">
                Boekhouder
              </Button>
              <Button onClick={() => onProcessAction("closed")} size="sm" variant="secondary">
                Sluiten
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
          title: event.title,
          description: event.description,
          meta: dateText(event.createdAt),
          badge: eventLabel(event.type),
          tone: event.visibleToCustomer ? "info" : "neutral"
        }))}
      />
    </section>
  );
}
