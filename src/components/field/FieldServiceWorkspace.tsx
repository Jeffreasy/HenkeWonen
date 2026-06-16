import { Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type {
  FieldWorkspaceBucket,
  FieldServiceWorkspaceResult,
  FieldWorkspaceCard
} from "../../lib/portalTypes";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { FormModal } from "../ui/overlays/FormModal";
import { SearchInput } from "../ui/forms/SearchInput";
import { FieldPrioritySummary } from "./FieldPrioritySummary";
import { FieldPageTabs } from "./FieldPageTabs";
import { FieldCardSection, type FieldSection } from "./FieldCardSection";
import { FieldIntakeForm, type IntakeFormValues } from "./FieldIntakeForm";
import { cardUrgency, type CardActionPreference, type CardUrgency } from "./FieldCard";

type FieldServiceWorkspaceProps = {
  session: AppSession;
  view?: FieldServiceView;
};

export type FieldServiceView = "today" | "measure" | "quote";
type PriorityCounts = Record<CardUrgency["level"], number>;

const fieldPages: Array<{
  view: FieldServiceView;
  href: string;
  label: string;
  shortLabel?: string;
  bucket: FieldWorkspaceBucket;
}> = [
  {
    view: "today",
    href: "/portal/buitendienst/vandaag",
    label: "Vandaag",
    bucket: "today"
  },
  {
    view: "measure",
    href: "/portal/buitendienst/inmeten",
    label: "Inmeten",
    bucket: "measure"
  },
  {
    view: "quote",
    href: "/portal/buitendienst/conceptoffertes",
    label: "Conceptoffertes",
    shortLabel: "Offertes",
    bucket: "quote"
  }
];

const pageCopy: Record<
  FieldServiceView,
  {
    title: string;
    description: string;
    searchPlaceholder: string;
  }
> = {
  today: {
    title: "Vandaag",
    description:
      "Klantbezoeken, deadlines en opvolging die nu aandacht vragen in de buitendienst werkplek.",
    searchPlaceholder: "Zoek klant, adres, taak of project"
  },
  measure: {
    title: "Inmeten",
    description:
      "Dossiers waar klantgegevens, adres en meetwerk vooraan staan, zonder afleiding van kantoor- of beheerschermen.",
    searchPlaceholder: "Zoek klant, adres of inmeetdossier"
  },
  quote: {
    title: "Conceptoffertes",
    description:
      "Dossiers waar meetregels kunnen worden omgezet naar een nette Klantversie voor overleg.",
    searchPlaceholder: "Zoek klant, offerte of project"
  }
};

const sectionCopy: Record<
  FieldWorkspaceBucket,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    preferredAction: CardActionPreference;
  }
> = {
  today: {
    title: "Vandaag",
    description: "Klantbezoeken en meetmomenten die direct aandacht vragen.",
    emptyTitle: "Geen bezoeken voor vandaag",
    emptyDescription: "Er staan nu geen klantbezoeken met een meetmoment voor vandaag klaar.",
    preferredAction: "measure"
  },
  measure: {
    title: "Inmeten",
    description: "Dossiers waar klantgegevens, adres en inmeting vooraan staan.",
    emptyTitle: "Geen dossiers om in te meten",
    emptyDescription: "Nieuwe meetdossiers verschijnen hier zodra ze aandacht vragen.",
    preferredAction: "measure"
  },
  quote: {
    title: "Conceptoffertes",
    description: "Dossiers waar meetregels kunnen worden omgezet naar een Klantversie.",
    emptyTitle: "Geen conceptoffertes",
    emptyDescription: "Zodra een offerte voorbereid moet worden, staat het dossier hier.",
    preferredAction: "quote"
  },
  followUp: {
    title: "Opvolgen",
    description: "Offertes en lopende dossiers die na het klantbezoek terugkomen.",
    emptyTitle: "Niets om op te volgen",
    emptyDescription: "Verzonden offertes en vervolgacties komen hier terug.",
    preferredAction: "quote"
  }
};

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
    card.project.titel,
    card.project.omschrijving,
    card.customer?.weergaveNaam,
    card.customer?.email,
    card.customer?.telefoon,
    card.address,
    card.latestQuote?.offertenummer,
    card.latestQuote?.titel,
    card.nextAction,
    ...(card.tasks ?? []).map((task) => task.titel)
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

export default function FieldServiceWorkspace({
  session,
  view = "today"
}: FieldServiceWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FieldServiceWorkspaceResult>(emptyWorkspace);
  const [search, setSearch] = useState("");
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreateFieldLead = canEditDossiers(session.role);

  // Detecteer ?open=nieuw URL-param (FAB-actie vanuit FieldFab)
  useEffect(() => {
    if (typeof window === "undefined" || !canCreateFieldLead) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "nieuw") {
      setIsIntakeOpen(true);
      setIntakeError(null);
      setIntakeNotice(null);
      // Verwijder param uit URL zonder pagina reload
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      window.history.replaceState({}, "", url.toString());
    }
  }, [canCreateFieldLead]);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient(session);

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

  async function handleCreateFieldLead(values: IntakeFormValues) {
    const displayName = values.displayName;

    const client = createConvexHttpClient(session);

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
        type: values.type,
        weergaveNaam: displayName,
        email: values.email,
        telefoon: values.phone,
        straat: values.street,
        huisnummer: values.houseNumber,
        postcode: values.postalCode,
        plaats: values.city,
        notities: values.notes
      });

      if (values.createDossier) {
        const newProjectId = await client.mutation(api.portal.createProject, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          klantId: String(customerId),
          titel: values.projectTitle || `${displayName} - inmeten`,
          omschrijving: values.notes,
          createdByExternalUserId: session.userId
        });

        window.location.assign(`/portal/buitendienst/projecten/${String(newProjectId)}`);
        return;
      }

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

  const activePage = pageCopy[view];
  const primaryBucket = fieldPages.find((page) => page.view === view)?.bucket ?? "today";
  const visibleBuckets = view === "today" ? [primaryBucket, "followUp" as const] : [primaryBucket];
  const sections = useMemo<FieldSection[]>(
    () =>
      visibleBuckets.map((bucket) => ({
        bucket,
        ...sectionCopy[bucket],
        items: filterCards(workspace[bucket], search)
      })),
    [search, visibleBuckets, workspace]
  );
  const pageCards = useMemo(
    () => uniqueCards(visibleBuckets.flatMap((bucket) => workspace[bucket])),
    [visibleBuckets, workspace]
  );
  const priorityCounts = useMemo(
    () => countPriorities(pageCards),
    [pageCards]
  );

  return (
    <div className="grid field-workspace">
      {error ? <Alert variant="danger" title="Buitendienst niet geladen" description={error} /> : null}

      <section className="field-hero-panel">
        <div>
          <p className="eyebrow">Buitendienst werkplek</p>
          <h1>{activePage.title}</h1>
          <p>{activePage.description}</p>
          <FieldPrioritySummary priorityCounts={priorityCounts} />
        </div>
        <div className="field-hero-search">
          <SearchInput
            aria-label="Buitendienst dossiers zoeken"
            placeholder={activePage.searchPlaceholder}
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
                  setIsIntakeOpen(true);
                  setIntakeError(null);
                  setIntakeNotice(null);
                }}
                variant="primary"
              >
                Nieuwe klant/lead
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <FieldPageTabs activeView={view} counts={workspace.counts} />

      {intakeNotice ? (
        <Alert variant="success" title="Lead vastgelegd" description={intakeNotice} />
      ) : null}

      {canCreateFieldLead ? (
        <FormModal
          open={isIntakeOpen}
          title="Nieuwe klant of lead"
          description="Leg klantgegevens vast voor de buitendienst. Maak direct een dossier aan als er gemeten of opgevolgd moet worden."
          size="lg"
          onClose={() => setIsIntakeOpen(false)}
        >
          <FieldIntakeForm
            onSubmit={handleCreateFieldLead}
            isSaving={isSavingLead}
            error={intakeError}
          />
        </FormModal>
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
