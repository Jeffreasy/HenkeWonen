import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatVatMode } from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FilterBar } from "../ui/FilterBar";
import { VatWorkbenchHeader } from "./VatWorkbenchHeader";
import { ImportProfilesTable } from "./ImportProfilesTable";
import { VatMappingGroups } from "./VatMappingGroups";

type ImportProfilesProps = {
  session: AppSession;
};

export type VatMode = "inclusive" | "exclusive" | "unknown";
export type MappingFilter = "all" | "unresolved" | "inclusive" | "exclusive" | "unknown" | "allowUnknown";
type ProfileStatusFilter = "all" | "active" | "archived";

export type VatMappingReviewRow = {
  profileId: string;
  profileName: string;
  supplier: string;
  category: string;
  sourceFileNamePattern?: string;
  sourceColumnName: string;
  sourceColumnIndex: number;
  detectedPriceType: string;
  detectedUnit: string;
  currentVatMode: VatMode;
  suggestedVatMode: VatMode;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  allowUnknownVatMode: boolean;
  reason: string;
  reviewStatus?: string;
  updatedByExternalUserId?: string;
  updatedAt?: number;
  reviewedByExternalUserId?: string;
  reviewedAt?: number;
};

export type VatMappingReview = {
  totalProfiles: number;
  totalPriceColumns: number;
  resolvedColumns: number;
  unresolvedColumns: number;
  allowUnknownColumns: number;
  rows: VatMappingReviewRow[];
};

export type ImportProfileSummary = {
  id: string;
  supplierName: string;
  name: string;
  expectedFileExtension?: ".xlsx" | ".xls";
  filePattern?: string;
  sheetPattern?: string;
  supportsXlsx: boolean;
  supportsXls: boolean;
  status: "active" | "inactive";
  updatedAt: number;
};

type PendingConfirmation =
  | {
      type: "bulkVatMode";
      rows: VatMappingReviewRow[];
      vatMode: "inclusive" | "exclusive";
      profileName: string;
    }
  | {
      type: "allowUnknown";
      profileId: string;
      profileName: string;
      allowUnknownVatMode: boolean;
    };

const filters: Array<{ value: MappingFilter; label: string }> = [
  { value: "unresolved", label: "Te beoordelen" },
  { value: "inclusive", label: "Inclusief btw" },
  { value: "exclusive", label: "Exclusief btw" },
  { value: "unknown", label: "Nog kiezen" },
  { value: "allowUnknown", label: "Bewuste uitzondering" },
  { value: "all", label: "Alle" }
];

function numberText(value: number) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function rowKey(row: VatMappingReviewRow) {
  return `${row.profileId}::${row.sourceColumnIndex}::${row.sourceColumnName}`;
}

function filterRow(row: VatMappingReviewRow, filter: MappingFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "unresolved") {
    return row.currentVatMode === "unknown" && !row.allowUnknownVatMode;
  }
  if (filter === "allowUnknown") {
    return row.allowUnknownVatMode;
  }
  return row.currentVatMode === filter;
}

function countRowsForFilter(rows: VatMappingReviewRow[], filter: MappingFilter) {
  return rows.filter((row) => filterRow(row, filter)).length;
}

function normalizedText(value?: string) {
  return (value ?? "").toLocaleLowerCase("nl-NL");
}

function rowMatchesSearch(row: VatMappingReviewRow, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }
  return [
    row.profileName,
    row.supplier,
    row.category,
    row.sourceFileNamePattern,
    row.sourceColumnName,
    formatVatMode(row.currentVatMode),
    formatVatMode(row.suggestedVatMode),
    row.reason
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function profileMatchesSearch(profile: ImportProfileSummary, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }
  return [
    profile.name,
    profile.supplierName,
    profile.filePattern,
    profile.sheetPattern,
    profile.expectedFileExtension,
    profile.supportsXlsx ? "xlsx" : "",
    profile.supportsXls ? "xls" : ""
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function progressPercentage(done: number, total: number) {
  if (total <= 0) {
    return 100;
  }
  return Math.round((done / total) * 100);
}

export default function ImportProfiles({ session }: ImportProfilesProps) {
  const [review, setReview] = useState<VatMappingReview | null>(null);
  const [profiles, setProfiles] = useState<ImportProfileSummary[]>([]);
  const [filter, setFilter] = useState<MappingFilter>("unresolved");
  const [searchTerm, setSearchTerm] = useState("");
  const [profileSearchTerm, setProfileSearchTerm] = useState("");
  const [profileStatusFilter, setProfileStatusFilter] = useState<ProfileStatusFilter>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingProfileStatus, setPendingProfileStatus] = useState<{
    profile: ImportProfileSummary;
    nextStatus: ImportProfileSummary["status"];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageProfiles = canManage(session.role);
  const searchQuery = searchTerm.trim().toLocaleLowerCase("nl-NL");
  const profileSearchQuery = profileSearchTerm.trim().toLocaleLowerCase("nl-NL");

  const searchedRows = useMemo(
    () => (review?.rows ?? []).filter((row) => rowMatchesSearch(row, searchQuery)),
    [review?.rows, searchQuery]
  );

  const visibleRows = useMemo(
    () => searchedRows.filter((row) => filterRow(row, filter)),
    [filter, searchedRows]
  );

  const groupedProfiles = useMemo(() => {
    const groups = new Map<string, VatMappingReviewRow[]>();
    for (const row of visibleRows) {
      const key = `${row.profileId}::${row.profileName}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    return [...groups.entries()]
      .map(([key, rows]) => ({
        key,
        profileId: rows[0].profileId,
        profileName: rows[0].profileName,
        supplier: rows[0].supplier,
        category: rows[0].category,
        sourceFileNamePattern: rows[0].sourceFileNamePattern,
        allowUnknownVatMode: rows[0].allowUnknownVatMode,
        rows
      }))
      .sort((left, right) => {
        const leftUnresolved = left.rows.filter(
          (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
        ).length;
        const rightUnresolved = right.rows.filter(
          (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
        ).length;

        if (leftUnresolved !== rightUnresolved) {
          return rightUnresolved - leftUnresolved;
        }

        return `${left.supplier} ${left.profileName}`.localeCompare(
          `${right.supplier} ${right.profileName}`,
          "nl-NL"
        );
      });
  }, [visibleRows]);

  const summary = useMemo(() => {
    const rows = review?.rows ?? [];
    return {
      unresolved: rows.filter((row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode).length,
      inclusive: rows.filter((row) => row.currentVatMode === "inclusive").length,
      exclusive: rows.filter((row) => row.currentVatMode === "exclusive").length,
      allowUnknown: rows.filter((row) => row.allowUnknownVatMode).length,
      reviewed: rows.filter((row) => Boolean(row.reviewedAt || row.reviewStatus === "reviewed")).length
    };
  }, [review?.rows]);

  const filterCounts = useMemo(
    () =>
      filters.reduce(
        (counts, item) => ({
          ...counts,
          [item.value]: countRowsForFilter(searchedRows, item.value)
        }),
        {} as Record<MappingFilter, number>
      ),
    [searchedRows]
  );

  const profileCounts = useMemo(
    () => ({
      total: profiles.length,
      active: profiles.filter((profile) => profile.status === "active").length,
      archived: profiles.filter((profile) => profile.status === "inactive").length
    }),
    [profiles]
  );

  const visibleProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => {
          const matchesStatus =
            profileStatusFilter === "all" ||
            (profileStatusFilter === "active"
              ? profile.status === "active"
              : profile.status === "inactive");

          return matchesStatus && profileMatchesSearch(profile, profileSearchQuery);
        })
        .sort((left, right) => {
          if (left.status !== right.status) {
            return left.status === "active" ? -1 : 1;
          }
          return `${left.supplierName} ${left.name}`.localeCompare(
            `${right.supplierName} ${right.name}`,
            "nl-NL"
          );
        }),
    [profileSearchQuery, profileStatusFilter, profiles]
  );

  const completedColumns = useMemo(
    () => (review?.totalPriceColumns ?? 0) - summary.unresolved,
    [review?.totalPriceColumns, summary.unresolved]
  );

  const completionPercentage = useMemo(
    () => progressPercentage(completedColumns, review?.totalPriceColumns ?? 0),
    [completedColumns, review?.totalPriceColumns]
  );

  const selectedVisibleRows = useMemo(
    () => visibleRows.filter((row) => selected[rowKey(row)]),
    [selected, visibleRows]
  );

  const highConfidenceOpen = useMemo(
    () =>
      (review?.rows ?? []).filter(
        (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode && row.confidence === "high"
      ).length,
    [review?.rows]
  );

  const carefulReviewOpen = useMemo(
    () =>
      (review?.rows ?? []).filter(
        (row) =>
          row.currentVatMode === "unknown" &&
          !row.allowUnknownVatMode &&
          (row.confidence === "low" || row.needsReview)
      ).length,
    [review?.rows]
  );

  const nextOpenProfile = useMemo(
    () =>
      groupedProfiles.find((profile) =>
        profile.rows.some((row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode)
      ),
    [groupedProfiles]
  );

  const hasUnresolvedVatChoices = useMemo(
    () => Boolean(review && summary.unresolved > 0),
    [review, summary.unresolved]
  );

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient();
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [result, profileResult] = await Promise.all([
        client.query(api.catalog.review.vatMappingReview, {
          tenantSlug: session.tenantId
        }) as Promise<VatMappingReview>,
        client.query(api.catalog.imports.listProfilesForPortal, {
          tenantSlug: session.tenantId
        }) as Promise<ImportProfileSummary[]>
      ]);

      setReview(result);
      setProfiles(profileResult);
    } catch (loadError) {
      console.error(loadError);
      setError("Btw-keuzes konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  async function updateVatMode(row: VatMappingReviewRow, value: VatMode) {
    const client = createConvexHttpClient();
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.review.updateProfileVatMode, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId: row.profileId,
        sourceColumnName: row.sourceColumnName,
        sourceColumnIndex: row.sourceColumnIndex,
        vatMode: value,
        updatedByExternalUserId: session.userId
      });
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Btw-keuze kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function bulkSetVatMode(
    profileId: string,
    selectedRows: VatMappingReviewRow[],
    vatMode: "inclusive" | "exclusive"
  ) {
    const client = createConvexHttpClient();
    if (!client || selectedRows.length === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.review.bulkUpdateProfileVatModes, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId,
        columns: selectedRows.map((row) => ({
          sourceColumnName: row.sourceColumnName,
          sourceColumnIndex: row.sourceColumnIndex
        })),
        vatMode,
        updatedByExternalUserId: session.userId
      });
      setSelected((current) => {
        const next = { ...current };
        for (const row of selectedRows) {
          next[rowKey(row)] = false;
        }
        return next;
      });
      setNotice(
        `${selectedRows.length} prijskolommen zijn op ${formatVatMode(vatMode).toLowerCase()} gezet.`
      );
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Btw-keuzes in één keer aanpassen kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markReviewed(rows: VatMappingReviewRow[]) {
    const selectedRows = rows.filter((row) => selected[rowKey(row)]);
    const client = createConvexHttpClient();
    if (!client || selectedRows.length === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.review.markProfileVatColumnsReviewed, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId: rows[0].profileId,
        columns: selectedRows.map((row) => ({
          sourceColumnName: row.sourceColumnName,
          sourceColumnIndex: row.sourceColumnIndex
        })),
        reviewedByExternalUserId: session.userId
      });
      setSelected((current) => {
        const next = { ...current };
        for (const row of selectedRows) {
          next[rowKey(row)] = false;
        }
        return next;
      });
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("De controle kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setAllowUnknown(profileId: string, allowUnknownVatMode: boolean) {
    const client = createConvexHttpClient();
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.review.setProfileAllowUnknownVatMode, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId,
        allowUnknownVatMode,
        updatedByExternalUserId: session.userId
      });
      setNotice(
        allowUnknownVatMode
          ? "Onbekende btw-keuze is toegestaan voor deze prijslijstcontrole."
          : "Onbekende btw-keuze is niet meer toegestaan voor deze prijslijstcontrole."
      );
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("De uitzondering kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProfileStatus() {
    if (!pendingProfileStatus || !canManageProfiles) {
      return;
    }

    const client = createConvexHttpClient();
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalog.imports.updateProfileStatusForPortal, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId: pendingProfileStatus.profile.id,
        status: pendingProfileStatus.nextStatus
      });
      setNotice(
        pendingProfileStatus.nextStatus === "inactive"
          ? "Importprofiel gearchiveerd."
          : "Importprofiel opnieuw actief gemaakt."
      );
      setPendingProfileStatus(null);
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Importprofielstatus kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingConfirmation) {
      return;
    }
    const pending = pendingConfirmation;
    setPendingConfirmation(null);

    if (pending.type === "bulkVatMode") {
      await bulkSetVatMode(pending.rows[0]?.profileId ?? "", pending.rows, pending.vatMode);
      return;
    }
    await setAllowUnknown(pending.profileId, pending.allowUnknownVatMode);
  }

  function requestBulkVatMode(
    profileName: string,
    rows: VatMappingReviewRow[],
    vatMode: "inclusive" | "exclusive"
  ) {
    const selectedRows = rows.filter((row) => selected[rowKey(row)]);
    if (selectedRows.length === 0) {
      return;
    }
    setPendingConfirmation({
      type: "bulkVatMode",
      rows: selectedRows,
      vatMode,
      profileName
    });
  }

  function requestAllowUnknown(profileId: string, profileName: string, allowUnknownVatMode: boolean) {
    if (!allowUnknownVatMode) {
      void setAllowUnknown(profileId, false);
      return;
    }
    setPendingConfirmation({
      type: "allowUnknown",
      profileId,
      profileName,
      allowUnknownVatMode
    });
  }

  const confirmTitle =
    pendingConfirmation?.type === "bulkVatMode"
      ? "Btw-keuze voor meerdere kolommen aanpassen?"
      : "Onbekende btw-keuze toestaan?";
  const confirmDescription =
    pendingConfirmation?.type === "bulkVatMode"
      ? `Je past ${pendingConfirmation.rows.length} prijskolommen in ${pendingConfirmation.profileName} tegelijk aan naar ${formatVatMode(
          pendingConfirmation.vatMode
        ).toLowerCase()}. Controleer of deze bedragen echt zo in het leverancierbestand bedoeld zijn.`
      : pendingConfirmation
        ? `Je staat een onbekende btw-keuze toe voor ${pendingConfirmation.profileName}. Dit is een bewuste uitzondering en houdt een waarschuwing zichtbaar.`
        : "";
  const confirmLabel =
    pendingConfirmation?.type === "bulkVatMode"
      ? "Aanpassen bevestigen"
      : "Uitzondering toestaan";

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingConfirmation)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        tone={pendingConfirmation?.type === "allowUnknown" ? "danger" : "warning"}
        isBusy={isSaving}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => void confirmPendingAction()}
      />

      <ConfirmDialog
        open={Boolean(pendingProfileStatus)}
        title={
          pendingProfileStatus?.nextStatus === "inactive"
            ? "Importprofiel archiveren?"
            : "Importprofiel opnieuw actief maken?"
        }
        description={
          pendingProfileStatus
            ? pendingProfileStatus.nextStatus === "inactive"
              ? `Je archiveert ${pendingProfileStatus.profile.name}. Het profiel wordt niet meer gebruikt voor nieuwe imports of btw-readiness, maar bestaande imports en controles blijven bewaard.`
              : `Je maakt ${pendingProfileStatus.profile.name} weer een actuele route. Controleer of het bestandsfilter niet overlapt met een nieuwer profiel.`
            : ""
        }
        confirmLabel={pendingProfileStatus?.nextStatus === "inactive" ? "Archiveren" : "Opnieuw activeren"}
        tone={pendingProfileStatus?.nextStatus === "inactive" ? "danger" : "warning"}
        isBusy={isSaving}
        onCancel={() => setPendingProfileStatus(null)}
        onConfirm={() => void updateProfileStatus()}
      />

      <VatWorkbenchHeader
        isLoading={isLoading}
        hasUnresolvedVatChoices={hasUnresolvedVatChoices}
        summary={summary}
        review={review}
        completionPercentage={completionPercentage}
      />

      {error ? (
        <Alert
          variant="danger"
          title="Btw-keuzes niet geladen"
          description={error}
          style={{ marginTop: 16 }}
        />
      ) : null}
      {notice ? (
        <Alert
          variant="success"
          title="Wijziging opgeslagen"
          description={notice}
          style={{ marginTop: 16 }}
        />
      ) : null}

      {review ? (
        <>
          <div className="vat-signal-row">
            <Badge variant={highConfidenceOpen > 0 ? "info" : "neutral"}>
              Hoog vertrouwen open: {numberText(highConfidenceOpen)}
            </Badge>
            <Badge variant={carefulReviewOpen > 0 ? "warning" : "success"}>
              Extra aandacht: {numberText(carefulReviewOpen)}
            </Badge>
            <span className="muted">
              {numberText(selectedVisibleRows.length)} van {numberText(visibleRows.length)} zichtbaar geselecteerd
            </span>
          </div>

          <div>
            <FilterBar
              search={
                <div className="search-input">
                  <Search className="search-input-icon" size={17} aria-hidden="true" />
                  <input
                    aria-label="Zoek in btw-keuzes"
                    className="search-input-control"
                    placeholder="Zoek leverancier, profiel, bestand of kolom"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
              }
              filters={
                <div className="import-filter-group">
                  <span className="import-filter-label">Weergave</span>
                  <div className="tabs vat-tabs">
                    {filters.map((item) => (
                      <button
                        className={filter === item.value ? "tab active" : "tab"}
                        key={item.value}
                        type="button"
                        aria-pressed={filter === item.value}
                        onClick={() => setFilter(item.value)}
                      >
                        <span>{item.label}</span>
                        <span className="vat-tab-count">{numberText(filterCounts[item.value] ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              }
              actions={<span className="muted">{numberText(visibleRows.length)} zichtbare kolommen</span>}
            />
          </div>

          <VatMappingGroups
            groupedProfiles={groupedProfiles}
            selected={selected}
            setSelected={setSelected}
            onUpdateVatMode={updateVatMode}
            onBulkSetVatMode={requestBulkVatMode}
            onMarkReviewed={markReviewed}
            onAllowUnknown={requestAllowUnknown}
            canManageProfiles={canManageProfiles}
            isSaving={isSaving}
          />
        </>
      ) : null}

      <ImportProfilesTable
        visibleProfiles={visibleProfiles}
        isLoading={isLoading}
        error={error}
        profileSearchTerm={profileSearchTerm}
        setProfileSearchTerm={setProfileSearchTerm}
        profileStatusFilter={profileStatusFilter}
        setProfileStatusFilter={setProfileStatusFilter}
        profileCounts={profileCounts}
        canManageProfiles={canManageProfiles}
        setPendingProfileStatus={setPendingProfileStatus}
      />
    </div>
  );
}
