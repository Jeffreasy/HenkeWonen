import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { PortalCustomer, PortalProject, ProjectStatus } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import ProjectForm, { type ProjectFormValues } from "./ProjectForm";
import ProjectStatusBadge from "./ProjectStatusBadge";

type ProjectWorkspaceProps = {
  session: AppSession;
};

type PortalProjectRow = PortalProject & {
  customerName?: string;
};

type StatusFilter = "all" | ProjectStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statussen" },
  { value: "lead", label: formatProjectStatus("lead") },
  { value: "quote_draft", label: formatProjectStatus("quote_draft") },
  { value: "quote_sent", label: formatProjectStatus("quote_sent") },
  { value: "quote_accepted", label: formatProjectStatus("quote_accepted") },
  { value: "measurement_planned", label: formatProjectStatus("measurement_planned") },
  { value: "execution_planned", label: formatProjectStatus("execution_planned") },
  { value: "ordering", label: formatProjectStatus("ordering") },
  { value: "in_progress", label: formatProjectStatus("in_progress") },
  { value: "invoiced", label: formatProjectStatus("invoiced") },
  { value: "paid", label: formatProjectStatus("paid") },
  { value: "closed", label: formatProjectStatus("closed") },
  { value: "cancelled", label: formatProjectStatus("cancelled") }
];

export default function ProjectWorkspace({ session }: ProjectWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [projects, setProjects] = useState<PortalProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const canCreateProjects = canEditDossiers(session.role);

  const loadProjects = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [customerResult, projectResult] = await Promise.all([
        client.query(api.portal.listCustomers, { tenantSlug: session.tenantId }),
        client.query(api.portal.listProjects, { tenantSlug: session.tenantId })
      ]);

      setCustomers(customerResult as PortalCustomer[]);
      setProjects(projectResult as PortalProjectRow[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Projecten konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function createProject(project: ProjectFormValues) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.createProject, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      customerId: project.customerId,
      title: project.title,
      description: project.description,
      createdByExternalUserId: session.userId
    });
    await loadProjects();
  }

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        [project.title, project.description, project.customerName, project.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const activeProjects = projects.filter(
    (project) => !["closed", "cancelled", "paid"].includes(project.status)
  );
  const quoteProjects = projects.filter((project) => project.status.startsWith("quote"));

  const columns: Array<DataTableColumn<PortalProjectRow>> = [
    {
      key: "project",
      header: "Project",
      priority: "primary",
      render: (project) => (
        <div className="stack-sm">
          <a href={`/portal/projecten/${project.id}`}>
            <strong>{project.title}</strong>
          </a>
          <small className="muted">{project.description ?? "Geen omschrijving"}</small>
        </div>
      )
    },
    {
      key: "customer",
      header: "Klant",
      render: (project) => project.customerName ?? "-"
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      render: (project) => <ProjectStatusBadge status={project.status} />
    },
    {
      key: "rooms",
      header: "Ruimtes",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (project) => project.rooms.length
    }
  ];

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Projecten niet geladen" description={error} />
      ) : null}

      <section className="grid three-column">
        <StatCard label="Projecten" value={projects.length} tone="info" />
        <StatCard label="Lopend" value={activeProjects.length} tone="warning" />
        <StatCard label="In offertefase" value={quoteProjects.length} />
      </section>

      <div className="grid two-column">
        {canCreateProjects ? <ProjectForm customers={customers} onCreate={createProject} /> : null}
        <section className="grid">
          <SectionHeader
            compact
            title="Lopende projectdossiers"
            description="Scan status, klant en ruimtes zonder het projectdossier te openen."
          />
          <FilterBar
            search={
              <SearchInput
                aria-label="Projecten zoeken"
                placeholder="Zoek op project, klant of status"
                value={search}
                onChange={setSearch}
              />
            }
            filters={
              <Field label="Status" htmlFor="project-status-filter">
                <Select
                  id="project-status-filter"
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
            ariaLabel="Projecten"
            columns={columns}
            density="compact"
            emptyDescription="Maak een nieuw project aan of pas je filters aan."
            emptyTitle="Geen projecten gevonden"
            getRowKey={(project) => project.id}
            loading={isLoading}
            rows={filteredProjects}
          />
        </section>
      </div>
    </div>
  );
}
