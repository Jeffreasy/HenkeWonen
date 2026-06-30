import { Skeleton } from "../ui/feedback/Skeleton";
import { SkeletonGroup } from "../ui/feedback/SkeletonGroup";

/**
 * Spiegelt de offerte-detail (QuoteBuilder) layout tijdens laden:
 * - terug-knoppen
 * - kop met titel + statusbadge + actieknoppen
 * - postenlijst (tabel-rijen)
 * - totalen-blok
 * Zelfde bouwstenen/CSS als InvoiceDetailSkeleton zodat er geen layout-sprong is.
 */
export function QuoteDetailSkeleton() {
  return (
    <div className="skeleton-detail-page" aria-label="Offerte laden" aria-busy="true">
      {/* Terug-navigatie */}
      <SkeletonGroup direction="row" gap={8}>
        <Skeleton height={30} width={150} />
        <Skeleton height={30} width={130} />
      </SkeletonGroup>

      {/* Kop: titel + status + acties */}
      <div className="skeleton-panel">
        <SkeletonGroup direction="row" gap={12}>
          <Skeleton height={22} width="32%" />
          <Skeleton height={24} width={96} />
          <Skeleton height={32} width={130} style={{ marginLeft: "auto" }} />
          <Skeleton height={32} width={110} />
        </SkeletonGroup>
        <Skeleton height={13} width="48%" />
      </div>

      {/* Postenlijst */}
      <div className="skeleton-panel">
        <Skeleton height={15} width="28%" />
        {[0, 1, 2, 3, 4].map((r) => (
          <div className="skeleton-table-row" key={r}>
            <Skeleton height={14} width={`${52 + Math.sin(r) * 12}%`} />
            <Skeleton height={14} width="14%" />
            <Skeleton height={14} width="16%" />
            <Skeleton height={14} width="14%" />
          </div>
        ))}
      </div>

      {/* Totalen */}
      <div className="skeleton-panel">
        {[
          ["Subtotaal", "22%"],
          ["Btw", "18%"],
          ["Totaal", "26%"]
        ].map(([, rw], i) => (
          <div className="skeleton-summary-row" key={i} style={{ justifyContent: "flex-end", gap: "var(--space-4)" }}>
            <Skeleton height={12} width="20%" />
            <Skeleton height={12} width={rw} />
          </div>
        ))}
      </div>
    </div>
  );
}
