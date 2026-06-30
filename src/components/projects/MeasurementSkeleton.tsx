import { Skeleton } from "../ui/feedback/Skeleton";
import { SkeletonGroup } from "../ui/feedback/SkeletonGroup";

/**
 * Spiegelt de MeasurementPanel-layout tijdens laden:
 * - kop (titel + stat-strip)
 * - samenvattingskaart
 * - twee stappen-secties (Producten & diensten / Inmeetregels) met enkele rijen
 * Zelfde bouwstenen/CSS als de andere detail-skeletons → geen layout-sprong.
 */
export function MeasurementSkeleton() {
  return (
    <div className="skeleton-detail-page" aria-label="Inmeting laden" aria-busy="true">
      {/* Kop + stat-pills */}
      <div className="skeleton-panel">
        <SkeletonGroup direction="row" gap={12}>
          <Skeleton height={20} width="34%" />
          <Skeleton height={24} width={96} style={{ marginLeft: "auto" }} />
        </SkeletonGroup>
        <SkeletonGroup direction="row" gap={10}>
          <Skeleton height={28} width={120} />
          <Skeleton height={28} width={120} />
          <Skeleton height={28} width={140} />
        </SkeletonGroup>
      </div>

      {/* Twee stappen-secties */}
      {[0, 1].map((section) => (
        <div className="skeleton-panel" key={section}>
          <Skeleton height={15} width="30%" />
          {[0, 1, 2].map((r) => (
            <div className="skeleton-table-row" key={r}>
              <Skeleton height={14} width={`${48 + Math.sin(section + r) * 14}%`} />
              <Skeleton height={14} width="18%" />
              <Skeleton height={14} width="14%" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
