import type { ProjectStatus, QuoteStatus } from "../portalTypes";

export type QuoteStatusActionDefinition = {
  status: Exclude<QuoteStatus, "expired">;
  label: string;
  confirmLabel?: string;
  description: string;
  variant: "primary" | "secondary" | "danger";
};

const actionDefinitions: Record<Exclude<QuoteStatus, "expired">, QuoteStatusActionDefinition> = {
  draft: {
    status: "draft",
    label: "Terug naar concept",
    description:
      "De offerte wordt opnieuw een bewerkbaar concept. Eerdere verzend-, geldigheids- en beslisdatums worden gewist.",
    variant: "secondary"
  },
  sent: {
    status: "sent",
    label: "Markeer verzonden",
    description: "De offerte wordt als verzonden geregistreerd en krijgt een nieuwe verzenddatum.",
    variant: "secondary"
  },
  accepted: {
    status: "accepted",
    label: "Akkoord",
    description: "De offerte wordt akkoord gezet en de bijbehorende opvolging wordt gestart.",
    variant: "primary"
  },
  rejected: {
    status: "rejected",
    label: "Afwijzen",
    description:
      "De offerte wordt afgewezen. Nog niet ontvangen leveranciersbestellingen van deze offerte worden mee-geannuleerd.",
    variant: "danger"
  },
  cancelled: {
    status: "cancelled",
    label: "Annuleren",
    confirmLabel: "Offerte annuleren",
    description:
      "Alleen deze offerte wordt geannuleerd. Nog niet ontvangen leveranciersbestellingen van deze offerte worden mee-geannuleerd.",
    variant: "secondary"
  }
};

const allowedTargets: Record<QuoteStatus, ReadonlyArray<Exclude<QuoteStatus, "expired">>> = {
  draft: ["sent", "accepted", "rejected", "cancelled"],
  sent: ["draft", "accepted", "rejected", "cancelled"],
  accepted: ["cancelled"],
  rejected: ["draft"],
  cancelled: ["draft"],
  expired: ["draft"]
};

const fieldTargets = new Set<QuoteStatus>(["sent", "accepted", "rejected"]);

export function getQuoteStatusActions(
  currentStatus: QuoteStatus,
  mode: "full" | "field" = "full",
  projectStatus?: ProjectStatus
): QuoteStatusActionDefinition[] {
  if (projectStatus === "cancelled" || projectStatus === "closed") {
    return [];
  }

  return allowedTargets[currentStatus]
    .filter((status) => mode === "full" || fieldTargets.has(status))
    .map((status) => actionDefinitions[status]);
}
