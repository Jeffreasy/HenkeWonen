import { CalendarClock, FileText, Pencil, Ruler, XCircle } from "lucide-react";
import type { PortalCustomer, PortalProject } from "../../lib/portalTypes";
import { formatDate } from "../../lib/dates";
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
  // Klant staat al in de kicker; lege/nul-waarden verbergen we tot ze gevuld zijn.
  const metadata = [
    { id: "rooms", label: "Ruimtes", value: project.rooms.length },
    { id: "events", label: "Momenten", value: workflowEventsCount },
    { id: "measurement", label: "Inmeetdatum", value: formatDate(project.inmeetdatum) },
    {
      id: "execution",
      label: "Uitvoering",
      value: formatDate(project.uitvoerdatum ?? project.uitvoerGeplandOp)
    },
    { id: "updated", label: "Bijgewerkt", value: formatDate(project.gewijzigdOp) }
  ].filter((item) => item.value !== 0 && item.value !== "-");

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
        // Twee gelijkwaardige paden voor een dossier: direct verkopen (offerte met
        // catalogus) óf inmeten. Beide primair zodat "verkopen" net zo vindbaar is als
        // inmeten; het inplannen van een inmeetbezoek is de secundaire variant.
        <div className="project-primary-actions">
          <a
            className="ui-button ui-button-primary ui-button-md"
            href={`/portal/offertes?open=nieuw&project=${project.id}`}
          >
            <FileText size={17} aria-hidden="true" />
            Offerte / verkoop maken
          </a>
          <Button
            isLoading={isStartingMeasurement}
            leftIcon={<Ruler size={17} aria-hidden="true" />}
            onClick={onStartMeasurement}
            variant="primary"
          >
            Inmeting starten
          </Button>
          <Button
            leftIcon={<CalendarClock size={17} aria-hidden="true" />}
            onClick={onPlanMeasurement}
            variant="secondary"
          >
            Inmeetbezoek inplannen
          </Button>
        </div>
      ) : null}

      {project.interneNotities || project.klantNotities ? (
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
