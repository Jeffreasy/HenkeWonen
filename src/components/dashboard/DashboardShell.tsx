import { ClipboardList, FileText, PackageSearch, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatImportStatus, formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalProject } from "../../lib/portalTypes";

type DashboardShellProps = {
  session: AppSession;
};

type DashboardData = {
  customerCount: number;
  activeProjectCount: number;
  quoteCount: number;
  catalogCount: number;
  importStatus: string;
  projects: PortalProject[];
};

const emptyDashboard: DashboardData = {
  customerCount: 0,
  activeProjectCount: 0,
  quoteCount: 0,
  catalogCount: 0,
  importStatus: "geen imports",
  projects: []
};

export default function DashboardShell({ session }: DashboardShellProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
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
        })) as DashboardData;

        if (isActive) {
          setDashboard(result);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setError("Dashboard kon niet worden geladen.");
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

  const metrics = [
    {
      label: "Klanten",
      value: dashboard.customerCount,
      href: "/portal/klanten",
      icon: Users
    },
    {
      label: "Projecten actief",
      value: dashboard.activeProjectCount,
      href: "/portal/projecten",
      icon: ClipboardList
    },
    {
      label: "Offertes",
      value: dashboard.quoteCount,
      href: "/portal/offertes",
      icon: FileText
    },
    {
      label: "Catalogusregels",
      value: dashboard.catalogCount,
      href: "/portal/catalogus",
      icon: PackageSearch
    }
  ];

  return (
    <div className="grid dashboard-grid">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <a className="card metric" href={metric.href} key={metric.label}>
            <Icon size={22} aria-hidden="true" />
            <span className="muted">{metric.label}</span>
            <strong>{isLoading ? "..." : metric.value}</strong>
          </a>
        );
      })}

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">Werkproces</p>
            <h2 className="section-title">Van aanvraag naar uitvoering</h2>
          </div>
          <span className="badge warning">{formatImportStatus(dashboard.importStatus)}</span>
        </div>
        {error ? <div className="empty-state">{error}</div> : null}
        <div className="grid three-column" style={{ marginTop: 18 }}>
          {dashboard.projects.map((project) => (
            <a href={`/portal/projecten/${project.id}`} className="card" key={project.id}>
              <span className="badge">{formatProjectStatus(project.status)}</span>
              <h3>{project.title}</h3>
              <p className="muted">{project.description}</p>
            </a>
          ))}
          {!isLoading && dashboard.projects.length === 0 ? (
            <div className="empty-state">Geen actieve projecten gevonden.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
