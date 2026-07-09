import { CornerDownLeft, Undo2 } from "lucide-react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { Card } from "../ui/data-display/Card";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { SummaryList } from "../ui/data-display/SummaryList";
import { dateText } from "../projects/measurement/measurementUtils";

type LoanedItemsListProps = {
  loanedItems: PortalCustomerContact[];
  /** Retour vastleggen (of ongedaan maken bij een misklik). */
  onMarkReturned?: (contact: PortalCustomerContact, returned: boolean) => void;
};

function loanStatus(contact: PortalCustomerContact) {
  if (contact.geretourneerdOp) {
    return { label: "Teruggebracht", variant: "success" as const };
  }

  if (contact.verwachteRetourdatum && contact.verwachteRetourdatum < Date.now()) {
    return { label: "Retour verwacht", variant: "warning" as const };
  }

  return { label: "Uitgeleend", variant: "info" as const };
}

export function LoanedItemsList({ loanedItems, onMarkReturned }: LoanedItemsListProps) {
  return (
    <section className="panel customer-detail-panel customer-loaned-panel">
      <SectionHeader
        compact
        title="Uitgeleende items"
        description="Stalen, boeken of materialen die terug verwacht worden."
      />
      <div className="grid">
        {loanedItems.map((contact) => {
          const status = loanStatus(contact);

          return (
            <Card
              key={contact.id}
              padding="sm"
              variant={status.variant === "warning" ? "warning" : "default"}
            >
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <strong>{contact.uitgeleendItemNaam ?? contact.titel}</strong>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <SummaryList
                items={[
                  { id: "title", label: "Contactmoment", value: contact.titel },
                  { id: "expected", label: "Retour verwacht", value: dateText(contact.verwachteRetourdatum) },
                  { id: "returned", label: "Teruggebracht", value: dateText(contact.geretourneerdOp) }
                ]}
              />
              {onMarkReturned ? (
                <div className="toolbar" style={{ marginTop: 8 }}>
                  {contact.geretourneerdOp ? (
                    <Button
                      leftIcon={<Undo2 size={15} aria-hidden="true" />}
                      onClick={() => onMarkReturned(contact, false)}
                      size="sm"
                      variant="ghost"
                    >
                      Toch niet retour
                    </Button>
                  ) : (
                    <Button
                      leftIcon={<CornerDownLeft size={15} aria-hidden="true" />}
                      onClick={() => onMarkReturned(contact, true)}
                      size="sm"
                      variant="secondary"
                    >
                      Teruggebracht
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          );
        })}
        {loanedItems.length === 0 ? (
          <EmptyState
            title="Geen uitgeleende items"
            description="Uitgeleende stalen of boeken verschijnen hier apart."
          />
        ) : null}
      </div>
    </section>
  );
}
