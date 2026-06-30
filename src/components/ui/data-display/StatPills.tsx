import type { ReactNode } from "react";
import { Skeleton } from "../feedback/Skeleton";

export type StatPill = {
  /** Stabiele React-key; valt terug op label+index als afwezig. */
  id?: string;
  label: string;
  /** Vooraf opgemaakte waarde (getal of bv. een euro-string). */
  value: ReactNode;
  /** Optioneel: maakt de pill een link. */
  href?: string;
  /** Optioneel icoon vóór de waarde. */
  icon?: ReactNode;
  /** Skeleton-breedte (px) tijdens laden; euro-pills mogen breder. Default 46. */
  skeletonWidth?: number;
};

type StatPillsProps = {
  items: StatPill[];
  ariaLabel?: string;
  /** Toont de waarden als shimmer-skeleton (labels blijven), tegen de "0 → echte waarde"-sprong. */
  loading?: boolean;
};

/**
 * Compacte stat-balk: vervangt grote StatCard-blokken door rustige pills.
 * Herbruikbaar over overzichten (offertes, dossiers, klanten, facturen, dashboard).
 */
export function StatPills({ items, ariaLabel, loading = false }: StatPillsProps) {
  return (
    <section className="stat-strip" aria-label={ariaLabel} aria-busy={loading || undefined}>
      {items.map((item, index) => {
        const key = item.id ?? `${item.label}-${index}`;
        const inner = (
          <>
            {item.icon}
            <strong>
              {loading ? (
                <Skeleton
                  width={item.skeletonWidth ?? 46}
                  height={18}
                  style={{ display: "inline-block", verticalAlign: "middle" }}
                />
              ) : (
                item.value
              )}
            </strong>
            <span className="muted">{item.label}</span>
          </>
        );

        // Tijdens laden geen link (er is nog geen zinvolle bestemming/telling).
        return item.href && !loading ? (
          <a className="stat-pill" href={item.href} key={key}>
            {inner}
          </a>
        ) : (
          <div className="stat-pill" key={key}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
