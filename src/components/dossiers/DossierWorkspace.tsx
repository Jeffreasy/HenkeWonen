import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatCustomerStatus,
  formatProjectStatus,
  formatQuoteStatus
} from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalCustomer, PortalProject, QuoteStatus } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { DossierStats } from "./DossierStats";
import { DossierSearchPanel, type DossierType, type DossierSearchRow } from "./DossierSearchPanel";
import { DossierActions } from "./DossierActions";

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
  klantId: string;
  offertenummer: string;
  titel: string;
  status: QuoteStatus;
  verzondenOp?: number;
  geldigTot?: number;
  subtotaalExBtw: number;
  btwTotaal: number;
  totaalInclBtw: number;
  createdByExternalUserId?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

const emptyWorkspace: DossierWorkspaceResult = {
  customers: [],
  projects: [],
  quotes: []
};

const defaultDossierTypeFilter: DossierType = "customer";
const dossierTypePreferenceKey = "henke-wonen:dossier-type-filter";
const dossierTypes = new Set<DossierType>(["all", "customer", "project", "quote"]);

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
    const client = createConvexHttpClient(session);

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
      const subtitle = joinParts([customer.email, customer.telefoon, customer.plaats]);

      return {
        id: `customer-${customer.id}`,
        type: "customer" as const,
        typeLabel: "Klant",
        title: customer.weergaveNaam,
        subtitle: subtitle || "Geen contactgegevens",
        status: customer.status,
        statusLabel: formatCustomerStatus(customer.status),
        href: `/portal/klanten/${customer.id}`,
        updatedAt: customer.gewijzigdOp,
        searchText: joinParts([
          customer.weergaveNaam,
          customer.email,
          customer.telefoon,
          customer.plaats,
          customer.notities,
          customer.status
        ]).toLowerCase()
      };
    });

    const projectRows = workspace.projects.map((project) => {
      const customer = customerById.get(project.klantId);

      return {
        id: `project-${project.id}`,
        type: "project" as const,
        typeLabel: "Project",
        title: project.titel,
        subtitle: joinParts([customer?.weergaveNaam, project.omschrijving]) || "Geen omschrijving",
        status: project.status,
        statusLabel: formatProjectStatus(project.status),
        href: `/portal/projecten/${project.id}`,
        updatedAt: project.gewijzigdOp,
        searchText: joinParts([
          project.titel,
          project.omschrijving,
          project.status,
          customer?.weergaveNaam,
          project.interneNotities,
          project.klantNotities
        ]).toLowerCase()
      };
    });

    const quoteRows = workspace.quotes.map((quote) => {
      const customer = customerById.get(quote.klantId);
      const project = projectById.get(quote.projectId);

      return {
        id: `quote-${quote.id}`,
        type: "quote" as const,
        typeLabel: "Offerte",
        title: `${quote.offertenummer} - ${quote.titel}`,
        subtitle: joinParts([customer?.weergaveNaam, project?.titel]) || "Geen gekoppeld dossier",
        status: quote.status,
        statusLabel: formatQuoteStatus(quote.status),
        href: `/portal/offertes/${quote.id}`,
        updatedAt: quote.gewijzigdOp,
        amountLabel: formatEuro(quote.totaalInclBtw),
        searchText: joinParts([
          quote.offertenummer,
          quote.titel,
          quote.status,
          customer?.weergaveNaam,
          project?.titel
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

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Dossiers niet geladen" description={error} /> : null}

      <DossierActions canCreateDossiers={canCreateDossiers} />

      <DossierStats
        customersCount={workspace.customers.length}
        openProjectsCount={openProjects.length}
        openQuotesCount={openQuotes.length}
      />

      <DossierSearchPanel
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilter}
        isLoading={isLoading}
        rows={filteredRows}
      />
    </div>
  );
}
