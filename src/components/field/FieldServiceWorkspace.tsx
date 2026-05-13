import {
  ClipboardList,
  ExternalLink,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Ruler,
  Search,
  UserPlus,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import type { SubmitEventLike } from "../../lib/events";
import { formatMeasurementStatus, formatProjectStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type {
  CustomerType,
  FieldServiceWorkspaceResult,
  FieldWorkspaceCard
} from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

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
    card.nextAction,
    ...(card.tasks ?? []).map((task) => task.title)
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
  const openTask = card.tasks?.find((task) => task.status === "open");

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
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [leadType, setLeadType] = useState<CustomerType>("private");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStreet, setLeadStreet] = useState("");
  const [leadHouseNumber, setLeadHouseNumber] = useState("");
  const [leadPostalCode, setLeadPostalCode] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [createDossier, setCreateDossier] = useState(true);
  const [projectTitle, setProjectTitle] = useState("");
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreateFieldLead = canEditDossiers(session.role);

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

  function resetIntakeForm() {
    setLeadType("private");
    setLeadName("");
    setLeadPhone("");
    setLeadEmail("");
    setLeadStreet("");
    setLeadHouseNumber("");
    setLeadPostalCode("");
    setLeadCity("");
    setLeadNotes("");
    setCreateDossier(true);
    setProjectTitle("");
  }

  async function createFieldLead(event: SubmitEventLike) {
    event.preventDefault();

    const displayName = leadName.trim();

    if (!displayName) {
      setIntakeError("Vul minimaal een klantnaam in.");
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setIntakeError("Kan de klant nu niet vastleggen.");
      return;
    }

    setIsSavingLead(true);
    setIntakeError(null);
    setIntakeNotice(null);

    try {
      const customerId = await client.mutation(api.portal.createCustomer, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        type: leadType,
        displayName,
        email: leadEmail.trim() || undefined,
        phone: leadPhone.trim() || undefined,
        street: leadStreet.trim() || undefined,
        houseNumber: leadHouseNumber.trim() || undefined,
        postalCode: leadPostalCode.trim() || undefined,
        city: leadCity.trim() || undefined,
        notes: leadNotes.trim() || undefined
      });

      if (createDossier) {
        const newProjectId = await client.mutation(api.portal.createProject, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          customerId: String(customerId),
          title: projectTitle.trim() || `${displayName} - inmeten`,
          description: leadNotes.trim() || undefined,
          createdByExternalUserId: session.userId
        });

        window.location.assign(`/portal/buitendienst/projecten/${String(newProjectId)}`);
        return;
      }

      resetIntakeForm();
      setIsIntakeOpen(false);
      setIntakeNotice(`${displayName} is als lead vastgelegd.`);
      await loadWorkspace();
    } catch (saveError) {
      console.error(saveError);
      setIntakeError("Klant of dossier kon niet worden vastgelegd.");
    } finally {
      setIsSavingLead(false);
    }
  }

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
          {canCreateFieldLead ? (
            <div className="field-hero-actions">
              <Button
                leftIcon={<UserPlus size={17} aria-hidden="true" />}
                onClick={() => {
                  setIsIntakeOpen((current) => !current);
                  setIntakeError(null);
                  setIntakeNotice(null);
                }}
                variant={isIntakeOpen ? "secondary" : "primary"}
              >
                {isIntakeOpen ? "Intake sluiten" : "Nieuwe klant/lead"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {intakeNotice ? (
        <Alert variant="success" title="Lead vastgelegd" description={intakeNotice} />
      ) : null}

      {canCreateFieldLead && isIntakeOpen ? (
        <section className="field-intake-panel">
          <SectionHeader
            compact
            title="Nieuwe klant of lead"
            description="Leg de klant vast terwijl je onderweg bent. Maak meteen een dossier aan als er gemeten of opgevolgd moet worden."
            actions={
              <Button
                leftIcon={<X size={16} aria-hidden="true" />}
                onClick={() => setIsIntakeOpen(false)}
                size="sm"
                variant="ghost"
              >
                Sluiten
              </Button>
            }
          />
          {intakeError ? <Alert variant="danger" description={intakeError} /> : null}
          <form className="field-intake-form" onSubmit={createFieldLead}>
            <div className="grid two-column-even">
              <Field htmlFor="field-lead-type" label="Type">
                <Select
                  id="field-lead-type"
                  value={leadType}
                  onChange={(event) => setLeadType(event.target.value as CustomerType)}
                >
                  <option value="private">Particulier</option>
                  <option value="business">Zakelijk</option>
                </Select>
              </Field>
              <Field htmlFor="field-lead-name" label="Naam" required>
                <Input
                  id="field-lead-name"
                  value={leadName}
                  onChange={(event) => setLeadName(event.target.value)}
                  placeholder="Bijv. Familie Jansen"
                  required
                />
              </Field>
            </div>

            <div className="grid two-column-even">
              <Field htmlFor="field-lead-phone" label="Telefoon">
                <Input
                  id="field-lead-phone"
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.target.value)}
                  placeholder="06..."
                />
              </Field>
              <Field htmlFor="field-lead-email" label="E-mail">
                <Input
                  id="field-lead-email"
                  type="email"
                  value={leadEmail}
                  onChange={(event) => setLeadEmail(event.target.value)}
                  placeholder="naam@example.nl"
                />
              </Field>
            </div>

            <div className="grid three-column">
              <Field htmlFor="field-lead-street" label="Straat">
                <Input
                  id="field-lead-street"
                  value={leadStreet}
                  onChange={(event) => setLeadStreet(event.target.value)}
                />
              </Field>
              <Field htmlFor="field-lead-house-number" label="Huisnr.">
                <Input
                  id="field-lead-house-number"
                  value={leadHouseNumber}
                  onChange={(event) => setLeadHouseNumber(event.target.value)}
                />
              </Field>
              <Field htmlFor="field-lead-postal-code" label="Postcode">
                <Input
                  id="field-lead-postal-code"
                  value={leadPostalCode}
                  onChange={(event) => setLeadPostalCode(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid two-column-even">
              <Field htmlFor="field-lead-city" label="Plaats">
                <Input
                  id="field-lead-city"
                  value={leadCity}
                  onChange={(event) => setLeadCity(event.target.value)}
                />
              </Field>
              <Field htmlFor="field-lead-project-title" label="Dossiernaam">
                <Input
                  id="field-lead-project-title"
                  disabled={!createDossier}
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder={leadName.trim() ? `${leadName.trim()} - inmeten` : "Automatisch op klantnaam"}
                />
              </Field>
            </div>

            <Field htmlFor="field-lead-notes" label="Notitie">
              <Textarea
                id="field-lead-notes"
                rows={3}
                value={leadNotes}
                onChange={(event) => setLeadNotes(event.target.value)}
                placeholder="Korte aanleiding, gewenste ruimte of afspraaknotitie."
              />
            </Field>

            <div className="field-intake-footer">
              <Checkbox
                checked={createDossier}
                label="Direct dossier voor inmeten/opvolging aanmaken"
                description="Na opslaan opent de buitendienst meteen het nieuwe dossier."
                onChange={(event) => setCreateDossier(event.target.checked)}
              />
              <div className="field-intake-actions">
                <Button
                  onClick={() => {
                    resetIntakeForm();
                    setIntakeError(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Wissen
                </Button>
                <Button
                  disabled={!leadName.trim()}
                  isLoading={isSavingLead}
                  leftIcon={<ClipboardList size={17} aria-hidden="true" />}
                  type="submit"
                  variant="primary"
                >
                  {createDossier ? "Opslaan en dossier openen" : "Lead vastleggen"}
                </Button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

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
