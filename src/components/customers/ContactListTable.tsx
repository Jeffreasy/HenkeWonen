import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { NoteVisibilityBadge } from "../common/NoteVisibilityBadge";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { dateText } from "../projects/measurement/measurementUtils";

type ContactListTableProps = {
  contacts: PortalCustomerContact[];
  onNew?: () => void;
  /** Typefout of verkeerd type corrigeren (user+). */
  onEdit?: (contact: PortalCustomerContact) => void;
  /** Verwijderen is winkel-beheer (editor/admin). */
  onDelete?: (contact: PortalCustomerContact) => void;
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

export function ContactListTable({ contacts, onNew, onEdit, onDelete }: ContactListTableProps) {
  const contactColumns = useMemo<Array<DataTableColumn<PortalCustomerContact>>>(
    () => [
      {
        key: "contact",
        header: "Moment",
        priority: "primary",
        render: (contact) => (
          <div className="stack-sm">
            <strong>{contact.titel}</strong>
            {contact.omschrijving ? <small className="muted">{contact.omschrijving}</small> : null}
            <small className="muted">{dateText(contact.aangemaaktOp)}</small>
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
        render: (contact) => <NoteVisibilityBadge visibleToCustomer={contact.zichtbaarVoorKlant} />
      },
      {
        key: "author",
        header: "Door",
        width: "140px",
        hideOnMobile: true,
        render: (contact) => contact.vastgelegdDoor ?? "-"
      },
      {
        key: "date",
        header: "Datum",
        width: "110px",
        render: (contact) => dateText(contact.aangemaaktOp)
      },
      ...(onEdit || onDelete
        ? [
            {
              key: "actions",
              header: "Acties",
              width: "100px",
              render: (contact: PortalCustomerContact) => (
                <div className="toolbar" style={{ gap: 4 }}>
                  {onEdit ? (
                    <Button
                      aria-label={`Contactmoment ${contact.titel} bewerken`}
                      leftIcon={<Pencil size={14} aria-hidden="true" />}
                      onClick={() => onEdit(contact)}
                      size="sm"
                      variant="ghost"
                    />
                  ) : null}
                  {onDelete ? (
                    <Button
                      aria-label={`Contactmoment ${contact.titel} verwijderen`}
                      leftIcon={<Trash2 size={14} aria-hidden="true" />}
                      onClick={() => onDelete(contact)}
                      size="sm"
                      variant="ghost"
                    />
                  ) : null}
                </div>
              )
            } satisfies DataTableColumn<PortalCustomerContact>
          ]
        : [])
    ],
    [onEdit, onDelete]
  );

  return (
    <section className="panel customer-detail-panel customer-contact-panel">
      <SectionHeader
        compact
        title="Contactmomenten"
        description="Interne notities, afspraken en klantcontacten."
        actions={
          onNew ? (
            <Button
              className="customer-detail-action-button"
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={onNew}
              size="sm"
              variant="secondary"
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
                <strong>{contact.titel}</strong>
                {contact.omschrijving ? <small className="muted">{contact.omschrijving}</small> : null}
              </div>
              <Badge variant={contact.type === "loaned_item" ? "warning" : "neutral"}>
                {contactTypeLabel(contact.type)}
              </Badge>
            </div>
            <div className="mobile-card-meta">
              <NoteVisibilityBadge visibleToCustomer={contact.zichtbaarVoorKlant} />
              {contact.vastgelegdDoor ? <span>{contact.vastgelegdDoor}</span> : null}
              <span>{dateText(contact.aangemaaktOp)}</span>
              {onEdit ? (
                <Button
                  aria-label={`Contactmoment ${contact.titel} bewerken`}
                  leftIcon={<Pencil size={14} aria-hidden="true" />}
                  onClick={() => onEdit(contact)}
                  size="sm"
                  variant="ghost"
                />
              ) : null}
              {onDelete ? (
                <Button
                  aria-label={`Contactmoment ${contact.titel} verwijderen`}
                  leftIcon={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => onDelete(contact)}
                  size="sm"
                  variant="ghost"
                />
              ) : null}
            </div>
          </div>
        )}
        rows={contacts}
      />
    </section>
  );
}
