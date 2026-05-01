import { CheckCheck, Filter, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
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
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";

type ImportProfilesProps = {
  session: AppSession;
};

type VatMode = "inclusive" | "exclusive" | "unknown";
type MappingFilter = "all" | "unresolved" | "inclusive" | "exclusive" | "unknown" | "allowUnknown";

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
  { value: "unknown", label: "Btw onbekend" },
  { value: "allowUnknown", label: "Uitzondering" },
  { value: "all", label: "Alle" }
];

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

export default function ImportProfiles({ session }: ImportProfilesProps) {
  const [review, setReview] = useState<VatMappingReview | null>(null);
  const [filter, setFilter] = useState<MappingFilter>("unresolved");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRows = useMemo(
    () => (review?.rows ?? []).filter((row) => filterRow(row, filter)),
    [filter, review?.rows]
  );

  const groupedProfiles = useMemo(() => {
    const groups = new Map<string, VatMappingReviewRow[]>();

    for (const row of visibleRows) {
      const key = `${row.profileId}::${row.profileName}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    return [...groups.entries()].map(([key, rows]) => ({
      key,
      profileId: rows[0].profileId,
      profileName: rows[0].profileName,
      supplier: rows[0].supplier,
      category: rows[0].category,
      sourceFileNamePattern: rows[0].sourceFileNamePattern,
      allowUnknownVatMode: rows[0].allowUnknownVatMode,
      rows
    }));
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

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.catalogReview.vatMappingReview, {
        tenantSlug: session.tenantId
      })) as VatMappingReview;

      setReview(result);
    } catch (loadError) {
      console.error(loadError);
      setError("Btw-mapping kon niet worden geladen.");
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
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.updateProfileVatMode, {
        tenantSlug: session.tenantId,
        profileId: row.profileId,
        sourceColumnName: row.sourceColumnName,
        sourceColumnIndex: row.sourceColumnIndex,
        vatMode: value,
        updatedByExternalUserId: session.userId
      });
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Btw-mapping kon niet worden opgeslagen.");
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
      setError("Btw-mapping in één keer aanpassen kon niet worden opgeslagen.");
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
      setError("Beoordelingsstatus kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setAllowUnknown(profileId: string, allowUnknownVatMode: boolean) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.setProfileAllowUnknownVatMode, {
        tenantSlug: session.tenantId,
        profileId,
        allowUnknownVatMode,
        updatedByExternalUserId: session.userId
      });
      setNotice(
        allowUnknownVatMode
          ? "Onbekende btw-modus is toegestaan voor dit profiel."
          : "Onbekende btw-modus is niet meer toegestaan voor dit profiel."
      );
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Uitzondering voor profiel kon niet worden opgeslagen.");
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
      ? "Btw-mapping voor meerdere kolommen aanpassen?"
      : "Onbekende btw-modus toestaan?";
  const confirmDescription =
    pendingConfirmation?.type === "bulkVatMode"
      ? `Je past ${pendingConfirmation.rows.length} prijskolommen in ${pendingConfirmation.profileName} tegelijk aan naar ${formatVatMode(
          pendingConfirmation.vatMode
        ).toLowerCase()}. Controleer of deze bedragen echt zo in de bron bedoeld zijn.`
      : pendingConfirmation
        ? `Je staat een onbekende btw-modus toe voor ${pendingConfirmation.profileName}. Dit is een bewuste uitzondering en houdt een waarschuwing zichtbaar.`
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

      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div className="toolbar">
            <Badge>Importprofielen</Badge>
            <span className="muted">
              {isLoading
                ? "Bezig met laden..."
                : `${numberText(review?.totalProfiles ?? 0)} profielen / ${numberText(
                    review?.totalPriceColumns ?? 0
              )} prijskolommen`}
            </span>
          </div>
          <Button
            leftIcon={<RefreshCw size={17} aria-hidden="true" />}
            variant="secondary"
            onClick={() => void loadReview()}
          >
            Verversen
          </Button>
        </div>
        {error ? (
          <Alert
            variant="danger"
            title="Btw-mapping niet geladen"
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
            <div className="grid three-column" style={{ marginTop: 16 }}>
              <StatCard
                label="Btw-mappings te beoordelen"
                value={numberText(summary.unresolved)}
                tone={summary.unresolved > 0 ? "danger" : "success"}
              />
              <StatCard
                label="Inclusief btw"
                value={numberText(summary.inclusive)}
                tone="success"
              />
              <StatCard
                label="Exclusief btw"
                value={numberText(summary.exclusive)}
                tone="success"
              />
            </div>
            <div className="grid three-column" style={{ marginTop: 16 }}>
              <StatCard
                label="Uitzonderingen onbekende btw"
                value={numberText(summary.allowUnknown)}
                tone={summary.allowUnknown > 0 ? "warning" : "neutral"}
              />
              <StatCard label="Beoordeeld" value={numberText(summary.reviewed)} tone="info" />
              <StatCard
                label="Totaal prijskolommen"
                value={numberText(review.totalPriceColumns)}
                tone="neutral"
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <FilterBar
                filters={
                  <>
                    <Badge icon={<Filter size={14} aria-hidden="true" />}>Filteren</Badge>
                    <div className="tabs">
                      {filters.map((item) => (
                        <button
                          className={filter === item.value ? "tab active" : "tab"}
                          key={item.value}
                          type="button"
                          onClick={() => setFilter(item.value)}
                        >
                          {item.label}
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
        const columns: Array<DataTableColumn<VatMappingReviewRow>> = [
          {
            key: "select",
            header: "Selectie",
            width: "90px",
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
            key: "profile",
            header: "Profiel",
            render: (row) => (
              <>
                <strong>{row.profileName}</strong>
                <div className="muted">{row.supplier}</div>
                <div className="muted">{row.category}</div>
              </>
            )
          },
          {
            key: "source",
            header: "Bronkolom",
            render: (row) => (
              <>
                <strong>{row.sourceColumnName}</strong>
                <div className="muted">kolomindex {row.sourceColumnIndex}</div>
              </>
            )
          },
          {
            key: "priceType",
            header: "Prijstype",
            width: "120px",
            render: (row) => formatPriceType(row.detectedPriceType)
          },
          {
            key: "unit",
            header: "Eenheid",
            width: "90px",
            render: (row) => formatUnit(row.detectedUnit)
          },
          {
            key: "current",
            header: "Huidig",
            width: "150px",
            render: (row) => (
              <Select
                aria-label={`Btw-modus voor ${row.sourceColumnName}`}
                value={row.currentVatMode}
                disabled={isSaving}
                onChange={(event) => void updateVatMode(row, event.target.value as VatMode)}
              >
                <option value="unknown">{formatVatMode("unknown")}</option>
                <option value="inclusive">{formatVatMode("inclusive")}</option>
                <option value="exclusive">{formatVatMode("exclusive")}</option>
              </Select>
            )
          },
          {
            key: "suggestion",
            header: "Suggestie",
            width: "130px",
            render: (row) => (
              <>
                <Badge variant={confidenceVariant(row.confidence)}>
                  {formatConfidence(row.confidence)}
                </Badge>
                <div className="muted">{formatVatMode(row.suggestedVatMode)}</div>
              </>
            )
          },
          {
            key: "reason",
            header: "Reden",
            hideOnMobile: true,
            render: (row) => (
              <>
                {row.needsReview ? (
                  <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
                    Controle vereist
                  </Badge>
                ) : (
                  <Badge variant="success">Akkoord</Badge>
                )}
                <div className="muted">
                  <InlineHelp title={row.reason}>{shortReason(row.reason)}</InlineHelp>
                </div>
              </>
            )
          },
          {
            key: "reviewed",
            header: "Beoordeeld",
            width: "110px",
            render: (row) =>
              row.reviewedAt || row.reviewStatus === "reviewed" ? (
                <Badge variant="success">Beoordeeld</Badge>
              ) : (
                <Badge variant="neutral">Open</Badge>
              )
          },
          {
            key: "updated",
            header: "Bijgewerkt / beoordeeld",
            hideOnMobile: true,
            render: (row) => (
              <>
                <div>Bijgewerkt {dateText(row.updatedAt)}</div>
                <div className="muted">{row.updatedByExternalUserId ?? "-"}</div>
                <div>Beoordeeld {dateText(row.reviewedAt)}</div>
                <div className="muted">{row.reviewedByExternalUserId ?? "-"}</div>
              </>
            )
          }
        ];

        return (
          <section className="grid" key={profile.key}>
            <div className="panel toolbar" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{profile.profileName}</strong>
                <div className="muted">
                  {profile.supplier} · {profile.category} · {profile.sourceFileNamePattern ?? "-"}
                </div>
                <div className="toolbar" style={{ marginTop: 8 }}>
                  <Badge variant={profileUnresolved > 0 ? "danger" : "success"}>
                    Te beoordelen {numberText(profileUnresolved)}
                  </Badge>
                  <Badge variant="success">Afgerond {numberText(profileResolved)}</Badge>
                  <Badge variant={profileReviewed > 0 ? "info" : "neutral"}>
                    Beoordeeld {numberText(profileReviewed)}
                  </Badge>
                  <Badge variant={profile.allowUnknownVatMode ? "warning" : "success"}>
                    {profile.allowUnknownVatMode
                      ? "Onbekende btw-modus toegestaan"
                      : "Onbekende btw-modus geblokkeerd"}
                  </Badge>
                </div>
              </div>
              <div className="toolbar">
                <div className="toolbar" style={{ gap: 8 }}>
                  <Checkbox
                    aria-label={`Sta onbekende btw-modus toe voor ${profile.profileName}`}
                    checked={profile.allowUnknownVatMode}
                    disabled={isSaving}
                    onChange={(event) =>
                      requestAllowUnknown(profile.profileId, profile.profileName, event.target.checked)
                    }
                  />
                  <Badge variant={profile.allowUnknownVatMode ? "warning" : "success"}>
                    Onbekende btw-modus
                  </Badge>
                </div>
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
                  Inclusief btw
                </Button>
                <Button
                  variant="secondary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => requestBulkVatMode(profile.profileName, profile.rows, "exclusive")}
                >
                  Exclusief btw
                </Button>
                <Button
                  variant="primary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => void markReviewed(profile.rows)}
                  leftIcon={<CheckCheck size={17} aria-hidden="true" />}
                >
                  Markeer beoordeeld
                </Button>
                <span className="muted">{numberText(selectedRows.length)} geselecteerd</span>
              </div>
            </div>

            <DataTable
              rows={profile.rows}
              columns={columns}
              getRowKey={rowKey}
              density="compact"
              ariaLabel={`Btw-mapping voor ${profile.profileName}`}
              emptyTitle="Geen prijskolommen in dit profiel"
            />
          </section>
        );
      })}

      {!isLoading && groupedProfiles.length === 0 ? (
        <section className="panel">
          <div className="empty-state">Geen prijskolommen gevonden voor dit filter.</div>
        </section>
      ) : null}
    </div>
  );
}
