import { ArrowRight } from "lucide-react";
import { formatDate } from "../../lib/dates";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

export type DashboardWorkItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  label: string;
  tone: BadgeVariant;
  updatedAt: number;
};

type DashboardWorkOverviewProps = {
  isLoading: boolean;
  workItems: DashboardWorkItem[];
};

export function DashboardWorkOverview({ isLoading, workItems }: DashboardWorkOverviewProps) {
  return (
    <section className="panel" id="werkoverzicht">
      <div className="dashboard-section-header">
        <div>
          <p className="eyebrow">Werkoverzicht</p>
          <h2>Wat moet ik vandaag doen?</h2>
          <p className="muted">Begin bij deze dossiers en werk daarna vanuit Dossiers verder.</p>
        </div>
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
          Alle dossiers
        </a>
      </div>

      {isLoading ? (
        <div className="empty-state">Werkvoorraad laden.</div>
      ) : workItems.length > 0 ? (
        <div className="dashboard-work-list">
          {workItems.map((item) => (
            <a className="dashboard-work-item" href={item.href} key={item.id}>
              <span className="dashboard-work-copy">
                <Badge variant={item.tone}>{item.label}</Badge>
                <strong>{item.title}</strong>
                <small className="muted">{item.description}</small>
              </span>
              <span className="dashboard-work-meta">
                <small className="muted">{formatDate(item.updatedAt)}</small>
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Geen directe acties"
          description="Er zijn geen nieuwe aanvragen, open offerteacties of uitvoeringsmomenten gevonden."
          action={
            <a className="ui-button ui-button-secondary ui-button-md" href="/portal/dossiers">
              Dossiers bekijken
            </a>
          }
        />
      )}
    </section>
  );
}
