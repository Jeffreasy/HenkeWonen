import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatImportStatus } from "../../lib/i18n/statusLabels";
import type { ProductImportBatch, ProductImportRow } from "../../lib/portalTypes";
import { Alert } from "../ui/feedback/Alert";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { ImportWorkbench } from "./ImportWorkbench";
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

function batchMatchesSearch(batch: ProductImportBatch, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }
  return [
    batch.bestandsnaam,
    batch.leverancierNaam,
    batch.profileName,
    batch.status,
    formatImportStatus(batch.status),
    batch.foutmelding
  ].some((value) => normalizedText(value).includes(searchQuery));
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
  return (right.gewijzigdOp ?? right.aangemaaktOp) - (left.gewijzigdOp ?? left.aangemaaktOp);
}

/**
 * Prijslijsten = controle- en overzichtsscherm. Het daadwerkelijk verwerken van
 * leverancierbestanden naar producten/prijzen gebeurt buiten de portal (via de
 * importscripts van de beheerder). Dit scherm toont de aangeleverde bestanden en
 * de controle-meldingen per batch; het staat GEEN import/verwerk-actie in de UI.
 */
export default function ImportPreview({ session, batchId }: ImportPreviewProps) {
  const [batches, setBatches] = useState<ProductImportBatch[]>([]);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState(batchId ?? "");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState<BatchStatusFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [rowKindFilter, setRowKindFilter] = useState<RowKindFilter>("all");
  const [rowStatusFilter, setRowStatusFilter] = useState<RowStatusFilter>("all");
  const [rowPage, setRowPage] = useState(1);
  const [pendingBatchStatus, setPendingBatchStatus] = useState<{
    batch: ProductImportBatch;
    nextStatus: ProductImportBatch["status"];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageImports = canManage(session.role);
  const batchSearch = batchSearchQuery.trim().toLocaleLowerCase("nl-NL");

  const loadBatches = useCallback(async () => {
    const client = createConvexHttpClient(session);
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

    const client = createConvexHttpClient(session);
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

  async function updateBatchStatus() {
    if (!pendingBatchStatus || !canManageImports) {
      return;
    }

    const client = createConvexHttpClient(session);
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
        const matchesKind = rowKindFilter === "all" || row.rijSoort === rowKindFilter;
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
      products: batches.reduce((total, batch) => total + batch.productRijen, 0),
      priceRules: batches.reduce((total, batch) => total + batch.geimporteerdePrijzen, 0),
      warningRows: batches.reduce((total, batch) => total + batch.waarschuwingRijen, 0),
      unknownVatModeRows: batches.reduce((total, batch) => total + batch.onbekendeBtwModusRijen, 0),
      errorRows: batches.reduce((total, batch) => total + batch.foutRijen, 0)
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

  const rowKindOptions = useMemo(
    () => [...new Set(rows.map((row) => row.rijSoort))].sort(),
    [rows]
  );

  const rowStatusOptions = useMemo(
    () => [...new Set(rows.map((row) => row.status))].sort(),
    [rows]
  );

  return (
    <>
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
              ? `Je archiveert "${pendingBatchStatus.batch.bestandsnaam}". De controle blijft bewaard, maar verdwijnt uit het dagelijkse overzicht.`
              : `Je herstelt "${pendingBatchStatus.batch.bestandsnaam}" naar ${formatImportStatus(
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
        <Alert
          variant="info"
          title="Controle- en overzichtsscherm"
          description="Hier bekijk en beoordeel je aangeleverde leverancier-prijslijsten en de controle-meldingen per bestand. Het daadwerkelijk verwerken naar de catalogus (producten en prijzen) doet de beheerder buiten de portal via de importscripts."
        />

        <ImportWorkbench
          batchSummary={batchSummary}
          nextAttentionBatch={nextAttentionBatch}
          selectedBatch={selectedBatch}
          isLoading={isLoading}
          visibleCount={filteredBatches.length}
          numberText={numberText}
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
              isBusy={isBusy}
              rowKindFilter={rowKindFilter}
              setRowKindFilter={setRowKindFilter}
              rowStatusFilter={rowStatusFilter}
              setRowStatusFilter={setRowStatusFilter}
              rowPage={safeRowPage}
              setRowPage={setRowPage}
              totalRowPages={totalRowPages}
              pagedRows={pagedRows}
              rowPageSize={rowPageSize}
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
