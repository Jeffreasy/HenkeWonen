import type { PortalCustomerContact } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { SummaryList } from "../ui/SummaryList";
import { dateText } from "../projects/measurement/measurementUtils";

type LoanedItemsListProps = {
  loanedItems: PortalCustomerContact[];
};

function loanStatus(contact: PortalCustomerContact) {
  if (contact.returnedAt) {
    return { label: "Teruggebracht", variant: "success" as const };
  }

  if (contact.expectedReturnDate && contact.expectedReturnDate < Date.now()) {
    return { label: "Retour verwacht", variant: "warning" as const };
  }

  return { label: "Uitgeleend", variant: "info" as const };
}

export function LoanedItemsList({ loanedItems }: LoanedItemsListProps) {
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
                <strong>{contact.loanedItemName ?? contact.title}</strong>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <SummaryList
                items={[
                  { id: "title", label: "Contactmoment", value: contact.title },
                  { id: "expected", label: "Retour verwacht", value: dateText(contact.expectedReturnDate) },
                  { id: "returned", label: "Teruggebracht", value: dateText(contact.returnedAt) }
                ]}
              />
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
