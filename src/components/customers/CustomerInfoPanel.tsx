import { Archive, Pencil, RotateCcw } from "lucide-react";
import { formatCustomerStatus } from "../../lib/i18n/statusLabels";
import type { PortalCustomer } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";

type CustomerInfoPanelProps = {
  customer: PortalCustomer;
  canEdit: boolean;
  onEditToggle: () => void;
  onArchiveToggle: (status: PortalCustomer["status"]) => void;
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

export function CustomerInfoPanel({
  customer,
  canEdit,
  onEditToggle,
  onArchiveToggle
}: CustomerInfoPanelProps) {
  return (
    <section className="panel">
      <SectionHeader
        compact
        title={customer.displayName}
        description={customer.type === "business" ? "Zakelijke klant" : "Particuliere klant"}
        actions={
          <div className="toolbar">
            <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
            {canEdit ? (
              <>
                <Button
                  leftIcon={<Pencil size={16} aria-hidden="true" />}
                  size="sm"
                  variant="secondary"
                  onClick={onEditToggle}
                >
                  Bewerken
                </Button>
                <Button
                  leftIcon={
                    customer.status === "archived" ? (
                      <RotateCcw size={16} aria-hidden="true" />
                    ) : (
                      <Archive size={16} aria-hidden="true" />
                    )
                  }
                  size="sm"
                  variant={customer.status === "archived" ? "secondary" : "danger"}
                  onClick={() => onArchiveToggle(customer.status === "archived" ? "active" : "archived")}
                >
                  {customer.status === "archived" ? "Herstellen" : "Archiveren"}
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <SummaryList
        items={[
          { id: "email", label: "E-mail", value: customer.email ?? "-" },
          { id: "phone", label: "Telefoon", value: customer.phone ?? "-" },
          {
            id: "address",
            label: "Adres",
            value:
              [customer.street, customer.houseNumber, customer.postalCode, customer.city]
                .filter(Boolean)
                .join(" ") || "-"
          },
          { id: "updated", label: "Bijgewerkt", value: dateText(customer.updatedAt) }
        ]}
      />
      {customer.notes ? (
        <Card className="dossier-note" variant="muted">
          <strong>Notities en afspraken</strong>
          <p className="muted">{customer.notes}</p>
        </Card>
      ) : null}
    </section>
  );
}
