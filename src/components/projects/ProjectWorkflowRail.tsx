import { CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import type { ProjectStatus } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";

type ProjectWorkflowRailProps = {
  status: ProjectStatus;
};

const workflowSteps: Array<{
  label: string;
  statuses: ProjectStatus[];
}> = [
  { label: "Aanvraag", statuses: ["lead"] },
  { label: "Offerte maken", statuses: ["quote_draft"] },
  { label: "Offerte verzonden", statuses: ["quote_sent"] },
  { label: "Offerte akkoord", statuses: ["quote_accepted"] },
  { label: "Inmeting", statuses: ["measurement_planned"] },
  { label: "Bestellen", statuses: ["ordering"] },
  { label: "Uitvoering", statuses: ["execution_planned", "in_progress"] },
  { label: "Factuur", statuses: ["invoiced"] },
  { label: "Betaald", statuses: ["paid"] },
  { label: "Gesloten", statuses: ["closed"] }
];

function stepIndex(status: ProjectStatus) {
  if (status === "cancelled" || status === "quote_rejected") {
    return -1;
  }

  return workflowSteps.findIndex((step) => step.statuses.includes(status));
}

export default function ProjectWorkflowRail({ status }: ProjectWorkflowRailProps) {
  const currentIndex = stepIndex(status);
  const isStopped = status === "cancelled" || status === "quote_rejected";

  return (
    <div className="workflow-rail" aria-label="Projectstappen">
      <div className="workflow-rail-header">
        <strong>Projectstappen</strong>
        <Badge variant={isStopped ? "danger" : "info"}>{formatProjectStatus(status)}</Badge>
      </div>
      <ol className="workflow-steps">
        {workflowSteps.map((step, index) => {
          const isCurrent = step.statuses.includes(status);
          const isDone = currentIndex >= 0 && index < currentIndex;
          const Icon = isStopped ? CircleAlert : isDone ? CheckCircle2 : Circle;

          return (
            <li
              className={[
                "workflow-step",
                isDone ? "workflow-step-done" : "",
                isCurrent ? "workflow-step-current" : "",
                isStopped ? "workflow-step-stopped" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={step.label}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
