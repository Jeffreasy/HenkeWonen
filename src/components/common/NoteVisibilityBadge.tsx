import { Eye, EyeOff } from "lucide-react";
import { Badge } from "../ui/Badge";

type NoteVisibilityBadgeProps = {
  visibleToCustomer: boolean;
};

export function NoteVisibilityBadge({ visibleToCustomer }: NoteVisibilityBadgeProps) {
  return (
    <Badge
      variant={visibleToCustomer ? "info" : "neutral"}
      icon={
        visibleToCustomer ? (
          <Eye size={13} aria-hidden="true" />
        ) : (
          <EyeOff size={13} aria-hidden="true" />
        )
      }
      label={visibleToCustomer ? "Zichtbaar voor klant" : "Alleen intern"}
    >
      {visibleToCustomer ? "Klantzichtbaar" : "Intern"}
    </Badge>
  );
}
