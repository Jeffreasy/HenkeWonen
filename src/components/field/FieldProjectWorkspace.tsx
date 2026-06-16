import { FileText, Printer, Ruler, Save } from "lucide-react";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditQuotes, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import { showToast } from "../../lib/toast";
import type { FieldProjectWorkspaceResult, PortalQuote } from "../../lib/portalTypes";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import MeasurementPanel from "../projects/MeasurementPanel";
import QuoteBuilder from "../quotes/QuoteBuilder";
import type { QuoteLineFormValues } from "../quotes/QuoteLineEditor";
import { quoteLineFormToApi } from "../quotes/quote/quoteTypes";
import { FieldVisitHeader, type FieldUrgency } from "./FieldVisitHeader";
import { FieldActionPlan } from "./FieldActionPlan";
import { FieldProjectDetailsGrid } from "./FieldProjectDetailsGrid";

type FieldProjectWorkspaceProps = {
  session: AppSession;
  projectId: string;
};

function customerAddress(workspace: FieldProjectWorkspaceResult) {
  const customer = workspace.customer;

  if (!customer) {
    return undefined;
  }

  return [customer.straat, customer.huisnummer, customer.postcode, customer.plaats]
    .filter(Boolean)
    .join(" ");
}

function pickInitialQuote(quotes: PortalQuote[]) {
  return (
    quotes.find((quote) => quote.status === "draft") ??
    quotes.find((quote) => quote.status === "sent") ??
    quotes.find((quote) => quote.status === "accepted") ??
    quotes[0]
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function visitUrgency(workspace: FieldProjectWorkspaceResult): FieldUrgency {
  const openTask = workspace.tasks.find((task) => task.status === "open");

  if (openTask) {
    return {
      level: openTask.priority.level,
      label: openTask.priority.label,
      title: openTask.titel,
      description: `Deadline ${formatDate(openTask.vervaltOp)}.`
    };
  }

  const measurementStatus = workspace.visit.measurementStatus;

  if (measurementStatus === "reviewed" || measurementStatus === "converted_to_quote") {
    return {
      level: "green",
      label: "Groen",
      title: "Op schema",
      description: "De inmeting is afgerond of gecontroleerd."
    };
  }

  if (!workspace.visit.visitAt) {
    return {
      level: "orange",
      label: "Oranje",
      title: "Meetmoment ontbreekt",
      description: "Plan of bevestig het bezoek voordat je verder werkt."
    };
  }

  const daysUntilVisit = Math.floor((workspace.visit.visitAt - startOfToday()) / DAY_MS);

  if (daysUntilVisit <= 1) {
    return {
      level: "red",
      label: "Rood",
      title: daysUntilVisit < 0 ? "Afspraak is verlopen" : "Afspraak heeft haast",
      description: "Vandaag of uiterlijk morgen oppakken."
    };
  }

  if (daysUntilVisit <= 7) {
    return {
      level: "orange",
      label: "Oranje",
      title: "Binnenkort opmeten",
      description: "Voorbereiden en klantgegevens controleren."
    };
  }

  return {
    level: "green",
    label: "Groen",
    title: "Rustig ingepland",
    description: "Er is nog voldoende tijd tot het meetmoment."
  };
}

export default function FieldProjectWorkspace({ session, projectId }: FieldProjectWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FieldProjectWorkspaceResult | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditQuote = canEditQuotes(session.role);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan dit klantbezoek nu niet bereiken.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.portal.fieldProjectWorkspace, {
        tenantSlug: session.tenantId,
        projectId
      })) as FieldProjectWorkspaceResult | null;

      setWorkspace(result);
      setSelectedQuoteId((current) => {
        if (!result) {
          return "";
        }

        return current || pickInitialQuote(result.quotes)?.id || "";
      });
    } catch (loadError) {
      console.error(loadError);
      setError("Klantbezoek kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session.tenantId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const selectedQuote = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return workspace.quotes.find((quote) => quote.id === selectedQuoteId) ?? pickInitialQuote(workspace.quotes) ?? null;
  }, [selectedQuoteId, workspace]);
  const draftQuote = workspace?.quotes.find((quote) => quote.status === "draft") ?? null;
  const address = workspace ? customerAddress(workspace) : undefined;
  const canEditSelectedQuote = canEditQuote && selectedQuote?.status === "draft";
  const canCreateConceptQuote = canEditQuote && !draftQuote && !selectedQuote;

  async function createConceptQuote() {
    if (!workspace || isCreatingQuote) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de conceptofferte nu niet maken.");
      return;
    }

    setIsCreatingQuote(true);
    setError(null);

    try {
      const quoteId = await client.mutation(api.portal.createQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        projectId: workspace.project.id,
        titel: `${workspace.project.titel} - conceptofferte`,
        createdByExternalUserId: session.userId
      });

      setSelectedQuoteId(String(quoteId));
      await loadWorkspace();
    } catch (createError) {
      console.error(createError);
      setError("Conceptofferte kon niet worden gemaakt.");
    } finally {
      setIsCreatingQuote(false);
    }
  }

  async function addQuoteLine(line: QuoteLineFormValues): Promise<string | void> {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de offertepost nu niet opslaan.");
      return;
    }

    try {
      const lineId = await client.mutation(api.portal.addQuoteLine, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuote.id,
        ...quoteLineFormToApi(line)
      });
      await loadWorkspace();
      return String(lineId);
    } catch (mutationError) {
      console.error(mutationError);
      showToast({ title: "Regel toevoegen mislukt", tone: "error" });
      throw mutationError;
    }
  }

  async function deleteQuoteLine(lineId: string) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de offertepost nu niet verwijderen.");
      return;
    }

    try {
      await client.mutation(api.portal.deleteQuoteLine, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        lineId
      });
      await loadWorkspace();
      showToast({ title: "Regel verwijderd", tone: "success" });
    } catch (mutationError) {
      console.error(mutationError);
      showToast({ title: "Regel verwijderen mislukt", tone: "error" });
      throw mutationError;
    }
  }

  async function updateQuoteLine(lineId: string, line: QuoteLineFormValues) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de offertepost nu niet aanpassen.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuoteLine, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        lineId,
        ...quoteLineFormToApi(line)
      });
      await loadWorkspace();
    } catch (mutationError) {
      console.error(mutationError);
      showToast({ title: "Regel bijwerken mislukt", tone: "error" });
      throw mutationError;
    }
  }

  async function updateQuoteStatus(status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled") {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de offerte nu niet verwerken.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuoteStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuote.id,
        status
      });
      await loadWorkspace();
      showToast({ title: "Status bijgewerkt", tone: "success" });
    } catch (mutationError) {
      console.error(mutationError);
      showToast({
        title:
          mutationError instanceof ConvexError
            ? String(mutationError.data)
            : "Status bijwerken mislukt",
        tone: "error"
      });
      throw mutationError;
    }
  }

  async function updateQuoteTerms(terms: string[], paymentTerms: string[]) {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de klantversie nu niet opslaan.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuoteTerms, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuote.id,
        voorwaarden: terms,
        betalingsvoorwaarden: paymentTerms
      });
      await loadWorkspace();
      showToast({ title: "Voorwaarden opgeslagen", tone: "success" });
    } catch (mutationError) {
      console.error(mutationError);
      showToast({ title: "Voorwaarden opslaan mislukt", tone: "error" });
      throw mutationError;
    }
  }

  async function updateQuoteTexts(introText: string, closingText: string) {
    if (!selectedQuote) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de offerteteksten nu niet opslaan.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuote.id,
        inleidingTekst: introText,
        afsluitTekst: closingText
      });
      await loadWorkspace();
      showToast({ title: "Teksten opgeslagen", tone: "success" });
    } catch (mutationError) {
      console.error(mutationError);
      showToast({ title: "Teksten opslaan mislukt", tone: "error" });
      throw mutationError;
    }
  }

  if (isLoading) {
    return (
      <div className="panel field-loading-state">
        Klantbezoek voor Inmeten, Conceptofferte en Klantversie laden...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="grid">
        {error ? <Alert variant="danger" title="Klantbezoek niet geladen" description={error} /> : null}
        <EmptyState
          title="Klantbezoek niet gevonden"
          description="Dit dossier bestaat niet of hoort niet bij deze werkplek."
        />
      </div>
    );
  }

  const urgency = visitUrgency(workspace);
  const openTasks = workspace.tasks.filter((task) => task.status === "open");

  return (
    <div className="grid field-project-workspace">
      {error ? <Alert variant="danger" title="Klantbezoek niet geladen" description={error} /> : null}

      <FieldVisitHeader
        project={workspace.project}
        visit={workspace.visit}
        customer={workspace.customer}
        urgency={urgency}
      />

      <FieldActionPlan
        customerDisplayName={workspace.customer?.weergaveNaam ?? "Onbekende klant"}
        address={address}
        measurementStatus={workspace.visit.measurementStatus}
        selectedQuoteStatus={selectedQuote?.status}
        openTasks={openTasks}
      />

      <FieldProjectDetailsGrid
        customer={workspace.customer}
        address={address}
        visit={workspace.visit}
        projectNotes={workspace.project.klantNotities ?? workspace.project.omschrijving ?? undefined}
      />

      <section className="field-measurement-section" id="inmeten">
        <SectionHeader
          compact
          title="Inmeten"
          description="Leg ruimtes en meetregels vast voor vloeren, ramen en andere werkzaamheden."
          actions={<Ruler size={20} aria-hidden="true" />}
        />
        <MeasurementPanel
          mode="field"
          session={session}
          tenantId={session.tenantId}
          projectId={workspace.project.id}
          customerId={workspace.customer?.id ?? workspace.project.klantId}
          projectRooms={workspace.project.rooms}
        />
      </section>

      <section className="field-quote-section" id="conceptofferte">
        <SectionHeader
          compact
          title="Conceptofferte"
          description="Werk aan posten, voorwaarden en een nette Klantversie op basis van de inmeting."
          actions={
            canCreateConceptQuote ? (
              <Button
                isLoading={isCreatingQuote}
                leftIcon={<Save size={17} aria-hidden="true" />}
                onClick={createConceptQuote}
                variant="primary"
              >
                Conceptofferte maken
              </Button>
            ) : selectedQuote ? (
              <span className="field-customer-version">
                <Printer size={17} aria-hidden="true" />
                Klantversie
              </span>
            ) : null
          }
        />

        {workspace.quotes.length > 1 ? (
          <div className="field-quote-tabs" aria-label="Conceptoffertes">
            {workspace.quotes.map((quote) => (
              <button
                key={quote.id}
                className={quote.id === selectedQuote?.id ? "field-quote-tab active" : "field-quote-tab"}
                type="button"
                onClick={() => setSelectedQuoteId(quote.id)}
              >
                <FileText size={16} aria-hidden="true" />
                <span>{quote.offertenummer}</span>
                <small>{formatQuoteStatus(quote.status)}</small>
              </button>
            ))}
          </div>
        ) : null}

        {selectedQuote ? (
          <QuoteBuilder
            mode="field"
            quote={selectedQuote}
            customer={workspace.customer ?? undefined}
            canEdit={canEditSelectedQuote}
            session={session}
            project={workspace.project}
            quoteTemplates={workspace.templates}
            onAddLine={addQuoteLine}
            onDeleteLine={deleteQuoteLine}
            onUpdateLine={updateQuoteLine}
            onUpdateStatus={updateQuoteStatus}
            onMeasurementLinesImported={loadWorkspace}
            onUpdateTerms={updateQuoteTerms}
            onUpdateTexts={updateQuoteTexts}
          />
        ) : (
          <EmptyState
            title="Nog geen conceptofferte"
            description={
              canEditQuote
                ? "Maak een conceptofferte zodra de inmeting voldoende is uitgewerkt."
                : "Je kunt de klantgegevens en inmeting bekijken, maar geen offerte opslaan."
            }
          />
        )}
      </section>
    </div>
  );
}
