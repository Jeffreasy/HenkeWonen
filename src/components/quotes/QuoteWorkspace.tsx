import { ArrowLeft } from "lucide-react";
import { navigate } from "astro:transitions/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditQuotes, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  QuoteStatus,
  QuoteTemplate
} from "../../lib/portalTypes";
import { showErrorToast, showToast } from "../../lib/toast";
import { Alert } from "../ui/feedback/Alert";
import { EmptyState } from "../ui/feedback/EmptyState";
import { QuoteDetailSkeleton } from "./QuoteDetailSkeleton";
import { FormModal } from "../ui/overlays/FormModal";
import QuoteBuilder from "./QuoteBuilder";
import type { QuoteLineFormValues } from "./quote/quoteTypes";
import { quoteLineFormToApi } from "./quote/quoteTypes";
import { QuoteStats } from "./QuoteStats";
import { CreateQuoteForm } from "./CreateQuoteForm";
import { QuotesTable } from "./QuotesTable";

type QuoteWorkspaceProps = {
  session: AppSession;
  quoteId?: string;
};

type QuoteWorkspaceResult = {
  customers: PortalCustomer[];
  projects: PortalProject[];
  quotes: PortalQuote[];
  templates: QuoteTemplate[];
  /** Klant-zichtbare afspraken voor het Afsprakenblok op de klantversie. */
  klantAfspraken?: Array<{ titel: string; omschrijving?: string }>;
};

type StatusFilter = "all" | QuoteStatus;

const DAY_MS = 24 * 60 * 60 * 1000;

function invoicePaymentTermDays(customer?: PortalCustomer | null) {
  return customer?.type === "business" ? 21 : 8;
}

function shouldOpenNewQuoteModal() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("open") === "nieuw"
  );
}

/** Vooraf gekozen project bij "Offerte maken" vanuit een dossier (?project=<id>). */
function newQuoteProjectFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("project") ?? "";
}

export default function QuoteWorkspace({ session, quoteId }: QuoteWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [quotes, setQuotes] = useState<PortalQuote[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [klantAfspraken, setKlantAfspraken] = useState<Array<{ titel: string; omschrijving?: string }>>([]);
  // Selectie volgt nu de route: /portal/offertes (lijst) vs /portal/offertes/[id] (detail).
  const selectedQuoteId = quoteId ?? null;
  const isDetailMode = Boolean(quoteId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(shouldOpenNewQuoteModal);
  const canEditQuote = canEditQuotes(session.role);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Detailpagina laadt alleen de betreffende offerte; de lijst laadt de volledige werkruimte.
      const result = (
        quoteId
          ? await client.query(api.portal.quoteDetailWorkspace, {
              tenantSlug: session.tenantId,
              quoteId
            })
          : await client.query(api.portal.listQuotesWorkspace, {
              tenantSlug: session.tenantId
            })
      ) as QuoteWorkspaceResult;

      setCustomers(result.customers);
      setProjects(result.projects);
      setQuotes(result.quotes);
      setTemplates(result.templates ?? []);
      setKlantAfspraken(result.klantAfspraken ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError("Offertes konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [quoteId, session.tenantId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateQuote(projectId: string, title: string, templateId: string) {
    const client = createConvexHttpClient(session);

    if (!client) {
      showToast({
        title: "Verbinding mislukt",
        description: "Kan de omgeving niet bereiken.",
        tone: "error"
      });
      return;
    }

    try {
      const newQuoteId = String(
        await client.mutation(api.portal.createQuote, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          projectId,
          titel: title.trim(),
          templateId: templateId || undefined,
          createdByExternalUserId: session.userId
        })
      );

      setIsNewQuoteModalOpen(false);
      showToast({ title: "Offerte aangemaakt", description: title.trim(), tone: "success" });
      void navigate(`/portal/offertes/${newQuoteId}`);
    } catch (createError) {
      showErrorToast(createError, "Offerte aanmaken mislukt");
    }
  }

  async function addQuoteLine(line: QuoteLineFormValues): Promise<string | void> {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      const lineId = await client.mutation(api.portal.addQuoteLine, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuoteId,
        ...quoteLineFormToApi(line)
      });
      await loadWorkspace();
      return String(lineId);
    } catch (mutationError) {
      showErrorToast(mutationError, "Regel toevoegen mislukt");
      throw mutationError;
    }
  }

  async function deleteQuoteLine(lineId: string) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
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
      showErrorToast(mutationError, "Regel verwijderen mislukt");
      throw mutationError;
    }
  }

  async function updateQuoteLine(lineId: string, line: QuoteLineFormValues) {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
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
      showErrorToast(mutationError, "Regel bijwerken mislukt");
      throw mutationError;
    }
  }

  async function updateQuoteTerms(terms: string[], paymentTerms: string[]) {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuoteTerms, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuoteId,
        voorwaarden: terms,
        betalingsvoorwaarden: paymentTerms
      });
      await loadWorkspace();
      showToast({ title: "Voorwaarden opgeslagen", tone: "success" });
    } catch (mutationError) {
      showErrorToast(mutationError, "Voorwaarden opslaan mislukt");
      throw mutationError;
    }
  }

  async function updateQuoteTexts(introText: string, closingText: string) {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuoteId,
        inleidingTekst: introText,
        afsluitTekst: closingText
      });
      await loadWorkspace();
      showToast({ title: "Teksten opgeslagen", tone: "success" });
    } catch (mutationError) {
      showErrorToast(mutationError, "Teksten opslaan mislukt");
      throw mutationError;
    }
  }

  async function updateQuoteStatus(status: QuoteStatus) {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      await client.mutation(api.portal.updateQuoteStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuoteId,
        status
      });
      await loadWorkspace();
      showToast({ title: "Status bijgewerkt", tone: "success" });
    } catch (mutationError) {
      showErrorToast(mutationError, "Status bijwerken mislukt");
      throw mutationError;
    }
  }

  async function handleCreateInvoice(): Promise<string | null> {
    if (!selectedQuoteId) {
      return null;
    }

    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return null;
    }

    const dueDate = Date.now() + invoicePaymentTermDays(selectedCustomer) * DAY_MS;

    try {
      const result = (await client.mutation(api.portal.createInvoiceFromQuote, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        quoteId: selectedQuoteId,
        vervaldatum: dueDate
      })) as { invoiceId: string; invoiceNumber: string; alreadyExists: boolean };

      showToast({
        title: result.alreadyExists ? "Factuur bestond al" : "Factuur aangemaakt",
        description: result.invoiceNumber,
        tone: "success"
      });
      return result.invoiceId;
    } catch (mutationError) {
      showErrorToast(mutationError, "Factuur aanmaken mislukt");
      throw mutationError;
    }
  }

  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId) ?? null;
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const selectedCustomer = selectedQuote ? customerById.get(selectedQuote.klantId) : undefined;
  const selectedProject = selectedQuote ? projectById.get(selectedQuote.projectId) : undefined;

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      const customer = customerById.get(quote.klantId);
      const matchesSearch =
        !normalizedSearch ||
        [quote.offertenummer, quote.titel, quote.status, customer?.weergaveNaam]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || quote.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customerById, quotes, search, statusFilter]);

  const stats = useMemo(() => {
    const draftCount = quotes.filter((quote) => quote.status === "draft").length;
    const totalValue = quotes.reduce((sum, quote) => sum + quote.totaalInclBtw, 0);
    return { draftCount, totalValue, total: quotes.length };
  }, [quotes]);

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Offertes niet geladen" description={error} /> : null}

      {isDetailMode ? (
        <>
          <div className="toolbar">
            {selectedProject ? (
              <a
                className="ui-button ui-button-secondary ui-button-sm"
                href={`/portal/projecten/${selectedProject.id}`}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Terug naar dossier
              </a>
            ) : null}
            <a className="ui-button ui-button-ghost ui-button-sm" href="/portal/offertes">
              <ArrowLeft size={16} aria-hidden="true" />
              Terug naar offertes
            </a>
          </div>

          {selectedQuote ? (
            <QuoteBuilder
              quote={selectedQuote}
              customer={selectedCustomer}
              canEdit={canEditQuote}
              session={session}
              project={selectedProject}
              klantAfspraken={klantAfspraken}
              quoteTemplates={templates}
              onAddLine={addQuoteLine}
              onDeleteLine={deleteQuoteLine}
              onUpdateLine={updateQuoteLine}
              onUpdateStatus={updateQuoteStatus}
              onMeasurementLinesImported={loadWorkspace}
              onUpdateTerms={updateQuoteTerms}
              onUpdateTexts={updateQuoteTexts}
              onCreateInvoice={handleCreateInvoice}
            />
          ) : isLoading ? (
            <QuoteDetailSkeleton />
          ) : (
            <EmptyState
              title="Offerte niet gevonden"
              description="Deze offerte bestaat niet (meer) of je hebt er geen toegang toe."
              action={
                <a className="ui-button ui-button-secondary ui-button-md" href="/portal/offertes">
                  Naar offertes
                </a>
              }
            />
          )}
        </>
      ) : (
        <>
          <QuoteStats
            total={stats.total}
            draftCount={stats.draftCount}
            totalValue={stats.totalValue}
            isLoading={isLoading}
          />

          <QuotesTable
            quotes={filteredQuotes}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            isLoading={isLoading}
            onNew={canEditQuote ? () => setIsNewQuoteModalOpen(true) : undefined}
            customerById={customerById}
          />

          {canEditQuote ? (
            <FormModal
              open={isNewQuoteModalOpen}
              title="Nieuwe offerte starten"
              description="Selecteer een project en geef de offerte een naam."
              size="sm"
              onClose={() => setIsNewQuoteModalOpen(false)}
            >
              <CreateQuoteForm
                projects={projects}
                templates={templates}
                defaultProjectId={newQuoteProjectFromUrl()}
                onCreateQuote={handleCreateQuote}
              />
            </FormModal>
          ) : null}
        </>
      )}
    </div>
  );
}
