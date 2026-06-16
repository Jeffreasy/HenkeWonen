import { Search } from "lucide-react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";

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
        <div className="dashboard-project-grid" aria-busy="true" aria-label="Projecten laden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="dashboard-project-link" key={index}>
              <Skeleton width={96} height={20} />
              <Skeleton width="70%" height={15} />
              <Skeleton width="90%" height={12} />
            </div>
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="dashboard-project-grid">
          {projects.map((project) => (
            <a
              href={`/portal/projecten/${project.id}`}
              className="dashboard-project-link"
              key={project.id}
            >
              <Badge variant="info">{formatProjectStatus(project.status)}</Badge>
              <strong>{project.titel}</strong>
              <small className="muted">{project.omschrijving ?? "Geen omschrijving"}</small>
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
