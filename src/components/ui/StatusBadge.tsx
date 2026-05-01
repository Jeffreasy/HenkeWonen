import type { HTMLAttributes } from "react";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Badge, type BadgeVariant } from "./Badge";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: string;
  label?: string;
  variant?: BadgeVariant;
};

const successWords = ["active", "accepted", "betaald", "closed", "geimporteerd", "imported", "paid", "ready", "resolved", "success"];
const warningWords = ["analyzing", "draft", "mapping", "needs", "open", "planned", "preview", "review", "sent", "uploaded", "warning"];
const dangerWords = ["blocked", "cancelled", "danger", "error", "failed", "overdue", "rejected"];
const infoWords = ["in_progress", "ordering", "measurement", "invoice", "quote"];

function statusVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase();

  if (dangerWords.some((word) => normalized.includes(word))) {
    return "danger";
  }

  if (successWords.some((word) => normalized.includes(word))) {
    return "success";
  }

  if (warningWords.some((word) => normalized.includes(word))) {
    return "warning";
  }

  if (infoWords.some((word) => normalized.includes(word))) {
    return "info";
  }

  return "neutral";
}

export function StatusBadge({ status, label, variant, ...props }: StatusBadgeProps) {
  const displayLabel = label ?? formatStatusLabel(status);

  return (
    <Badge variant={variant ?? statusVariant(status)} label={`Status: ${displayLabel}`} {...props}>
      {displayLabel}
    </Badge>
  );
}
