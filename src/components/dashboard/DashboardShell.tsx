import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  Ruler,
  Search
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { canManage } from "../../lib/auth/session";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatProjectStatus, formatQuoteStatus } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalProject, QuoteStatus } from "../../lib/portalTypes";
import ProductionReadiness from "../imports/ProductionReadiness";
import { Alert } from "../ui/Alert";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

type DashboardShellProps = {
  session: AppSession;
};

type DashboardWorkItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  label: string;
  tone: BadgeVariant;
  updatedAt: number;
};

type DashboardQuoteFollowUp = {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  totalIncVat: number;
  customerName: string;
  projectTitle?: string;
  updatedAt: number;
};

type DashboardData = {
  openQuoteCount: number;
  plannedWorkCount: number;
  workItemCount: number;
  workItems: DashboardWorkItem[];
  quoteFollowUps: DashboardQuoteFollowUp[];
  projects: PortalProject[];
};

const emptyDashboard: DashboardData = {
  openQuoteCount: 0,
  plannedWorkCount: 0,
  workItemCount: 0,
  workItems: [],
  quoteFollowUps: [],
  projects: []
};

function normalizeDashboardData(result: Partial<DashboardData> | null | undefined): DashboardData {
  const workItems = Array.isArray(result?.workItems) ? result.workItems : [];

  return {
    openQuoteCount: typeof result?.openQuoteCount === "number" ? result.openQuoteCount : 0,
    plannedWorkCount: typeof result?.plannedWorkCount === "number" ? result.plannedWorkCount : 0,
    workItemCount:
      typeof result?.workItemCount === "number" ? result.workItemCount : workItems.length,
    workItems,
    quoteFollowUps: Array.isArray(result?.quoteFollowUps) ? result.quoteFollowUps : [],
    projects: Array.isArray(result?.projects) ? result.projects : []
  };
}

function loadingValue(isLoading: boolean, value: number) {
  return isLoading ? "..." : new Intl.NumberFormat("nl-NL").format(value);
}

export default function DashboardShell({ session }: DashboardShellProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showAdminReadiness = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }
    const convexClient = client;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const result = (await convexClient.query(api.portal.dashboard, {
          tenantSlug: session.tenantId
        })) as Partial<DashboardData> | null;

        if (isActive) {
          setDashboard(normalizeDashboardData(result));
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Werkoverzicht kon niet worden geladen.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [session.tenantId]);

  const focusCards = [
    {
      label: "Vandaag oppakken",
      value: dashboard.workItemCount,
      description: "Dossiers die aandacht vragen",
      href: "#werkoverzicht",
      icon: ClipboardCheck,
      tone: "warning"
    },
    {
      label: "Open offertes",
      value: dashboard.openQuoteCount,
      description: "Concepten en verzonden offertes",
      href: "/portal/offertes",
      icon: FileText,
      tone: "info"
    },
    {
      label: "Lopende uitvoering",
      value: dashboard.plannedWorkCount,
      description: "Inmeting, bestelling of uitvoering",
      href: "/portal/dossiers",
      icon: BriefcaseBusiness,
      tone: "success"
    },
    {
      label: "Buitendienst",
      value: dashboard.plannedWorkCount,
      description: "Klantbezoeken, inmeten en conceptoffertes",
      href: "/portal/buitendienst",
      icon: Ruler,
      tone: "field"
    }
  ] as const;

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Werkoverzicht niet geladen" description={error} /> : null}

      <section className="grid dashboard-grid" aria-label="Belangrijkste werkvoorraad">
        {focusCards.map((card) => {
          const Icon = card.icon;

          return (
            <a className={`card metric dashboard-focus-card dashboard-focus-card-${card.tone}`} href={card.href} key={card.label}>
              <Icon size={22} aria-hidden="true" />
              <span className="muted">{card.label}</span>
              <strong>{loadingValue(isLoading, card.value)}</strong>
              <small className="muted">{card.description}</small>
            </a>
          );
        })}
      </section>

      <div className="grid two-column">
        <section className="panel" id="werkoverzicht">
          <div className="dashboard-section-header">
            <div>
              <p className="eyebrow">Werkoverzicht</p>
              <h2>Wat moet ik vandaag doen?</h2>
              <p className="muted">Begin bij deze dossiers en werk daarna vanuit Dossiers verder.</p>
            </div>
            <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
              Alle dossiers
            </a>
          </div>

          {isLoading ? (
            <div className="empty-state">Werkvoorraad laden.</div>
          ) : dashboard.workItems.length > 0 ? (
            <div className="dashboard-work-list">
              {dashboard.workItems.map((item) => (
                <a className="dashboard-work-item" href={item.href} key={item.id}>
                  <span className="dashboard-work-copy">
                    <Badge variant={item.tone}>{item.label}</Badge>
                    <strong>{item.title}</strong>
                    <small className="muted">{item.description}</small>
                  </span>
                  <span className="dashboard-work-meta">
                    <small className="muted">{formatDate(item.updatedAt)}</small>
                    <ArrowRight size={17} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Geen directe acties"
              description="Er zijn geen nieuwe aanvragen, open offerteacties of uitvoeringsmomenten gevonden."
              action={
                <a className="ui-button ui-button-secondary ui-button-md" href="/portal/dossiers">
                  Dossiers bekijken
                </a>
              }
            />
          )}
        </section>

        <section className="panel">
          <div className="dashboard-section-header">
            <div>
              <p className="eyebrow">Offertes</p>
              <h2>Opvolgen</h2>
              <p className="muted">Concepten afmaken en verzonden offertes nalopen.</p>
            </div>
            <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/offertes">
              Offertes
            </a>
          </div>

          {isLoading ? (
            <div className="empty-state">Offertes laden.</div>
          ) : dashboard.quoteFollowUps.length > 0 ? (
            <div className="dashboard-work-list">
              {dashboard.quoteFollowUps.map((quote) => (
                <a className="dashboard-work-item" href={`/portal/offertes/${quote.id}`} key={quote.id}>
                  <span className="dashboard-work-copy">
                    <Badge variant={quote.status === "draft" ? "warning" : "info"}>
                      {formatQuoteStatus(quote.status)}
                    </Badge>
                    <strong>{quote.quoteNumber}</strong>
                    <small className="muted">
                      {quote.title} - {quote.customerName}
                    </small>
                  </span>
                  <span className="dashboard-work-meta">
                    <strong>{formatEuro(quote.totalIncVat)}</strong>
                    <ArrowRight size={17} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Geen open offertes"
              description="Er staan geen concepten of verzonden offertes open voor opvolging."
            />
          )}
        </section>
      </div>

      <section className="panel">
        <div className="dashboard-section-header">
          <div>
            <p className="eyebrow">Snel verder</p>
            <h2>Recente projectdossiers</h2>
            <p className="muted">Open lopende projecten zonder opnieuw te zoeken.</p>
          </div>
          <a className="ui-button ui-button-secondary ui-button-sm" href="/portal/dossiers">
            <Search size={15} aria-hidden="true" />
            Zoeken
          </a>
        </div>

        {isLoading ? (
          <div className="empty-state">Projecten laden.</div>
        ) : dashboard.projects.length > 0 ? (
          <div className="dashboard-project-grid">
            {dashboard.projects.map((project) => (
              <a href={`/portal/projecten/${project.id}`} className="dashboard-project-link" key={project.id}>
                <Badge variant="info">{formatProjectStatus(project.status)}</Badge>
                <strong>{project.title}</strong>
                <small className="muted">{project.description ?? "Geen omschrijving"}</small>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Geen lopende projecten"
            description="Maak een klant- en projectdossier aan zodra er een nieuwe aanvraag binnenkomt."
            action={
              <a className="ui-button ui-button-primary ui-button-md" href="/portal/dossiers">
                Naar dossiers
              </a>
            }
          />
        )}
      </section>

      {showAdminReadiness ? <ProductionReadiness session={session} /> : null}
    </div>
  );
}
