import { CalendarClock, FileText, Pencil, Ruler, XCircle } from "lucide-react";
import type { PortalCustomer, PortalProject } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import ProjectStatusBadge from "./ProjectStatusBadge";

type ProjectOverviewPanelProps = {
  project: PortalProject;
  customer: PortalCustomer | null;
  workflowEventsCount: number;
  isStartingMeasurement: boolean;
  onStartMeasurement: () => void;
  onPlanMeasurement: () => void;
  onEditProject: () => void;
  onCancelProject: () => void;
  canEdit: boolean;
};

function dateText(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function ProjectOverviewPanel({
  project,
  customer,
  workflowEventsCount,
  isStartingMeasurement,
  onStartMeasurement,
  onPlanMeasurement,
  onEditProject,
  onCancelProject,
  canEdit
}: ProjectOverviewPanelProps) {
  const metadata = [
    { id: "customer", label: "Klant", value: customer?.weergaveNaam ?? "-" },
    { id: "rooms", label: "Ruimtes", value: project.rooms.length },
    { id: "events", label: "Momenten", value: workflowEventsCount },
    { id: "measurement", label: "Inmeetdatum", value: dateText(project.inmeetdatum) },
    { id: "execution", label: "Uitvoering", value: dateText(project.uitvoerdatum ?? project.uitvoerGeplandOp) },
    { id: "updated", label: "Bijgewerkt", value: dateText(project.gewijzigdOp) }
  ];

  return (
    <section className="panel project-overview-panel">
      <div className="project-overview-header">
        <div className="project-overview-copy">
          <div className="project-overview-kicker">
            <ProjectStatusBadge status={project.status} />
            <span>{customer?.weergaveNaam ?? "Geen klant gekoppeld"}</span>
          </div>
          <h1>{project.titel}</h1>
          <p className="muted">{project.omschrijving?.trim() || "Geen projectomschrijving"}</p>
        </div>
        {canEdit ? (
          <div className="project-overview-actions">
            <Button
              leftIcon={<Pencil size={16} aria-hidden="true" />}
              size="sm"
              variant="secondary"
              onClick={onEditProject}
            >
              Bewerken
            </Button>
            <Button
              leftIcon={<XCircle size={16} aria-hidden="true" />}
              size="sm"
              variant="danger"
              onClick={onCancelProject}
            >
              Annuleren
            </Button>
          </div>
        ) : null}
      </div>

      <dl className="project-meta-strip" aria-label="Projectgegevens">
        {metadata.map((item) => (
          <div className="project-meta-item" key={item.id}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      {canEdit ? (
        <div className="project-primary-actions">
          <a className="ui-button ui-button-secondary ui-button-md" href="/portal/offertes">
            <FileText size={17} aria-hidden="true" />
            Offerte maken
          </a>
          <Button
            leftIcon={<CalendarClock size={17} aria-hidden="true" />}
            onClick={onPlanMeasurement}
            variant="secondary"
          >
            Inmeetbezoek inplannen
          </Button>
          <Button
            isLoading={isStartingMeasurement}
            leftIcon={<Ruler size={17} aria-hidden="true" />}
            onClick={onStartMeasurement}
            variant="primary"
          >
            Inmeting starten
          </Button>
        </div>
      ) : null}

      {(project.interneNotities || project.klantNotities) ? (
        <div className="project-notes-strip" aria-label="Projectnotities">
          {project.interneNotities ? (
            <div className="project-note-preview">
              <Badge variant="neutral">Intern</Badge>
              <p>{project.interneNotities}</p>
            </div>
          ) : null}
          {project.klantNotities ? (
            <div className="project-note-preview">
              <Badge variant="info">Klant</Badge>
              <p>{project.klantNotities}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
