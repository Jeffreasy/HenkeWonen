import { CheckCircle2, XCircle } from "lucide-react";
import { useMemo } from "react";
import type { PortalProjectTask } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { SectionHeader } from "../ui/layout/SectionHeader";

type ProjectTasksPanelProps = {
  tasks: PortalProjectTask[];
  updatingTaskId: string | null;
  onUpdateTaskStatus: (
    task: PortalProjectTask,
    status: PortalProjectTask["status"]
  ) => Promise<void>;
  canEdit: boolean;
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

function taskTypeLabel(type: PortalProjectTask["type"]) {
  const labels: Record<PortalProjectTask["type"], string> = {
    quote_follow_up: "Offerte opvolgen",
    confirmation_payment: "Bevestiging/betaling",
    execution_call: "Afspraak uitvoering",
    invoice_payment: "Factuurbetaling"
  };

  return labels[type];
}

function taskStatusLabel(status: PortalProjectTask["status"]) {
  const labels: Record<PortalProjectTask["status"], string> = {
    open: "Open",
    done: "Gereed",
    dismissed: "Verborgen"
  };

  return labels[status];
}

export function ProjectTasksPanel({
  tasks,
  updatingTaskId,
  onUpdateTaskStatus,
  canEdit
}: ProjectTasksPanelProps) {
  const taskColumns = useMemo<Array<DataTableColumn<PortalProjectTask>>>(
    () => [
      {
        key: "priority",
        header: "Signaal",
        width: "100px",
        render: (task) => <Badge variant={task.priority.tone}>{task.priority.label}</Badge>
      },
      {
        key: "task",
        header: "Taak",
        priority: "primary",
        render: (task) => (
          <div className="stack-sm">
            <strong>{task.titel}</strong>
            <small className="muted">{taskTypeLabel(task.type)}</small>
          </div>
        )
      },
      {
        key: "due",
        header: "Deadline",
        width: "120px",
        render: (task) => dateText(task.vervaltOp)
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        render: (task) => taskStatusLabel(task.status)
      },
      {
        key: "actions",
        header: "Acties",
        width: "190px",
        render: (task) =>
          canEdit && task.status === "open" ? (
            <div className="toolbar">
              <Button
                disabled={updatingTaskId === task.id}
                leftIcon={<CheckCircle2 size={16} aria-hidden="true" />}
                onClick={() => void onUpdateTaskStatus(task, "done")}
                size="sm"
                variant="secondary"
              >
                Gereed
              </Button>
              <Button
                disabled={updatingTaskId === task.id}
                leftIcon={<XCircle size={16} aria-hidden="true" />}
                onClick={() => void onUpdateTaskStatus(task, "dismissed")}
                size="sm"
                variant="ghost"
              >
                Verberg
              </Button>
            </div>
          ) : (
            "-"
          )
      }
    ],
    [canEdit, updatingTaskId, onUpdateTaskStatus]
  );

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Procesopvolging"
        description="Open taken en deadlines voor winkel en buitendienst."
      />
      <DataTable
        ariaLabel="Projecttaken"
        columns={taskColumns}
        density="compact"
        emptyDescription="Taken worden automatisch aangemaakt bij offerte verzenden, akkoord en factureren."
        emptyTitle="Nog geen procesopvolging"
        getRowKey={(task) => task.id}
        mobileMode="cards"
        renderMobileCard={(task) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <strong>{task.titel}</strong>
                <small className="muted">{taskTypeLabel(task.type)}</small>
              </div>
              <Badge variant={task.priority.tone}>{task.priority.label}</Badge>
            </div>
            <div className="mobile-card-meta">
              <span>Deadline {dateText(task.vervaltOp)}</span>
              <span>{taskStatusLabel(task.status)}</span>
            </div>
            {canEdit && task.status === "open" ? (
              <div className="mobile-card-actions">
                <Button
                  disabled={updatingTaskId === task.id}
                  leftIcon={<CheckCircle2 size={16} aria-hidden="true" />}
                  onClick={() => void onUpdateTaskStatus(task, "done")}
                  size="sm"
                  variant="secondary"
                >
                  Gereed
                </Button>
                <Button
                  disabled={updatingTaskId === task.id}
                  leftIcon={<XCircle size={16} aria-hidden="true" />}
                  onClick={() => void onUpdateTaskStatus(task, "dismissed")}
                  size="sm"
                  variant="ghost"
                >
                  Verberg
                </Button>
              </div>
            ) : null}
          </div>
        )}
        rows={tasks}
      />
    </section>
  );
}
