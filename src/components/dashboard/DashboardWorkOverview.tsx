import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import type { PriorityCounts } from "../ui/data-display/PriorityCountStrip";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Skeleton } from "../ui/feedback/Skeleton";

/** Aantal actie-items (rood + oranje) dat standaard zichtbaar is. */
const VISIBLE_LIMIT = 10;

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

/**
 * Triage-indeling: de urgentie is de structuur. Rood en oranje zijn "vandaag
 * iets mee doen" en staan open; groen is "op schema" en staat achter een
 * toggle — daar hoeft vandaag niets mee. De losse tellerstrip is vervangen
 * door de sectiekoppen zelf (zelfde cijfers, geen dubbele rij).
 */
const WORK_SECTIONS: Array<{
  level: DashboardWorkItem["level"];
  label: string;
}> = [
  { level: "red", label: "Vandaag of morgen" },
  { level: "orange", label: "Actie nodig" },
  { level: "green", label: "Op schema" }
];

function WorkItemRow({ item }: { item: DashboardWorkItem }) {
  return (
    <a className={`dashboard-work-item dashboard-work-item-${item.level}`} href={item.href}>
      <span className="dashboard-work-copy">
        {/* Het dossier (klant + project) is de kop; de actie is de subregel.
            Voorheen stond de generieke actietekst ("Nieuwe aanvraag opvolgen")
            groot en het onderscheidende dossier klein. */}
        <span className="dashboard-work-titlerow">
          <Badge variant={item.tone}>{item.label}</Badge>
          <strong>{item.description}</strong>
        </span>
        <small className="muted">{item.title}</small>
      </span>
      <span className="dashboard-work-meta">
        <ArrowRight size={17} aria-hidden="true" />
      </span>
    </a>
  );
}

export function DashboardWorkOverview({
  isLoading,
  workItems,
  priorityCounts,
  totalCount
}: DashboardWorkOverviewProps) {
  const [showAll, setShowAll] = useState(false);

  const byLevel = {
    red: workItems.filter((item) => item.level === "red"),
    orange: workItems.filter((item) => item.level === "orange"),
    green: workItems.filter((item) => item.level === "green")
  };
  const actionableCount = byLevel.red.length + byLevel.orange.length;
  const total = totalCount ?? workItems.length;

  // Rood + oranje tonen (gecapt), groen alleen bij "alles tonen".
  let remainingBudget = showAll ? Number.MAX_SAFE_INTEGER : VISIBLE_LIMIT;
  const visibleByLevel: Record<DashboardWorkItem["level"], DashboardWorkItem[]> = {
    red: [],
    orange: [],
    green: []
  };
  for (const section of WORK_SECTIONS) {
    if (section.level === "green" && !showAll) {
      continue;
    }
    const items = byLevel[section.level];
    visibleByLevel[section.level] = items.slice(0, Math.max(0, remainingBudget));
    remainingBudget -= visibleByLevel[section.level].length;
  }
  const hiddenCount = workItems.length - WORK_SECTIONS.reduce(
    (sum, section) => sum + visibleByLevel[section.level].length,
    0
  );
  const toonAllesLabel =
    total > workItems.length
      ? `Toon alles (nog ${hiddenCount}, waarvan ${byLevel.green.length} op schema — rest via Klanten)`
      : `Toon alles (nog ${hiddenCount}, waarvan ${byLevel.green.length} op schema)`;

  return (
    <section className="panel" id="werkoverzicht">
      <div className="dashboard-section-header">
        <div>
          <p className="eyebrow">Werkoverzicht</p>
          <h2>Wat moet ik vandaag doen?</h2>
          <p className="muted">Rood en oranje vragen actie; op schema staat onderaan.</p>
        </div>
        <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
          Alle dossiers
        </a>
      </div>

      {isLoading ? (
        <div className="dashboard-work-list" aria-busy="true" aria-label="Werkvoorraad laden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="dashboard-work-item" key={index}>
              <span className="dashboard-work-copy">
                <Skeleton width={88} height={20} />
                <Skeleton width="55%" height={15} />
              </span>
            </div>
          ))}
        </div>
      ) : workItems.length > 0 ? (
        <>
          {WORK_SECTIONS.map((section) => {
            const sectionItems = byLevel[section.level];
            const visible = visibleByLevel[section.level];
            if (sectionItems.length === 0 || (section.level === "green" && !showAll)) {
              return null;
            }
            return (
              <div className="dashboard-work-group" key={section.level}>
                <h3 className="dashboard-work-group-title">
                  <span
                    className={`dashboard-work-dot dashboard-work-dot-${section.level}`}
                    aria-hidden="true"
                  />
                  {section.label}
                  <span className="dashboard-work-group-count">{sectionItems.length}</span>
                </h3>
                <div className="dashboard-work-list">
                  {visible.map((item) => (
                    <WorkItemRow item={item} key={item.id} />
                  ))}
                </div>
              </div>
            );
          })}

          {actionableCount === 0 ? (
            <p className="muted dashboard-work-allclear">
              Niets urgents — alle {priorityCounts.green} lopende dossiers staan op schema.
            </p>
          ) : null}

          {hiddenCount > 0 || showAll ? (
            <div className="dashboard-work-toggle">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showAll}
                aria-controls="werkoverzicht"
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
            <a className="ui-button ui-button-secondary ui-button-md" href="/portal/klanten">
              Naar klanten
            </a>
          }
        />
      )}
    </section>
  );
}
