import { useState } from "react";
import type { FieldWorkspaceBucket, FieldWorkspaceCard } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { FieldCard, cardUrgency, type CardActionPreference } from "./FieldCard";

export type FieldSection = {
  bucket: FieldWorkspaceBucket;
  title: string;
  description: string;
  items: FieldWorkspaceCard[];
  emptyTitle: string;
  emptyDescription: string;
  preferredAction: CardActionPreference;
};

type FieldCardSectionProps = {
  section: FieldSection;
  search: string;
};

export function FieldCardSection({ section, search }: FieldCardSectionProps) {
  const hasSearch = search.trim().length > 0;
  const [showOnSchedule, setShowOnSchedule] = useState(false);

  // Bezoeken splitsen op urgentie: rood/oranje (vraagt aandacht) altijd zichtbaar,
  // groen (op schema) standaard ingeklapt zodat de lijst rustig blijft. Bij een
  // zoekopdracht tonen we alles, anders mis je resultaten achter de toggle.
  const urgent = section.items.filter((card) => cardUrgency(card).level !== "green");
  const onSchedule = section.items.filter((card) => cardUrgency(card).level === "green");
  const collapseOnSchedule = !hasSearch && urgent.length > 0 && onSchedule.length > 0;
  const visibleCards = collapseOnSchedule && !showOnSchedule ? urgent : [...urgent, ...onSchedule];

  return (
    <section className="field-section">
      <SectionHeader
        compact
        title={`${section.title} (${section.items.length})`}
        description={section.description}
      />

      {section.items.length ? (
        <>
          <div className="field-card-list">
            {visibleCards.map((card) => (
              <FieldCard
                key={`${section.title}-${card.id}`}
                card={card}
                preferredAction={section.preferredAction}
              />
            ))}
          </div>
          {collapseOnSchedule ? (
            <div className="field-section-toggle">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showOnSchedule}
                onClick={() => setShowOnSchedule((current) => !current)}
              >
                {showOnSchedule
                  ? "Verberg bezoeken op schema"
                  : `Toon ${onSchedule.length} bezoek${
                      onSchedule.length === 1 ? "" : "en"
                    } op schema`}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={hasSearch ? `Geen resultaten in ${section.title}` : section.emptyTitle}
          description={
            hasSearch
              ? `Geen dossier gevonden op "${search.trim()}". Wis of wijzig de zoekopdracht.`
              : section.emptyDescription
          }
        />
      )}
    </section>
  );
}
