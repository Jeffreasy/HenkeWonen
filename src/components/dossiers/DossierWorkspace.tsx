import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import {
  formatCustomerStatus,
  formatProjectStatus,
  formatQuoteStatus
} from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalCustomer, PortalProject, QuoteStatus } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";

type DossierWorkspaceProps = {
  session: AppSession;
};

type DossierWorkspaceResult = {
  customers: PortalCustomer[];
  projects: PortalProject[];
  quotes: DossierQuoteSummary[];
};

type DossierQuoteSummary = {
  id: string;
  tenantId: string;
  projectId: string;
  customerId: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  subtotalExVat: number;
  vatTotal: number;
  totalIncVat: number;
  createdByExternalUserId?: string;
  createdAt: number;
  updatedAt: number;
};

type DossierType = "all" | "customer" | "project" | "quote";

type DossierSearchRow = {
  id: string;
  type: Exclude<DossierType, "all">;
  typeLabel: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  href: string;
  updatedAt: number;
  amountLabel?: string;
  searchText: string;
};

const emptyWorkspace: DossierWorkspaceResult = {
  customers: [],
  projects: [],
  quotes: []
};

const typeOptions: Array<{ value: DossierType; label: string }> = [
  { value: "customer", label: "Klanten" },
  { value: "all", label: "Alles" },
  { value: "project", label: "Projecten" },
  { value: "quote", label: "Offertes" }
];

const defaultDossierTypeFilter: DossierType = "customer";
const dossierTypePreferenceKey = "henke-wonen:dossier-type-filter";
const dossierTypes = new Set<DossierType>(typeOptions.map((option) => option.value));

function joinParts(parts: Array<string | number | undefined | null>) {
  return parts.filter(Boolean).join(" - ");
}

function isDossierType(value: string | null): value is DossierType {
  return value !== null && dossierTypes.has(value as DossierType);
}

export default function DossierWorkspace({ session }: DossierWorkspaceProps) {
  const [workspace, setWorkspace] = useState<DossierWorkspaceResult>(emptyWorkspace);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DossierType>(defaultDossierTypeFilter);
  const canCreateDossiers = canEditDossiers(session.role);

  useEffect(() => {
    const storedTypeFilter = window.localStorage.getItem(dossierTypePreferenceKey);

    if (isDossierType(storedTypeFilter)) {
      setTypeFilter(storedTypeFilter);
    }
  }, []);

  function handleTypeFilter(nextTypeFilter: DossierType) {
    setTypeFilter(nextTypeFilter);
    window.localStorage.setItem(dossierTypePreferenceKey, nextTypeFilter);
  }

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    const convexClient = client;

    async function loadWorkspace() {
      setIsLoading(true);
      setError(null);

      try {
        const result = (await convexClient.query(api.portal.dossierWorkspace, {
          tenantSlug: session.tenantId
        })) as DossierWorkspaceResult;

        if (isActive) {
          setWorkspace({
            customers: result.customers,
            projects: result.projects,
            quotes: result.quotes
          });
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Dossiers konden niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      isActive = false;
    };
  }, [session.tenantId]);

  const customerById = useMemo(
    () => new Map(workspace.customers.map((customer) => [customer.id, customer])),
    [workspace.customers]
  );
  const projectById = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project])),
    [workspace.projects]
  );

  const rows = useMemo<DossierSearchRow[]>(() => {
    const customerRows = workspace.customers.map((customer) => {
      const subtitle = joinParts([customer.email, customer.phone, customer.city]);

      return {
        id: `customer-${customer.id}`,
        type: "customer" as const,
        typeLabel: "Klant",
        title: customer.displayName,
        subtitle: subtitle || "Geen contactgegevens",
        status: customer.status,
        statusLabel: formatCustomerStatus(customer.status),
        href: `/portal/klanten/${customer.id}`,
        updatedAt: customer.updatedAt,
        searchText: joinParts([
          customer.displayName,
          customer.email,
          customer.phone,
          customer.city,
          customer.notes,
          customer.status
        ]).toLowerCase()
      };
    });

    const projectRows = workspace.projects.map((project) => {
      const customer = customerById.get(project.customerId);

      return {
        id: `project-${project.id}`,
        type: "project" as const,
        typeLabel: "Project",
        title: project.title,
        subtitle: joinParts([customer?.displayName, project.description]) || "Geen omschrijving",
        status: project.status,
        statusLabel: formatProjectStatus(project.status),
        href: `/portal/projecten/${project.id}`,
        updatedAt: project.updatedAt,
        searchText: joinParts([
          project.title,
          project.description,
          project.status,
          customer?.displayName,
          project.internalNotes,
          project.customerNotes
        ]).toLowerCase()
      };
    });

    const quoteRows = workspace.quotes.map((quote) => {
      const customer = customerById.get(quote.customerId);
      const project = projectById.get(quote.projectId);

      return {
        id: `quote-${quote.id}`,
        type: "quote" as const,
        typeLabel: "Offerte",
        title: `${quote.quoteNumber} - ${quote.title}`,
        subtitle: joinParts([customer?.displayName, project?.title]) || "Geen gekoppeld dossier",
        status: quote.status,
        statusLabel: formatQuoteStatus(quote.status),
        href: `/portal/offertes/${quote.id}`,
        updatedAt: quote.updatedAt,
        amountLabel: formatEuro(quote.totalIncVat),
        searchText: joinParts([
          quote.quoteNumber,
          quote.title,
          quote.status,
          customer?.displayName,
          project?.title
        ]).toLowerCase()
      };
    });

    return [...projectRows, ...customerRows, ...quoteRows].sort(
      (left, right) => right.updatedAt - left.updatedAt
    );
  }, [customerById, projectById, workspace.customers, workspace.projects, workspace.quotes]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesType = typeFilter === "all" || row.type === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        row.searchText.includes(normalizedSearch) ||
        row.title.toLowerCase().includes(normalizedSearch) ||
        row.subtitle.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [rows, search, typeFilter]);

  const openProjects = workspace.projects.filter(
    (project) => !["closed", "cancelled", "paid"].includes(project.status)
  );
  const openQuotes = workspace.quotes.filter(
    (quote) => quote.status === "draft" || quote.status === "sent"
  );

  const columns: Array<DataTableColumn<DossierSearchRow>> = [
    {
      key: "dossier",
      header: "Dossier",
      priority: "primary",
      render: (row) => (
        <div className="stack-sm">
          <a href={row.href}>
            <strong>{row.title}</strong>
          </a>
          <small className="muted">{row.subtitle}</small>
        </div>
      )
    },
    {
      key: "type",
      header: "Soort",
      width: "120px",
      render: (row) => <StatusBadge status={row.type} label={row.typeLabel} />
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      render: (row) => <StatusBadge status={row.status} label={row.statusLabel} />
    },
    {
      key: "updated",
      header: "Bijgewerkt",
      width: "120px",
      hideOnMobile: true,
      render: (row) => formatDate(row.updatedAt)
    },
    {
      key: "amount",
      header: "Waarde",
      align: "right",
      width: "130px",
      hideOnMobile: true,
      render: (row) => row.amountLabel ?? "-"
    },
    {
      key: "action",
      header: "",
      align: "right",
      width: "120px",
      render: (row) => (
        <a className="ui-button ui-button-secondary ui-button-sm" href={row.href}>
          Openen
        </a>
      )
    }
  ];

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Dossiers niet geladen" description={error} /> : null}

      <section className="grid three-column">
        <StatCard label="Klanten" value={workspace.customers.length} tone="info" />
        <StatCard label="Lopende projecten" value={openProjects.length} tone="warning" />
        <StatCard label="Open offertes" value={openQuotes.length} tone="success" />
      </section>

      <section className="panel dossier-search-panel">
        <SectionHeader
          compact
          title="Zoeken in alle dossiers"
          description="Zoek op klant, project, plaats, telefoonnummer, offerte of status."
        />
        <FilterBar
          search={
            <SearchInput
              aria-label="Dossiers zoeken"
              placeholder="Zoek klant, project, offerte, plaats of status"
              value={search}
              onChange={setSearch}
            />
          }
          filters={
            <Field label="Toon" htmlFor="dossier-type-filter">
              <Select
                id="dossier-type-filter"
                value={typeFilter}
                onChange={(event) => handleTypeFilter(event.target.value as DossierType)}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          }
        />
        <DataTable
          ariaLabel="Dossiers"
          columns={columns}
          density="compact"
          emptyDescription="Pas je zoekopdracht aan of maak een nieuw klant- of projectdossier aan."
          emptyTitle="Geen dossiers gevonden"
          getRowKey={(row) => row.id}
          loading={isLoading}
          rows={filteredRows}
        />
      </section>

      {canCreateDossiers ? (
        <section className="grid two-column-even" aria-label="Nieuwe dossieracties">
          <a className="card" href="/portal/klanten">
            <span className="badge accent">Nieuwe aanvraag</span>
            <h2>Klant vastleggen</h2>
            <p className="muted">Maak een klantdossier aan wanneer iemand belt, mailt of langskomt.</p>
          </a>

          <a className="card" href="/portal/projecten">
            <span className="badge accent">Werk starten</span>
            <h2>Project aanmaken</h2>
            <p className="muted">Start een project vanuit een bestaande klant voor inmeten, offerte en uitvoering.</p>
          </a>
        </section>
      ) : null}
    </div>
  );
}
