import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatImportStatus } from "../../lib/i18n/statusLabels";
import type { ProductImportBatch, ProductImportRow } from "../../lib/portalTypes";
import type { SubmitEventLike } from "../../lib/events";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ImportWorkbench } from "./ImportWorkbench";
import { StartImportForm } from "./StartImportForm";
import { ImportBatchesTable } from "./ImportBatchesTable";
import { ImportDetailPanel } from "./ImportDetailPanel";
import { type BatchStatusFilter, type DetailTab, type RowKindFilter, type RowStatusFilter } from "./import/importTypes";
import { numberText, normalizedText } from "./import/importUtils";

type ImportPreviewProps = {
  session: AppSession;
  batchId?: string;
};

type BatchDetail = {
  batch: ProductImportBatch;
  rows: ProductImportRow[];
};

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
      const result = (await client.query(api.catalog.imports.listBatchesForPortal, {
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
      const result = (await client.query(api.catalog.imports.getBatchForPortal, {
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
      const newBatchId = await client.mutation(api.catalog.import.createPreviewBatch, {
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
      await client.mutation(api.catalog.import.savePreviewMapping, {
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
        const result = await client.mutation(api.catalog.import.commitPreviewBatchChunk, {
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
      await client.mutation(api.catalog.imports.updateBatchStatusForPortal, {
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

  const selectedBatch = detail?.batch ?? batches.find((batch) => batch.id === selectedBatchId) ?? null;
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
      (
        ["failed", "ready_to_import", "needs_mapping", "imported", "archived", "all"] as BatchStatusFilter[]
      ).reduce(
        (counts, filterVal) => ({
          ...counts,
          [filterVal]: countBatchesForFilter(searchedBatches, filterVal)
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

  const nextAttentionBatch = useMemo(
    () =>
      batches
        .filter((batch) => batch.status === "failed" || batch.status === "needs_mapping")
        .sort(sortBatches)[0] ?? null,
    [batches]
  );

  const canCommit = useMemo(
    () =>
      selectedBatch
        ? selectedBatch.totalRows > 0 &&
          selectedBatch.errorRows === 0 &&
          selectedBatch.duplicateSourceKeys === 0 &&
          (selectedBatch.unknownVatModeRows === 0 || allowUnknownVatMode)
        : false,
    [selectedBatch, allowUnknownVatMode]
  );

  const selectedBlockers = useMemo(
    () => (selectedBatch ? batchBlockers(selectedBatch, allowUnknownVatMode) : []),
    [selectedBatch, allowUnknownVatMode]
  );

  const rowKindOptions = useMemo(
    () => [...new Set(rows.map((row) => row.rowKind))].sort(),
    [rows]
  );

  const rowStatusOptions = useMemo(
    () => [...new Set(rows.map((row) => row.status))].sort(),
    [rows]
  );

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
        <ImportWorkbench
          batchSummary={batchSummary}
          nextAttentionBatch={nextAttentionBatch}
          selectedBatch={selectedBatch}
          isLoading={isLoading}
          visibleCount={filteredBatches.length}
          numberText={numberText}
        />

        <StartImportForm
          sourceFiles={sourceFiles}
          fileName={fileName}
          supplierName={supplierName}
          setFileName={setFileName}
          setSupplierName={setSupplierName}
          onSubmit={createBatch}
          isBusy={isBusy}
          isCreatingBatch={isCreatingBatch}
        />

        <div className="import-layout">
          <ImportBatchesTable
            filteredBatches={filteredBatches}
            isLoading={isLoading}
            error={error}
            batchSearchQuery={batchSearchQuery}
            setBatchSearchQuery={setBatchSearchQuery}
            batchStatusFilter={batchStatusFilter}
            setBatchStatusFilter={setBatchStatusFilter}
            batchCounts={batchCounts}
            canManageImports={canManageImports}
            setSelectedBatchId={setSelectedBatchId}
            setPendingBatchStatus={setPendingBatchStatus}
          />

          {selectedBatch ? (
            <ImportDetailPanel
              selectedBatch={selectedBatch}
              rows={rows}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              allowUnknownVatMode={allowUnknownVatMode}
              setAllowUnknownVatMode={setAllowUnknownVatMode}
              canCommit={canCommit}
              isBusy={isBusy}
              selectedBlockers={selectedBlockers}
              rowKindFilter={rowKindFilter}
              setRowKindFilter={setRowKindFilter}
              rowStatusFilter={rowStatusFilter}
              setRowStatusFilter={setRowStatusFilter}
              rowPage={safeRowPage}
              setRowPage={setRowPage}
              totalRowPages={totalRowPages}
              pagedRows={pagedRows}
              rowPageSize={rowPageSize}
              onSaveMapping={() => saveMapping(selectedBatch)}
              onCommitBatch={() => setPendingCommitBatch(selectedBatch)}
              onUpdateBatchStatus={(nextStatus) => setPendingBatchStatus({ batch: selectedBatch, nextStatus })}
              canManageImports={canManageImports}
              rowKindOptions={rowKindOptions}
              rowStatusOptions={rowStatusOptions}
            />
          ) : (
            <section className="panel import-detail-panel">
              <div className="empty-state">Selecteer een prijslijst om de controle te bekijken.</div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
