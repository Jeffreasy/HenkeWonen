import { CalendarClock, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
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
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatCard } from "../ui/StatCard";
import { SummaryList } from "../ui/SummaryList";
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

  return labels[type] ?? type.replaceAll("_", " ");
}

export default function ProjectDetail({ session, projectId }: ProjectDetailProps) {
  const [detail, setDetail] = useState<ProjectDetailResult>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [perimeterMeter, setPerimeterMeter] = useState("");

  const loadProject = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
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

  async function addRoom(event: SubmitEventLike) {
    event.preventDefault();

    if (!detail?.project || !roomName.trim()) {
      return;
    }

    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    await client.mutation(api.portal.addProjectRoom, {
      tenantSlug: session.tenantId,
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
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    await client.mutation(api.portal.updateProjectStatus, {
      tenantSlug: session.tenantId,
      projectId,
      status: "measurement_planned",
      workflowType: "measurement_planned",
      workflowTitle: "Inmeetmoment gepland",
      createdByExternalUserId: session.userId
    });
    await loadProject();
  }

  async function addWorkflowEvent(type: PortalWorkflowEvent["type"], title: string) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    await client.mutation(api.portal.createWorkflowEvent, {
      tenantSlug: session.tenantId,
      projectId,
      type,
      title,
      visibleToCustomer: false,
      createdByExternalUserId: session.userId
    });
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
      }
    ],
    []
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

  return (
    <div className="grid">
      <section className="grid three-column">
        <StatCard label="Ruimtes" value={project.rooms.length} tone="info" />
        <StatCard label="Werkprocesmomenten" value={workflowEvents.length} />
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
            actions={<ProjectStatusBadge status={project.status} />}
          />
          <SummaryList
            items={[
              { id: "customer", label: "Klant", value: customer?.displayName ?? "-" },
              { id: "measurement", label: "Inmeten", value: dateText(project.measurementDate ?? project.measurementPlannedAt) },
              { id: "execution", label: "Uitvoering", value: dateText(project.executionDate ?? project.executionPlannedAt) },
              { id: "updated", label: "Bijgewerkt", value: dateText(project.updatedAt) }
            ]}
          />
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
        </section>

        <ProjectWorkflowRail status={project.status} />
      </div>

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
      </section>

      <section className="panel">
        <SectionHeader
          compact
          title="Werkprocesacties"
          description="Snelle dossieracties voor dagelijkse opvolging."
        />
        <div className="toolbar">
          <Button
            onClick={() => void addWorkflowEvent("quote_accepted", "Offerte akkoord")}
            variant="secondary"
          >
            Akkoord
          </Button>
          <Button
            onClick={() => void addWorkflowEvent("supplier_order_created", "Bestelling aangemaakt")}
            variant="secondary"
          >
            Bestellen
          </Button>
          <Button
            onClick={() => void addWorkflowEvent("invoice_created", "Factuur aangemaakt")}
            variant="secondary"
          >
            Factuur
          </Button>
          <Button
            onClick={() => void addWorkflowEvent("bookkeeper_export_sent", "Export naar boekhouder")}
            variant="secondary"
          >
            Boekhouder export
          </Button>
        </div>
        <div style={{ marginTop: 16 }}>
          <Timeline
            emptyState={
              <EmptyState
                title="Nog geen werkprocesmomenten"
                description="Gebruik de acties hierboven om projectopvolging vast te leggen."
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
