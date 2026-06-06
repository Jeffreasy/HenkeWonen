import { CheckCircle2, Save, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import type { ProductImportBatch, ProductImportRow } from "../../lib/portalTypes";
import { formatImportStatus, formatRowKind, formatRowStatus } from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Pagination } from "../ui/Pagination";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import ImportWarnings from "./ImportWarnings";
import { type DetailTab, type RowKindFilter, type RowStatusFilter } from "./import/importTypes";
import { numberText, batchStatusVariant, lifecycleText, archiveActionFor } from "./import/importUtils";

type ImportDetailPanelProps = {
  selectedBatch: ProductImportBatch;
  rows: ProductImportRow[];
  detailTab: DetailTab;
  setDetailTab: (value: DetailTab) => void;
  allowUnknownVatMode: boolean;
  setAllowUnknownVatMode: (value: boolean) => void;
  canCommit: boolean;
  isBusy: boolean;
  selectedBlockers: string[];
  rowKindFilter: RowKindFilter;
  setRowKindFilter: (value: RowKindFilter) => void;
  rowStatusFilter: RowStatusFilter;
  setRowStatusFilter: (value: RowStatusFilter) => void;
  rowPage: number;
  setRowPage: (value: number | ((c: number) => number)) => void;
  totalRowPages: number;
  pagedRows: ProductImportRow[];
  rowPageSize: number;
  onSaveMapping: () => void;
  onCommitBatch: () => void;
  onUpdateBatchStatus: (nextStatus: ProductImportBatch["status"]) => void;
  canManageImports: boolean;
  rowKindOptions: string[];
  rowStatusOptions: string[];
};

export function ImportDetailPanel({
  selectedBatch,
  rows,
  detailTab,
  setDetailTab,
  allowUnknownVatMode,
  setAllowUnknownVatMode,
  canCommit,
  isBusy,
  selectedBlockers,
  rowKindFilter,
  setRowKindFilter,
  rowStatusFilter,
  setRowStatusFilter,
  rowPage,
  setRowPage,
  totalRowPages,
  pagedRows,
  rowPageSize,
  onSaveMapping,
  onCommitBatch,
  onUpdateBatchStatus,
  canManageImports,
  rowKindOptions,
  rowStatusOptions
}: ImportDetailPanelProps) {
  const rowColumns: Array<DataTableColumn<ProductImportRow>> = useMemo(
    () => [
      {
        key: "rowNumber",
        header: "Regel",
        width: "80px",
        render: (row) => row.rowNumber
      },
      {
        key: "kind",
        header: "Soort regel",
        width: "120px",
        render: (row) => formatRowKind(row.rowKind)
      },
      {
        key: "status",
        header: "Status",
        width: "130px",
        render: (row) => <StatusBadge status={row.status} label={formatRowStatus(row.status)} />
      },
      {
        key: "product",
        header: "Product of groep",
        render: (row) => {
          const normalized = row.normalized ?? {};
          const title =
            typeof normalized.productName === "string"
              ? normalized.productName
              : row.sectionLabel ?? "-";

          return (
            <>
              <strong>{title}</strong>
              <div className="muted">{row.sourceSheetName ?? ""}</div>
              {row.importedProductId ? (
                <div className="muted">verwerkt als product</div>
              ) : null}
            </>
          );
        }
      },
      {
        key: "warnings",
        header: "Meldingen",
        hideOnMobile: true,
        render: (row) => (
          <>
            {row.warnings.length > 0 ? <div className="muted">{row.warnings.join(", ")}</div> : null}
            {row.errors.length > 0 ? <div className="muted">{row.errors.join(", ")}</div> : null}
            {row.warnings.length === 0 && row.errors.length === 0 ? "-" : null}
          </>
        )
      }
    ],
    []
  );

  return (
    <section className="panel import-detail-panel">
      <div className="import-detail-header">
        <div>
          <p className="eyebrow">Geselecteerde controle</p>
          <h2>{selectedBatch.fileName}</h2>
          <p className="muted">
            {selectedBatch.supplierName}
            {selectedBatch.profileName ? ` · ${selectedBatch.profileName}` : ""} · {lifecycleText(selectedBatch)}
          </p>
        </div>
        <StatusBadge
          status={selectedBatch.status}
          label={formatImportStatus(selectedBatch.status)}
          variant={batchStatusVariant(selectedBatch)}
        />
      </div>

      {selectedBatch.errorMessage ? (
        <Alert
          variant="danger"
          title="Verwerken mislukt"
          description={selectedBatch.errorMessage}
        />
      ) : null}

      {canManageImports && selectedBatch.status !== "importing" ? (
        <div className="toolbar import-detail-actions">
          {(() => {
            const archiveAction = archiveActionFor(selectedBatch);

            return (
              <Button
                disabled={isBusy}
                leftIcon={archiveAction.icon}
                onClick={() => onUpdateBatchStatus(archiveAction.nextStatus)}
                variant={archiveAction.variant}
              >
                {archiveAction.label}
              </Button>
            );
          })()}
        </div>
      ) : null}

      <div className="tabs import-detail-tabs" role="tablist" aria-label="Tabs voor prijslijstcontrole">
        {[
          { value: "summary", label: "Samenvatting" },
          { value: "rows", label: `Regels ${numberText(rows.length)}` },
          { value: "warnings", label: `Meldingen ${numberText(selectedBatch.warningRows + selectedBatch.errorRows)}` },
          { value: "reconciliation", label: "Controle" }
        ].map((tab) => (
          <button
            className={detailTab === tab.value ? "tab active" : "tab"}
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={detailTab === tab.value}
            onClick={() => setDetailTab(tab.value as DetailTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {detailTab === "summary" ? (
        <>
          <div className="import-detail-summary">
            <div className="import-summary-item">
              <span>Productregels</span>
              <strong>{numberText(selectedBatch.productRows)}</strong>
            </div>
            <div className="import-summary-item import-summary-success">
              <span>Producten verwerkt</span>
              <strong>{numberText(selectedBatch.importedProducts + selectedBatch.updatedProducts)}</strong>
            </div>
            <div className="import-summary-item import-summary-info">
              <span>Prijsregels</span>
              <strong>{numberText(selectedBatch.importedPrices)}</strong>
            </div>
            <div className="import-summary-item import-summary-warning">
              <span>Rijmeldingen</span>
              <strong>{numberText(selectedBatch.warningRows)}</strong>
              <small>
                {selectedBatch.unknownVatModeRows > 0
                  ? `${numberText(selectedBatch.unknownVatModeRows)} btw onbekend`
                  : "Geen btw-meldingen"}
              </small>
            </div>
            <div className="import-summary-item import-summary-danger">
              <span>Fouten</span>
              <strong>{numberText(selectedBatch.errorRows)}</strong>
            </div>
            <div className="import-summary-item">
              <span>Overgeslagen</span>
              <strong>{numberText(selectedBatch.ignoredRows)}</strong>
            </div>
          </div>

          <div className={canCommit ? "import-gate import-gate-ready" : "import-gate import-gate-blocked"}>
            <div>
              <p className="eyebrow">Verwerkingspoort</p>
              <h3>{canCommit ? "Klaar voor definitieve verwerking" : "Nog niet definitief verwerken"}</h3>
              <p className="muted">
                {canCommit
                  ? "Er zijn geen blokkerende fouten voor deze controle."
                  : selectedBlockers.length > 0
                    ? selectedBlockers.join(", ")
                    : "Controleer de meldingen voordat je verwerkt."}
              </p>
            </div>
            <div className="import-gate-actions">
              <label className="vat-exception-toggle import-vat-toggle">
                <Checkbox
                  aria-label="Sta ontbrekende btw-keuze toe voor deze prijslijst"
                  checked={allowUnknownVatMode}
                  onChange={(event) => setAllowUnknownVatMode(event.target.checked)}
                />
                <span>Onbekende btw toestaan</span>
              </label>
              <Badge variant={selectedBatch.unknownVatModeRows > 0 ? "warning" : "success"}>
                Btw onbekend {numberText(selectedBatch.unknownVatModeRows)}
              </Badge>
              <Button
                variant="secondary"
                onClick={onSaveMapping}
                disabled={isBusy}
                leftIcon={<Save size={17} aria-hidden="true" />}
              >
                Btw-instelling bewaren
              </Button>
              <Button
                variant="primary"
                onClick={onCommitBatch}
                disabled={isBusy || !canCommit}
                leftIcon={
                  canCommit ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <ShieldAlert size={17} aria-hidden="true" />
                  )
                }
              >
                Definitief verwerken
              </Button>
            </div>
          </div>

          {!canCommit ? (
            <Alert
              variant="warning"
              title="Nog niet klaar om te verwerken"
              description={
                selectedBlockers.length > 0
                  ? `Los eerst op: ${selectedBlockers.join(", ")}.`
                  : "Verwerken blijft geblokkeerd zolang er fouten, dubbele prijslijstregels of ontbrekende btw-keuzes zijn."
              }
              style={{ marginTop: 16 }}
            />
          ) : null}
        </>
      ) : null}

      {detailTab === "rows" ? (
        <>
          <div className="release-block" style={{ marginTop: 16 }}>
            <FilterBar
              filters={
                <>
                  <Field label="Soort regel" htmlFor="import-row-kind-filter">
                    <Select
                      id="import-row-kind-filter"
                      value={rowKindFilter}
                      onChange={(event) => setRowKindFilter(event.target.value as RowKindFilter)}
                    >
                      <option value="all">Alle soorten</option>
                      {rowKindOptions.map((kind) => (
                        <option value={kind} key={kind}>
                          {formatRowKind(kind)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Status" htmlFor="import-row-status-filter">
                    <Select
                      id="import-row-status-filter"
                      value={rowStatusFilter}
                      onChange={(event) => setRowStatusFilter(event.target.value as RowStatusFilter)}
                    >
                      <option value="all">Alle statussen</option>
                      {rowStatusOptions.map((status) => (
                        <option value={status} key={status}>
                          {formatRowStatus(status)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              }
              actions={<span className="muted">{numberText(rows.length)} regels</span>}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <DataTable
              rows={pagedRows}
              columns={rowColumns}
              getRowKey={(row) => row.id}
              emptyTitle="Geen regels gevonden"
              emptyDescription="Deze prijslijst heeft geen regels voor de huidige filters."
              density="compact"
              mobileMode="cards"
              renderMobileCard={(row) => {
                const normalized = row.normalized ?? {};
                const title =
                  typeof normalized.productName === "string"
                    ? normalized.productName
                    : row.sectionLabel ?? "-";
                const messages = [...row.errors, ...row.warnings];

                return (
                  <div className="mobile-card-section">
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        <strong>{title}</strong>
                        <small className="muted">
                          Regel {row.rowNumber} · {formatRowKind(row.rowKind)}
                        </small>
                      </div>
                      <StatusBadge status={row.status} label={formatRowStatus(row.status)} />
                    </div>
                    <div className="mobile-card-meta">
                      {row.sourceSheetName ? <span>{row.sourceSheetName}</span> : null}
                      {row.importedProductId ? <span>verwerkt als product</span> : null}
                    </div>
                    {messages.length > 0 ? (
                      <div className="mobile-card-section">
                        <p className="mobile-card-section-label">Meldingen</p>
                        <span className="muted">{messages.join(", ")}</span>
                      </div>
                    ) : null}
                  </div>
                );
              }}
              ariaLabel="Prijslijstregels"
            />
          </div>

          {rows.length > rowPageSize ? (
            <div style={{ marginTop: 12 }}>
              <Pagination
                currentPage={rowPage}
                totalPages={totalRowPages}
                hasPreviousPage={rowPage > 1}
                hasNextPage={rowPage < totalRowPages}
                onPrevious={() => setRowPage((current) => Math.max(1, current - 1))}
                onNext={() => setRowPage((current) => Math.min(totalRowPages, current + 1))}
                label="Paginatie prijslijstregels"
              />
            </div>
          ) : null}
        </>
      ) : null}

      {detailTab === "warnings" ? (
        <div style={{ marginTop: 16 }}>
          {selectedBatch.warningRows > 0 || selectedBatch.errorRows > 0 ? (
            <Alert
              variant={selectedBatch.errorRows > 0 ? "danger" : "warning"}
              title="Rijmeldingen in deze prijslijst"
              description={
                selectedBatch.unknownVatModeRows > 0
                  ? `${numberText(selectedBatch.warningRows)} productregels hebben een melding. In deze import komt dat vooral door btw-modus onbekend; de prijslijst kan verwerkt zijn wanneer onbekende btw bewust is toegestaan.`
                  : `${numberText(selectedBatch.warningRows)} productregels hebben een importmelding. Open de tab Regels en filter op status Waarschuwing voor de exacte regels.`
              }
            />
          ) : null}
          {selectedBatch.warnings.length > 0 ? <ImportWarnings warnings={selectedBatch.warnings} /> : null}
          {selectedBatch.warningRows === 0 && selectedBatch.errorRows === 0 ? (
            <Alert
              variant="success"
              title="Geen waarschuwingen of fouten"
              description="Deze prijslijst heeft geen waarschuwingen of fouten in de huidige tellingen."
              style={{ marginTop: 16 }}
            />
          ) : null}
        </div>
      ) : null}

      {detailTab === "reconciliation" ? (
        <div style={{ marginTop: 16 }}>
          <SummaryList
            items={[
              {
                label: "Dubbele productmatches",
                value: numberText(selectedBatch.duplicateProductMatches)
              },
              {
                label: "Dubbele prijslijstregels",
                value: numberText(selectedBatch.duplicateSourceKeys),
                description:
                  selectedBatch.duplicateSourceKeys > 0
                    ? "Blokkeert definitief verwerken."
                    : "Geen dubbele prijslijstregels."
              },
              {
                label: "Regels met nulprijs",
                value: numberText(selectedBatch.zeroPriceRows)
              },
              {
                label: "Producten zonder leverancierscode",
                value: numberText(selectedBatch.productsWithoutSupplierCode)
              },
              {
                label: "Prijsregels zonder product",
                value: numberText(selectedBatch.orphanPriceRules)
              },
              {
                label: "Overgeslagen prijsregels",
                value: numberText(selectedBatch.skippedPrices)
              }
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}
