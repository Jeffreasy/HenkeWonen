import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditQuotes, type AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  QuoteStatus,
  QuoteTemplate
} from "../../lib/portalTypes";
import { formatEuro } from "../../lib/money";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { Input } from "../ui/Input";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import QuoteBuilder from "./QuoteBuilder";
import type { QuoteLineFormValues } from "./QuoteLineEditor";

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

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statussen" },
  { value: "draft", label: formatQuoteStatus("draft") },
  { value: "sent", label: formatQuoteStatus("sent") },
  { value: "accepted", label: formatQuoteStatus("accepted") },
  { value: "rejected", label: formatQuoteStatus("rejected") },
  { value: "expired", label: formatQuoteStatus("expired") },
  { value: "cancelled", label: formatQuoteStatus("cancelled") }
];

export default function QuoteWorkspace({ session, quoteId }: QuoteWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [quotes, setQuotes] = useState<PortalQuote[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState(quoteId ?? "");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
      setProjectId((current) => current || result.projects[0]?.id || "");
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

  async function createQuote(event: SubmitEventLike) {
    event.preventDefault();

    if (!projectId || !title.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    const newQuoteId = await client.mutation(api.portal.createQuote, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      title: title.trim(),
      createdByExternalUserId: session.userId
    });

    setSelectedQuoteId(String(newQuoteId));
    setTitle("");
    await loadWorkspace();
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

  const columns: Array<DataTableColumn<PortalQuote>> = [
    {
      key: "quote",
      header: "Offerte",
      priority: "primary",
      render: (quote) => (
        <button
          className="quote-select-button"
          type="button"
          onClick={() => setSelectedQuoteId(quote.id)}
        >
          <strong>{quote.quoteNumber}</strong>
          <span>{quote.title}</span>
        </button>
      )
    },
    {
      key: "customer",
      header: "Klant",
      render: (quote) => customerById.get(quote.customerId)?.displayName ?? "-"
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (quote) => <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
    },
    {
      key: "lines",
      header: "Offerteposten",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (quote) => quote.lines.length
    },
    {
      key: "total",
      header: "Totaal",
      align: "right",
      width: "130px",
      render: (quote) => formatEuro(quote.totalIncVat)
    }
  ];

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Offertes niet geladen" description={error} />
      ) : null}

      <section className="grid three-column">
        <StatCard label="Offertes" value={quotes.length} tone="info" />
        <StatCard
          label="Concepten"
          value={quotes.filter((quote) => quote.status === "draft").length}
          tone="warning"
        />
        <StatCard
          label="Totaalwaarde"
          value={formatEuro(quotes.reduce((sum, quote) => sum + quote.totalIncVat, 0))}
          tone="success"
        />
      </section>

      {canEditQuote ? (
        <section className="panel">
          <SectionHeader
            compact
            title="Nieuwe offerte"
            description="Start een offerte vanuit een bestaand project."
          />
          <form className="responsive-form-row" onSubmit={createQuote}>
            <Field htmlFor="quote-project" label="Project" required>
              <Select
                id="quote-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                required
              >
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="quote-title" label="Offertenaam" required>
              <Input
                id="quote-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </Field>
            <Button
              disabled={projects.length === 0}
              leftIcon={<Save size={17} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              Offerte starten
            </Button>
          </form>
        </section>
      ) : null}

      <section className="grid">
        <SectionHeader
          compact
          title="Offertes"
          description="Selecteer een offerte om posten, voorwaarden en totaal te bekijken."
        />
        <FilterBar
          search={
            <SearchInput
              aria-label="Offertes zoeken"
              placeholder="Zoek op nummer, titel of klant"
              value={search}
              onChange={setSearch}
            />
          }
          filters={
            <Field label="Status" htmlFor="quote-status-filter">
              <Select
                id="quote-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          }
        />
        <DataTable
          ariaLabel="Offertes"
          columns={columns}
          density="compact"
          emptyDescription="Maak hierboven een offerte aan of pas je filters aan."
          emptyTitle="Geen offertes gevonden"
          getRowKey={(quote) => quote.id}
          loading={isLoading}
          rows={filteredQuotes}
        />
      </section>

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
