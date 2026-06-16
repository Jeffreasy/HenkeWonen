import { Archive, Pencil, RotateCcw } from "lucide-react";
import { formatCustomerStatus } from "../../lib/i18n/statusLabels";
import type { PortalCustomer } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Card } from "../ui/data-display/Card";
import { CopyButton } from "../ui/forms/CopyButton";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { SummaryList } from "../ui/data-display/SummaryList";
import { dateText } from "../projects/measurement/measurementUtils";

type CustomerInfoPanelProps = {
  customer: PortalCustomer;
  canEdit: boolean;
  onEditToggle: () => void;
  onArchiveToggle: (status: PortalCustomer["status"]) => void;
};

function CopyableCustomerValue({
  value,
  copyLabel
}: {
  value: string;
  copyLabel: string;
}) {
  return (
    <span className="customer-info-copy-value">
      <span className="customer-info-value-text">{value}</span>
      <CopyButton value={value} label={copyLabel} />
    </span>
  );
}

export function CustomerInfoPanel({
  customer,
  canEdit,
  onEditToggle,
  onArchiveToggle
}: CustomerInfoPanelProps) {
  const address =
    [customer.straat, customer.huisnummer, customer.postcode, customer.plaats]
      .filter(Boolean)
      .join(" ") || "";

  return (
    <section className="panel customer-detail-panel customer-info-panel">
      <SectionHeader
        compact
        title={customer.weergaveNaam}
        description={customer.type === "business" ? "Zakelijke klant" : "Particuliere klant"}
        actions={
          <div className="toolbar customer-detail-action-bar customer-info-actions">
            <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
            {canEdit ? (
              <>
                <Button
                  className="customer-detail-action-button"
                  leftIcon={<Pencil size={16} aria-hidden="true" />}
                  size="sm"
                  variant="secondary"
                  onClick={onEditToggle}
                >
                  Bewerken
                </Button>
                <Button
                  className={
                    customer.status === "archived"
                      ? "customer-detail-action-button"
                      : "customer-detail-action-button customer-danger-action"
                  }
                  leftIcon={
                    customer.status === "archived" ? (
                      <RotateCcw size={16} aria-hidden="true" />
                    ) : (
                      <Archive size={16} aria-hidden="true" />
                    )
                  }
                  size="sm"
                  variant={customer.status === "archived" ? "secondary" : "ghost"}
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
          {
            id: "email",
            label: "E-mail",
            value: customer.email ? (
              <CopyableCustomerValue
                value={customer.email}
                copyLabel="E-mailadres kopiëren"
              />
            ) : "-"
          },
          {
            id: "phone",
            label: "Telefoon",
            value: customer.telefoon ? (
              <CopyableCustomerValue
                value={customer.telefoon}
                copyLabel="Telefoonnummer kopiëren"
              />
            ) : "-"
          },
          {
            id: "address",
            label: "Adres",
            value: address ? (
              <span className="customer-info-value-text">{address}</span>
            ) : "-"
          },
          { id: "registered", label: "Vastgelegd op", value: dateText(customer.aangemaaktOp) },
          { id: "updated", label: "Bijgewerkt", value: dateText(customer.gewijzigdOp) }
        ]}
      />
      {customer.notities ? (
        <Card className="dossier-note" variant="muted">
          <strong>Notities en afspraken</strong>
          <p className="muted">{customer.notities}</p>
        </Card>
      ) : null}
    </section>
  );
}
