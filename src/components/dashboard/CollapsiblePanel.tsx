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
 * Inklapbaar dashboard-paneel (details/summary). Naslag-secties staan standaard
 * dicht zodat het werkoverzicht in één oogopslag past; de kop blijft de toggle.
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
      className="panel dashboard-collapsible"
      id={id}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="dashboard-collapsible-summary">
        <div className="dashboard-collapsible-titles">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <ChevronDown className="dashboard-collapsible-chevron" size={18} aria-hidden="true" />
      </summary>
      {action ? <div className="dashboard-collapsible-action">{action}</div> : null}
      {children}
    </details>
  );
}
