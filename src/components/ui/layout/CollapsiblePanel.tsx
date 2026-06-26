import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type CollapsiblePanelProps = {
  /** Kleine bovenkop (eyebrow), bv. "Agenda". */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Actie(s) rechtsboven in de body (zichtbaar zodra uitgeklapt). */
  action?: ReactNode;
  /** Open bij eerste render? Standaard dicht (naslag-secties). */
  defaultOpen?: boolean;
  id?: string;
  children: ReactNode;
};

/**
 * Inklapbaar paneel (details/summary). Naslag-/invoer-secties staan standaard dicht
 * zodat een scherm in één oogopslag past; de kop blijft de toggle. Portaal-breed
 * herbruikbaar (dashboard, offerte-bouwer, …).
 */
export function CollapsiblePanel({
  eyebrow,
  title,
  description,
  action,
  defaultOpen = false,
  id,
  children
}: CollapsiblePanelProps) {
  return (
    <details
      className="panel collapsible-panel"
      id={id}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="collapsible-panel-summary">
        <div className="collapsible-panel-titles">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <ChevronDown className="collapsible-panel-chevron" size={18} aria-hidden="true" />
      </summary>
      {action ? <div className="collapsible-panel-action">{action}</div> : null}
      {children}
    </details>
  );
}
