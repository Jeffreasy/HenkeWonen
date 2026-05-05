import { Archive, CheckCircle2, FileSpreadsheet, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatImportStatus,
  formatRowKind,
  formatRowStatus
} from "../../lib/i18n/statusLabels";
import type { ProductImportBatch, ProductImportRow } from "../../lib/portalTypes";
import type { SubmitEventLike } from "../../lib/events";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import ImportWarnings from "./ImportWarnings";

type ImportPreviewProps = {
  session: AppSession;
  batchId?: string;
};

type BatchDetail = {
  batch: ProductImportBatch;
  rows: ProductImportRow[];
};

type BatchStatusFilter = "all" | ProductImportBatch["status"];
type DetailTab = "summary" | "rows" | "warnings" | "reconciliation";
type RowKindFilter = "all" | ProductImportRow["rowKind"];
type RowStatusFilter = "all" | ProductImportRow["status"];

const sourceFiles = [
  "Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx",
  "henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls",
  "Prijslijst PVC 11-2025 click dryback apart.xlsx",
  "PVC 11-2025 click dryback apart floorlife.xlsx",
  "Prijslijst EVC 2025 click en dryback apart.xlsx",
  "Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx",
  "Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx",
  "Co-pro Entreematten 2025.xlsx",
  "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx",
  "Co-pro prijslijst Plinten 2025-07.xlsx",
  "Prijslijst Ambiant Tapijt 2025-04.xlsx",
  "Prijslijst Ambiant Vinyl 07-2024.xlsx",
  "Prijslijst Traprenovatie Floorlife 2025.xlsx",
  "Prijslijst Douchepanelen en tegels 2025-04.xlsx",
  "Prijslijst Wandpanelen 2025-05.xlsx",
  "PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx",
  "Prijslijst VT Wonen Karpetten 2024.xlsx"
];

function fileTypeFor(fileName: string) {
  return fileName.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
}

function numberText(value: number) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function dateText(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function ImportPreview({ session, batchId }: ImportPreviewProps) {
  const [batches, setBatches] = useState<ProductImportBatch[]>([]);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [fileName, setFileName] = useState(sourceFiles[0]);
  const [supplierName, setSupplierName] = useState("Headlam");
  const [selectedBatchId, setSelectedBatchId] = useState(batchId ?? "");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState<BatchStatusFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [rowKindFilter, setRowKindFilter] = useState<RowKindFilter>("all");
  const [rowStatusFilter, setRowStatusFilter] = useState<RowStatusFilter>("all");
  const [rowPage, setRowPage] = useState(1);
  const [allowUnknownVatMode, setAllowUnknownVatMode] = useState(false);
  const [pendingCommitBatch, setPendingCommitBatch] = useState<ProductImportBatch | null>(null);
  const [pendingBatchStatus, setPendingBatchStatus] = useState<{
    batch: ProductImportBatch;
    nextStatus: ProductImportBatch["status"];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageImports = canManage(session.role);

  const loadBatches = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.imports.listBatchesForPortal, {
        tenantSlug: session.tenantId
      })) as ProductImportBatch[];

      setBatches(result);
      setSelectedBatchId((current) => (batchId ?? current) || result[0]?.id || "");
    } catch (loadError) {
      console.error(loadError);
      setError("Prijslijsten konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [batchId, session.tenantId]);

  const loadDetail = useCallback(async () => {
    if (!selectedBatchId) {
      setDetail(null);
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      const result = (await client.query(api.imports.getBatchForPortal, {
        tenantSlug: session.tenantId,
        batchId: selectedBatchId,
        rowLimit: 300
      })) as BatchDetail | null;

      setDetail(result);
      setAllowUnknownVatMode(result?.batch.allowUnknownVatMode ?? false);
    } catch (loadError) {
      console.error(loadError);
      setError("De controle van deze prijslijst kon niet worden geladen.");
    }
  }, [selectedBatchId, session.tenantId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setRowPage(1);
  }, [selectedBatchId]);

  useEffect(() => {
    setRowPage(1);
  }, [rowKindFilter, rowStatusFilter]);

  async function createBatch(event: SubmitEventLike) {
    event.preventDefault();

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const newBatchId = await client.mutation(api.catalogImport.createPreviewBatch, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        fileName,
        fileType: fileTypeFor(fileName),
        sourceFileName: fileName,
        supplierName,
        allowUnknownVatMode: false,
        createdByExternalUserId: session.userId
      });

      setSelectedBatchId(String(newBatchId));
      await loadBatches();
    } catch (createError) {
      console.error(createError);
      setError("De prijslijstcontrole kon niet worden gestart.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveMapping(batch: ProductImportBatch) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await client.mutation(api.catalogImport.savePreviewMapping, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        batchId: batch.id,
        allowUnknownVatMode,
        mapping: {
          mode: "portal-preview",
          requiresExplicitVatMapping: true,
          allowUnknownVatMode
        }
      });
      await loadBatches();
      await loadDetail();
    } catch (mappingError) {
      console.error(mappingError);
      setError("De btw-keuze kon niet worden opgeslagen.");
    } finally {
      setIsBusy(false);
    }
  }

  async function commitBatch(batch: ProductImportBatch) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      for (let index = 0; index < 500; index += 1) {
        const result = await client.mutation(api.catalogImport.commitPreviewBatchChunk, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          batchId: batch.id,
          allowUnknownVatMode,
          importedByExternalUserId: session.userId,
          limit: 75
        });

        if (result.done) {
          break;
        }
      }

      await loadBatches();
      await loadDetail();
    } catch (commitError) {
      console.error(commitError);
      setError(
        commitError instanceof Error
          ? commitError.message
          : "De prijslijst kon niet definitief worden verwerkt."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function updateBatchStatus() {
    if (!pendingBatchStatus || !canManageImports) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await client.mutation(api.imports.updateBatchStatusForPortal, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        batchId: pendingBatchStatus.batch.id,
        status: pendingBatchStatus.nextStatus
      });
      setPendingBatchStatus(null);
      await loadBatches();
      await loadDetail();
    } catch (statusError) {
      console.error(statusError);
      setError("De prijslijststatus kon niet worden bijgewerkt.");
    } finally {
      setIsBusy(false);
    }
  }

  function archiveActionFor(batch: ProductImportBatch) {
    return batch.status === "archived"
      ? {
          label: "Herstellen",
          nextStatus: batch.archivedFromStatus ?? ("uploaded" as ProductImportBatch["status"]),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          variant: "secondary" as const
        }
      : {
          label: "Archiveren",
          nextStatus: "archived" as ProductImportBatch["status"],
          icon: <Archive size={16} aria-hidden="true" />,
          variant: "danger" as const
        };
  }

  const selectedBatch =
    detail?.batch ?? batches.find((batch) => batch.id === selectedBatchId) ?? null;
  const rows = detail?.rows ?? [];
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesKind = rowKindFilter === "all" || row.rowKind === rowKindFilter;
        const matchesStatus = rowStatusFilter === "all" || row.status === rowStatusFilter;

        return matchesKind && matchesStatus;
      }),
    [rowKindFilter, rowStatusFilter, rows]
  );
  const rowPageSize = 50;
  const totalRowPages = Math.max(1, Math.ceil(filteredRows.length / rowPageSize));
  const safeRowPage = Math.min(rowPage, totalRowPages);
  const pagedRows = filteredRows.slice((safeRowPage - 1) * rowPageSize, safeRowPage * rowPageSize);
  const filteredBatches = useMemo(() => {
    const normalizedQuery = batchSearchQuery.trim().toLowerCase();

    return batches.filter((batch) => {
      const matchesStatus = batchStatusFilter === "all" || batch.status === batchStatusFilter;
      const haystack = [
        batch.fileName,
        batch.supplierName,
        batch.profileName,
        batch.status,
        batch.errorMessage
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });
  }, [batchSearchQuery, batchStatusFilter, batches]);
  const canCommit = selectedBatch
    ? selectedBatch.totalRows > 0 &&
      selectedBatch.errorRows === 0 &&
      selectedBatch.duplicateSourceKeys === 0 &&
      (selectedBatch.unknownVatModeRows === 0 || allowUnknownVatMode)
    : false;

  const rowKindOptions = useMemo(
    () => [...new Set(rows.map((row) => row.rowKind))].sort(),
    [rows]
  );
  const rowStatusOptions = useMemo(
    () => [...new Set(rows.map((row) => row.status))].sort(),
    [rows]
  );

  const batchColumns: Array<DataTableColumn<ProductImportBatch>> = [
    {
      key: "source",
      header: "Bestand",
      render: (batch) => (
        <>
          <a
            className="button ghost"
            href={`/portal/imports/${batch.id}`}
            onClick={() => setSelectedBatchId(batch.id)}
          >
            {batch.fileName}
          </a>
          <div className="muted">{batch.supplierName}</div>
          {batch.profileName ? <div className="muted">{batch.profileName}</div> : null}
        </>
      )
    },
    {
      key: "status",
      header: "Status",
      width: "170px",
      render: (batch) => (
        <>
          <StatusBadge status={batch.status} label={formatImportStatus(batch.status)} />
          <div className="muted">
            {batch.failedAt
              ? `mislukt ${dateText(batch.failedAt)}`
              : batch.committedAt
                ? `verwerkt ${dateText(batch.committedAt)}`
                : `aangemaakt ${dateText(batch.createdAt)}`}
          </div>
        </>
      )
    },
    {
      key: "previewRows",
      header: "Gecontroleerde regels",
      align: "right",
      width: "110px",
      render: (batch) => numberText(batch.previewRows)
    },
    {
      key: "productRows",
      header: "Producten",
      align: "right",
      width: "120px",
      render: (batch) => numberText(batch.productRows)
    },
    {
      key: "importedPrices",
      header: "Prijsregels",
      align: "right",
      width: "110px",
      render: (batch) => numberText(batch.importedPrices)
    },
    {
      key: "unknownVatModeRows",
      header: "Btw nog onbekend",
      align: "right",
      width: "130px",
      render: (batch) => (
        <Badge variant={batch.unknownVatModeRows > 0 ? "warning" : "success"}>
          {numberText(batch.unknownVatModeRows)}
        </Badge>
      )
    },
    {
      key: "issues",
      header: "Meldingen",
      width: "130px",
      render: (batch) => (
        <>
          <Badge variant={batch.errorRows > 0 ? "danger" : "success"}>
            fouten: {numberText(batch.errorRows)}
          </Badge>
          <div style={{ marginTop: 4 }}>
            <Badge variant={batch.warningRows > 0 ? "warning" : "neutral"}>
              waarschuwingen: {numberText(batch.warningRows)}
            </Badge>
          </div>
          {batch.errorMessage ? <div className="muted">{batch.errorMessage}</div> : null}
        </>
      )
    },
    {
      key: "actions",
      header: "Actie",
      width: "210px",
      render: (batch) => {
        const archiveAction = archiveActionFor(batch);

        return (
          <div className="toolbar">
            <a className="button secondary" href={`/portal/imports/${batch.id}`}>
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
  ];

  const rowColumns: Array<DataTableColumn<ProductImportRow>> = [
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
  ];

  return (
    <>
      <ConfirmDialog
        open={Boolean(pendingCommitBatch)}
        title="Prijslijst definitief verwerken?"
        description={
          pendingCommitBatch
            ? `Je verwerkt "${pendingCommitBatch.fileName}" naar producten en verkoopprijzen. Controleer de meldingen voordat je doorgaat; fouten, dubbele prijslijstregels en ontbrekende btw-keuzes blokkeren dit.`
            : ""
        }
        confirmLabel="Definitief verwerken"
        tone="danger"
        isBusy={isBusy}
        onCancel={() => setPendingCommitBatch(null)}
        onConfirm={() => {
          const batch = pendingCommitBatch;
          setPendingCommitBatch(null);
          if (batch) {
            void commitBatch(batch);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingBatchStatus)}
        title={
          pendingBatchStatus?.nextStatus === "archived"
            ? "Prijslijst archiveren?"
            : "Prijslijst herstellen?"
        }
        description={
          pendingBatchStatus
            ? pendingBatchStatus.nextStatus === "archived"
              ? `Je archiveert "${pendingBatchStatus.batch.fileName}". De controle blijft bewaard, maar verdwijnt uit het dagelijkse overzicht.`
              : `Je herstelt "${pendingBatchStatus.batch.fileName}" naar ${formatImportStatus(
                  pendingBatchStatus.nextStatus
                ).toLowerCase()}.`
            : ""
        }
        confirmLabel={pendingBatchStatus?.nextStatus === "archived" ? "Archiveren" : "Herstellen"}
        tone={pendingBatchStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={isBusy}
        onCancel={() => setPendingBatchStatus(null)}
        onConfirm={() => void updateBatchStatus()}
      />
      <div className="grid two-column">
      <section className="grid">
        <form className="panel form-grid" onSubmit={createBatch}>
          <p className="eyebrow">Nieuwe prijslijstcontrole</p>
          <Field label="Bestand" htmlFor="import-file">
            <Select id="import-file" value={fileName} onChange={(event) => setFileName(event.target.value)}>
              {sourceFiles.map((file) => (
                <option value={file} key={file}>
                  {file}
                </option>
              ))}
            </Select>
          </Field>
          <div className="field">
            <label htmlFor="import-supplier">Leverancier</label>
            <input
              id="import-supplier"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
            />
          </div>
          <Button
            variant="primary"
            type="submit"
            disabled={isBusy}
            leftIcon={<FileSpreadsheet size={17} aria-hidden="true" />}
          >
            Controle starten
          </Button>
        </form>

        <section className="panel">
          <FilterBar
            search={
              <SearchInput
                aria-label="Zoek prijslijsten"
                value={batchSearchQuery}
                placeholder="Zoek op bestand, leverancier of controle"
                onChange={setBatchSearchQuery}
              />
            }
            filters={
              <Field label="Status" htmlFor="batch-status-filter">
                <Select
                  id="batch-status-filter"
                  value={batchStatusFilter}
                  onChange={(event) => setBatchStatusFilter(event.target.value as BatchStatusFilter)}
                >
                  <option value="all">Alle statussen</option>
                  <option value="uploaded">{formatImportStatus("uploaded")}</option>
                  <option value="analyzing">{formatImportStatus("analyzing")}</option>
                  <option value="needs_mapping">{formatImportStatus("needs_mapping")}</option>
                  <option value="ready_to_import">{formatImportStatus("ready_to_import")}</option>
                  <option value="importing">{formatImportStatus("importing")}</option>
                  <option value="imported">{formatImportStatus("imported")}</option>
                  <option value="failed">{formatImportStatus("failed")}</option>
                  <option value="archived">{formatImportStatus("archived")}</option>
                </Select>
              </Field>
            }
            actions={<span className="muted">{numberText(filteredBatches.length)} prijslijsten</span>}
          />
        </section>

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
          renderMobileCard={(batch) => (
            <>
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <a href={`/portal/imports/${batch.id}`} onClick={() => setSelectedBatchId(batch.id)}>
                    <strong>{batch.fileName}</strong>
                  </a>
                  <span className="muted">{batch.supplierName}</span>
                  {batch.profileName ? <span className="muted">{batch.profileName}</span> : null}
                </div>
                <StatusBadge status={batch.status} label={formatImportStatus(batch.status)} />
              </div>
              <div className="mobile-card-meta">
                <Badge variant="neutral">Gecontroleerde regels {numberText(batch.previewRows)}</Badge>
                <Badge variant="neutral">Productregels {numberText(batch.productRows)}</Badge>
                <Badge variant="neutral">Prijsregels {numberText(batch.importedPrices)}</Badge>
                <Badge variant={batch.unknownVatModeRows > 0 ? "warning" : "success"}>
                  Btw nog onbekend {numberText(batch.unknownVatModeRows)}
                </Badge>
              </div>
              <div className="mobile-card-section">
                <p className="mobile-card-section-label">Datum</p>
                <span className="muted">
                  {batch.failedAt
                    ? `mislukt ${dateText(batch.failedAt)}`
                    : batch.committedAt
                      ? `verwerkt ${dateText(batch.committedAt)}`
                      : `aangemaakt ${dateText(batch.createdAt)}`}
                </span>
                {batch.errorMessage ? <span className="muted">{batch.errorMessage}</span> : null}
              </div>
              <div className="mobile-card-actions">
                <a className="button secondary" href={`/portal/imports/${batch.id}`}>
                  Bekijk details
                </a>
                {canManageImports && batch.status !== "importing" ? (
                  <Button
                    leftIcon={archiveActionFor(batch).icon}
                    onClick={() => {
                      const archiveAction = archiveActionFor(batch);
                      setPendingBatchStatus({ batch, nextStatus: archiveAction.nextStatus });
                    }}
                    size="sm"
                    variant={archiveActionFor(batch).variant}
                  >
                    {archiveActionFor(batch).label}
                  </Button>
                ) : null}
              </div>
            </>
          )}
          ariaLabel="Prijslijsten"
        />
      </section>

      <section className="panel">
        {selectedBatch ? (
          <>
            <p className="eyebrow">Controle en meldingen</p>
            <h2>{selectedBatch.fileName}</h2>
            <p className="muted">
              Aangemaakt {dateText(selectedBatch.createdAt)} · verwerkt{" "}
              {dateText(selectedBatch.committedAt)} · mislukt {dateText(selectedBatch.failedAt)}
            </p>
            {selectedBatch.errorMessage ? (
              <Alert
                variant="danger"
                title="Verwerken mislukt"
                description={selectedBatch.errorMessage}
              />
            ) : null}
            {canManageImports && selectedBatch.status !== "importing" ? (
              <div className="toolbar" style={{ margin: "12px 0 0" }}>
                {(() => {
                  const archiveAction = archiveActionFor(selectedBatch);

                  return (
                    <Button
                      disabled={isBusy}
                      leftIcon={archiveAction.icon}
                      onClick={() =>
                        setPendingBatchStatus({
                          batch: selectedBatch,
                          nextStatus: archiveAction.nextStatus
                        })
                      }
                      variant={archiveAction.variant}
                    >
                      {archiveAction.label}
                    </Button>
                  );
                })()}
              </div>
            ) : null}

            <div className="tabs" role="tablist" aria-label="Tabs voor prijslijstcontrole">
              {[
                { value: "summary", label: "Samenvatting" },
                { value: "rows", label: "Regels" },
                { value: "warnings", label: "Meldingen" },
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
                <div className="grid three-column" style={{ marginTop: 16 }}>
                  <StatCard label="Productregels" value={numberText(selectedBatch.productRows)} />
                  <StatCard
                    label="Producten verwerkt"
                    value={numberText(selectedBatch.importedProducts + selectedBatch.updatedProducts)}
                  />
                  <StatCard label="Prijsregels verwerkt" value={numberText(selectedBatch.importedPrices)} />
                </div>
                <div className="grid three-column" style={{ marginTop: 16 }}>
                  <StatCard
                    label="Regels met waarschuwing"
                    value={numberText(selectedBatch.warningRows)}
                    tone={selectedBatch.warningRows > 0 ? "warning" : "neutral"}
                  />
                  <StatCard
                    label="Regels met fouten"
                    value={numberText(selectedBatch.errorRows)}
                    tone={selectedBatch.errorRows > 0 ? "danger" : "success"}
                  />
                  <StatCard label="Overgeslagen regels" value={numberText(selectedBatch.ignoredRows)} />
                </div>
                <div className="toolbar" style={{ marginTop: 16 }}>
                  <div className="toolbar" style={{ gap: 8 }}>
                    <Checkbox
                      aria-label="Sta ontbrekende btw-keuze toe voor deze prijslijst"
                      checked={allowUnknownVatMode}
                      onChange={(event) => setAllowUnknownVatMode(event.target.checked)}
                    />
                    <Badge variant={selectedBatch.unknownVatModeRows > 0 ? "warning" : "success"}>
                      Btw nog onbekend: {numberText(selectedBatch.unknownVatModeRows)}
                    </Badge>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => void saveMapping(selectedBatch)}
                    disabled={isBusy}
                    leftIcon={<Save size={17} aria-hidden="true" />}
                  >
                    Btw-keuze opslaan
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setPendingCommitBatch(selectedBatch)}
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
                {!canCommit ? (
                  <Alert
                    variant="warning"
                    title="Nog niet klaar om te verwerken"
                    description="Verwerken blijft geblokkeerd zolang er fouten, dubbele prijslijstregels of ontbrekende btw-keuzes zijn."
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
                    actions={<span className="muted">{numberText(filteredRows.length)} regels</span>}
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
                    ariaLabel="Prijslijstregels"
                  />
                </div>
                {filteredRows.length > rowPageSize ? (
                  <div style={{ marginTop: 12 }}>
                    <Pagination
                      currentPage={safeRowPage}
                      totalPages={totalRowPages}
                      hasPreviousPage={safeRowPage > 1}
                      hasNextPage={safeRowPage < totalRowPages}
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
                <ImportWarnings warnings={selectedBatch.warnings} />
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
          </>
        ) : (
          <div className="empty-state">Selecteer een prijslijst om de controle te bekijken.</div>
        )}
      </section>
      </div>
    </>
  );
}
