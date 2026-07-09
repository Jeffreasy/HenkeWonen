import { Pencil, Archive, RotateCcw, Plus } from "lucide-react";
import { useMemo } from "react";
import { Card } from "../ui/data-display/Card";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { FilterBar } from "../ui/layout/FilterBar";
import { SearchInput } from "../ui/forms/SearchInput";
import { Field } from "../ui/forms/Field";
import { Select } from "../ui/forms/Select";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { Button } from "../ui/forms/Button";
import {
  formatStatusLabel,
  formatProductListStatus,
  formatImportStatus
} from "../../lib/i18n/statusLabels";
import type { PortalSupplier, ProductListStatus } from "../../lib/portalTypes";
import { type SupplierStatus, PRODUCT_LIST_STATUSES, SUPPLIER_STATUSES, dateText } from "./supplier/supplierUtils";

type SupplierTableProps = {
  suppliers: PortalSupplier[];
  search: string;
  setSearch: (val: string) => void;
  statusFilter: ProductListStatus | "all";
  setStatusFilter: (val: ProductListStatus | "all") => void;
  supplierStatusFilter: SupplierStatus | "all";
  setSupplierStatusFilter: (val: SupplierStatus | "all") => void;
  onEdit: (supplier: PortalSupplier) => void;
  onNew: () => void;
  onArchive: (supplier: PortalSupplier) => void;
  onRestore: (supplier: PortalSupplier) => void;
  onChangeProductListStatus: (supplier: PortalSupplier, nextStatus: ProductListStatus) => Promise<void>;
  onChangeVatMode: (supplier: PortalSupplier, nextMode: "exclusive" | "inclusive") => void;
  savingSupplierId: string | null;
  isLoading: boolean;
  error: string | null;
};

function vatModeSelect(
  supplier: PortalSupplier,
  savingSupplierId: string | null,
  onChangeVatMode: (supplier: PortalSupplier, nextMode: "exclusive" | "inclusive") => void
) {
  return (
    <Select
      aria-label={`Btw-modus verkoopprijzen voor ${supplier.naam}`}
      disabled={savingSupplierId === supplier.id}
      value={supplier.verkoopBtwModus ?? ""}
      onChange={(event) => {
        const next = event.target.value;
        if (next === "exclusive" || next === "inclusive") {
          onChangeVatMode(supplier, next);
        }
      }}
    >
      {/* Leeg = nog geen bewuste keuze: prijzen volgen de geïmporteerde prijslijst. */}
      {supplier.verkoopBtwModus ? null : (
        <option value="" disabled>
          Volgens prijslijst
        </option>
      )}
      <option value="exclusive">Exclusief btw</option>
      <option value="inclusive">Inclusief btw</option>
    </Select>
  );
}

function productListTone(status: ProductListStatus) {
  if (status === "received") {
    return "success" as const;
  }

  if (status === "download_available") {
    return "info" as const;
  }

  if (status === "not_available") {
    return "danger" as const;
  }

  if (status === "requested" || status === "manual_only") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function SupplierTable({
  suppliers,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  supplierStatusFilter,
  setSupplierStatusFilter,
  onEdit,
  onNew,
  onArchive,
  onRestore,
  onChangeProductListStatus,
  onChangeVatMode,
  savingSupplierId,
  isLoading,
  error
}: SupplierTableProps) {
  const columns = useMemo<Array<DataTableColumn<PortalSupplier>>>(
    () => [
      {
        key: "name",
        header: "Leverancier",
        priority: "primary",
        render: (supplier) => (
          <div className="stack-sm">
            <strong>{supplier.naam}</strong>
            <StatusBadge
              status={supplier.status ?? "active"}
              label={formatStatusLabel(supplier.status ?? "active")}
            />
            {supplier.notities ? <small className="muted">{supplier.notities}</small> : null}
          </div>
        )
      },
      {
        key: "status",
        header: "Status prijslijst",
        render: (supplier) => (
          <StatusBadge
            status={supplier.prijslijstStatus}
            label={formatProductListStatus(supplier.prijslijstStatus)}
            variant={productListTone(supplier.prijslijstStatus)}
          />
        )
      },
      {
        key: "contact",
        header: "Contact",
        render: (supplier) => (
          <div className="stack-sm">
            <span>{supplier.contactpersoon ?? "-"}</span>
            <small className="muted">{supplier.email ?? supplier.telefoon ?? "Geen contactgegevens"}</small>
          </div>
        )
      },
      {
        key: "dates",
        header: "Opvolging",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>Laatst: {dateText(supplier.laatsteContactOp)}</span>
            <small className="muted">Verwacht: {dateText(supplier.verwachtOp)}</small>
          </div>
        )
      },
      {
        key: "links",
        header: "Gekoppelde gegevens",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>{supplier.activeProductCount ?? 0} producten</span>
            <small className="muted">
              {supplier.importProfileCount ?? 0} btw-controles ·{" "}
              {supplier.sourceFileCount ?? 0} prijslijstbestanden
            </small>
          </div>
        )
      },
      {
        key: "files",
        header: "Prijslijstbestanden",
        hideOnMobile: true,
        render: (supplier) => {
          const files = supplier.sourceFileNames ?? [];

          return files.length > 0 ? (
            <div className="supplier-file-list">
              {files.slice(0, 3).map((fileName) => (
                <small className="muted" key={fileName}>
                  {fileName}
                </small>
              ))}
              {files.length > 3 ? (
                <small className="muted">+{files.length - 3} extra bestanden</small>
              ) : null}
            </div>
          ) : (
            <span className="muted">Nog geen prijslijstbestand</span>
          );
        }
      },
      {
        key: "latest",
        header: "Laatste verwerking",
        hideOnMobile: true,
        render: (supplier) => (
          <div className="stack-sm">
            <span>
              {supplier.latestImportStatus
                ? formatImportStatus(supplier.latestImportStatus)
                : "Geen verwerking"}
            </span>
            <small className="muted">{dateText(supplier.latestImportAt)}</small>
          </div>
        )
      },
      {
        key: "action",
        header: "Prijslijst",
        render: (supplier) => (
          <Select
            aria-label={`Prijslijststatus bijwerken voor ${supplier.naam}`}
            disabled={savingSupplierId === supplier.id}
            value={supplier.prijslijstStatus}
            onChange={(event) =>
              void onChangeProductListStatus(supplier, event.target.value as ProductListStatus)
            }
          >
            {PRODUCT_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatProductListStatus(status)}
              </option>
            ))}
          </Select>
        )
      },
      {
        key: "vat",
        header: "Btw verkoopprijzen",
        render: (supplier) => vatModeSelect(supplier, savingSupplierId, onChangeVatMode)
      },
      {
        key: "actions",
        header: "Acties",
        width: "190px",
        render: (supplier) => (
          <div className="toolbar">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              onClick={() => onEdit(supplier)}
              size="sm"
              variant="secondary"
            >
              Bewerken
            </Button>
            {(supplier.status ?? "active") === "archived" ? (
              <Button
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => onRestore(supplier)}
                size="sm"
                variant="secondary"
              >
                Herstellen
              </Button>
            ) : (
              <Button
                leftIcon={<Archive size={16} aria-hidden="true" />}
                onClick={() => onArchive(supplier)}
                size="sm"
                variant="danger"
              >
                Archiveren
              </Button>
            )}
          </div>
        )
      }
    ],
    [savingSupplierId, onEdit, onChangeProductListStatus, onChangeVatMode, onArchive, onRestore]
  );

  return (
    <Card>
      <SectionHeader
        compact
        title="Leveranciersoverzicht"
        description="Zoek, filter en volg prijslijsten per leverancier."
        actions={
          <Button
            leftIcon={<Plus size={16} aria-hidden="true" />}
            onClick={onNew}
            size="sm"
            variant="primary"
            data-shortcut="new-supplier"
          >
            Nieuwe leverancier
          </Button>
        }
      />
      <FilterBar
        search={
          <SearchInput
            aria-label="Zoeken in leveranciers"
            placeholder="Zoek op leverancier, contactpersoon of notitie"
            value={search}
            onChange={setSearch}
          />
        }
        filters={
          <>
            <Field htmlFor="supplier-visibility-filter" label="Leverancierstatus">
              <Select
                id="supplier-visibility-filter"
                value={supplierStatusFilter}
                onChange={(event) =>
                  setSupplierStatusFilter(event.target.value as SupplierStatus | "all")
                }
              >
                <option value="all">Alle leverancierstatussen</option>
                {SUPPLIER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="supplier-status-filter" label="Filter op prijslijststatus">
              <Select
                id="supplier-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as ProductListStatus | "all")
                }
              >
                <option value="all">Alle prijslijststatussen</option>
                {PRODUCT_LIST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatProductListStatus(status)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
      />
      <div style={{ marginTop: 16 }}>
        <DataTable
          ariaLabel="Leveranciers"
          columns={columns}
          density="compact"
          emptyDescription={
            search || statusFilter !== "all"
              ? "Pas de zoekterm of statusfilter aan om meer leveranciers te tonen."
              : "Voeg een leverancier toe om productlijsten en opvolging te beheren."
          }
          emptyTitle={search || statusFilter !== "all" ? "Geen leveranciers gevonden" : "Nog geen leveranciers toegevoegd"}
          error={error}
          getRowKey={(supplier) => supplier.id}
          loading={isLoading}
          mobileMode="cards"
          renderMobileCard={(supplier) => (
            <div className="mobile-card-section">
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <strong>{supplier.naam}</strong>
                  <span className="muted">
                    {supplier.contactpersoon ?? supplier.email ?? "Geen contactgegevens"}
                  </span>
                </div>
                <StatusBadge
                  status={supplier.prijslijstStatus}
                  label={formatProductListStatus(supplier.prijslijstStatus)}
                  variant={productListTone(supplier.prijslijstStatus)}
                />
              </div>
              <div className="mobile-card-meta">
                <span>{supplier.activeProductCount ?? 0} producten</span>
                <span>{supplier.importProfileCount ?? 0} btw-controles</span>
                <span>{supplier.sourceFileCount ?? 0} prijslijstbestanden</span>
                <span>Verwacht: {dateText(supplier.verwachtOp)}</span>
              </div>
              {(supplier.sourceFileNames ?? []).length > 0 ? (
                <div className="mobile-card-section">
                  <p className="mobile-card-section-label">Prijslijstbestanden</p>
                  <div className="supplier-file-list">
                    {(supplier.sourceFileNames ?? []).slice(0, 3).map((fileName) => (
                      <small className="muted" key={fileName}>
                        {fileName}
                      </small>
                    ))}
                    {(supplier.sourceFileNames ?? []).length > 3 ? (
                      <small className="muted">
                        +{(supplier.sourceFileNames ?? []).length - 3} extra bestanden
                      </small>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {supplier.notities ? <p className="muted">{supplier.notities}</p> : null}
              <div className="mobile-card-actions">
                <Select
                  aria-label={`Prijslijststatus bijwerken voor ${supplier.naam}`}
                  disabled={savingSupplierId === supplier.id}
                  value={supplier.prijslijstStatus}
                  onChange={(event) =>
                    void onChangeProductListStatus(supplier, event.target.value as ProductListStatus)
                  }
                >
                  {PRODUCT_LIST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatProductListStatus(status)}
                    </option>
                  ))}
                </Select>
                {vatModeSelect(supplier, savingSupplierId, onChangeVatMode)}
                <Button
                  leftIcon={<Pencil size={16} aria-hidden="true" />}
                  onClick={() => onEdit(supplier)}
                  size="sm"
                  variant="secondary"
                >
                  Bewerken
                </Button>
                {(supplier.status ?? "active") === "archived" ? (
                  <Button
                    leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                    onClick={() => onRestore(supplier)}
                    size="sm"
                    variant="secondary"
                  >
                    Herstellen
                  </Button>
                ) : (
                  <Button
                    leftIcon={<Archive size={16} aria-hidden="true" />}
                    onClick={() => onArchive(supplier)}
                    size="sm"
                    variant="danger"
                  >
                    Archiveren
                  </Button>
                )}
              </div>
            </div>
          )}
          rows={suppliers}
        />
      </div>
    </Card>
  );
}
