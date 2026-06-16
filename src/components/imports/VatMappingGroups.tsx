import { CheckCheck, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import type { VatMappingReviewRow, VatMode } from "./ImportProfiles";
import { formatPriceType, formatVatMode, formatUnit } from "../../lib/i18n/statusLabels";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { Checkbox } from "../ui/forms/Checkbox";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { InlineHelp } from "../ui/feedback/InlineHelp";
import { Select } from "../ui/forms/Select";
import { numberText, rowKey, progressPercentage } from "./import/importUtils";

type VatMappingGroupsProps = {
  groupedProfiles: Array<{
    key: string;
    profileId: string;
    profileName: string;
    supplier: string;
    category: string;
    sourceFileNamePattern?: string;
    allowUnknownVatMode: boolean;
    rows: VatMappingReviewRow[];
  }>;
  selected: Record<string, boolean>;
  setSelected: (value: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void;
  onUpdateVatMode: (row: VatMappingReviewRow, value: VatMode) => void;
  onBulkSetVatMode: (profileName: string, rows: VatMappingReviewRow[], vatMode: "inclusive" | "exclusive") => void;
  onMarkReviewed: (rows: VatMappingReviewRow[]) => void;
  onAllowUnknown: (profileId: string, profileName: string, allowUnknownVatMode: boolean) => void;
  isSaving: boolean;
};

function confidenceVariant(confidence: VatMappingReviewRow["confidence"]): BadgeVariant {
  if (confidence === "high") {
    return "success";
  }
  if (confidence === "medium") {
    return "warning";
  }
  return "danger";
}


function shortReason(value: string) {
  return value.length > 96 ? `${value.slice(0, 94).trim()}...` : value;
}

function formatConfidenceLabel(confidence: VatMappingReviewRow["confidence"]) {
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

export function VatMappingGroups({
  groupedProfiles,
  selected,
  setSelected,
  onUpdateVatMode,
  onBulkSetVatMode,
  onMarkReviewed,
  onAllowUnknown,
  isSaving
}: VatMappingGroupsProps) {
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

  const columnsBase: Array<DataTableColumn<VatMappingReviewRow>> = useMemo(
    () => [
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
              onChange={(event) => onUpdateVatMode(row, event.target.value as VatMode)}
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
              {formatConfidenceLabel(row.confidence)}
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
    ],
    [selected, isSaving, onUpdateVatMode, setSelected]
  );

  return (
    <>
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

        return (
          <section
            className={
              profileUnresolved > 0
                ? "panel vat-profile-panel vat-profile-needs-work"
                : "panel vat-profile-panel"
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
                      onAllowUnknown(profile.profileId, profile.profileName, event.target.checked)
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
                  onClick={() => onBulkSetVatMode(profile.profileName, profile.rows, "inclusive")}
                >
                  Zet inclusief
                </Button>
                <Button
                  variant="secondary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => onBulkSetVatMode(profile.profileName, profile.rows, "exclusive")}
                >
                  Zet exclusief
                </Button>
                <Button
                  variant="primary"
                  disabled={isSaving || selectedRows.length === 0}
                  onClick={() => onMarkReviewed(profile.rows)}
                  leftIcon={<CheckCheck size={17} aria-hidden="true" />}
                >
                  Beoordeeld
                </Button>
                <span className="vat-selected-count">{numberText(selectedRows.length)} geselecteerd</span>
              </div>
            </div>

            <DataTable
              rows={profile.rows}
              columns={columnsBase}
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
                      onChange={(event) => onUpdateVatMode(row, event.target.value as VatMode)}
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

      {groupedProfiles.length === 0 ? (
        <section className="panel">
          <div className="empty-state">Geen prijskolommen gevonden voor deze keuze.</div>
        </section>
      ) : null}
    </>
  );
}
