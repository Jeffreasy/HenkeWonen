import { Search } from "lucide-react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";
import { CollapsiblePanel } from "../ui/layout/CollapsiblePanel";

type DashboardRecentProjectsProps = {
  isLoading: boolean;
  projects: PortalProject[];
};

export function DashboardRecentProjects({ isLoading, projects }: DashboardRecentProjectsProps) {
  return (
    <CollapsiblePanel
      eyebrow="Snel verder"
      title="Recente projectdossiers"
      description="Open lopende projecten zonder opnieuw te zoeken."
      action={
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
          <Search size={15} aria-hidden="true" />
          Zoeken
        </a>
      }
    >
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
    </CollapsiblePanel>
  );
}
