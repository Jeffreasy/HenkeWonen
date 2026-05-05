import { CalendarClock, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type {
  PortalCustomer,
  PortalProject,
  PortalRoom,
  PortalWorkflowEvent
} from "../../lib/portalTypes";
import { NoteVisibilityBadge } from "../common/NoteVisibilityBadge";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatCard } from "../ui/StatCard";
import { SummaryList } from "../ui/SummaryList";
import { Textarea } from "../ui/Textarea";
import { Timeline } from "../ui/Timeline";
import ProjectStatusBadge from "./ProjectStatusBadge";
import ProjectWorkflowRail from "./ProjectWorkflowRail";
import MeasurementPanel from "./MeasurementPanel";

type ProjectDetailProps = {
  session: AppSession;
  projectId: string;
};

type ProjectDetailResult = {
  project: PortalProject;
  customer: PortalCustomer | null;
  workflowEvents: PortalWorkflowEvent[];
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

function dateText(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function eventLabel(type: PortalWorkflowEvent["type"]) {
  const labels: Record<string, string> = {
    customer_contact: "Klantcontact",
    quote_created: "Offerte aangemaakt",
    measurement_requested: "Inmeting aangevraagd",
    measurement_planned: "Inmeting gepland",
    quote_sent: "Offerte verzonden",
    quote_accepted: "Offerte akkoord",
    thank_you_letter_sent: "Bedankbrief verzonden",
    execution_planned: "Uitvoering gepland",
    supplier_order_created: "Leveranciersbestelling aangemaakt",
    invoice_created: "Factuur aangemaakt",
    payment_reminder_sent: "Betalingsherinnering verzonden",
    payment_received: "Betaling ontvangen",
    bookkeeper_export_sent: "Export naar boekhouder verzonden",
    closed: "Gesloten"
  };

  return labels[type] ?? "Dossiermoment";
}

export default function ProjectDetail({ session, projectId }: ProjectDetailProps) {
  const [detail, setDetail] = useState<ProjectDetailResult>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [perimeterMeter, setPerimeterMeter] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState({
    title: "",
    description: "",
    measurementDate: "",
    executionDate: "",
    internalNotes: "",
    customerNotes: ""
  });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState({
    name: "",
    floor: "",
    areaM2: "",
    perimeterMeter: "",
    notes: ""
  });
  const [pendingRoomDelete, setPendingRoomDelete] = useState<PortalRoom | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState<ProjectAction | null>(null);
  const canEditProject = canEditDossiers(session.role);

  const loadProject = useCallback(async () => {
    const client = createConvexHttpClient();

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

  useEffect(() => {
    if (!detail?.project) {
      return;
    }

    setProjectDraft({
      title: detail.project.title,
      description: detail.project.description ?? "",
      measurementDate: toDateInputValue(detail.project.measurementDate),
      executionDate: toDateInputValue(detail.project.executionDate),
      internalNotes: detail.project.internalNotes ?? "",
      customerNotes: detail.project.customerNotes ?? ""
    });
  }, [detail?.project]);

  function toDateInputValue(value?: number) {
    if (!value) {
      return "";
    }

    return new Date(value).toISOString().slice(0, 10);
  }

  function fromDateInputValue(value: string): number | undefined {
    if (!value) {
      return undefined;
    }

    return new Date(`${value}T12:00:00`).getTime();
  }

  function numberFromInput(value: string): number | undefined {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && value.trim() ? parsed : undefined;
  }

  async function addRoom(event: SubmitEventLike) {
    event.preventDefault();

    if (!detail?.project || !roomName.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.addProjectRoom, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      name: roomName.trim(),
      areaM2: Number(areaM2) || undefined,
      perimeterMeter: Number(perimeterMeter) || undefined
    });
    setRoomName("");
    setAreaM2("");
    setPerimeterMeter("");
    await loadProject();
  }

  async function updateStatus() {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateProjectStatus, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      status: "measurement_planned",
      workflowType: "measurement_planned",
      workflowTitle: "Inmeetmoment gepland",
      createdByExternalUserId: session.userId
    });
    await loadProject();
  }

  async function saveProject(event: SubmitEventLike) {
    event.preventDefault();

    const client = createConvexHttpClient();

    if (!client || !detail?.project) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateProject, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      title: projectDraft.title.trim(),
      description: projectDraft.description.trim() || undefined,
      measurementDate: fromDateInputValue(projectDraft.measurementDate),
      executionDate: fromDateInputValue(projectDraft.executionDate),
      internalNotes: projectDraft.internalNotes.trim() || undefined,
      customerNotes: projectDraft.customerNotes.trim() || undefined,
      status: detail.project.status
    });
    setEditingProject(false);
    await loadProject();
  }

  function startEditRoom(room: PortalRoom) {
    setEditingRoomId(room.id);
    setRoomDraft({
      name: room.name,
      floor: room.floor ?? "",
      areaM2: room.areaM2 === undefined ? "" : String(room.areaM2),
      perimeterMeter: room.perimeterMeter === undefined ? "" : String(room.perimeterMeter),
      notes: room.notes ?? ""
    });
  }

  async function saveRoom(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingRoomId || !roomDraft.name.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.updateProjectRoom, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      roomId: editingRoomId,
      name: roomDraft.name.trim(),
      floor: roomDraft.floor.trim() || undefined,
      areaM2: numberFromInput(roomDraft.areaM2),
      perimeterMeter: numberFromInput(roomDraft.perimeterMeter),
      notes: roomDraft.notes.trim() || undefined
    });
    setEditingRoomId(null);
    await loadProject();
  }

  async function deleteRoom() {
    if (!pendingRoomDelete) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    try {
      await client.mutation(api.portal.deleteProjectRoom, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        roomId: pendingRoomDelete.id
      });
      setPendingRoomDelete(null);
      await loadProject();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Ruimte kan niet worden verwijderd als deze al is gebruikt in inmeting of offerte.");
      setPendingRoomDelete(null);
    }
  }

  async function processProjectAction(action: ProjectAction) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    await client.mutation(api.portal.processProjectAction, {
      tenantSlug: session.tenantId,
      actor: mutationActorFromSession(session),
      projectId,
      action
    });
    setPendingProjectAction(null);
    await loadProject();
  }

  const roomColumns = useMemo<Array<DataTableColumn<PortalRoom>>>(
    () => [
      {
        key: "name",
        header: "Ruimte",
        priority: "primary",
        render: (room) => <strong>{room.name}</strong>
      },
      {
        key: "area",
        header: "m2",
        align: "right",
        width: "100px",
        render: (room) => room.areaM2 ?? "-"
      },
      {
        key: "perimeter",
        header: "Omtrek",
        align: "right",
        width: "110px",
        render: (room) => (room.perimeterMeter ? `${room.perimeterMeter} m` : "-")
      },
      {
        key: "notes",
        header: "Notities",
        hideOnMobile: true,
        render: (room) => room.notes ?? "-"
      },
      {
        key: "actions",
        header: "Acties",
        width: "180px",
        render: (room) =>
          canEditProject ? (
            <div className="toolbar">
              <Button size="sm" variant="secondary" onClick={() => startEditRoom(room)}>
                Bewerken
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPendingRoomDelete(room)}>
                Verwijderen
              </Button>
            </div>
          ) : (
            "-"
          )
      }
    ],
    [canEditProject]
  );

  if (isLoading) {
    return <LoadingState title="Project laden" description="Projectgegevens ophalen." />;
  }

  if (error) {
    return <ErrorState title="Project niet geladen" description={error} />;
  }

  if (!detail?.project) {
    return <EmptyState title="Project niet gevonden" description="Controleer de link of ga terug naar projecten." />;
  }

  const { project, customer, workflowEvents } = detail;
  const pendingProjectActionDetails = pendingProjectAction
    ? projectActionCopy[pendingProjectAction]
    : null;

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
      />
      <section className="grid three-column">
        <StatCard label="Ruimtes" value={project.rooms.length} tone="info" />
        <StatCard label="Dossiermomenten" value={workflowEvents.length} />
        <StatCard
          label="Status"
          value={formatProjectStatus(project.status)}
          description={customer?.displayName ?? "Geen klant gekoppeld"}
          tone={project.status === "cancelled" || project.status === "quote_rejected" ? "danger" : "warning"}
        />
      </section>

      <div className="grid two-column">
        <section className="panel">
          <SectionHeader
            compact
            title={project.title}
            description={project.description ?? "Geen projectomschrijving"}
            actions={
              <div className="toolbar">
                <ProjectStatusBadge status={project.status} />
                {canEditProject ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setEditingProject((current) => !current)}>
                      Bewerken
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setPendingProjectAction("cancelled")}>
                      Annuleren
                    </Button>
                  </>
                ) : null}
              </div>
            }
          />
          <SummaryList
            items={[
              { id: "customer", label: "Klant", value: customer?.displayName ?? "-" },
              { id: "measurement", label: "Inmeten", value: dateText(project.measurementDate ?? project.measurementPlannedAt) },
              { id: "execution", label: "Uitvoering", value: dateText(project.executionDate ?? project.executionPlannedAt) },
              { id: "updated", label: "Bijgewerkt", value: dateText(project.updatedAt) }
            ]}
          />
          {canEditProject ? (
            <div className="toolbar" style={{ marginTop: 16 }}>
              <a className="ui-button ui-button-secondary ui-button-md" href="/portal/offertes">
                Offerte maken
              </a>
              <Button
                leftIcon={<CalendarClock size={17} aria-hidden="true" />}
                onClick={() => void updateStatus()}
                variant="primary"
              >
                Inmeten plannen
              </Button>
            </div>
          ) : null}
        </section>

        <ProjectWorkflowRail status={project.status} />
      </div>

      {canEditProject && editingProject ? (
        <section className="panel">
          <SectionHeader compact title="Projectgegevens aanpassen" description="Wijzig planning, omschrijving en interne of klantzichtbare notities." />
          <form className="form-grid" onSubmit={saveProject}>
            <Field htmlFor="edit-project-title" label="Projectnaam" required>
              <Input
                id="edit-project-title"
                value={projectDraft.title}
                onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </Field>
            <Field htmlFor="edit-project-description" label="Omschrijving">
              <Textarea
                id="edit-project-description"
                rows={3}
                value={projectDraft.description}
                onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
            <div className="grid two-column-even">
              <Field htmlFor="edit-project-measurement-date" label="Inmeetdatum">
                <Input
                  id="edit-project-measurement-date"
                  type="date"
                  value={projectDraft.measurementDate}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, measurementDate: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-project-execution-date" label="Uitvoerdatum">
                <Input
                  id="edit-project-execution-date"
                  type="date"
                  value={projectDraft.executionDate}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, executionDate: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="edit-project-internal-notes" label="Interne notities">
                <Textarea
                  id="edit-project-internal-notes"
                  rows={4}
                  value={projectDraft.internalNotes}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, internalNotes: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-project-customer-notes" label="Notities voor klant">
                <Textarea
                  id="edit-project-customer-notes"
                  rows={4}
                  value={projectDraft.customerNotes}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, customerNotes: event.target.value }))}
                />
              </Field>
            </div>
            <div className="toolbar">
              <Button leftIcon={<Save size={17} aria-hidden="true" />} type="submit" variant="primary">
                Projectgegevens opslaan
              </Button>
              <Button variant="secondary" onClick={() => setEditingProject(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {(project.internalNotes || project.customerNotes) ? (
        <section className="grid two-column">
          <Card variant="muted">
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <strong>Interne opmerkingen</strong>
              <NoteVisibilityBadge visibleToCustomer={false} />
            </div>
            <p className="muted">{project.internalNotes ?? "Geen interne opmerkingen."}</p>
          </Card>
          <Card variant="info">
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <strong>Klantzichtbare opmerkingen</strong>
              <NoteVisibilityBadge visibleToCustomer />
            </div>
            <p className="muted">{project.customerNotes ?? "Geen klantzichtbare opmerkingen."}</p>
          </Card>
        </section>
      ) : (
        <Alert
          variant="info"
          title="Notities"
          description="Interne en klantzichtbare projectnotities worden apart getoond zodra ze beschikbaar zijn."
        />
      )}

      <section className="panel">
        <SectionHeader
          compact
          title="Ruimtes en maten"
          description="Maten blijven automatisch onderdeel van het projectdossier."
        />
        {canEditProject ? (
          <form className="responsive-form-row" onSubmit={addRoom}>
            <Field htmlFor="room-name" label="Ruimte" required>
              <Input
                id="room-name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                required
              />
            </Field>
            <Field htmlFor="room-area" label="m2">
              <Input
                id="room-area"
                inputMode="decimal"
                value={areaM2}
                onChange={(event) => setAreaM2(event.target.value)}
              />
            </Field>
            <Field htmlFor="room-perimeter" label="Omtrek m">
              <Input
                id="room-perimeter"
                inputMode="decimal"
                value={perimeterMeter}
                onChange={(event) => setPerimeterMeter(event.target.value)}
              />
            </Field>
            <Button
              leftIcon={<Plus size={17} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              Ruimte toevoegen
            </Button>
          </form>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <DataTable
            ariaLabel="Projectruimtes"
            columns={roomColumns}
            density="compact"
            emptyDescription="Voeg hierboven de eerste ruimte toe."
            emptyTitle="Nog geen ruimtes"
            getRowKey={(room) => room.id}
            rows={project.rooms}
          />
        </div>
        {editingRoomId ? (
          <form className="form-grid" onSubmit={saveRoom} style={{ marginTop: 16 }}>
            <SectionHeader compact title="Ruimte aanpassen" description="Corrigeer naam, meters en notities van deze projectruimte." />
            <div className="grid three-column">
              <Field htmlFor="edit-room-name" label="Ruimte" required>
                <Input
                  id="edit-room-name"
                  value={roomDraft.name}
                  onChange={(event) => setRoomDraft((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </Field>
              <Field htmlFor="edit-room-area" label="m2">
                <Input
                  id="edit-room-area"
                  inputMode="decimal"
                  value={roomDraft.areaM2}
                  onChange={(event) => setRoomDraft((current) => ({ ...current, areaM2: event.target.value }))}
                />
              </Field>
              <Field htmlFor="edit-room-perimeter" label="Omtrek m">
                <Input
                  id="edit-room-perimeter"
                  inputMode="decimal"
                  value={roomDraft.perimeterMeter}
                  onChange={(event) => setRoomDraft((current) => ({ ...current, perimeterMeter: event.target.value }))}
                />
              </Field>
            </div>
            <Field htmlFor="edit-room-notes" label="Notities">
              <Textarea
                id="edit-room-notes"
                rows={3}
                value={roomDraft.notes}
                onChange={(event) => setRoomDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </Field>
            <div className="toolbar">
              <Button leftIcon={<Save size={17} aria-hidden="true" />} type="submit" variant="primary">
                Ruimte opslaan
              </Button>
              <Button variant="secondary" onClick={() => setEditingRoomId(null)}>
                Annuleren
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel">
        <SectionHeader
          compact
          title="Dossieracties"
          description="Snelle dossieracties voor dagelijkse opvolging."
        />
        {canEditProject ? (
          <div className="toolbar">
            <Button
              onClick={() => setPendingProjectAction("quote_accepted")}
              variant="secondary"
            >
              Akkoord
            </Button>
            <Button
              onClick={() => setPendingProjectAction("supplier_order_created")}
              variant="secondary"
            >
              Bestellen
            </Button>
            <Button
              onClick={() => setPendingProjectAction("invoice_created")}
              variant="secondary"
            >
              Factuur
            </Button>
            <Button
              onClick={() => setPendingProjectAction("bookkeeper_export_sent")}
              variant="secondary"
            >
              Naar boekhouder
            </Button>
            <Button
              onClick={() => setPendingProjectAction("closed")}
              variant="secondary"
            >
              Sluiten
            </Button>
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <Timeline
            emptyState={
              <EmptyState
                title="Nog geen dossiermomenten"
                description="Gebruik de acties hierboven om opvolging vast te leggen."
              />
            }
            items={workflowEvents.map((event) => ({
              id: event.id,
              title: event.title,
              description: event.description,
              meta: dateText(event.createdAt),
              badge: eventLabel(event.type),
              tone: event.visibleToCustomer ? "info" : "neutral"
            }))}
          />
        </div>
      </section>

      <MeasurementPanel
        customerId={project.customerId}
        projectId={project.id}
        projectRooms={project.rooms}
        session={session}
        tenantId={session.tenantId}
      />
    </div>
  );
}
