type SkeletonProps = {
  width?: string | number;
  height?: number;
  variant?: "text" | "block" | "circle";
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

import type React from "react";

export function Skeleton({
  width = "100%",
  height = 16,
  variant = "text",
  animate = true,
  className,
  style
}: SkeletonProps) {
  const resolvedWidth = typeof width === "number" ? `${width}px` : width;

  return (
    <div
      aria-hidden="true"
      className={[
        "skeleton",
        variant === "circle" ? "skeleton-circle" : "",
        animate ? "" : "skeleton-no-shimmer",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: resolvedWidth,
        height: variant === "circle" ? height : height,
        minHeight: height,
        borderRadius: variant === "circle" ? "50%" : undefined,
        ...style
      }}
    />
  );
}

/** Renders a fake table: header + N skeleton rows */
export function SkeletonTable({
  rows = 5,
  cols = 4
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div aria-hidden="true" aria-label="Tabel laden">
      {/* Header row */}
      <div className="skeleton-table-row">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height={12} width={c === 0 ? "30%" : "20%"} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-table-row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height={14}
              width={c === 0 ? `${55 + Math.sin(r + c) * 15}%` : `${30 + Math.sin(r * c + 1) * 12}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
