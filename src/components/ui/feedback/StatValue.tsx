import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

type StatValueProps = {
  loading: boolean;
  value: ReactNode;
  /** Skeleton-breedte (px) tijdens laden; standaard 40. */
  width?: number;
};

/**
 * Toont een waarde, of tijdens laden een shimmer-skeleton van vergelijkbare
 * breedte — voorkomt een "0 → echte waarde"-sprong. Gedeeld door ImportWorkbench
 * en VatWorkbenchHeader (en herbruikbaar voor vergelijkbare stat-cellen elders).
 */
export function StatValue({ loading, value, width = 40 }: StatValueProps) {
  if (!loading) {
    return <>{value}</>;
  }

  return (
    <Skeleton width={width} height={18} style={{ display: "inline-block", verticalAlign: "middle" }} />
  );
}
