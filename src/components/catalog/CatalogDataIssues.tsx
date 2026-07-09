import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatRecommendation } from "../../lib/i18n/statusLabels";
import { showToast } from "../../lib/toast";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { DataIssuesHeader } from "./DataIssuesHeader";
import { DataIssuesFilterBar, type IssueStatusFilter } from "./DataIssuesFilterBar";
import { DataIssuesTable, type DuplicateEanIssue, type IssueDraft } from "./DataIssuesTable";

type CatalogDataIssuesProps = {
  session: AppSession;
};

type DuplicateEanReview = {
  duplicateGroupCount: number;
  duplicateProductCount: number;
  groups: DuplicateEanIssue[];
};

type DuplicateEanSyncChunk = {
  isDone: boolean;
  nextCursor: string | null;
  supplierNaam: string | null;
  supplierIndex: number;
  supplierCount: number;
  created: number;
  updated: number;
};

type DuplicateEanFinalizeResult = {
  active: number;
  resolvedStale: number;
};

/** Aantal groepen dat in één keer rendert; "Toon meer" haalt de rest erbij. */
const VISIBLE_STEP = 50;

const statusFilters: Array<{ value: IssueStatusFilter; label: string }> = [
  { value: "open", label: "Te beoordelen" },
  { value: "reviewed", label: "Beoordeeld" },
  { value: "accepted", label: "Bewust toegestaan" },
  { value: "resolved", label: "Opgelost" },
  { value: "all", label: "Alle" }
];

function normalizedText(value?: string) {
  return (value ?? "").toLocaleLowerCase("nl-NL");
}

function formatDuplicateEanStatus(status: DuplicateEanIssue["issueStatus"]) {
  if (status === "open") {
    return "Te beoordelen";
  }

  if (status === "accepted") {
    return "Bewust toegestaan";
  }

  if (status === "reviewed") {
    return "Beoordeeld";
  }

  return "Opgelost";
}

function issueMatchesSearch(issue: DuplicateEanIssue, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  return [
    issue.supplier,
    issue.ean,
    issue.reason,
    issue.recommendation,
    formatRecommendation(issue.recommendation),
    formatDuplicateEanStatus(issue.issueStatus),
    ...issue.productNames,
    ...issue.articleNumbers,
    ...issue.supplierCodes,
    ...issue.sourceFileNames,
    ...issue.sourceSheetNames
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function statusSortValue(status: DuplicateEanIssue["issueStatus"]) {
  if (status === "open") {
    return 0;
  }

  if (status === "reviewed") {
    return 1;
  }

  if (status === "accepted") {
    return 2;
  }

  return 3;
}

export default function CatalogDataIssues({ session }: CatalogDataIssuesProps) {
  const [review, setReview] = useState<DuplicateEanReview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, IssueDraft>>({});
  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>("open");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [recommendationFilter, setRecommendationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_STEP);
  const [error, setError] = useState<string | null>(null);

  const orderedGroups = useMemo(
    () =>
      [...(review?.groups ?? [])].sort((left, right) => {
        const statusDifference = statusSortValue(left.issueStatus) - statusSortValue(right.issueStatus);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        if (left.supplier !== right.supplier) {
          return left.supplier.localeCompare(right.supplier, "nl-NL");
        }

        return left.ean.localeCompare(right.ean, "nl-NL");
      }),
    [review?.groups]
  );

  const supplierOptions = useMemo(
    () => [...new Set(orderedGroups.map((issue) => issue.supplier))].sort(),
    [orderedGroups]
  );
  const recommendationOptions = useMemo(
    () => [...new Set(orderedGroups.map((issue) => issue.recommendation))].sort(),
    [orderedGroups]
  );
  const summary = useMemo(() => {
    return {
      total: orderedGroups.length,
      open: orderedGroups.filter((issue) => issue.issueStatus === "open").length,
      reviewed: orderedGroups.filter((issue) => issue.issueStatus === "reviewed").length,
      accepted: orderedGroups.filter((issue) => issue.issueStatus === "accepted").length,
      resolved: orderedGroups.filter((issue) => issue.issueStatus === "resolved").length
    };
  }, [orderedGroups]);

  const groupsMatchingFiltersExceptStatus = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("nl-NL");

    return orderedGroups.filter((issue) => {
      const matchesSupplier = supplierFilter === "all" || issue.supplier === supplierFilter;
      const matchesRecommendation =
        recommendationFilter === "all" || issue.recommendation === recommendationFilter;
      const matchesSearch = issueMatchesSearch(issue, normalizedQuery);

      return matchesSupplier && matchesRecommendation && matchesSearch;
    });
  }, [orderedGroups, recommendationFilter, searchQuery, supplierFilter]);

  const statusCounts = useMemo(
    () =>
      statusFilters.reduce(
        (counts, item) => ({
          ...counts,
          [item.value]:
            item.value === "all"
              ? groupsMatchingFiltersExceptStatus.length
              : groupsMatchingFiltersExceptStatus.filter((issue) => issue.issueStatus === item.value)
                  .length
        }),
        {} as Record<IssueStatusFilter, number>
      ),
    [groupsMatchingFiltersExceptStatus]
  );

  const filteredGroups = useMemo(
    () =>
      groupsMatchingFiltersExceptStatus.filter(
        (issue) => statusFilter === "all" || issue.issueStatus === statusFilter
      ),
    [groupsMatchingFiltersExceptStatus, statusFilter]
  );

  const visibleProductCount = useMemo(
    () => filteredGroups.reduce((total, issue) => total + issue.products.length, 0),
    [filteredGroups]
  );
  const nextOpenIssue = orderedGroups.find((issue) => issue.issueStatus === "open");
  const hasOpenIssues = Boolean(review && summary.open > 0);

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.catalog.review.duplicateEanReview, {
        tenantSlug: session.tenantId
      })) as DuplicateEanReview;

      setReview(result);
      setDrafts(
        Object.fromEntries(
          result.groups
            .filter((issue) => issue.issueId)
            .map((issue) => [
              issue.issueId as string,
              {
                decision: issue.reviewDecision ?? "keep_separate",
                notes: issue.notes ?? ""
              }
            ])
        )
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Productwaarschuwingen konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  // Bij een andere filterkeuze weer bovenaan beginnen; met ~1.800 groepen
  // rendert alles-in-één-keer onwerkbaar traag (elke rij heeft een formulier).
  useEffect(() => {
    setVisibleLimit(VISIBLE_STEP);
  }, [statusFilter, supplierFilter, recommendationFilter, searchQuery]);

  // Scant de live catalogus leverancier voor leverancier (Convex-leeslimiet)
  // en zet daarna verdwenen signalen op "opgelost" via de finalize-stap.
  async function syncIssues() {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const actor = mutationActorFromSession(session);
      const syncRunId = `duplicate-ean-${Date.now()}`;
      let cursor: string | undefined;
      let created = 0;
      let updated = 0;

      do {
        const chunk = (await client.mutation(api.catalog.review.syncDuplicateEanIssues, {
          tenantSlug: session.tenantId,
          actor,
          syncRunId,
          supplierCursor: cursor
        })) as DuplicateEanSyncChunk;

        created += chunk.created;
        updated += chunk.updated;
        if (chunk.supplierNaam) {
          setSyncProgress(`${chunk.supplierIndex}/${chunk.supplierCount} · ${chunk.supplierNaam}`);
        }
        cursor = chunk.isDone ? undefined : (chunk.nextCursor ?? undefined);
      } while (cursor);

      const finalized = (await client.mutation(api.catalog.review.finalizeDuplicateEanIssueSync, {
        tenantSlug: session.tenantId,
        actor,
        syncRunId
      })) as DuplicateEanFinalizeResult;

      await loadReview();
      showToast({
        title: "Catalogus gescand op dubbele EAN's",
        description: `${created} nieuwe signalen, ${updated} bijgewerkt, ${finalized.resolvedStale} vervallen signalen opgelost.`,
        tone: "success"
      });
    } catch (syncError) {
      console.error(syncError);
      setError("Dubbele EAN-waarschuwingen konden niet worden bijgewerkt.");
    } finally {
      setSyncProgress(null);
      setIsSaving(false);
    }
  }

  // Bulk: alle OPEN signalen in één keer op "Gescheiden houden" zetten.
  // Chunked (500 per ronde) omdat de open lijst duizenden signalen kan tellen.
  async function bulkKeepSeparate() {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsBulkConfirmOpen(false);
    setIsSaving(true);
    setError(null);

    try {
      const actor = mutationActorFromSession(session);
      let patched = 0;
      let isDone = false;

      while (!isDone) {
        const result = (await client.mutation(api.catalog.review.bulkReviewOpenDuplicateEanIssues, {
          tenantSlug: session.tenantId,
          actor,
          decision: "keep_separate"
        })) as { patched: number; isDone: boolean };
        patched += result.patched;
        isDone = result.isDone;
        setSyncProgress(`${patched} beoordeeld`);
      }

      await loadReview();
      showToast({
        title: "Alle open signalen op 'Gescheiden houden' gezet",
        description: `${patched} EAN-groepen beoordeeld. Wijzigt een groep later, dan vraagt het signaal opnieuw om beoordeling.`,
        tone: "success"
      });
    } catch (bulkError) {
      console.error(bulkError);
      setError("Bulkbeoordeling kon niet worden opgeslagen.");
    } finally {
      setSyncProgress(null);
      setIsSaving(false);
    }
  }

  async function saveIssue(issue: DuplicateEanIssue) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    if (!issue.issueId) {
      setError("Deze waarschuwing mist een beoordeling. Werk de waarschuwingen opnieuw bij.");
      return;
    }

    const draft = drafts[issue.issueId];

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.review.updateDuplicateEanIssueReview, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        issueId: issue.issueId,
        decision: draft?.decision ?? "keep_separate",
        notities: draft?.notes,
        reviewedByExternalUserId: session.userId
      });
      await loadReview();
      showToast({ title: `Beoordeling EAN ${issue.ean} opgeslagen`, tone: "success" });
    } catch (saveError) {
      console.error(saveError);
      setError("Beoordeling kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft(issueId: string, patch: Partial<IssueDraft>) {
    setDrafts((current) => ({
      ...current,
      [issueId]: {
        decision: current[issueId]?.decision ?? "keep_separate",
        notes: current[issueId]?.notes ?? "",
        ...patch
      }
    }));
  }

  return (
    <div className="grid">
      <ConfirmDialog
        open={isBulkConfirmOpen}
        title="Alle open signalen op 'Gescheiden houden' zetten?"
        description={`Je legt voor ${summary.open} open EAN-groepen de beslissing "Gescheiden houden" vast. Producten worden sowieso nooit samengevoegd; dit ruimt alleen de werklijst op. Verandert een groep later van samenstelling, dan komt dat signaal vanzelf terug als "Te beoordelen".`}
        confirmLabel="Gescheiden houden"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setIsBulkConfirmOpen(false)}
        onConfirm={() => void bulkKeepSeparate()}
      />
      <section
        className={
          hasOpenIssues ? "panel issue-workbench issue-workbench-attention" : "panel issue-workbench"
        }
      >
        <DataIssuesHeader
          isLoading={isLoading}
          isSaving={isSaving}
          syncProgress={syncProgress}
          hasOpenIssues={hasOpenIssues}
          review={review}
          error={error}
          summary={summary}
          nextOpenIssue={nextOpenIssue}
          supplierOptionsCount={supplierOptions.length}
          visibleProductCount={visibleProductCount}
          filteredGroupsCount={filteredGroups.length}
          onRefresh={loadReview}
          onSync={syncIssues}
          onBulkKeepSeparate={() => setIsBulkConfirmOpen(true)}
        />
        {review && !isLoading ? (
          <DataIssuesFilterBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusCounts={statusCounts}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            supplierOptions={supplierOptions}
            recommendationFilter={recommendationFilter}
            onRecommendationFilterChange={setRecommendationFilter}
            recommendationOptions={recommendationOptions}
            filteredGroupsCount={filteredGroups.length}
          />
        ) : null}
      </section>

      <DataIssuesTable
        filteredGroups={filteredGroups.slice(0, visibleLimit)}
        totalGroupCount={filteredGroups.length}
        drafts={drafts}
        isSaving={isSaving}
        isLoading={isLoading}
        error={error}
        onUpdateDraft={updateDraft}
        onSaveIssue={saveIssue}
        onShowMore={
          filteredGroups.length > visibleLimit
            ? () => setVisibleLimit((current) => current + VISIBLE_STEP)
            : undefined
        }
      />
    </div>
  );
}
