import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { ProjectNextStep, ProjectNextStepKind } from "../../../convex/projecten/nextStep";
import { Button } from "../ui/forms/Button";

type ProjectNextStepBannerProps = {
  nextStep: ProjectNextStep;
  /** Laadtoestand voor de actie die de cockpit zelf afhandelt (bv. inmeten starten). */
  isBusy?: boolean;
  onAction: (kind: ProjectNextStepKind) => void;
};

/** Stappen die navigeren (link) i.p.v. een cockpit-handler aan te roepen. */
const LINK_KINDS: ProjectNextStepKind[] = ["open_quote", "open_invoice", "make_quote"];

/**
 * "Volgende stap"-banner op het kantoor-dossier: toont, op basis van de
 * server-bepaalde {@link ProjectNextStep}, dé eerstvolgende actie — zodat kantoor
 * net zo gestuurd wordt als de buitendienst i.p.v. een vaste rij knoppen.
 *
 * Stappen met een `href` navigeren (link); de overige laten de cockpit de actie
 * afhandelen via `onAction(kind)`. Afgeronde/gestopte dossiers tonen geen actie.
 */
export function ProjectNextStepBanner({ nextStep, isBusy, onAction }: ProjectNextStepBannerProps) {
  const { phaseLabel, actionLabel, hint, kind, href, tone, isStopped } = nextStep;
  const isLinkKind = LINK_KINDS.includes(kind);
  // Een handler-actie (geen link, geen "none"); link-acties navigeren via href.
  const isHandlerAction = !isLinkKind && kind !== "none";

  return (
    <section className={`next-step-banner next-step-banner-${tone}`} aria-label="Volgende stap">
      <div className="next-step-banner-copy">
        <span className="next-step-banner-eyebrow">
          {isStopped ? "Dossier gestopt" : "Volgende stap"} · {phaseLabel}
        </span>
        <strong className="next-step-banner-title">{actionLabel}</strong>
        {hint ? <span className="next-step-banner-hint">{hint}</span> : null}
      </div>
      {isLinkKind ? (
        // Alleen een link tonen als er een bestemming is — nooit een dode knop.
        href ? (
          <a
            className="ui-button ui-button-primary ui-button-md next-step-banner-action"
            href={href}
          >
            {actionLabel}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        ) : null
      ) : isHandlerAction ? (
        <Button
          className="next-step-banner-action"
          variant="primary"
          isLoading={isBusy}
          rightIcon={<ArrowRight size={17} aria-hidden="true" />}
          onClick={() => onAction(kind)}
        >
          {actionLabel}
        </Button>
      ) : (
        <CheckCircle2 size={22} aria-hidden="true" className="next-step-banner-done" />
      )}
    </section>
  );
}
