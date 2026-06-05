import { Skeleton } from "../ui/feedback/Skeleton";
import { SkeletonGroup } from "../ui/feedback/SkeletonGroup";

/**
 * Mirrors InvoiceDetail layout:
 * - Header panel (factuurnummer + status + actions)
 * - Two-column: factuurgegevens + gekoppeld dossier
 */
export function InvoiceDetailSkeleton() {
  return (
    <div className="skeleton-detail-page" aria-label="Factuur laden" aria-busy="true">
      {/* Header */}
      <div className="skeleton-panel">
        <SkeletonGroup direction="row" gap={12}>
          <Skeleton height={20} width="35%" />
          <Skeleton height={24} width={90} />
          <Skeleton height={32} width={140} style={{ marginLeft: "auto" }} />
        </SkeletonGroup>
        <Skeleton height={13} width="45%" />
      </div>

      {/* Two-column */}
      <div className="skeleton-two-col">
        {/* Factuurgegevens */}
        <div className="skeleton-panel">
          <Skeleton height={15} width="40%" />
          {[
            ["30%", "45%"],
            ["30%", "55%"],
            ["30%", "50%"],
            ["30%", "40%"],
            ["30%", "40%"],
            ["30%", "55%"],
            ["30%", "45%"],
            ["30%", "55%"]
          ].map(([lw, rw], i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton height={12} width={lw} />
              <Skeleton height={12} width={rw} />
            </div>
          ))}
        </div>

        {/* Gekoppeld dossier */}
        <div className="skeleton-panel">
          <Skeleton height={15} width="40%" />
          {[
            ["30%", "60%"],
            ["30%", "55%"],
            ["30%", "50%"],
            ["30%", "65%"],
            ["30%", "45%"]
          ].map(([lw, rw], i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton height={12} width={lw} />
              <Skeleton height={12} width={rw} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
