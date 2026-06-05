import { Skeleton } from "../ui/feedback/Skeleton";
import { SkeletonGroup } from "../ui/feedback/SkeletonGroup";

/**
 * Mirrors the ProjectDetail layout:
 * - ProjectOverviewPanel + ProjectWorkflowRail (two-col)
 * - ProjectRoomsPanel
 * - Tasks + Timeline (two-col)
 * - MeasurementPanel (inline)
 */
export function ProjectDetailSkeleton() {
  return (
    <div className="skeleton-detail-page" aria-label="Project laden" aria-busy="true">
      {/* Top: overview panel + workflow rail */}
      <div className="skeleton-two-col">
        {/* Overview panel */}
        <div className="skeleton-panel">
          <SkeletonGroup direction="row" gap={10}>
            <Skeleton height={18} width="50%" />
            <Skeleton height={22} width={80} style={{ marginLeft: "auto" }} />
          </SkeletonGroup>
          {[65, 50, 75, 55, 60].map((w, i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton height={12} width="28%" />
              <Skeleton height={12} width={`${w}%`} />
            </div>
          ))}
          <SkeletonGroup direction="row" gap={8}>
            <Skeleton height={32} width={120} />
            <Skeleton height={32} width={120} />
          </SkeletonGroup>
        </div>

        {/* Workflow rail */}
        <div className="skeleton-panel">
          <Skeleton height={14} width="40%" />
          {[100, 100, 100, 100, 100].map((_, i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton variant="circle" height={28} width={28} />
              <Skeleton height={13} width="60%" />
              <Skeleton height={20} width={70} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Rooms panel */}
      <div className="skeleton-panel">
        <SkeletonGroup direction="row" gap={12}>
          <Skeleton height={16} width="35%" />
          <Skeleton height={28} width={110} style={{ marginLeft: "auto" }} />
        </SkeletonGroup>
        {[55, 70, 60].map((w, i) => (
          <div className="skeleton-table-row" key={i}>
            <Skeleton height={13} width={`${w}%`} />
            <Skeleton height={13} width="20%" />
            <Skeleton height={22} width={80} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      {/* Tasks + Timeline */}
      <div className="skeleton-two-col">
        {/* Tasks */}
        <div className="skeleton-panel">
          <Skeleton height={16} width="40%" />
          {[70, 55, 80, 65].map((w, i) => (
            <div className="skeleton-table-row" key={i}>
              <Skeleton variant="circle" height={18} width={18} />
              <Skeleton height={13} width={`${w}%`} />
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="skeleton-panel">
          <Skeleton height={16} width="40%" />
          {[60, 75, 50, 65, 70].map((w, i) => (
            <div className="skeleton-summary-row" key={i}>
              <Skeleton variant="circle" height={20} width={20} />
              <SkeletonGroup gap={6}>
                <Skeleton height={12} width={`${w}%`} />
                <Skeleton height={10} width={90} />
              </SkeletonGroup>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
