import { Skeleton } from "../ui/feedback/Skeleton";
import { SkeletonGroup } from "../ui/feedback/SkeletonGroup";

/**
 * Mirrors the CustomerDetail layout:
 * - 3 stat-cards (CustomerDetailStats)
 * - Two-column: info-panel + projects-table
 * - Two-column: contacts-table + loaned-items
 */
export function CustomerDetailSkeleton() {
  return (
    <div className="skeleton-detail-page" aria-label="Klantdossier laden" aria-busy="true">
      {/* Stat cards (3) */}
      <div className="skeleton-stat-row">
        {[0, 1, 2].map((i) => (
          <div className="skeleton-stat-card" key={i}>
            <Skeleton height={12} width="55%" />
            <Skeleton height={28} width="40%" />
            <Skeleton height={11} width="70%" />
          </div>
        ))}
      </div>

      {/* Two-column: CustomerInfoPanel + CustomerProjectsTable */}
      <div className="skeleton-two-col">
        {/* Info panel — SummaryList style */}
        <div className="skeleton-panel">
          <SkeletonGroup direction="row" gap={12}>
            <Skeleton height={16} width="40%" />
            <Skeleton height={22} width={64} />
          </SkeletonGroup>
          {[70, 55, 85, 60, 75, 50].map((w, i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton height={12} width="30%" />
              <Skeleton height={12} width={`${w}%`} />
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div className="skeleton-panel">
          <Skeleton height={16} width="45%" />
          {[60, 80, 50, 70, 65].map((w, i) => (
            <div className="skeleton-table-row" key={i}>
              <Skeleton height={13} width={`${w}%`} />
              <Skeleton height={20} width={72} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: ContactListTable + LoanedItemsList */}
      <div className="skeleton-two-col">
        {/* Contacts */}
        <div className="skeleton-panel">
          <SkeletonGroup direction="row" gap={12}>
            <Skeleton height={16} width="40%" />
            <Skeleton height={26} width={100} style={{ marginLeft: "auto" }} />
          </SkeletonGroup>
          {[75, 60, 80, 55, 70, 65].map((w, i) => (
            <div className="skeleton-table-row" key={i}>
              <Skeleton height={13} width={`${w}%`} />
              <Skeleton height={18} width={60} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>

        {/* Loaned items */}
        <div className="skeleton-panel">
          <Skeleton height={16} width="45%" />
          {[55, 70, 60].map((w, i) => (
            <div className="skeleton-table-row" key={i}>
              <Skeleton height={13} width={`${w}%`} />
              <Skeleton height={18} width={50} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
