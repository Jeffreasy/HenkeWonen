import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { canManage } from "../../lib/auth/session";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { PortalProject } from "../../lib/portalTypes";
import ProductionReadiness from "../imports/ProductionReadiness";
import { Alert } from "../ui/Alert";
import { DashboardFocusCards } from "./DashboardFocusCards";
import { DashboardInvoiceStrip } from "./DashboardInvoiceStrip";
import { DashboardWorkOverview, type DashboardWorkItem } from "./DashboardWorkOverview";
import { DashboardQuoteFollowUps, type DashboardQuoteFollowUp } from "./DashboardQuoteFollowUps";
import { DashboardRecentProjects } from "./DashboardRecentProjects";

type DashboardShellProps = {
  session: AppSession;
};

type DashboardData = {
  openQuoteCount: number;
  plannedWorkCount: number;
  workItemCount: number;
  workItems: DashboardWorkItem[];
  quoteFollowUps: DashboardQuoteFollowUp[];
  projects: PortalProject[];
  invoiceStats: { openAmount: number; overdueCount: number };
};

const emptyDashboard: DashboardData = {
  openQuoteCount: 0,
  plannedWorkCount: 0,
  workItemCount: 0,
  workItems: [],
  quoteFollowUps: [],
  projects: [],
  invoiceStats: { openAmount: 0, overdueCount: 0 }
};

function normalizeDashboardData(result: Partial<DashboardData> | null | undefined): DashboardData {
  const workItems = Array.isArray(result?.workItems) ? result.workItems : [];
  const invoiceStats = result?.invoiceStats;

  return {
    openQuoteCount: typeof result?.openQuoteCount === "number" ? result.openQuoteCount : 0,
    plannedWorkCount: typeof result?.plannedWorkCount === "number" ? result.plannedWorkCount : 0,
    workItemCount:
      typeof result?.workItemCount === "number" ? result.workItemCount : workItems.length,
    workItems,
    quoteFollowUps: Array.isArray(result?.quoteFollowUps) ? result.quoteFollowUps : [],
    projects: Array.isArray(result?.projects) ? result.projects : [],
    invoiceStats: {
      openAmount: typeof invoiceStats?.openAmount === "number" ? invoiceStats.openAmount : 0,
      overdueCount: typeof invoiceStats?.overdueCount === "number" ? invoiceStats.overdueCount : 0
    }
  };
}

export default function DashboardShell({ session }: DashboardShellProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showAdminReadiness = canManage(session.role);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient(session);

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

  return (
    <div className="grid">
      {error ? <Alert variant="danger" title="Werkoverzicht niet geladen" description={error} /> : null}

      <DashboardInvoiceStrip
        isLoading={isLoading}
        openAmount={dashboard.invoiceStats.openAmount}
        overdueCount={dashboard.invoiceStats.overdueCount}
      />

      <DashboardFocusCards
        isLoading={isLoading}
        workItemCount={dashboard.workItemCount}
        openQuoteCount={dashboard.openQuoteCount}
        plannedWorkCount={dashboard.plannedWorkCount}
      />

      <div className="grid two-column">
        <DashboardWorkOverview
          isLoading={isLoading}
          workItems={dashboard.workItems}
        />

        <DashboardQuoteFollowUps
          isLoading={isLoading}
          quoteFollowUps={dashboard.quoteFollowUps}
        />
      </div>

      <DashboardRecentProjects
        isLoading={isLoading}
        projects={dashboard.projects}
      />

      {showAdminReadiness ? <ProductionReadiness session={session} hideWhenReady /> : null}
    </div>
  );
}
