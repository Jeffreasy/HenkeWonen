import { Plus } from "lucide-react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject, ProjectStatus } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import ProjectStatusBadge from "./ProjectStatusBadge";

type PortalProjectRow = PortalProject & {
  customerName?: string;
};

type StatusFilter = "all" | ProjectStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statussen" },
  { value: "lead", label: formatProjectStatus("lead") },
  { value: "quote_draft", label: formatProjectStatus("quote_draft") },
  { value: "quote_sent", label: formatProjectStatus("quote_sent") },
  { value: "quote_accepted", label: formatProjectStatus("quote_accepted") },
  { value: "measurement_planned", label: formatProjectStatus("measurement_planned") },
  { value: "execution_planned", label: formatProjectStatus("execution_planned") },
  { value: "ordering", label: formatProjectStatus("ordering") },
  { value: "in_progress", label: formatProjectStatus("in_progress") },
  { value: "invoiced", label: formatProjectStatus("invoiced") },
  { value: "paid", label: formatProjectStatus("paid") },
  { value: "closed", label: formatProjectStatus("closed") },
  { value: "cancelled", label: formatProjectStatus("cancelled") }
];

type ProjectsTableProps = {
  projects: PortalProjectRow[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  onNew?: () => void;
};

export function ProjectsTable({
  projects,
  isLoading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onNew
}: ProjectsTableProps) {
  const columns: Array<DataTableColumn<PortalProjectRow>> = [
    {
      key: "project",
      header: "Project",
      priority: "primary",
      render: (project) => (
        <div className="stack-sm">
          <a href={`/portal/projecten/${project.id}`}>
            <strong>{project.title}</strong>
          </a>
          <small className="muted">{project.description ?? "Geen omschrijving"}</small>
        </div>
      )
    },
    {
      key: "customer",
      header: "Klant",
      render: (project) => project.customerName ?? "-"
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      render: (project) => <ProjectStatusBadge status={project.status} />
    },
    {
      key: "rooms",
      header: "Ruimtes",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (project) => project.rooms.length
    }
  ];

  return (
    <section className="grid">
      <SectionHeader
        compact
        title="Lopende projectdossiers"
        description="Scan status, klant en ruimtes zonder het projectdossier te openen."
        actions={
          onNew ? (
            <Button
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={onNew}
              size="sm"
              variant="primary"
              data-shortcut="new-project"
            >
              Nieuw project
            </Button>
          ) : null
        }
      />
      <FilterBar
        search={
          <SearchInput
            aria-label="Projecten zoeken"
            placeholder="Zoek op project, klant of status"
            value={search}
            onChange={setSearch}
            data-searchbar
          />
        }
        filters={
          <Field label="Status" htmlFor="project-status-filter">
            <Select
              id="project-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        }
      />
      <DataTable
        ariaLabel="Projecten"
        columns={columns}
        density="compact"
        emptyDescription="Maak een nieuw project aan of pas je filters aan."
        emptyTitle="Geen projecten gevonden"
        getRowKey={(project) => project.id}
        loading={isLoading}
        mobileMode="cards"
        renderMobileCard={(project) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <a href={`/portal/projecten/${project.id}`}>
                  <strong>{project.title}</strong>
                </a>
                <small className="muted">{project.customerName ?? "Geen klant gekoppeld"}</small>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="mobile-card-meta">
              <span>{project.description ?? "Geen omschrijving"}</span>
              <span>{project.rooms.length} ruimtes</span>
            </div>
            <div className="mobile-card-actions">
              <a className="ui-button ui-button-secondary ui-button-sm" href={`/portal/projecten/${project.id}`}>
                Project openen
              </a>
            </div>
          </div>
        )}
        rows={projects}
      />
    </section>
  );
}
