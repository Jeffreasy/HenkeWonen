import type { FieldWorkspaceBucket, FieldWorkspaceCard } from "../../lib/portalTypes";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { FieldCard, type CardActionPreference } from "./FieldCard";

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

  return (
    <section className="field-section">
      <SectionHeader
        compact
        title={`${section.title} (${section.items.length})`}
        description={section.description}
      />

      {section.items.length ? (
        <div className="field-card-list">
          {section.items.map((card) => (
            <FieldCard
              key={`${section.title}-${card.id}`}
              card={card}
              preferredAction={section.preferredAction}
            />
          ))}
        </div>
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
