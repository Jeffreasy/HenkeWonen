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
          <Skeleton height={16} width={190} style={{ marginBottom: "var(--space-3)" }} />
          <div className="field-card-list">
            {[0, 1, 2].map((c) => (
              <article className="field-work-card" key={c}>
                <div className="field-card-status-stack">
                  <Skeleton height={18} width="55%" />
                  <Skeleton height={22} width={92} />
                </div>
                <Skeleton height={13} width="72%" style={{ marginTop: "var(--space-2)" }} />
                <Skeleton height={13} width="48%" style={{ marginTop: "var(--space-1)" }} />
                <div className="field-card-actions" style={{ marginTop: "var(--space-3)" }}>
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
