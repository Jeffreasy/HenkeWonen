import { ExternalLink, Mail, MapPin, Navigation, Phone, Ruler, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatMeasurementStatus, formatProjectStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type { FieldServiceWorkspaceResult, FieldWorkspaceCard } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";

type FieldServiceWorkspaceProps = {
  session: AppSession;
};

type FieldSection = {
  id?: string;
  title: string;
  description: string;
  items: FieldWorkspaceCard[];
  emptyTitle: string;
  emptyDescription: string;
};

type CardUrgency = {
  level: "red" | "orange" | "green";
  label: "Rood" | "Oranje" | "Groen";
};

type PriorityCounts = Record<CardUrgency["level"], number>;

const DAY_MS = 24 * 60 * 60 * 1000;

const emptyWorkspace: FieldServiceWorkspaceResult = {
  today: [],
  measure: [],
  quote: [],
  followUp: [],
  counts: {
    today: 0,
    measure: 0,
    quote: 0,
    followUp: 0
  }
};

function cardSearchText(card: FieldWorkspaceCard) {
  return [
    card.project.title,
    card.project.description,
    card.customer?.displayName,
    card.customer?.email,
    card.customer?.phone,
    card.address,
    card.latestQuote?.quoteNumber,
    card.latestQuote?.title,
    card.nextAction
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterCards(cards: FieldWorkspaceCard[], search: string) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return cards;
  }

  return cards.filter((card) => cardSearchText(card).includes(query));
}

function cardUrgency(card: FieldWorkspaceCard): CardUrgency {
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

function uniqueCards(cards: FieldWorkspaceCard[]) {
  const byId = new Map<string, FieldWorkspaceCard>();

  for (const card of cards) {
    byId.set(card.id, card);
  }

  return [...byId.values()];
}

function countPriorities(cards: FieldWorkspaceCard[]): PriorityCounts {
  return cards.reduce<PriorityCounts>(
    (counts, card) => {
      counts[cardUrgency(card).level] += 1;
      return counts;
    },
    { red: 0, orange: 0, green: 0 }
  );
}

function FieldCard({ card }: { card: FieldWorkspaceCard }) {
  const customerName = card.customer?.displayName ?? "Onbekende klant";
  const urgency = cardUrgency(card);
  const statusLabel = card.latestQuote
    ? formatQuoteStatus(card.latestQuote.status)
    : formatProjectStatus(card.project.status);

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
          {card.visitAt ? <span>Meetmoment: {formatDate(card.visitAt)}</span> : null}
          {card.measurement ? (
            <span>Inmeting: {formatMeasurementStatus(card.measurement.status)}</span>
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
        <a className="ui-button ui-button-primary ui-button-md" href={`${card.href}#inmeten`}>
          <Ruler size={17} aria-hidden="true" />
          <span>Inmeten</span>
        </a>
        <a className="ui-button ui-button-secondary ui-button-md" href={`${card.href}#conceptofferte`}>
          <ExternalLink size={17} aria-hidden="true" />
          <span>Conceptofferte</span>
        </a>
      </div>
    </article>
  );
}

function FieldCardSection({ section, search }: { section: FieldSection; search: string }) {
  const hasSearch = search.trim().length > 0;

  return (
    <section className="field-section" id={section.id}>
      <SectionHeader
        compact
        title={`${section.title} (${section.items.length})`}
        description={section.description}
      />

      {section.items.length ? (
        <div className="field-card-list">
          {section.items.map((card) => (
            <FieldCard key={`${section.title}-${card.id}`} card={card} />
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

export default function FieldServiceWorkspace({ session }: FieldServiceWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FieldServiceWorkspaceResult>(emptyWorkspace);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de buitendienstgegevens nu niet bereiken.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.portal.fieldServiceWorkspace, {
        tenantSlug: session.tenantId
      })) as FieldServiceWorkspaceResult;

      setWorkspace(result);
    } catch (loadError) {
      console.error(loadError);
      setError("Buitendienst kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const sections = useMemo<FieldSection[]>(
    () => [
      {
        title: "Vandaag",
        description: "Klantbezoeken en meetmomenten die direct aandacht vragen.",
        items: filterCards(workspace.today, search),
        emptyTitle: "Geen bezoeken voor vandaag",
        emptyDescription: "Er staan nu geen klantbezoeken met een meetmoment voor vandaag klaar."
      },
      {
        id: "dossiers",
        title: "Inmeten",
        description: "Dossiers waar klantgegevens, adres en inmeting vooraan staan.",
        items: filterCards(workspace.measure, search),
        emptyTitle: "Geen dossiers om in te meten",
        emptyDescription: "Nieuwe meetdossiers verschijnen hier zodra ze aandacht vragen."
      },
      {
        id: "conceptoffertes",
        title: "Conceptoffertes",
        description: "Dossiers waar meetregels kunnen worden omgezet naar een Klantversie.",
        items: filterCards(workspace.quote, search),
        emptyTitle: "Geen conceptoffertes",
        emptyDescription: "Zodra een offerte voorbereid moet worden, staat het dossier hier."
      },
      {
        title: "Opvolgen",
        description: "Offertes en lopende dossiers die na het klantbezoek terugkomen.",
        items: filterCards(workspace.followUp, search),
        emptyTitle: "Niets om op te volgen",
        emptyDescription: "Verzonden offertes en vervolgacties komen hier terug."
      }
    ],
    [search, workspace]
  );
  const priorityCounts = useMemo(
    () =>
      countPriorities(
        uniqueCards([
          ...workspace.today,
          ...workspace.measure,
          ...workspace.quote,
          ...workspace.followUp
        ])
      ),
    [workspace]
  );

  return (
    <div className="grid field-workspace">
      {error ? <Alert variant="danger" title="Buitendienst niet geladen" description={error} /> : null}

      <section className="field-hero-panel">
        <div>
          <p className="eyebrow">Vandaag</p>
          <h1>Buitendienst werkplek</h1>
          <p>
            Klantbezoeken, Inmeten en Conceptoffertes bij elkaar, met Klantversie klaar voor
            overleg en zonder winkel- of kantoorschermen
            ertussen.
          </p>
          <div className="field-priority-summary" aria-label="Urgentie overzicht">
            <span className="field-priority-pill field-priority-pill-red">
              <strong>{priorityCounts.red}</strong>
              Rood
              <small>vandaag of morgen</small>
            </span>
            <span className="field-priority-pill field-priority-pill-orange">
              <strong>{priorityCounts.orange}</strong>
              Oranje
              <small>binnenkort of onbekend</small>
            </span>
            <span className="field-priority-pill field-priority-pill-green">
              <strong>{priorityCounts.green}</strong>
              Groen
              <small>op schema</small>
            </span>
          </div>
        </div>
        <div className="field-hero-search">
          <SearchInput
            aria-label="Buitendienst dossiers zoeken"
            placeholder="Zoek klant, adres, project of offerte"
            value={search}
            onChange={setSearch}
          />
          {search.trim() ? (
            <div className="field-search-feedback">
              <span>Zoeken op: {search.trim()}</span>
              <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
                Wissen
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <div className="panel field-loading-state">
          <Search size={18} aria-hidden="true" />
          Inmeten, Conceptoffertes en Klantversie laden...
        </div>
      ) : (
        sections.map((section) => (
          <FieldCardSection key={section.title} search={search} section={section} />
        ))
      )}
    </div>
  );
}
