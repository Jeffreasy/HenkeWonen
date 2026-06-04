import { Archive, Pencil, RotateCcw } from "lucide-react";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { StatusBadge } from "../ui/StatusBadge";

type CategoryRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: "active" | "inactive";
};

type CategoriesTableProps = {
  categories: CategoryRow[];
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
  onEdit: (category: CategoryRow) => void;
  onArchive: (category: CategoryRow) => void;
  onRestore: (category: CategoryRow) => void;
};

export function CategoriesTable({
  categories,
  isLoading,
  error,
  canManage,
  onEdit,
  onArchive,
  onRestore
}: CategoriesTableProps) {
  const columns: Array<DataTableColumn<CategoryRow>> = [
    {
      key: "name",
      header: "Productgroep",
      priority: "primary",
      render: (category) => (
        <div className="stack-sm">
          <strong>{category.name}</strong>
          <small className="muted">{category.slug}</small>
        </div>
      )
    },
    {
      key: "sortOrder",
      header: "Volgorde",
      align: "right",
      width: "100px",
      render: (category) => category.sortOrder
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (category) => (
        <StatusBadge status={category.status} label={formatStatusLabel(category.status)} />
      )
    },
    {
      key: "actions",
      header: "Acties",
      width: "190px",
      render: (category) =>
        canManage ? (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => onEdit(category)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {category.status === "inactive" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => onRestore(category)}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => onArchive(category)}
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
      ariaLabel="Productgroepen"
      columns={columns}
      density="compact"
      emptyDescription="Voeg de eerste productgroep toe om catalogusproducten te ordenen."
      emptyTitle="Geen productgroepen"
      error={error}
      getRowKey={(category) => category.id}
      loading={isLoading}
      mobileMode="cards"
      renderMobileCard={(category) => (
        <div className="mobile-card-section">
          <div className="mobile-card-header">
            <div className="mobile-card-title">
              <strong>{category.name}</strong>
              <small className="muted">{category.slug}</small>
            </div>
            <StatusBadge status={category.status} label={formatStatusLabel(category.status)} />
          </div>
          <div className="mobile-card-meta">
            <span>Volgorde {category.sortOrder}</span>
          </div>
          {canManage ? (
            <div className="mobile-card-actions">
              <Button
                leftIcon={<Pencil size={16} aria-hidden="true" />}
                onClick={() => onEdit(category)}
                size="sm"
                variant="secondary"
              >
                Bewerken
              </Button>
              {category.status === "inactive" ? (
                <Button
                  leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                  onClick={() => onRestore(category)}
                  size="sm"
                  variant="secondary"
                >
                  Herstellen
                </Button>
              ) : (
                <Button
                  leftIcon={<Archive size={16} aria-hidden="true" />}
                  onClick={() => onArchive(category)}
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
      rows={categories}
    />
  );
}
