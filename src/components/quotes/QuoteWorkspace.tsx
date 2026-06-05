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
import { formatEuro } from "../../lib/money";
import { showToast } from "../../lib/toast";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { FormModal } from "../ui/overlays/FormModal";
import QuoteBuilder from "./QuoteBuilder";
import type { QuoteLineFormValues } from "./quote/quoteTypes";
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
};

type StatusFilter = "all" | QuoteStatus;

export default function QuoteWorkspace({ session, quoteId }: QuoteWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [quotes, setQuotes] = useState<PortalQuote[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteId ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(false);
  const canEditQuote = canEditQuotes(session.role);

  const loadWorkspace = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.portal.listQuotesWorkspace, {
        tenantSlug: session.tenantId
      })) as QuoteWorkspaceResult;

      setCustomers(result.customers);
      setProjects(result.projects);
      setQuotes(result.quotes);
      setTemplates(result.templates ?? []);
      setSelectedQuoteId((current) => (quoteId ?? current) || result.quotes[0]?.id || "");
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

  async function handleCreateQuote(projectId: string, title: string) {
    const client = createConvexHttpClient();

    if (!client) {
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      const newQuoteId = String(
        await client.mutation(api.portal.createQuote, {
          tenantSlug: session.tenantId,
          actor: mutationActorFromSession(session),
          projectId,
          title: title.trim(),
          createdByExternalUserId: session.userId
        })
      );

      await loadWorkspace();
      setSelectedQuoteId(newQuoteId);
      setIsNewQuoteModalOpen(false);
      showToast({ title: "Offerte aangemaakt", description: title.trim(), tone: "success" });
    } catch {
      showToast({ title: "Offerte aanmaken mislukt", tone: "error" });
    }
  }

  async function addQuoteLine(line: QuoteLineFormValues): Promise<string | void> {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    const lineId = await client.mutation(api.portal.addQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuoteId,
      ...line
    });
    await loadWorkspace();
    return String(lineId);
  }

  async function deleteQuoteLine(lineId: string) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.deleteQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      lineId
    });
    await loadWorkspace();
  }

  async function updateQuoteLine(lineId: string, line: QuoteLineFormValues) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateQuoteLine, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      lineId,
      ...line
    });
    await loadWorkspace();
  }

  async function updateQuoteTerms(terms: string[], paymentTerms: string[]) {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateQuoteTerms, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuoteId,
      terms,
      paymentTerms
    });
    await loadWorkspace();
  }

  async function updateQuoteStatus(status: QuoteStatus) {
    if (!selectedQuoteId) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuoteId,
      status
    });
    await loadWorkspace();
  }

  async function handleCreateInvoice(): Promise<string | null> {
    if (!selectedQuoteId) {
      return null;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return null;
    }

    // Standaard vervaldatum: 30 dagen vanaf nu
    const dueDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const result = await client.mutation(api.portal.createInvoiceFromQuote, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      quoteId: selectedQuoteId,
      dueDate
    }) as { invoiceId: string; invoiceNumber: string; alreadyExists: boolean };

    return result.invoiceId;
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
  const selectedCustomer = selectedQuote ? customerById.get(selectedQuote.customerId) : undefined;
  const selectedProject = selectedQuote ? projectById.get(selectedQuote.projectId) : undefined;

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      const customer = customerById.get(quote.customerId);
      const matchesSearch =
        !normalizedSearch ||
        [quote.quoteNumber, quote.title, quote.status, customer?.displayName]
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
    const totalValue = quotes.reduce((sum, quote) => sum + quote.totalIncVat, 0);
    return { draftCount, totalValue, total: quotes.length };
  }, [quotes]);

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Offertes niet geladen" description={error} />
      ) : null}

      <QuoteStats
        total={stats.total}
        draftCount={stats.draftCount}
        totalValue={stats.totalValue}
      />

      <QuotesTable
        quotes={filteredQuotes}
        selectedQuoteId={selectedQuoteId}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        isLoading={isLoading}
        onNew={canEditQuote ? () => setIsNewQuoteModalOpen(true) : undefined}
        onSelectQuote={setSelectedQuoteId}
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
            onCreateQuote={handleCreateQuote}
          />
        </FormModal>
      ) : null}

      {selectedQuote ? (
        <QuoteBuilder
          quote={selectedQuote}
          customer={selectedCustomer}
          canEdit={canEditQuote}
          session={session}
          project={selectedProject}
          quoteTemplates={templates}
          onAddLine={addQuoteLine}
          onDeleteLine={deleteQuoteLine}
          onUpdateLine={updateQuoteLine}
          onUpdateStatus={updateQuoteStatus}
          onMeasurementLinesImported={loadWorkspace}
          onUpdateTerms={updateQuoteTerms}
          onCreateInvoice={handleCreateInvoice}
        />
      ) : (
        <EmptyState
          title="Geen offerte geselecteerd"
          description="Selecteer een offerte uit de lijst of maak een nieuwe offerte aan."
        />
      )}
    </div>
  );
}
