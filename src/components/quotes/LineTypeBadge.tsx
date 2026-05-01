import type { QuoteLineType } from "../../lib/portalTypes";
import { formatLineType } from "../../lib/i18n/statusLabels";
import { Badge, type BadgeVariant } from "../ui/Badge";

type LineTypeBadgeProps = {
  lineType: QuoteLineType;
};

const variants: Record<QuoteLineType, BadgeVariant> = {
  product: "accent",
  service: "info",
  labor: "warning",
  material: "neutral",
  discount: "danger",
  text: "neutral",
  manual: "info"
};

export default function LineTypeBadge({ lineType }: LineTypeBadgeProps) {
  const label = formatLineType(lineType);

  return (
    <Badge variant={variants[lineType]} label={`Regeltype: ${label}`}>
      {label}
    </Badge>
  );
}
