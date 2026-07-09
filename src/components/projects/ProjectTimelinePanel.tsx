import { Archive, CheckCircle, FileText, Send, ShoppingCart } from "lucide-react";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type { PortalCustomerContact, PortalQuote } from "../../lib/portalTypes";
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
  /** Contactmomenten die aan dit project zijn gekoppeld: samengevoegd in de tijdlijn. */
  klantContacten?: PortalCustomerContact[];
  latestQuote?: Omit<PortalQuote, "lines"> | null;
  /** Dossierstatus: bepaalt welke statusacties nú aan de beurt zijn. */
  projectStatus: string;
  canEdit: boolean;
  onProcessAction: (action: ProjectAction) => void;
};

const CONTACT_BADGE: Record<PortalCustomerContact["type"], string> = {
  note: "Notitie",
  call: "Telefoon",
  email: "E-mail",
  visit: "Bezoek",
  loaned_item: "Uitgeleend",
  agreement: "Afspraak"
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
  klantContacten = [],
  latestQuote,
  projectStatus,
  canEdit,
  onProcessAction
}: ProjectTimelinePanelProps) {
  // Eén chronologie: statusacties én gekoppelde klantcontacten, nieuwste boven.
  const timelineItems = [
    ...workflowEvents.map((event) => ({
      id: event.id,
      title: event.titel,
      description: event.omschrijving,
      meta: dateText(event.aangemaaktOp),
      badge: eventLabel(event.type),
      tone: (event.zichtbaarVoorKlant ? "info" : "neutral") as "info" | "neutral",
      sortKey: event.aangemaaktOp
    })),
    ...klantContacten.map((contact) => ({
      id: contact.id,
      title: contact.titel,
      description: [contact.omschrijving, contact.vastgelegdDoor ? `Door ${contact.vastgelegdDoor}` : undefined]
        .filter(Boolean)
        .join(" — "),
      meta: dateText(contact.aangemaaktOp),
      badge: `Klantcontact · ${CONTACT_BADGE[contact.type]}`,
      tone: "info" as const,
      sortKey: contact.aangemaaktOp
    }))
  ].sort((a, b) => b.sortKey - a.sortKey);
  const hasQuote = Boolean(latestQuote);
  const canCreateInvoice = latestQuote?.status === "accepted";
  const quoteContext = latestQuote
    ? `${latestQuote.offertenummer} - ${formatQuoteStatus(latestQuote.status)}`
    : undefined;

  // Statusacties fase-gebonden: een verse aanvraag toonde voorheen ook
  // "Leverancier bestellen", "Export boekhouder" en "Project afsluiten" — een
  // muur van knoppen die pas weken later relevant zijn. Elke actie verschijnt
  // nu pas als hij aan de beurt is; de "Volgende stap"-banner blijft de gids.
  const showAcceptQuote =
    hasQuote && ["lead", "measurement_planned", "quote_draft", "quote_sent"].includes(projectStatus);
  const showCreateOrder = projectStatus === "quote_accepted";
  const showCreateInvoice =
    canCreateInvoice &&
    ["quote_accepted", "ordering", "execution_planned", "in_progress"].includes(projectStatus);
  const showBookkeeperExport = ["invoiced", "paid"].includes(projectStatus);
  const showCloseProject = ["invoiced", "paid"].includes(projectStatus);
  const hasActions =
    canEdit &&
    (showAcceptQuote || showCreateOrder || showCreateInvoice || showBookkeeperExport || showCloseProject);

  return (
    <section className="panel project-timeline-panel">
      <SectionHeader
        compact
        title="Dossiermomenten"
        description="Statusacties en klantcontact bij elkaar."
        actions={
          hasActions ? (
            <div className="project-action-row">
              {showAcceptQuote ? (
                <Button
                  onClick={() => onProcessAction("quote_accepted")}
                  size="sm"
                  variant="secondary"
                  leftIcon={<CheckCircle size={14} aria-hidden="true" />}
                  title={quoteContext}
                >
                  Offerte akkoord
                </Button>
              ) : null}
              {showCreateOrder ? (
                <Button
                  onClick={() => onProcessAction("supplier_order_created")}
                  size="sm"
                  variant="secondary"
                  leftIcon={<ShoppingCart size={14} aria-hidden="true" />}
                >
                  Leverancier bestellen
                </Button>
              ) : null}
              {showCreateInvoice ? (
                <Button
                  onClick={() => onProcessAction("invoice_created")}
                  size="sm"
                  variant="secondary"
                  leftIcon={<FileText size={14} aria-hidden="true" />}
                  title={quoteContext ? `Laatste offerte: ${quoteContext}` : undefined}
                >
                  Factuur aanmaken
                </Button>
              ) : null}
              {showBookkeeperExport ? (
                <Button
                  onClick={() => onProcessAction("bookkeeper_export_sent")}
                  size="sm"
                  variant="secondary"
                  leftIcon={<Send size={14} aria-hidden="true" />}
                >
                  Export boekhouder
                </Button>
              ) : null}
              {showCloseProject ? (
                <Button
                  onClick={() => onProcessAction("closed")}
                  size="sm"
                  variant="ghost"
                  leftIcon={<Archive size={14} aria-hidden="true" />}
                >
                  Project afsluiten
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
      <Timeline
        emptyState={
          <EmptyState
            title="Nog geen dossiermomenten"
            description="Elke stap (inmeting, offerte, akkoord, factuur) verschijnt hier vanzelf in de tijdlijn."
          />
        }
        items={timelineItems.map(({ sortKey: _sortKey, ...item }) => item)}
      />
    </section>
  );
}
