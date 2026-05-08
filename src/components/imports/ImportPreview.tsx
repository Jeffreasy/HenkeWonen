import {
  Archive,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Save,
  ShieldAlert
} from "lucide-react";
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
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";
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

const batchStatusFilters: Array<{ value: BatchStatusFilter; label: string }> = [
  { value: "failed", label: "Aandacht nodig" },
  { value: "ready_to_import", label: "Klaar voor verwerking" },
  { value: "needs_mapping", label: "Btw-keuze nodig" },
  { value: "imported", label: "Verwerkt" },
  { value: "archived", label: "Gearchiveerd" },
  { value: "all", label: "Alle" }
];

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

function normalizedText(value?: string) {
  return (value ?? "").toLocaleLowerCase("nl-NL");
}

function batchMatchesSearch(batch: ProductImportBatch, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  return [
    batch.fileName,
    batch.supplierName,
    batch.profileName,
    batch.status,
    formatImportStatus(batch.status),
    batch.errorMessage
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function batchStatusVariant(batch: ProductImportBatch): BadgeVariant {
  if (batch.status === "failed") {
    return "danger";
  }

  if (batch.status === "needs_mapping") {
    return "warning";
  }

  if (batch.status === "ready_to_import" || batch.status === "imported") {
    return "success";
  }

  if (batch.unknownVatModeRows > 0) {
    return "warning";
  }

  if (batch.status === "importing" || batch.status === "analyzing") {
    return "info";
  }

  return "neutral";
}

function lifecycleText(batch: ProductImportBatch) {
  if (batch.status === "archived") {
    return batch.archivedAt ? `gearchiveerd ${dateText(batch.archivedAt)}` : "gearchiveerd";
  }

  if (batch.failedAt) {
    return `mislukt ${dateText(batch.failedAt)}`;
  }

  if (batch.committedAt) {
    return `verwerkt ${dateText(batch.committedAt)}`;
  }

  return `aangemaakt ${dateText(batch.createdAt)}`;
}

function batchBlockers(batch: ProductImportBatch, allowUnknownVatMode: boolean) {
  const blockers: string[] = [];

  if (batch.totalRows <= 0) {
    blockers.push("geen regels gevonden");
  }

  if (batch.errorRows > 0) {
    blockers.push(`${numberText(batch.errorRows)} foutregels`);
  }

  if (batch.duplicateSourceKeys > 0) {
    blockers.push(`${numberText(batch.duplicateSourceKeys)} dubbele prijslijstregels`);
  }

  if (batch.unknownVatModeRows > 0 && !allowUnknownVatMode) {
    blockers.push(`${numberText(batch.unknownVatModeRows)} ontbrekende btw-keuzes`);
  }

  return blockers;
}

function countBatchesForFilter(batches: ProductImportBatch[], filter: BatchStatusFilter) {
  if (filter === "all") {
    return batches.length;
  }

  return batches.filter((batch) => batch.status === filter).length;
}

function sortBatches(left: ProductImportBatch, right: ProductImportBatch) {
  const order: Record<ProductImportBatch["status"], number> = {
    failed: 0,
    needs_mapping: 1,
    ready_to_import: 2,
    uploaded: 3,
    analyzing: 4,
    importing: 5,
    imported: 6,
    archived: 7
  };
  const statusDifference = order[left.status] - order[right.status];

  if (statusDifference !== 0) {
    return statusDifference;
  }

  return (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt);
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
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageImports = canManage(session.role);
  const batchSearch = batchSearchQuery.trim().toLocaleLowerCase("nl-NL");

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
    setIsCreatingBatch(true);
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
      setIsCreatingBatch(false);
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
          label: "Terugzetten",
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
  const searchedBatches = useMemo(
    () => batches.filter((batch) => batchMatchesSearch(batch, batchSearch)),
    [batchSearch, batches]
  );
  const batchCounts = useMemo(
    () =>
      batchStatusFilters.reduce(
        (counts, item) => ({
          ...counts,
          [item.value]: countBatchesForFilter(searchedBatches, item.value)
        }),
        {} as Record<BatchStatusFilter, number>
      ),
    [searchedBatches]
  );
  const filteredBatches = useMemo(() => {
    return searchedBatches
      .filter((batch) => batchStatusFilter === "all" || batch.status === batchStatusFilter)
      .sort(sortBatches);
  }, [batchStatusFilter, searchedBatches]);
  const batchSummary = useMemo(
    () => ({
      total: batches.length,
      imported: batches.filter((batch) => batch.status === "imported").length,
      failed: batches.filter((batch) => batch.status === "failed").length,
      archived: batches.filter((batch) => batch.status === "archived").length,
      ready: batches.filter((batch) => batch.status === "ready_to_import").length,
      needsMapping: batches.filter((batch) => batch.status === "needs_mapping").length,
      products: batches.reduce((total, batch) => total + batch.productRows, 0),
      priceRules: batches.reduce((total, batch) => total + batch.importedPrices, 0),
      warningRows: batches.reduce((total, batch) => total + batch.warningRows, 0),
      unknownVatModeRows: batches.reduce((total, batch) => total + batch.unknownVatModeRows, 0),
      errorRows: batches.reduce((total, batch) => total + batch.errorRows, 0)
    }),
    [batches]
  );
  const nextAttentionBatch =
    batches
      .filter((batch) => batch.status === "failed" || batch.status === "needs_mapping")
      .sort(sortBatches)[0] ?? null;
  const canCommit = selectedBatch
    ? selectedBatch.totalRows > 0 &&
      selectedBatch.errorRows === 0 &&
      selectedBatch.duplicateSourceKeys === 0 &&
      (selectedBatch.unknownVatModeRows === 0 || allowUnknownVatMode)
    : false;
  const selectedBlockers = selectedBatch ? batchBlockers(selectedBatch, allowUnknownVatMode) : [];

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
      priority: "primary",
      render: (batch) => (
        <div className="import-file-cell">
          <a
            className="button ghost"
            href={`/portal/imports/${batch.id}`}
            onClick={() => setSelectedBatchId(batch.id)}
          >
            {batch.fileName}
          </a>
          <small className="muted">{batch.supplierName}</small>
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
          <span>{numberText(batch.previewRows)} gecontroleerde regels</span>
          <span>{numberText(batch.productRows)} productregels</span>
          <span>{numberText(batch.importedPrices)} prijsregels</span>
        </div>
      )
    },
    {
      key: "signals",
      header: "Controle",
      width: "190px",
      render: (batch) => (
        <div className="import-signal-stack">
          <Badge variant={batch.errorRows > 0 || batch.status === "failed" ? "danger" : "success"}>
            Fouten {numberText(batch.errorRows)}
          </Badge>
          <Badge variant={batch.warningRows > 0 ? "warning" : "neutral"}>
            Rijmeldingen {numberText(batch.warningRows)}
          </Badge>
          <Badge variant={batch.duplicateSourceKeys > 0 ? "danger" : "success"}>
            Dubbele regels {numberText(batch.duplicateSourceKeys)}
          </Badge>
          <Badge variant={batch.unknownVatModeRows > 0 ? "warning" : "success"}>
            Btw onbekend {numberText(batch.unknownVatModeRows)}
          </Badge>
          {batch.errorMessage ? <small className="muted">{batch.errorMessage}</small> : null}
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
            : "Prijslijstcontrole terugzetten?"
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
        confirmLabel={pendingBatchStatus?.nextStatus === "archived" ? "Archiveren" : "Terugzetten"}
        tone={pendingBatchStatus?.nextStatus === "archived" ? "danger" : "warning"}
        isBusy={isBusy}
        onCancel={() => setPendingBatchStatus(null)}
        onConfirm={() => void updateBatchStatus()}
      />
      <div className="grid">
        <section
          className={
            batchSummary.failed > 0 || batchSummary.needsMapping > 0
              ? "panel import-workbench import-workbench-attention"
              : "panel import-workbench"
          }
        >
          <div className="toolbar import-workbench-titlebar">
            <div>
              <p className="eyebrow">Prijslijstwerkbank</p>
              <h2 className="import-workbench-title">
                {isLoading
                  ? "Prijslijsten laden"
                  : batchSummary.failed > 0 || batchSummary.needsMapping > 0
                    ? `${numberText(batchSummary.failed + batchSummary.needsMapping)} controles vragen aandacht`
                    : "Prijslijstcontroles zijn bijgewerkt"}
              </h2>
              <p className="muted import-workbench-copy">
                Start controles, bekijk meldingen en verwerk pas definitief als de poort vrij is.
              </p>
            </div>
            <div className="toolbar">
              <Badge
                variant={
                  isLoading
                    ? "neutral"
                    : batchSummary.failed > 0
                      ? "danger"
                      : batchSummary.needsMapping > 0
                        ? "warning"
                        : "success"
                }
                icon={
                  isLoading ? (
                    <FileSpreadsheet size={14} aria-hidden="true" />
                  ) : batchSummary.failed > 0 || batchSummary.needsMapping > 0 ? (
                    <ShieldAlert size={14} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  )
                }
              >
                {isLoading
                  ? "Laden"
                  : batchSummary.failed > 0
                    ? "Mislukte controles"
                    : batchSummary.needsMapping > 0
                      ? "Btw-keuze nodig"
                      : "Overzicht gereed"}
              </Badge>
            </div>
          </div>

          <div className="import-overview-layout">
            <div className="import-focus-block">
              <p className="eyebrow">Nu eerst</p>
              <strong>
                {nextAttentionBatch
                  ? `${nextAttentionBatch.supplierName} · ${nextAttentionBatch.fileName}`
                  : selectedBatch
                    ? selectedBatch.fileName
                    : "Geen open blokkades"}
              </strong>
              <p className="muted">
                {nextAttentionBatch
                  ? nextAttentionBatch.status === "failed"
                    ? "Deze controle is mislukt. Bekijk de melding voordat je opnieuw verwerkt."
                    : "Deze controle heeft nog een btw-keuze of mapping nodig."
                  : "Gebruik de lijst hieronder voor detailcontrole of om een nieuwe prijslijstcontrole te starten."}
              </p>
            </div>
            <div className="import-focus-block">
              <p className="eyebrow">Catalogusvolume</p>
              <strong>{numberText(batchSummary.products)} productregels</strong>
              <p className="muted">
                {numberText(batchSummary.priceRules)} prijsregels over {numberText(batchSummary.total)} controles.
              </p>
            </div>
          </div>

          <div className="import-summary-strip" aria-label="Samenvatting prijslijsten">
            <div className="import-summary-item import-summary-danger">
              <span>Aandacht nodig</span>
              <strong>{numberText(batchSummary.failed + batchSummary.needsMapping)}</strong>
            </div>
            <div className="import-summary-item import-summary-success">
              <span>Verwerkt</span>
              <strong>{numberText(batchSummary.imported)}</strong>
            </div>
            <div className="import-summary-item import-summary-info">
              <span>Klaar</span>
              <strong>{numberText(batchSummary.ready)}</strong>
            </div>
            <div className="import-summary-item import-summary-warning">
              <span>Rijmeldingen</span>
              <strong>{numberText(batchSummary.warningRows)}</strong>
              <small>
                {batchSummary.unknownVatModeRows > 0
                  ? "Vooral btw-modus onbekend"
                  : "Geen btw-meldingen"}
              </small>
            </div>
            <div className="import-summary-item">
              <span>Zichtbaar</span>
              <strong>{numberText(filteredBatches.length)}</strong>
            </div>
          </div>
        </section>

        <section className="panel import-start-panel">
          <form
            className="import-start-form"
            onSubmit={createBatch}
            aria-label="Nieuwe prijslijstcontrole"
          >
            <div className="import-start-copy">
              <p className="eyebrow">Nieuwe controle</p>
              <h2>Prijslijstcontrole starten</h2>
              <p className="muted">
                Start eerst een veilige preview. Definitief verwerken gebeurt pas vanuit de detailcontrole.
              </p>
            </div>
            <div className="import-start-controls">
              <Field label="Bestand" htmlFor="import-file">
                <Select id="import-file" value={fileName} onChange={(event) => setFileName(event.target.value)}>
                  {sourceFiles.map((file) => (
                    <option value={file} key={file}>
                      {file}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Leverancier" htmlFor="import-supplier">
                <input
                  className="ui-control"
                  id="import-supplier"
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                />
              </Field>
              <div className="import-start-action">
                <Button
                  className="import-start-submit"
                  variant="primary"
                  type="submit"
                  disabled={isBusy}
                  isLoading={isCreatingBatch}
                  leftIcon={<FileSpreadsheet size={17} aria-hidden="true" />}
                >
                  {isCreatingBatch ? "Preview voorbereiden" : "Preview starten"}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <div className="import-layout">
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
                    <StatusBadge
                      status={batch.status}
                      label={formatImportStatus(batch.status)}
                      variant={batchStatusVariant(batch)}
                    />
                  </div>
                  <div className="mobile-card-meta">
                    <Badge variant="neutral">Regels {numberText(batch.previewRows)}</Badge>
                    <Badge variant="neutral">Producten {numberText(batch.productRows)}</Badge>
                    <Badge variant="neutral">Prijsregels {numberText(batch.importedPrices)}</Badge>
                    <Badge variant={batch.duplicateSourceKeys > 0 ? "danger" : "success"}>
                      Dubbele regels {numberText(batch.duplicateSourceKeys)}
                    </Badge>
                    <Badge variant={batch.unknownVatModeRows > 0 ? "warning" : "success"}>
                      Btw onbekend {numberText(batch.unknownVatModeRows)}
                    </Badge>
                  </div>
                  <div className="mobile-card-section">
                    <p className="mobile-card-section-label">Statusmoment</p>
                    <span className="muted">{lifecycleText(batch)}</span>
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

          <section className="panel import-detail-panel">
            {selectedBatch ? (
              <>
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
                      onClick={() => void saveMapping(selectedBatch)}
                      disabled={isBusy}
                      leftIcon={<Save size={17} aria-hidden="true" />}
                    >
                      Btw-instelling bewaren
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
          </>
        ) : (
          <div className="empty-state">Selecteer een prijslijst om de controle te bekijken.</div>
        )}
      </section>
      </div>
      </div>
    </>
  );
}
