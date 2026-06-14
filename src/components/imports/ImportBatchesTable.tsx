import { Filter } from "lucide-react";
import { useMemo } from "react";
import type { ProductImportBatch } from "../../lib/portalTypes";
import { formatImportStatus } from "../../lib/i18n/statusLabels";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { StatusBadge } from "../ui/StatusBadge";
import { type BatchStatusFilter } from "./import/importTypes";
import { numberText, batchStatusVariant, lifecycleText, archiveActionFor } from "./import/importUtils";

const batchStatusFilters: Array<{ value: BatchStatusFilter; label: string }> = [
  { value: "failed", label: "Aandacht nodig" },
  { value: "ready_to_import", label: "Klaar voor verwerking" },
  { value: "needs_mapping", label: "Btw-keuze nodig" },
  { value: "imported", label: "Verwerkt" },
  { value: "archived", label: "Gearchiveerd" },
  { value: "all", label: "Alle" }
];

type ImportBatchesTableProps = {
  filteredBatches: ProductImportBatch[];
  isLoading: boolean;
  error: string | null;
  batchSearchQuery: string;
  setBatchSearchQuery: (value: string) => void;
  batchStatusFilter: BatchStatusFilter;
  setBatchStatusFilter: (value: BatchStatusFilter) => void;
  batchCounts: Record<BatchStatusFilter, number>;
  canManageImports: boolean;
  setSelectedBatchId: (id: string) => void;
  setPendingBatchStatus: (value: { batch: ProductImportBatch; nextStatus: ProductImportBatch["status"] } | null) => void;
};


export function ImportBatchesTable({
  filteredBatches,
  isLoading,
  error,
  batchSearchQuery,
  setBatchSearchQuery,
  batchStatusFilter,
  setBatchStatusFilter,
  batchCounts,
  canManageImports,
  setSelectedBatchId,
  setPendingBatchStatus
}: ImportBatchesTableProps) {
  const batchColumns: Array<DataTableColumn<ProductImportBatch>> = useMemo(
    () => [
      {
        key: "source",
        header: "Bestand",
        priority: "primary",
        render: (batch) => (
          <div className="import-file-cell">
            <a
              className="button ghost"
              href={`/portal/imports/${batch.id}`}
              onClick={(e) => {
                e.preventDefault();
                setSelectedBatchId(batch.id);
              }}
            >
              {batch.bestandsnaam}
            </a>
            <small className="muted">{batch.leverancierNaam}</small>
            {batch.profileName ? <small className="muted">{batch.profileName}</small> : null}
          </div>
        )
      },
      {
        key: "status",
        header: "Status",
        width: "180px",
        render: (batch) => (
          <div className="stack-sm">
            <StatusBadge
              status={batch.status}
              label={formatImportStatus(batch.status)}
              variant={batchStatusVariant(batch)}
            />
            <small className="muted">{lifecycleText(batch)}</small>
          </div>
        )
      },
      {
        key: "counts",
        header: "Tellingen",
        width: "170px",
        render: (batch) => (
          <div className="import-count-stack">
            <span>{numberText(batch.voorbeeldRijen)} gecontroleerde regels</span>
            <span>{numberText(batch.productRijen)} productregels</span>
            <span>{numberText(batch.geimporteerdePrijzen)} prijsregels</span>
          </div>
        )
      },
      {
        key: "signals",
        header: "Controle",
        width: "190px",
        render: (batch) => (
          <div className="import-signal-stack">
            <Badge variant={batch.foutRijen > 0 || batch.status === "failed" ? "danger" : "success"}>
              Fouten {numberText(batch.foutRijen)}
            </Badge>
            <Badge variant={batch.waarschuwingRijen > 0 ? "warning" : "neutral"}>
              Rijmeldingen {numberText(batch.waarschuwingRijen)}
            </Badge>
            <Badge variant={batch.dubbeleBronSleutels > 0 ? "danger" : "success"}>
              Dubbele regels {numberText(batch.dubbeleBronSleutels)}
            </Badge>
            <Badge variant={batch.onbekendeBtwModusRijen > 0 ? "warning" : "success"}>
              Btw onbekend {numberText(batch.onbekendeBtwModusRijen)}
            </Badge>
            {batch.foutmelding ? <small className="muted">{batch.foutmelding}</small> : null}
          </div>
        )
      },
      {
        key: "actions",
        header: "Actie",
        width: "210px",
        render: (batch) => {
          const archiveAction = archiveActionFor(batch);

          return (
            <div className="toolbar import-row-actions">
              <a
                className="button secondary"
                href={`/portal/imports/${batch.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedBatchId(batch.id);
                }}
              >
                Bekijken
              </a>
              {canManageImports && batch.status !== "importing" ? (
                <Button
                  leftIcon={archiveAction.icon}
                  onClick={() =>
                    setPendingBatchStatus({ batch, nextStatus: archiveAction.nextStatus })
                  }
                  size="sm"
                  variant={archiveAction.variant}
                >
                  {archiveAction.label}
                </Button>
              ) : null}
            </div>
          );
        }
      }
    ],
    [canManageImports, setSelectedBatchId, setPendingBatchStatus]
  );

  return (
    <section className="panel import-list-panel">
      <div className="import-list-filters">
        <FilterBar
          search={
            <SearchInput
              aria-label="Zoek prijslijsten"
              value={batchSearchQuery}
              placeholder="Zoek bestand, leverancier, profiel of melding"
              onChange={setBatchSearchQuery}
            />
          }
          filters={
            <div className="import-filter-group">
              <span className="import-filter-label">
                <Filter size={14} aria-hidden="true" />
                Weergave
              </span>
              <div className="tabs import-tabs">
                {batchStatusFilters.map((item) => (
                  <button
                    className={batchStatusFilter === item.value ? "tab active" : "tab"}
                    key={item.value}
                    type="button"
                    aria-pressed={batchStatusFilter === item.value}
                    onClick={() => setBatchStatusFilter(item.value)}
                  >
                    <span>{item.label}</span>
                    <span className="vat-tab-count">{numberText(batchCounts[item.value] ?? 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          }
          actions={<span className="muted">{numberText(filteredBatches.length)} prijslijsten</span>}
        />
      </div>

      <DataTable
        rows={filteredBatches}
        columns={batchColumns}
        getRowKey={(batch) => batch.id}
        loading={isLoading}
        error={error}
        emptyTitle="Geen prijslijsten gevonden"
        emptyDescription="Pas filters aan of start een nieuwe controle."
        density="compact"
        mobileMode="cards"
        renderMobileCard={(batch) => {
          const archiveAction = archiveActionFor(batch);
          return (
            <>
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <a
                    href={`/portal/imports/${batch.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedBatchId(batch.id);
                    }}
                  >
                    <strong>{batch.bestandsnaam}</strong>
                  </a>
                  <span className="muted">{batch.leverancierNaam}</span>
                  {batch.profileName ? <span className="muted">{batch.profileName}</span> : null}
                </div>
                <StatusBadge
                  status={batch.status}
                  label={formatImportStatus(batch.status)}
                  variant={batchStatusVariant(batch)}
                />
              </div>
              <div className="mobile-card-meta">
                <Badge variant="neutral">Regels {numberText(batch.voorbeeldRijen)}</Badge>
                <Badge variant="neutral">Producten {numberText(batch.productRijen)}</Badge>
                <Badge variant="neutral">Prijsregels {numberText(batch.geimporteerdePrijzen)}</Badge>
                <Badge variant={batch.dubbeleBronSleutels > 0 ? "danger" : "success"}>
                  Dubbele regels {numberText(batch.dubbeleBronSleutels)}
                </Badge>
                <Badge variant={batch.onbekendeBtwModusRijen > 0 ? "warning" : "success"}>
                  Btw onbekend {numberText(batch.onbekendeBtwModusRijen)}
                </Badge>
              </div>
              <div className="mobile-card-section">
                <p className="mobile-card-section-label">Statusmoment</p>
                <span className="muted">{lifecycleText(batch)}</span>
                {batch.foutmelding ? <span className="muted">{batch.foutmelding}</span> : null}
              </div>
              <div className="mobile-card-actions">
                <a
                  className="button secondary"
                  href={`/portal/imports/${batch.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedBatchId(batch.id);
                  }}
                >
                  Bekijk details
                </a>
                {canManageImports && batch.status !== "importing" ? (
                  <Button
                    leftIcon={archiveAction.icon}
                    onClick={() => setPendingBatchStatus({ batch, nextStatus: archiveAction.nextStatus })}
                    size="sm"
                    variant={archiveAction.variant}
                  >
                    {archiveAction.label}
                  </Button>
                ) : null}
              </div>
            </>
          );
        }}
        ariaLabel="Prijslijsten"
      />
    </section>
  );
}
