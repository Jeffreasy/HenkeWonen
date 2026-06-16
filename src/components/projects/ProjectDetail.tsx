import { ClipboardList, Ruler } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatDate } from "../../lib/dates";
import { formatEuro } from "../../lib/money";
import { showToast } from "../../lib/toast";
import type {
  InvoiceStatus,
  PortalCustomer,
  PortalProject,
  PortalProjectTask,
  PortalQuote,
  PortalRoom,
  PortalWorkflowEvent
} from "../../lib/portalTypes";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { ErrorState } from "../ui/feedback/ErrorState";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { EmptyState } from "../ui/feedback/EmptyState";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { SummaryList } from "../ui/data-display/SummaryList";
import { Tabs } from "../ui/Tabs";
import { ProjectDetailSkeleton } from "./ProjectDetailSkeleton";
import ProjectWorkflowRail from "./ProjectWorkflowRail";
import MeasurementPanel from "./MeasurementPanel";
import { ProjectOverviewPanel } from "./ProjectOverviewPanel";
import { ProjectEditForm } from "./ProjectEditForm";
import { ProjectRoomsPanel } from "./ProjectRoomsPanel";
import { ProjectTasksPanel } from "./ProjectTasksPanel";
import { ProjectTimelinePanel } from "./ProjectTimelinePanel";
import { InvoiceStatusBadge } from "../invoices/InvoiceStatusBadge";

type ProjectDetailProps = {
  session: AppSession;
  projectId: string;
};

type ProjectDetailResult = {
  project: PortalProject;
  customer: PortalCustomer | null;
  workflowEvents?: PortalWorkflowEvent[];
  projectTasks?: PortalProjectTask[];
  latestQuote?: Omit<PortalQuote, "lines"> | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus | string;
    totalIncVat: number;
    dueDate: number;
    paidAmount: number;
  } | null;
} | null;

type ProjectAction =
  | "quote_accepted"
  | "supplier_order_created"
  | "invoice_created"
  | "bookkeeper_export_sent"
  | "closed"
  | "cancelled";

const projectActionCopy: Record<
  ProjectAction,
  { label: string; description: string; confirmLabel: string; tone?: "warning" | "danger" }
> = {
  quote_accepted: {
    label: "Akkoord",
    description: "Je zet dit dossier op akkoord en koppelt de nieuwste offerte aan deze status.",
    confirmLabel: "Akkoord verwerken"
  },
  supplier_order_created: {
    label: "Bestellen",
    description: "Je zet dit dossier op bestellen en legt vast dat de leveranciersbestelling is aangemaakt.",
    confirmLabel: "Bestelling verwerken"
  },
  invoice_created: {
    label: "Factuur",
    description: "Je zet dit dossier op gefactureerd en legt vast dat de factuur is aangemaakt.",
    confirmLabel: "Factuur verwerken"
  },
  bookkeeper_export_sent: {
    label: "Naar boekhouder",
    description: "Je legt vast dat dit dossier naar de boekhouder is verwerkt.",
    confirmLabel: "Naar boekhouder verwerken"
  },
  closed: {
    label: "Sluiten",
    description: "Je sluit dit dossier af. Gebruik dit alleen als de opvolging klaar is.",
    confirmLabel: "Dossier sluiten"
  },
  cancelled: {
    label: "Annuleren",
    description: "Je annuleert dit dossier. Eventuele conceptofferte wordt ook geannuleerd.",
    confirmLabel: "Dossier annuleren",
    tone: "danger"
  }
};

function invoicePaymentTermDays(customer?: PortalCustomer | null) {
  return customer?.type === "business" ? 21 : 8;
}

export default function ProjectDetail({ session, projectId }: ProjectDetailProps) {
  const [detail, setDetail] = useState<ProjectDetailResult>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [pendingRoomDelete, setPendingRoomDelete] = useState<PortalRoom | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState<ProjectAction | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isStartingMeasurement, setIsStartingMeasurement] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "inmeting";
    }
    return new URLSearchParams(window.location.search).get("tab") === "opvolging"
      ? "opvolging"
      : "inmeting";
  });
  const canEditProject = canEditDossiers(session.role);

  const loadProject = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query(api.portal.projectDetail, {
        tenantSlug: session.tenantId,
        projectId
      });

      setDetail(result as ProjectDetailResult);
    } catch (loadError) {
      console.error(loadError);
      setError("Project kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session.tenantId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  // Documenttitel = dossiernaam, zodat meerdere geopende dossier-tabs uit elkaar
  // te houden zijn (de SSR-titel is generiek "Project").
  useEffect(() => {
    if (detail?.project?.titel) {
      document.title = `${detail.project.titel} | Henke Wonen`;
    }
  }, [detail?.project?.titel]);

  function handleTabChange(tabId: string) {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function defaultDateInputInDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function openProjectAction(action: ProjectAction) {
    if (action === "invoice_created") {
      setInvoiceDueDate(defaultDateInputInDays(invoicePaymentTermDays(detail?.customer)));
    }
    setPendingProjectAction(action);
  }

  async function handleAddRoom(name: string, areaM2?: number, perimeterMeter?: number) {
    const client = createConvexHttpClient(session);
    if (!client || !detail?.project) {
      return;
    }

    await client.mutation(api.portal.addProjectRoom, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      naam: name,
      oppervlakteM2: areaM2,
      omtrekMeter: perimeterMeter
    });
    await loadProject();
  }

  function focusMeasurementPanel() {
    window.setTimeout(() => {
      document.getElementById("project-measurement")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  }

  async function startMeasurementWorkflow() {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsStartingMeasurement(true);
    setError(null);

    try {
      await client.mutation(api.portal.startOrPlanMeasurement, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        projectId,
        gemetenDoor: session.name ?? session.email
      });
      await loadProject();
      handleTabChange("inmeting");
      focusMeasurementPanel();
    } catch (startError) {
      console.error(startError);
      setError("Inmeting kon niet worden gestart.");
    } finally {
      setIsStartingMeasurement(false);
    }
  }

  async function handleSaveProject(data: {
    title: string;
    description?: string;
    measurementDate?: number;
    executionDate?: number;
    internalNotes?: string;
    customerNotes?: string;
  }) {
    const client = createConvexHttpClient(session);
    if (!client || !detail?.project) {
      return;
    }

    await client.mutation(api.portal.updateProject, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      titel: data.title,
      omschrijving: data.description,
      inmeetdatum: data.measurementDate,
      uitvoerdatum: data.executionDate,
      interneNotities: data.internalNotes,
      klantNotities: data.customerNotes,
      status: detail.project.status
    });
    setEditingProject(false);
    await loadProject();
  }

  async function handleSaveRoom(
    roomId: string,
    data: {
      name: string;
      floor?: string;
      areaM2?: number;
      perimeterMeter?: number;
      notes?: string;
    }
  ) {
    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }

    await client.mutation(api.portal.updateProjectRoom, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      ruimteId: roomId,
      naam: data.name,
      verdieping: data.floor,
      oppervlakteM2: data.areaM2,
      omtrekMeter: data.perimeterMeter,
      notities: data.notes
    });
    await loadProject();
  }

  async function deleteRoom() {
    if (!pendingRoomDelete) {
      return;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }

    try {
      await client.mutation(api.portal.deleteProjectRoom, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        ruimteId: pendingRoomDelete.id
      });
      setPendingRoomDelete(null);
      await loadProject();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Ruimte kan niet worden verwijderd als deze al is gebruikt in inmeting of offerte.");
      setPendingRoomDelete(null);
    }
  }

  function fromDateInputValue(value: string): number | undefined {
    if (!value) {
      return undefined;
    }
    return new Date(`${value}T12:00:00`).getTime();
  }

  async function processProjectAction(action: ProjectAction) {
    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }

    try {
      await client.mutation(api.portal.processProjectAction, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        projectId,
        action,
        invoiceDueAt:
          action === "invoice_created" ? fromDateInputValue(invoiceDueDate) : undefined
      });
      setPendingProjectAction(null);
      await loadProject();
    } catch (processError) {
      console.error(processError);
      setPendingProjectAction(null);
      showToast({
        title: "Dossieractie mislukt",
        description:
          processError instanceof Error
            ? processError.message
            : "De dossieractie kon niet worden verwerkt.",
        tone: "error"
      });
    }
  }

  async function updateProjectTaskStatus(
    task: PortalProjectTask,
    status: PortalProjectTask["status"]
  ) {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de taak nu niet bijwerken.");
      return;
    }

    setUpdatingTaskId(task.id);
    try {
      await client.mutation(api.portal.updateProjectTaskStatus, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        taskId: task.id,
        status
      });
      await loadProject();
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (error) {
    return <ErrorState title="Project niet geladen" description={error} />;
  }

  if (!detail?.project) {
    return <EmptyState title="Project niet gevonden" description="Controleer de link of ga terug naar projecten." />;
  }

  const {
    project,
    customer,
    workflowEvents = [],
    projectTasks = []
  } = detail;
  const pendingProjectActionDetails = pendingProjectAction
    ? projectActionCopy[pendingProjectAction]
    : null;
  // Fase-afhankelijke ruimtes: vóór de inmeting (status "lead") beheer je dossier-
  // ruimtes in dit losse paneel; zodra de inmeting loopt nemen de inmeetruimtes het
  // over (die syncen automatisch terug naar het dossier), dus tonen we het dan niet meer.
  const measurementStarted = project.status !== "lead";

  return (
    <div className="grid">
      <ConfirmDialog
        open={Boolean(pendingRoomDelete)}
        title="Ruimte verwijderen?"
        description="Dit kan alleen als de ruimte nog niet is gebruikt in een inmeting of offerte."
        confirmLabel="Ruimte verwijderen"
        tone="danger"
        onCancel={() => setPendingRoomDelete(null)}
        onConfirm={() => void deleteRoom()}
      />
      <ConfirmDialog
        open={Boolean(pendingProjectAction)}
        title={
          pendingProjectActionDetails
            ? `${pendingProjectActionDetails.label} bevestigen?`
            : "Actie bevestigen?"
        }
        description={pendingProjectActionDetails?.description ?? ""}
        confirmLabel={pendingProjectActionDetails?.confirmLabel ?? "Verwerken"}
        tone={pendingProjectActionDetails?.tone ?? "warning"}
        onCancel={() => setPendingProjectAction(null)}
        onConfirm={() => {
          if (pendingProjectAction) {
            void processProjectAction(pendingProjectAction);
          }
        }}
      >
        {pendingProjectAction === "invoice_created" ? (
          <Field
            htmlFor="invoice-due-date"
            label="Betaaltermijn"
            description={`Standaard ${invoicePaymentTermDays(customer)} kalenderdagen voor deze klant. Particulier is 8 dagen, zakelijk/groot project is 21 dagen. Aanpasbaar voordat de factuurstap wordt verwerkt.`}
          >
            <Input
              id="invoice-due-date"
              type="date"
              value={invoiceDueDate}
              onChange={(event) => setInvoiceDueDate(event.target.value)}
            />
          </Field>
        ) : null}
      </ConfirmDialog>
      <div className="grid project-workspace-top">
        <ProjectOverviewPanel
          project={project}
          customer={customer}
          workflowEventsCount={workflowEvents.length}
          isStartingMeasurement={isStartingMeasurement}
          onStartMeasurement={startMeasurementWorkflow}
          onEditProject={() => setEditingProject((current) => !current)}
          onCancelProject={() => openProjectAction("cancelled")}
          canEdit={canEditProject}
        />

        <ProjectWorkflowRail status={project.status} />
      </div>

      {canEditProject && editingProject ? (
        <ProjectEditForm
          project={project}
          onSave={handleSaveProject}
          onCancel={() => setEditingProject(false)}
        />
      ) : null}

      <Tabs
        ariaLabel="Dossieronderdelen"
        idBase="dossier"
        activeId={activeTab}
        onChange={handleTabChange}
        tabs={[
          {
            id: "inmeting",
            label: "Inmeting",
            icon: <Ruler size={15} aria-hidden="true" />,
            content: (
              <>
                {!measurementStarted ? (
                  <ProjectRoomsPanel
                    rooms={project.rooms}
                    canEdit={canEditProject}
                    onAddRoom={handleAddRoom}
                    onSaveRoom={handleSaveRoom}
                    onDeleteRoom={setPendingRoomDelete}
                  />
                ) : null}

                <div id="project-measurement">
                  <MeasurementPanel
                    customerId={project.klantId}
                    projectId={project.id}
                    projectRooms={project.rooms}
                    session={session}
                    tenantId={session.tenantId}
                  />
                </div>
              </>
            )
          },
          {
            id: "opvolging",
            label: "Opvolging",
            icon: <ClipboardList size={15} aria-hidden="true" />,
            content: (
              <>
                <div className="grid project-followup-grid">
                  <ProjectTasksPanel
                    tasks={projectTasks}
                    updatingTaskId={updatingTaskId}
                    onUpdateTaskStatus={updateProjectTaskStatus}
                    canEdit={canEditProject}
                  />

                  <ProjectTimelinePanel
                    workflowEvents={workflowEvents}
                    latestQuote={detail.latestQuote ?? null}
                    canEdit={canEditProject}
                    onProcessAction={openProjectAction}
                  />
                </div>

                {detail.invoice ? (
                  <section className="panel">
                    <SectionHeader
                      compact
                      title="Gekoppelde factuur"
                      description="Automatisch aangemaakt bij de stap Gefactureerd."
                      actions={
                        <a
                          href={`/portal/facturen/${detail.invoice.id}`}
                          className="ui-button ui-button-secondary ui-button-sm"
                        >
                          Factuur openen
                        </a>
                      }
                    />
                    <SummaryList
                      items={[
                        { label: "Factuurnummer", value: detail.invoice.invoiceNumber },
                        {
                          label: "Status",
                          value: <InvoiceStatusBadge status={detail.invoice.status} />
                        },
                        { label: "Totaal incl. btw", value: <strong>{formatEuro(detail.invoice.totalIncVat)}</strong> },
                        { label: "Vervaldatum", value: formatDate(detail.invoice.dueDate) },
                        {
                          label: "Betaald",
                          value: formatEuro(detail.invoice.paidAmount),
                          description:
                            detail.invoice.paidAmount >= detail.invoice.totalIncVat
                              ? "Volledig ontvangen"
                              : `Nog € ${(detail.invoice.totalIncVat - detail.invoice.paidAmount).toFixed(2).replace(".", ",")} te ontvangen`
                        }
                      ]}
                    />
                  </section>
                ) : null}
              </>
            )
          }
        ]}
      />
    </div>
  );
}
