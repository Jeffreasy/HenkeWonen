import { formatInvoiceStatus } from "../../lib/i18n/statusLabels";
import type { InvoiceStatus } from "../../lib/portalTypes";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";

type InvoiceStatusBadgeProps = {
  status: InvoiceStatus | string;
};

function invoiceStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
      return "danger";
    case "partially_paid":
      return "warning";
    case "sent":
      return "info";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <Badge variant={invoiceStatusVariant(status)} label={`Status: ${formatInvoiceStatus(status)}`}>
      {formatInvoiceStatus(status)}
    </Badge>
  );
}
