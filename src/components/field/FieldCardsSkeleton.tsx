import { Skeleton } from "../ui/feedback/Skeleton";

/**
 * Spiegelt de buitendienst-kaartlijst tijdens laden: een paar secties met elk
 * een kop + enkele field-work-card-skeletons (titel + status + meta + acties).
 * Zelfde className-structuur (field-section / field-card-list / field-work-card)
 * zodat er geen layout-sprong is als de kaarten binnenkomen.
 */
export function FieldCardsSkeleton() {
  return (
    <div aria-label="Buitendienst laden" aria-busy="true">
      {[0, 1].map((s) => (
        <section className="field-section" key={s}>
          <Skeleton height={16} width={190} style={{ marginBottom: "var(--space-2)" }} />
          <Skeleton height={12} width="55%" style={{ marginBottom: "var(--space-3)" }} />
          <div className="field-card-list">
            {[0, 1, 2].map((c) => (
              <article className="field-work-card" key={c}>
                {/* .field-work-card is een 2-koloms grid (main | actions) — exact 2
                    directe children spiegelen, anders wrapt CSS-grid de skeleton-rijen
                    naar extra rijen en ontstaat een layout-sprong bij het laden. */}
                <div className="field-work-card-main">
                  <div className="field-work-card-title-row">
                    <Skeleton height={18} width="55%" />
                    <div className="field-card-status-stack">
                      <Skeleton height={18} width={70} />
                      <Skeleton height={22} width={92} />
                    </div>
                  </div>
                  <div className="field-customer-block">
                    <Skeleton height={13} width="40%" />
                    <Skeleton height={13} width="72%" />
                    <Skeleton height={13} width="48%" />
                  </div>
                </div>
                <div className="field-card-actions">
                  <Skeleton height={32} width={96} />
                  <Skeleton height={32} width={96} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
