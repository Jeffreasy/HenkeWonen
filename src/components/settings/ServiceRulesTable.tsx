import { Archive, Pencil, RotateCcw } from "lucide-react";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { StatusBadge } from "../ui/StatusBadge";
import { type ServiceRuleRow } from "./settings/settingsTypes";

type ServiceRulesTableProps = {
  rules: ServiceRuleRow[];
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
  onEdit: (rule: ServiceRuleRow) => void;
  onArchive: (rule: ServiceRuleRow) => void;
  onRestore: (rule: ServiceRuleRow) => void;
};

export function ServiceRulesTable({
  rules,
  isLoading,
  error,
  canManage,
  onEdit,
  onArchive,
  onRestore
}: ServiceRulesTableProps) {
  const columns: Array<DataTableColumn<ServiceRuleRow>> = [
    {
      key: "name",
      header: "Werkzaamheid",
      priority: "primary",
      render: (rule) => (
        <div className="stack-sm">
          <strong>{rule.name}</strong>
          {rule.description ? <small className="muted">{rule.description}</small> : null}
        </div>
      )
    },
    {
      key: "calculation",
      header: "Berekening",
      width: "150px",
      render: (rule) => formatStatusLabel(rule.calculationType)
    },
    {
      key: "price",
      header: "Prijs excl. btw",
      align: "right",
      width: "130px",
      render: (rule) => formatEuro(rule.priceExVat)
    },
    {
      key: "vat",
      header: "Btw",
      align: "right",
      width: "90px",
      render: (rule) => `${rule.vatRate}%`
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (rule) => <StatusBadge status={rule.status} label={formatStatusLabel(rule.status)} />
    },
    {
      key: "actions",
      header: "Acties",
      width: "190px",
      render: (rule) =>
        canManage ? (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => onEdit(rule)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {rule.status === "inactive" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => onRestore(rule)}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => onArchive(rule)}
                size="sm"
                variant="danger"
              >
                Archiveren
              </Button>
            )}
          </div>
        ) : null
    }
  ];

  return (
    <DataTable
      ariaLabel="Werkzaamheden"
      columns={columns}
      density="compact"
      emptyDescription="Voeg de eerste werkzaamheid toe om offerteposten te standaardiseren."
      emptyTitle="Geen werkzaamheden"
      error={error}
      getRowKey={(rule) => rule.id}
      loading={isLoading}
      mobileMode="cards"
      renderMobileCard={(rule) => (
        <div className="mobile-card-section">
          <div className="mobile-card-header">
            <div className="mobile-card-title">
              <strong>{rule.name}</strong>
              {rule.description ? <small className="muted">{rule.description}</small> : null}
            </div>
            <StatusBadge status={rule.status} label={formatStatusLabel(rule.status)} />
          </div>
          <div className="mobile-card-meta">
            <span>{formatStatusLabel(rule.calculationType)}</span>
            <strong>{formatEuro(rule.priceExVat)}</strong>
            <span>{rule.vatRate}% btw</span>
          </div>
          {canManage ? (
            <div className="mobile-card-actions">
              <Button
                leftIcon={<Pencil size={16} aria-hidden="true" />}
                onClick={() => onEdit(rule)}
                size="sm"
                variant="secondary"
              >
                Bewerken
              </Button>
              {rule.status === "inactive" ? (
                <Button
                  leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                  onClick={() => onRestore(rule)}
                  size="sm"
                  variant="secondary"
                >
                  Herstellen
                </Button>
              ) : (
                <Button
                  leftIcon={<Archive size={16} aria-hidden="true" />}
                  onClick={() => onArchive(rule)}
                  size="sm"
                  variant="danger"
                >
                  Archiveren
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
      rows={rules}
    />
  );
}
