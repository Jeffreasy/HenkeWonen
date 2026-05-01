import type { ProjectStatus } from "../../lib/portalTypes";
import { formatProjectStatus } from "../../lib/i18n/statusLabels";
import { StatusBadge } from "../ui/StatusBadge";

type ProjectStatusBadgeProps = {
  status: ProjectStatus;
};

const successStatuses: ProjectStatus[] = [
  "quote_accepted",
  "execution_planned",
  "in_progress",
  "paid",
  "closed"
];

export default function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const variant =
    status === "cancelled" || status === "quote_rejected"
      ? "danger"
      : successStatuses.includes(status)
        ? "success"
        : undefined;

  return <StatusBadge status={status} label={formatProjectStatus(status)} variant={variant} />;
}
