import { useMemo } from "react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject } from "../../lib/portalTypes";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";

type CustomerProjectsTableProps = {
  projects: PortalProject[];
};

export function CustomerProjectsTable({ projects }: CustomerProjectsTableProps) {
  const projectColumns = useMemo<Array<DataTableColumn<PortalProject>>>(
    () => [
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
        key: "status",
        header: "Status",
        width: "150px",
        render: (project) => (
          <StatusBadge status={project.status} label={formatProjectStatus(project.status)} />
        )
      },
      {
        key: "rooms",
        header: "Ruimtes",
        width: "90px",
        align: "right",
        render: (project) => project.rooms.length
      }
    ],
    []
  );

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Projecten"
        description="Open projectdossiers vanuit deze klantcontext."
      />
      <DataTable
        ariaLabel="Projecten van klant"
        columns={projectColumns}
        density="compact"
        emptyDescription="Maak vanuit projecten een nieuw traject aan voor deze klant."
        emptyTitle="Nog geen projecten"
        getRowKey={(project) => project.id}
        mobileMode="cards"
        renderMobileCard={(project) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <a href={`/portal/projecten/${project.id}`}>
                  <strong>{project.title}</strong>
                </a>
                <small className="muted">{project.description ?? "Geen omschrijving"}</small>
              </div>
              <StatusBadge status={project.status} label={formatProjectStatus(project.status)} />
            </div>
            <div className="mobile-card-meta">
              <span>{project.rooms.length} ruimtes</span>
            </div>
            <div className="mobile-card-actions">
              <a
                className="ui-button ui-button-secondary ui-button-sm"
                href={`/portal/projecten/${project.id}`}
              >
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
