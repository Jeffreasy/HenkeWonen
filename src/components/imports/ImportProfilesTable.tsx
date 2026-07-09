import { Archive, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { ImportProfileSummary } from "./ImportProfiles";
import { formatImportProfileStatus } from "../../lib/i18n/statusLabels";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { FilterBar } from "../ui/layout/FilterBar";
import { SearchInput } from "../ui/forms/SearchInput";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { type ProfileStatusFilter } from "./import/importTypes";

type ImportProfilesTableProps = {
  visibleProfiles: ImportProfileSummary[];
  isLoading: boolean;
  error: string | null;
  profileSearchTerm: string;
  setProfileSearchTerm: (value: string) => void;
  profileStatusFilter: ProfileStatusFilter;
  setProfileStatusFilter: (value: ProfileStatusFilter) => void;
  profileCounts: { total: number; active: number; archived: number };
  canManageProfiles: boolean;
  setPendingProfileStatus: (
    value: { profile: ImportProfileSummary; nextStatus: ImportProfileSummary["status"] } | null
  ) => void;
};

export function ImportProfilesTable({
  visibleProfiles,
  isLoading,
  error,
  profileSearchTerm,
  setProfileSearchTerm,
  profileStatusFilter,
  setProfileStatusFilter,
  profileCounts,
  canManageProfiles,
  setPendingProfileStatus
}: ImportProfilesTableProps) {
  const profileColumns: Array<DataTableColumn<ImportProfileSummary>> = useMemo(
    () => [
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
    ],
    [canManageProfiles, setPendingProfileStatus]
  );

  return (
    <section className="panel import-list-panel">
      <div className="import-list-filters">
        <FilterBar
          search={
            <SearchInput
              aria-label="Zoek importprofielen"
              value={profileSearchTerm}
              placeholder="Zoek profiel, leverancier of bestandspatroon"
              onChange={setProfileSearchTerm}
            />
          }
          filters={
            <div className="import-filter-group">
              <span className="import-filter-label">Filter</span>
              <div className="tabs import-tabs">
                {[
                  { value: "active", label: "Actief", count: profileCounts.active },
                  { value: "archived", label: "Gearchiveerd", count: profileCounts.archived },
                  { value: "all", label: "Alle", count: profileCounts.total }
                ].map((item) => (
                  <button
                    className={profileStatusFilter === item.value ? "tab active" : "tab"}
                    key={item.value}
                    type="button"
                    onClick={() => setProfileStatusFilter(item.value as ProfileStatusFilter)}
                  >
                    <span>{item.label}</span>
                    <span className="vat-tab-count">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          }
          actions={<span className="muted">{visibleProfiles.length} importprofielen</span>}
        />
      </div>

      <DataTable
        rows={visibleProfiles}
        columns={profileColumns}
        getRowKey={(profile) => profile.id}
        loading={isLoading}
        error={error}
        emptyTitle={
          profileCounts.total === 0 ? "Nog geen importprofielen" : "Geen importprofielen gevonden"
        }
        emptyDescription={
          profileCounts.total === 0
            ? "De V2-catalogusimport gebruikt geen importprofielen. De btw-modus per leverancier beheer je op de Leveranciers-pagina; profielen verschijnen hier pas weer bij een Excel-prijslijstimport."
            : "Pas filters of zoekterm aan."
        }
        density="compact"
        mobileMode="cards"
        renderMobileCard={(profile) => (
          <>
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <strong>{profile.name}</strong>
                <span className="muted">{profile.supplierName}</span>
              </div>
              <StatusBadge
                status={profile.status}
                label={formatImportProfileStatus(profile.status)}
                variant={profile.status === "inactive" ? "neutral" : "success"}
              />
            </div>
            <div className="mobile-card-meta">
              <span>Bestandspatroon: {profile.filePattern ?? "Geen"}</span>
              <span>Tabbladpatroon: {profile.sheetPattern ?? "Geen"}</span>
              <span>
                Formaten: {[profile.supportsXlsx && "xlsx", profile.supportsXls && "xls"].filter(Boolean).join(", ")}
              </span>
            </div>
            {canManageProfiles ? (
              <div className="mobile-card-actions">
                {profile.status === "inactive" ? (
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
                )}
              </div>
            ) : null}
          </>
        )}
        ariaLabel="Importprofielen"
      />
    </section>
  );
}
