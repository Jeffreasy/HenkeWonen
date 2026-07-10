import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../../lib/dates";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import { PriorityCountStrip, type PriorityCounts } from "../ui/data-display/PriorityCountStrip";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";

/** Aantal werkitems dat standaard zichtbaar is; de rest komt achter "Toon alles". */
const VISIBLE_LIMIT = 6;

/** Winkel-formulering van de urgentiestrip (mix van deadlines en dossierstatussen). */
const WORK_PRIORITY_LABELS = {
  red: "vandaag of morgen",
  orange: "actie nodig",
  green: "op schema"
};

export type DashboardWorkItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  label: string;
  tone: BadgeVariant;
  level: "red" | "orange" | "green";
  updatedAt: number;
};

type DashboardWorkOverviewProps = {
  isLoading: boolean;
  workItems: DashboardWorkItem[];
  priorityCounts: PriorityCounts;
  /** Totale werkvoorraad (server-telling); kan hoger zijn dan de meegestuurde lijst. */
  totalCount?: number;
};

export function DashboardWorkOverview({
  isLoading,
  workItems,
  priorityCounts,
  totalCount
}: DashboardWorkOverviewProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? workItems : workItems.slice(0, VISIBLE_LIMIT);
  // De server stuurt de lijst met een bovengrens mee; benoem het verschil expliciet
  // zodat de teller op de pill en deze knop nooit stilzwijgend uiteenlopen.
  const total = totalCount ?? workItems.length;
  const toonAllesLabel =
    total > workItems.length
      ? `Toon alles (${workItems.length} van ${total} — rest via Dossiers)`
      : `Toon alles (${workItems.length})`;
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

      {isLoading || workItems.length > 0 ? (
        <PriorityCountStrip
          counts={priorityCounts}
          labels={WORK_PRIORITY_LABELS}
          loading={isLoading}
          ariaLabel="Wat heeft haast — rood, oranje, groen"
        />
      ) : null}

      {isLoading ? (
        <div className="dashboard-work-list" aria-busy="true" aria-label="Werkvoorraad laden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="dashboard-work-item" key={index}>
              <span className="dashboard-work-copy">
                <Skeleton width={88} height={20} />
                <Skeleton width="55%" height={15} />
                <Skeleton width="80%" height={12} />
              </span>
            </div>
          ))}
        </div>
      ) : workItems.length > 0 ? (
        <>
          <div className="dashboard-work-list" id="werkoverzicht-lijst">
            {visibleItems.map((item) => (
              <a
                className={`dashboard-work-item dashboard-work-item-${item.level}`}
                href={item.href}
                key={item.id}
              >
                <span className="dashboard-work-copy">
                  <span className="dashboard-work-titlerow">
                    <Badge variant={item.tone}>{item.label}</Badge>
                    <strong>{item.title}</strong>
                  </span>
                  <small className="muted">{item.description}</small>
                </span>
                <span className="dashboard-work-meta">
                  <small className="muted">{formatDate(item.updatedAt)}</small>
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
          {workItems.length > VISIBLE_LIMIT ? (
            <div className="dashboard-work-toggle">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showAll}
                aria-controls="werkoverzicht-lijst"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? "Toon minder" : toonAllesLabel}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="Geen directe acties"
          description="Er zijn geen nieuwe aanvragen, open offertes of geplande inmetingen en bestellingen gevonden."
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
