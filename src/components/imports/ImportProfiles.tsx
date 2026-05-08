import {
  Archive,
  CheckCheck,
  CheckCircle2,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canManage, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatImportProfileStatus,
  formatPriceType,
  formatUnit,
  formatVatMode
} from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { FilterBar } from "../ui/FilterBar";
import { InlineHelp } from "../ui/InlineHelp";
import { StatusBadge } from "../ui/StatusBadge";
import { Select } from "../ui/Select";

type ImportProfilesProps = {
  session: AppSession;
};

type VatMode = "inclusive" | "exclusive" | "unknown";
type MappingFilter = "all" | "unresolved" | "inclusive" | "exclusive" | "unknown" | "allowUnknown";
type ProfileStatusFilter = "all" | "active" | "archived";

type VatMappingReviewRow = {
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

type VatMappingReview = {
  totalProfiles: number;
  totalPriceColumns: number;
  resolvedColumns: number;
  unresolvedColumns: number;
  allowUnknownColumns: number;
  rows: VatMappingReviewRow[];
};

type ImportProfileSummary = {
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

function confidenceVariant(confidence: VatMappingReviewRow["confidence"]): BadgeVariant {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "warning";
  }

  return "danger";
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
    formatPriceType(row.detectedPriceType),
    formatUnit(row.detectedUnit),
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
    profile.supportsXls ? "xls" : "",
    formatImportProfileStatus(profile.status)
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function progressPercentage(done: number, total: number) {
  if (total <= 0) {
    return 100;
  }

  return Math.round((done / total) * 100);
}

function shortReason(value: string) {
  return value.length > 96 ? `${value.slice(0, 94).trim()}...` : value;
}

function formatConfidence(confidence: VatMappingReviewRow["confidence"]) {
  if (confidence === "high") {
    return "hoog";
  }

  if (confidence === "medium") {
    return "middel";
  }

  return "laag";
}

function formatVatChoiceLabel(vatMode: VatMode) {
  if (vatMode === "unknown") {
    return "Nog kiezen";
  }

  return formatVatMode(vatMode);
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
      unresolved: rows.filter((row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode)
        .length,
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

  const completedColumns = (review?.totalPriceColumns ?? 0) - summary.unresolved;
  const completionPercentage = progressPercentage(completedColumns, review?.totalPriceColumns ?? 0);
  const selectedVisibleRows = visibleRows.filter((row) => selected[rowKey(row)]);
  const highConfidenceOpen = (review?.rows ?? []).filter(
    (row) =>
      row.currentVatMode === "unknown" &&
      !row.allowUnknownVatMode &&
      row.confidence === "high"
  ).length;
  const carefulReviewOpen = (review?.rows ?? []).filter(
    (row) =>
      row.currentVatMode === "unknown" &&
      !row.allowUnknownVatMode &&
      (row.confidence === "low" || row.needsReview)
  ).length;
  const nextOpenProfile = groupedProfiles.find((profile) =>
    profile.rows.some((row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode)
  );
  const hasUnresolvedVatChoices = Boolean(review && summary.unresolved > 0);

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
        client.query(api.catalogReview.vatMappingReview, {
          tenantSlug: session.tenantId
        }) as Promise<VatMappingReview>,
        client.query(api.imports.listProfilesForPortal, {
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

  function selectedRowsForProfile(rows: VatMappingReviewRow[]) {
    return rows.filter((row) => selected[rowKey(row)]);
  }

  function setProfileSelection(rows: VatMappingReviewRow[], checked: boolean) {
    setSelected((current) => {
      const next = { ...current };

      for (const row of rows) {
        next[rowKey(row)] = checked;
      }

      return next;
    });
  }

  async function updateVatMode(row: VatMappingReviewRow, value: VatMode) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.updateProfileVatMode, {
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
      await client.mutation(api.catalogReview.bulkUpdateProfileVatModes, {
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
      setProfileSelection(selectedRows, false);
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
    const selectedRows = selectedRowsForProfile(rows);
    const client = createConvexHttpClient();

    if (!client || selectedRows.length === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.markProfileVatColumnsReviewed, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        profileId: rows[0].profileId,
        columns: selectedRows.map((row) => ({
          sourceColumnName: row.sourceColumnName,
          sourceColumnIndex: row.sourceColumnIndex
        })),
        reviewedByExternalUserId: session.userId
      });
      setProfileSelection(selectedRows, false);
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
      await client.mutation(api.catalogReview.setProfileAllowUnknownVatMode, {
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
      await client.mutation(api.imports.updateProfileStatusForPortal, {
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
    const selectedRows = selectedRowsForProfile(rows);

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
  const profileColumns: Array<DataTableColumn<ImportProfileSummary>> = [
    {
      key: "profile",
      header: "Importprofiel",
      priority: "primary",
      render: (profile) => (
        <div className="stack-sm">
          <strong>{profile.name}</strong>
          <small className="muted">{profile.supplierName}</small>
          <small className="muted">
            {profile.status === "inactive"
              ? "Niet gebruikt voor nieuwe import of btw-readiness."
              : "Wordt gebruikt als actuele import- en btw-route."}
          </small>
        </div>
      )
    },
    {
      key: "pattern",
      header: "Bestand",
      render: (profile) => (
        <div className="stack-sm">
          <span>{profile.filePattern ?? "Geen bestandsfilter"}</span>
          <small className="muted">{profile.sheetPattern ?? "Alle tabbladen"}</small>
        </div>
      )
    },
    {
      key: "support",
      header: "Ondersteuning",
      width: "150px",
      render: (profile) => (
        <div className="toolbar">
          {profile.supportsXlsx ? <Badge variant="neutral">xlsx</Badge> : null}
          {profile.supportsXls ? <Badge variant="neutral">xls</Badge> : null}
          {profile.expectedFileExtension ? (
            <Badge variant="info">{profile.expectedFileExtension}</Badge>
          ) : null}
        </div>
      )
    },
    {
      key: "status",
      header: "Gebruik",
      width: "170px",
      render: (profile) => (
        <StatusBadge
          status={profile.status}
          label={formatImportProfileStatus(profile.status)}
          variant={profile.status === "inactive" ? "neutral" : "success"}
        />
      )
    },
    {
      key: "actions",
      header: "Acties",
      width: "150px",
      render: (profile) =>
        canManageProfiles ? (
          profile.status === "inactive" ? (
            <Button
              leftIcon={<RotateCcw size={16} aria-hidden="true" />}
              onClick={() => setPendingProfileStatus({ profile, nextStatus: "active" })}
              size="sm"
              variant="secondary"
            >
              Activeren
            </Button>
          ) : (
            <Button
              leftIcon={<Archive size={16} aria-hidden="true" />}
              onClick={() => setPendingProfileStatus({ profile, nextStatus: "inactive" })}
              size="sm"
              variant="danger"
            >
              Archiveren
            </Button>
          )
        ) : null
    }
  ];

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

      <section
        className={
          hasUnresolvedVatChoices ? "panel vat-workbench vat-workbench-blocked" : "panel vat-workbench"
        }
      >
        <div className="toolbar vat-workbench-titlebar">
          <div>
            <p className="eyebrow">Btw-werkbank</p>
            <h2 className="vat-workbench-title">
              {isLoading
                ? "Btw-keuzes laden"
                : hasUnresolvedVatChoices
                  ? `${numberText(summary.unresolved)} prijskolommen vragen nog een keuze`
                  : "Alle prijskolommen hebben een btw-keuze"}
            </h2>
            <p className="muted vat-workbench-copy">
              {isLoading
                ? "De controles worden opgehaald."
                : `${numberText(review?.totalProfiles ?? 0)} importprofielen met ${numberText(
                    review?.totalPriceColumns ?? 0
                  )} prijskolommen.`}
            </p>
          </div>
          <div className="toolbar">
            <Badge
              variant={isLoading || !review ? "neutral" : hasUnresolvedVatChoices ? "danger" : "success"}
              icon={
                isLoading || !review ? (
                  <RefreshCw size={14} aria-hidden="true" />
                ) : hasUnresolvedVatChoices ? (
                  <ShieldAlert size={14} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} aria-hidden="true" />
                )
              }
            >
              {isLoading || !review ? "Laden" : hasUnresolvedVatChoices ? "Import geblokkeerd" : "Btw gereed"}
            </Badge>
            <Button
              leftIcon={<RefreshCw size={17} aria-hidden="true" />}
              variant="secondary"
              onClick={() => void loadReview()}
            >
              Verversen
            </Button>
          </div>
        </div>
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
            <div className="vat-progress-layout">
              <div className="vat-progress-block">
                <div className="toolbar vat-progress-heading">
                  <span className="muted">Voortgang</span>
                  <strong>{completionPercentage}%</strong>
                </div>
                <div
                  className="vat-progress-track"
                  aria-label={`${completionPercentage}% btw-keuzes afgerond`}
                >
                  <span style={{ width: `${completionPercentage}%` }} />
                </div>
                <div className="vat-progress-meta">
                  <span>{numberText(completedColumns)} afgerond</span>
                  <span>{numberText(review.totalPriceColumns)} totaal</span>
                </div>
              </div>
              <div className="vat-next-block">
                <p className="eyebrow">Nu eerst</p>
                <strong>
                  {summary.unresolved === 0
                    ? "Geen btw-blokkades open"
                    : nextOpenProfile
                      ? nextOpenProfile.profileName
                      : "Open de filter Te beoordelen"}
                </strong>
                <p className="muted">
                  {summary.unresolved === 0
                    ? "De importstraat kan verder zodra de overige productcontroles ook akkoord zijn."
                    : nextOpenProfile
                      ? `${numberText(
                          nextOpenProfile.rows.filter(
                            (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
                          ).length
                        )} open keuzes in dit profiel.`
                      : "Er zijn nog open keuzes, maar ze vallen buiten de huidige weergave."}
                </p>
              </div>
            </div>

            <div className="vat-summary-strip" aria-label="Samenvatting btw-keuzes">
              <div className="vat-summary-item vat-summary-danger">
                <span>Te beoordelen</span>
                <strong>{numberText(summary.unresolved)}</strong>
              </div>
              <div className="vat-summary-item vat-summary-success">
                <span>Inclusief btw</span>
                <strong>{numberText(summary.inclusive)}</strong>
              </div>
              <div className="vat-summary-item vat-summary-success">
                <span>Exclusief btw</span>
                <strong>{numberText(summary.exclusive)}</strong>
              </div>
              <div className="vat-summary-item vat-summary-warning">
                <span>Uitzonderingen</span>
                <strong>{numberText(summary.allowUnknown)}</strong>
              </div>
              <div className="vat-summary-item">
                <span>Beoordeeld</span>
                <strong>{numberText(summary.reviewed)}</strong>
              </div>
            </div>

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
                    {searchTerm ? (
                      <button
                        aria-label="Zoekopdracht wissen"
                        className="ui-icon-button ui-icon-button-ghost ui-icon-button-sm search-input-clear"
                        type="button"
                        onClick={() => setSearchTerm("")}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                }
                filters={
                  <>
                    <Badge icon={<Filter size={14} aria-hidden="true" />}>Weergave</Badge>
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
                  </>
                }
                actions={
                  <span className="muted">{numberText(visibleRows.length)} zichtbare kolommen</span>
                }
              />
            </div>
          </>
        ) : null}
      </section>

      {groupedProfiles.map((profile) => {
        const selectedRows = selectedRowsForProfile(profile.rows);
        const allVisibleSelected =
          profile.rows.length > 0 && profile.rows.every((row) => selected[rowKey(row)]);
        const profileUnresolved = profile.rows.filter(
          (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
        ).length;
        const profileResolved = profile.rows.length - profileUnresolved;
        const profileReviewed = profile.rows.filter((row) =>
          Boolean(row.reviewedAt || row.reviewStatus === "reviewed")
        ).length;
        const profileProgress = progressPercentage(profileResolved, profile.rows.length);
        const columns: Array<DataTableColumn<VatMappingReviewRow>> = [
          {
            key: "select",
            header: "Kies",
            width: "64px",
            render: (row) => (
              <Checkbox
                aria-label={`Selecteer ${row.sourceColumnName} uit ${row.profileName}`}
                checked={selected[rowKey(row)] ?? false}
                onChange={(event) =>
                  setSelected((current) => ({
                    ...current,
                    [rowKey(row)]: event.target.checked
                  }))
                }
              />
            )
          },
          {
            key: "source",
            header: "Kolom",
            width: "170px",
            render: (row) => (
              <div className="stack-sm">
                <strong>{row.sourceColumnName}</strong>
                <small className="muted">Kolom {row.sourceColumnIndex + 1}</small>
              </div>
            )
          },
          {
            key: "context",
            header: "Type",
            width: "140px",
            render: (row) => (
              <div className="vat-row-meta">
                <Badge variant="neutral">{formatPriceType(row.detectedPriceType)}</Badge>
                <small className="muted">{formatUnit(row.detectedUnit)}</small>
              </div>
            )
          },
          {
            key: "current",
            header: "Btw-keuze",
            width: "170px",
            render: (row) => (
              <div className="vat-mode-control">
                <Select
                  aria-label={`Btw-keuze voor ${row.sourceColumnName}`}
                  className={`vat-mode-select vat-mode-select-${row.currentVatMode}`}
                  value={row.currentVatMode}
                  disabled={isSaving}
                  onChange={(event) => void updateVatMode(row, event.target.value as VatMode)}
                >
                  <option value="unknown">{formatVatChoiceLabel("unknown")}</option>
                  <option value="inclusive">{formatVatChoiceLabel("inclusive")}</option>
                  <option value="exclusive">{formatVatChoiceLabel("exclusive")}</option>
                </Select>
              </div>
            )
          },
          {
            key: "suggestion",
            header: "Voorstel",
            width: "130px",
            render: (row) => (
              <div className="vat-suggestion">
                <strong>{formatVatMode(row.suggestedVatMode)}</strong>
                <Badge variant={confidenceVariant(row.confidence)}>
                  {formatConfidence(row.confidence)}
                </Badge>
              </div>
            )
          },
          {
            key: "reason",
            header: "Controle",
            hideOnMobile: true,
            render: (row) => (
              <div className="stack-sm">
                {row.needsReview ? (
                  <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
                    Controle vereist
                  </Badge>
                ) : (
                  <Badge variant="success">Akkoord</Badge>
                )}
                <small className="muted">
                  <InlineHelp title={row.reason}>{shortReason(row.reason)}</InlineHelp>
                </small>
              </div>
            )
          },
          {
            key: "reviewed",
            header: "Beoordeeld",
            width: "96px",
            render: (row) =>
              row.reviewedAt || row.reviewStatus === "reviewed" ? (
                <Badge variant="success">Beoordeeld</Badge>
              ) : (
                <Badge variant="neutral">Open</Badge>
              )
          }
        ];

        return (
          <section
            className={
              profileUnresolved > 0 ? "panel vat-profile-panel vat-profile-needs-work" : "panel vat-profile-panel"
            }
            key={profile.key}
          >
            <div className="vat-profile-header">
              <div className="vat-profile-heading">
                <div className="toolbar">
                  <Badge variant={profileUnresolved > 0 ? "danger" : "success"}>
                    {profileUnresolved > 0 ? "Actie nodig" : "Compleet"}
                  </Badge>
                  <strong className="vat-profile-title">{profile.profileName}</strong>
                </div>
                <p className="muted">
                  {[
                    profile.supplier,
                    profile.category,
                    profile.sourceFileNamePattern ? `Bestand: ${profile.sourceFileNamePattern}` : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div
                  className="vat-progress-track vat-profile-progress"
                  aria-label={`${profileProgress}% van dit importprofiel afgerond`}
                >
                  <span style={{ width: `${profileProgress}%` }} />
                </div>
                <div className="toolbar">
                  <Badge variant={profileUnresolved > 0 ? "danger" : "success"}>
                    Te beoordelen {numberText(profileUnresolved)}
                  </Badge>
                  <Badge variant="success">Afgerond {numberText(profileResolved)}</Badge>
                  <Badge variant={profileReviewed > 0 ? "info" : "neutral"}>
                    Beoordeeld {numberText(profileReviewed)}
                  </Badge>
                  <Badge variant={profile.allowUnknownVatMode ? "warning" : "success"}>
                    {profile.allowUnknownVatMode ? "Onbekende btw toegestaan" : "Btw-keuze verplicht"}
                  </Badge>
                </div>
              </div>
              <div className="vat-profile-actions">
                <label className="vat-exception-toggle">
                  <Checkbox
                    aria-label={`Sta onbekende btw-keuze toe voor ${profile.profileName}`}
                    checked={profile.allowUnknownVatMode}
                    disabled={isSaving}
                    onChange={(event) =>
                      requestAllowUnknown(profile.profileId, profile.profileName, event.target.checked)
                    }
                  />
                  <span>Onbekend toestaan</span>
                </label>
                <Button
                  variant="secondary"
                  disabled={isSaving}
                  onClick={() => setProfileSelection(profile.rows, !allVisibleSelected)}
                >
                  {allVisibleSelected ? "Deselecteer zichtbaar" : "Selecteer zichtbaar"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => requestBulkVatMode(profile.profileName, profile.rows, "inclusive")}
                >
                  Zet inclusief
                </Button>
                <Button
                  variant="secondary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => requestBulkVatMode(profile.profileName, profile.rows, "exclusive")}
                >
                  Zet exclusief
                </Button>
                <Button
                  variant="primary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => void markReviewed(profile.rows)}
                  leftIcon={<CheckCheck size={17} aria-hidden="true" />}
                >
                  Beoordeeld
                </Button>
                <span className="vat-selected-count">{numberText(selectedRows.length)} geselecteerd</span>
              </div>
            </div>

            <DataTable
              rows={profile.rows}
              columns={columns}
              getRowKey={rowKey}
              density="compact"
              ariaLabel={`Btw-keuzes voor ${profile.profileName}`}
              emptyTitle="Geen prijskolommen in deze controle"
              mobileMode="cards"
              renderMobileCard={(row) => (
                <>
                  <div className="mobile-card-header">
                    <div className="mobile-card-title">
                      <strong>{row.sourceColumnName}</strong>
                      <small className="muted">Kolom {row.sourceColumnIndex + 1}</small>
                    </div>
                    <Checkbox
                      aria-label={`Selecteer ${row.sourceColumnName} uit ${row.profileName}`}
                      checked={selected[rowKey(row)] ?? false}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [rowKey(row)]: event.target.checked
                        }))
                      }
                    />
                  </div>
                  <div className="mobile-card-meta">
                    <Badge variant="neutral">{formatPriceType(row.detectedPriceType)}</Badge>
                    <Badge variant="neutral">{formatUnit(row.detectedUnit)}</Badge>
                    <Badge variant={confidenceVariant(row.confidence)}>
                      Voorstel {formatVatMode(row.suggestedVatMode).toLowerCase()}
                    </Badge>
                  </div>
                  <div className="mobile-card-section">
                    <p className="mobile-card-section-label">Btw-keuze</p>
                    <Select
                      aria-label={`Btw-keuze voor ${row.sourceColumnName}`}
                      className={`vat-mode-select vat-mode-select-${row.currentVatMode}`}
                      value={row.currentVatMode}
                      disabled={isSaving}
                      onChange={(event) => void updateVatMode(row, event.target.value as VatMode)}
                    >
                      <option value="unknown">{formatVatChoiceLabel("unknown")}</option>
                      <option value="inclusive">{formatVatChoiceLabel("inclusive")}</option>
                      <option value="exclusive">{formatVatChoiceLabel("exclusive")}</option>
                    </Select>
                  </div>
                  <div className="mobile-card-section">
                    <p className="mobile-card-section-label">Controle</p>
                    <div className="stack-sm">
                      {row.needsReview ? (
                        <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
                          Controle vereist
                        </Badge>
                      ) : (
                        <Badge variant="success">Akkoord</Badge>
                      )}
                      <small className="muted">
                        <InlineHelp title={row.reason}>{shortReason(row.reason)}</InlineHelp>
                      </small>
                    </div>
                  </div>
                </>
              )}
            />
          </section>
        );
      })}

      {!isLoading && groupedProfiles.length === 0 ? (
        <section className="panel">
          <div className="empty-state">Geen prijskolommen gevonden voor deze keuze.</div>
        </section>
      ) : null}

      <section className="panel vat-profile-admin">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Beheer</p>
            <h2 style={{ margin: 0 }}>Importprofielen</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Actuele routes worden gebruikt voor nieuwe imports en btw-readiness. Gearchiveerde profielen
              blijven bewaard als oude of vervangen routes.
            </p>
          </div>
          <div className="toolbar">
            <Badge variant="success">{numberText(profileCounts.active)} actueel</Badge>
            <Badge variant="neutral">{numberText(profileCounts.archived)} gearchiveerd</Badge>
          </div>
        </div>
        <div className="vat-profile-admin-filters">
          <FilterBar
            search={
              <div className="search-input">
                <Search className="search-input-icon" size={17} aria-hidden="true" />
                <input
                  aria-label="Zoek in importprofielen"
                  className="search-input-control"
                  placeholder="Zoek profiel, leverancier, bestand of tabblad"
                  type="search"
                  value={profileSearchTerm}
                  onChange={(event) => setProfileSearchTerm(event.target.value)}
                />
                {profileSearchTerm ? (
                  <button
                    aria-label="Zoekopdracht voor importprofielen wissen"
                    className="ui-icon-button ui-icon-button-ghost ui-icon-button-sm search-input-clear"
                    type="button"
                    onClick={() => setProfileSearchTerm("")}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            }
            filters={
              <div className="tabs vat-tabs">
                {[
                  { value: "active" as const, label: "Actueel", count: profileCounts.active },
                  { value: "archived" as const, label: "Gearchiveerd", count: profileCounts.archived },
                  { value: "all" as const, label: "Alle", count: profileCounts.total }
                ].map((item) => (
                  <button
                    className={profileStatusFilter === item.value ? "tab active" : "tab"}
                    key={item.value}
                    type="button"
                    aria-pressed={profileStatusFilter === item.value}
                    onClick={() => setProfileStatusFilter(item.value)}
                  >
                    <span>{item.label}</span>
                    <span className="vat-tab-count">{numberText(item.count)}</span>
                  </button>
                ))}
              </div>
            }
            actions={
              <span className="muted">{numberText(visibleProfiles.length)} zichtbare profielen</span>
            }
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <DataTable
            ariaLabel="Importprofielen"
            columns={profileColumns}
            density="compact"
            emptyDescription="Pas de zoekterm of statusfilter aan om meer profielen te tonen."
            emptyTitle="Geen importprofielen gevonden"
            getRowKey={(profile) => profile.id}
            loading={isLoading}
            rows={visibleProfiles}
          />
        </div>
      </section>
    </div>
  );
}
