import { Search } from "lucide-react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

type DashboardRecentProjectsProps = {
  isLoading: boolean;
  projects: PortalProject[];
};

export function DashboardRecentProjects({ isLoading, projects }: DashboardRecentProjectsProps) {
  return (
    <section className="panel">
      <div className="dashboard-section-header">
        <div>
          <p className="eyebrow">Snel verder</p>
          <h2>Recente projectdossiers</h2>
          <p className="muted">Open lopende projecten zonder opnieuw te zoeken.</p>
        </div>
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
          <Search size={15} aria-hidden="true" />
          Zoeken
        </a>
      </div>

      {isLoading ? (
        <div className="empty-state">Projecten laden.</div>
      ) : projects.length > 0 ? (
        <div className="dashboard-project-grid">
          {projects.map((project) => (
            <a
              href={`/portal/projecten/${project.id}`}
              className="dashboard-project-link"
              key={project.id}
            >
              <Badge variant="info">{formatProjectStatus(project.status)}</Badge>
              <strong>{project.title}</strong>
              <small className="muted">{project.description ?? "Geen omschrijving"}</small>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Geen lopende projecten"
          description="Maak een klant- en projectdossier aan zodra er een nieuwe aanvraag binnenkomt."
          action={
            <a className="ui-button ui-button-primary ui-button-md" href="/portal/dossiers">
              Naar dossiers
            </a>
          }
        />
      )}
    </section>
  );
}
