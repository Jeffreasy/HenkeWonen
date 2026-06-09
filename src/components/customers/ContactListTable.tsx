import { Plus } from "lucide-react";
import { useMemo } from "react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { NoteVisibilityBadge } from "../common/NoteVisibilityBadge";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { SectionHeader } from "../ui/SectionHeader";
import { dateText } from "../projects/measurement/measurementUtils";

type ContactListTableProps = {
  contacts: PortalCustomerContact[];
  onNew?: () => void;
};

function contactTypeLabel(type: PortalCustomerContact["type"]) {
  const labels: Record<PortalCustomerContact["type"], string> = {
    note: "Notitie",
    call: "Telefoon",
    email: "E-mail",
    visit: "Bezoek",
    loaned_item: "Uitgeleend",
    agreement: "Afspraak"
  };

  return labels[type];
}

export function ContactListTable({ contacts, onNew }: ContactListTableProps) {
  const contactColumns = useMemo<Array<DataTableColumn<PortalCustomerContact>>>(
    () => [
      {
        key: "contact",
        header: "Moment",
        priority: "primary",
        render: (contact) => (
          <div className="stack-sm">
            <strong>{contact.title}</strong>
            {contact.description ? <small className="muted">{contact.description}</small> : null}
            <small className="muted">{dateText(contact.createdAt)}</small>
          </div>
        )
      },
      {
        key: "type",
        header: "Type",
        width: "130px",
        render: (contact) => (
          <Badge variant={contact.type === "loaned_item" ? "warning" : "neutral"}>
            {contactTypeLabel(contact.type)}
          </Badge>
        )
      },
      {
        key: "visibility",
        header: "Zichtbaarheid",
        width: "150px",
        hideOnMobile: true,
        render: (contact) => <NoteVisibilityBadge visibleToCustomer={contact.visibleToCustomer} />
      },
      {
        key: "date",
        header: "Datum",
        width: "110px",
        render: (contact) => dateText(contact.createdAt)
      }
    ],
    []
  );

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Contactmomenten"
        description="Interne notities, afspraken en klantcontacten."
        actions={
          onNew ? (
            <Button
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={onNew}
              size="sm"
              variant="primary"
            >
              Toevoegen
            </Button>
          ) : null
        }
      />
      <DataTable
        ariaLabel="Contactmomenten"
        columns={contactColumns}
        density="compact"
        emptyDescription="Voeg hierboven een eerste contactmoment toe."
        emptyTitle="Nog geen contactmomenten"
        getRowKey={(contact) => contact.id}
        mobileMode="cards"
        renderMobileCard={(contact) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <strong>{contact.title}</strong>
                {contact.description ? <small className="muted">{contact.description}</small> : null}
              </div>
              <Badge variant={contact.type === "loaned_item" ? "warning" : "neutral"}>
                {contactTypeLabel(contact.type)}
              </Badge>
            </div>
            <div className="mobile-card-meta">
              <NoteVisibilityBadge visibleToCustomer={contact.visibleToCustomer} />
              <span>{dateText(contact.createdAt)}</span>
            </div>
          </div>
        )}
        rows={contacts}
      />
    </section>
  );
}
