import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatRecommendation } from "../../lib/i18n/statusLabels";
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

type DuplicateEanSyncResult = {
  requiresPreviewSync?: boolean;
  message?: string;
};

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

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      resolved: orderedGroups.filter((issue) => issue.issueStatus === "resolved").length,
      missingIssueRecords: orderedGroups.filter((issue) => !issue.issueId).length
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
  const visibleSourceFileCount = useMemo(
    () => uniqueCount(filteredGroups.flatMap((issue) => issue.sourceFileNames)),
    [filteredGroups]
  );
  const nextOpenIssue = orderedGroups.find((issue) => issue.issueStatus === "open");
  const hasOpenIssues = Boolean(review && summary.open > 0);

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);

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

  async function syncIssues() {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = (await client.mutation(api.catalog.review.syncDuplicateEanIssues, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session)
      })) as DuplicateEanSyncResult;
      await loadReview();
      setNotice(result.message ?? "Dubbele EAN-waarschuwingen zijn bijgewerkt.");
    } catch (syncError) {
      console.error(syncError);
      setError("Dubbele EAN-waarschuwingen konden niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveIssue(issue: DuplicateEanIssue) {
    const client = createConvexHttpClient();

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
    setNotice(null);

    try {
      await client.mutation(api.catalog.review.updateDuplicateEanIssueReview, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        issueId: issue.issueId,
        decision: draft?.decision ?? "keep_separate",
        notes: draft?.notes,
        reviewedByExternalUserId: session.userId
      });
      await loadReview();
      setNotice(`Beoordeling voor EAN ${issue.ean} is opgeslagen.`);
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
      <section
        className={
          hasOpenIssues ? "panel issue-workbench issue-workbench-attention" : "panel issue-workbench"
        }
      >
        <DataIssuesHeader
          isLoading={isLoading}
          isSaving={isSaving}
          hasOpenIssues={hasOpenIssues}
          review={review}
          error={error}
          notice={notice}
          summary={summary}
          nextOpenIssue={nextOpenIssue}
          supplierOptionsCount={supplierOptions.length}
          visibleProductCount={visibleProductCount}
          visibleSourceFileCount={visibleSourceFileCount}
          filteredGroupsCount={filteredGroups.length}
          onRefresh={loadReview}
          onSync={syncIssues}
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
        filteredGroups={filteredGroups}
        drafts={drafts}
        isSaving={isSaving}
        isLoading={isLoading}
        error={error}
        onUpdateDraft={updateDraft}
        onSaveIssue={saveIssue}
        onSyncIssues={syncIssues}
      />
    </div>
  );
}
