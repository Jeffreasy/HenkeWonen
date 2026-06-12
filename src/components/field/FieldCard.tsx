import { ExternalLink, Mail, MapPin, Navigation, Phone, Ruler } from "lucide-react";
import { formatDate } from "../../lib/dates";
import { formatMeasurementStatus, formatProjectStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type { FieldWorkspaceCard } from "../../lib/portalTypes";
import { StatusBadge } from "../ui/StatusBadge";

export type CardActionPreference = "measure" | "quote";

export type CardUrgency = {
  level: "red" | "orange" | "green";
  label: "Rood" | "Oranje" | "Groen";
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function cardUrgency(card: FieldWorkspaceCard): CardUrgency {
  const openTask = card.tasks?.find((task) => task.status === "open");

  if (openTask) {
    return { level: openTask.priority.level, label: openTask.priority.label };
  }

  if (card.measurement?.status === "reviewed" || card.measurement?.status === "converted_to_quote") {
    return { level: "green", label: "Groen" };
  }

  if (!card.visitAt) {
    return { level: "orange", label: "Oranje" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilVisit = Math.floor((card.visitAt - today.getTime()) / DAY_MS);

  if (daysUntilVisit <= 1) {
    return { level: "red", label: "Rood" };
  }

  if (daysUntilVisit <= 7) {
    return { level: "orange", label: "Oranje" };
  }

  return { level: "green", label: "Groen" };
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

type FieldCardProps = {
  card: FieldWorkspaceCard;
  preferredAction: CardActionPreference;
};

export function FieldCard({ card, preferredAction }: FieldCardProps) {
  const customerName = card.customer?.displayName ?? "Onbekende klant";
  const urgency = cardUrgency(card);
  const statusLabel = card.latestQuote
    ? formatQuoteStatus(card.latestQuote.status)
    : formatProjectStatus(card.project.status);
  const openTask = card.tasks?.find((task) => task.status === "open");
  const actions = [
    {
      id: "measure" as const,
      href: `${card.href}#inmeten`,
      icon: <Ruler size={17} aria-hidden="true" />,
      label: "Inmeten"
    },
    {
      id: "quote" as const,
      href: `${card.href}#conceptofferte`,
      icon: <ExternalLink size={17} aria-hidden="true" />,
      label: "Conceptofferte"
    }
  ].sort((left, right) => {
    if (left.id === preferredAction) return -1;
    if (right.id === preferredAction) return 1;
    return 0;
  });

  return (
    <article className={`field-work-card field-work-card-${urgency.level}`}>
      <div className="field-work-card-main">
        <div className="field-work-card-title-row">
          <div>
            <span className="field-next-action">{card.nextAction}</span>
            <h3>{card.project.title}</h3>
          </div>
          <div className="field-card-status-stack">
            <span className={`field-card-priority field-card-priority-${urgency.level}`}>
              {urgency.label}
            </span>
            <StatusBadge status={card.latestQuote?.status ?? card.project.status} label={statusLabel} />
          </div>
        </div>

        <div className="field-customer-block">
          <strong>{customerName}</strong>
          {card.address ? (
            <span>
              <MapPin size={16} aria-hidden="true" />
              {card.address}
            </span>
          ) : null}
          {card.visitAt ? <span>Afspraak: {formatDate(card.visitAt)}</span> : null}
          {card.measurement ? (
            <span>Inmeting: {formatMeasurementStatus(card.measurement.status)}</span>
          ) : null}
          {openTask ? (
            <span>
              Taak: {openTask.title} ({formatDate(openTask.dueAt)})
            </span>
          ) : null}
        </div>
      </div>

      <div className="field-card-actions">
        {card.phone ? (
          <a className="ui-button ui-button-secondary ui-button-md" href={`tel:${card.phone}`}>
            <Phone size={17} aria-hidden="true" />
            <span>Bellen</span>
          </a>
        ) : null}
        {card.email ? (
          <a className="ui-button ui-button-secondary ui-button-md" href={`mailto:${card.email}`}>
            <Mail size={17} aria-hidden="true" />
            <span>Mail</span>
          </a>
        ) : null}
        {card.address ? (
          <a
            className="ui-button ui-button-secondary ui-button-md"
            href={mapsUrl(card.address)}
            rel="noreferrer"
            target="_blank"
          >
            <Navigation size={17} aria-hidden="true" />
            <span>Route</span>
          </a>
        ) : null}
        {actions.map((action) => (
          <a
            className={`ui-button ui-button-${
              action.id === preferredAction ? "primary" : "secondary"
            } ui-button-md`}
            href={action.href}
            key={action.id}
          >
            {action.icon}
            <span>{action.label}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
