import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { PortalCustomer, PortalProject, ProjectStatus } from "../../lib/portalTypes";
import { showToast } from "../../lib/toast";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FormModal } from "../ui/overlays/FormModal";
import ProjectForm, { type ProjectFormValues } from "./ProjectForm";
import { ProjectStats } from "./ProjectStats";
import { ProjectsTable } from "./ProjectsTable";

type ProjectWorkspaceProps = {
  session: AppSession;
};

type PortalProjectRow = PortalProject & {
  customerName?: string;
};

type StatusFilter = "all" | ProjectStatus;

export default function ProjectWorkspace({ session }: ProjectWorkspaceProps) {
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [projects, setProjects] = useState<PortalProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      showToast({ title: "Verbinding mislukt", description: "Kan de omgeving niet bereiken.", tone: "error" });
      return;
    }

    try {
      await client.mutation(api.portal.createProject, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        customerId: project.customerId,
        title: project.title,
        description: project.description,
        createdByExternalUserId: session.userId
      });
      await loadProjects();
      setIsModalOpen(false);
      showToast({ title: "Project gestart", description: project.title, tone: "success" });
    } catch {
      showToast({ title: "Project aanmaken mislukt", tone: "error" });
    }
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

  const stats = useMemo(() => {
    const activeCount = projects.filter(
      (project) => !["closed", "cancelled", "paid"].includes(project.status)
    ).length;
    const quotePhaseCount = projects.filter((project) => project.status.startsWith("quote")).length;
    return { activeCount, quotePhaseCount, total: projects.length };
  }, [projects]);

  return (
    <div className="grid">
      {error ? (
        <Alert variant="danger" title="Projecten niet geladen" description={error} />
      ) : null}

      <ProjectStats
        total={stats.total}
        activeCount={stats.activeCount}
        quotePhaseCount={stats.quotePhaseCount}
      />

      <ProjectsTable
        projects={filteredProjects}
        isLoading={isLoading}
        onNew={canCreateProjects ? () => setIsModalOpen(true) : undefined}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {canCreateProjects ? (
        <FormModal
          open={isModalOpen}
          title="Nieuw project starten"
          description="Koppel een klant en geef het project een naam om te beginnen."
          size="sm"
          onClose={() => setIsModalOpen(false)}
        >
          <ProjectForm customers={customers} onCreate={createProject} />
        </FormModal>
      ) : null}
    </div>
  );
}
