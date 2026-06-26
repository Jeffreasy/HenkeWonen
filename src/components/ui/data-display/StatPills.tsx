import type { ReactNode } from "react";

export type StatPill = {
  label: string;
  /** Vooraf opgemaakte waarde (getal of bv. een euro-string). */
  value: ReactNode;
  /** Optioneel: maakt de pill een link. */
  href?: string;
  /** Optioneel icoon vóór de waarde. */
  icon?: ReactNode;
};

type StatPillsProps = {
  items: StatPill[];
  ariaLabel?: string;
};

/**
 * Compacte stat-balk: vervangt grote StatCard-blokken door rustige pills.
 * Herbruikbaar over overzichten (offertes, dossiers, klanten, facturen, dashboard).
 */
export function StatPills({ items, ariaLabel }: StatPillsProps) {
  return (
    <section className="stat-strip" aria-label={ariaLabel}>
      {items.map((item) => {
        const inner = (
          <>
            {item.icon}
            <strong>{item.value}</strong>
            <span className="muted">{item.label}</span>
          </>
        );

        return item.href ? (
          <a className="stat-pill" href={item.href} key={item.label}>
            {inner}
          </a>
        ) : (
          <div className="stat-pill" key={item.label}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
