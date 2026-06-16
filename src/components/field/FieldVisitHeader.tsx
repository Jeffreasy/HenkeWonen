import { AlertTriangle, CheckCircle2, Clock3, Mail, Phone } from "lucide-react";
import { formatMeasurementStatus, formatProjectStatus } from "../../lib/i18n/statusLabels";
import { StatusBadge } from "../ui/data-display/StatusBadge";

export type FieldUrgency = {
  level: "red" | "orange" | "green";
  label: "Rood" | "Oranje" | "Groen";
  title: string;
  description: string;
};

function UrgencyIcon({ level }: { level: FieldUrgency["level"] }) {
  if (level === "green") {
    return <CheckCircle2 size={22} aria-hidden="true" />;
  }

  if (level === "orange") {
    return <Clock3 size={22} aria-hidden="true" />;
  }

  return <AlertTriangle size={22} aria-hidden="true" />;
}

type FieldVisitHeaderProps = {
  project: {
    titel: string;
    status: string;
  };
  visit: {
    status: string;
    visitAt?: number;
    measurementStatus?: string;
  };
  customer: {
    phone?: string;
    email?: string;
  } | null;
  urgency: FieldUrgency;
};

export function FieldVisitHeader({ project, visit, customer, urgency }: FieldVisitHeaderProps) {
  return (
    <section className={`field-visit-header field-visit-header-${urgency.level}`}>
      <div className="field-visit-title">
        <p className="eyebrow">Klantbezoek</p>
        <h1>{project.titel}</h1>
        <div className="field-visit-badges">
          <StatusBadge
            status={project.status}
            label={formatProjectStatus(project.status)}
          />
          {visit.measurementStatus ? (
            <StatusBadge
              status={visit.measurementStatus}
              label={formatMeasurementStatus(visit.measurementStatus)}
            />
          ) : null}
        </div>
      </div>

      <div className="field-visit-side">
        <div className={`field-urgency-card field-urgency-${urgency.level}`}>
          <span className="field-urgency-label">
            <UrgencyIcon level={urgency.level} />
            {urgency.label}
          </span>
          <strong>{urgency.title}</strong>
          <p>{urgency.description}</p>
        </div>

        <div className="field-visit-actions">
          {customer?.phone ? (
            <a className="ui-button ui-button-primary ui-button-md" href={`tel:${customer.phone}`}>
              <Phone size={17} aria-hidden="true" />
              <span>Bellen</span>
            </a>
          ) : null}
          {customer?.email ? (
            <a className="ui-button ui-button-secondary ui-button-md" href={`mailto:${customer.email}`}>
              <Mail size={17} aria-hidden="true" />
              <span>Mail</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
