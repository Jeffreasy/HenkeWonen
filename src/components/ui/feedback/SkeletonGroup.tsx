import type { ReactNode } from "react";

type SkeletonGroupProps = {
  children: ReactNode;
  direction?: "column" | "row";
  gap?: number;
  className?: string;
};

export function SkeletonGroup({
  children,
  direction = "column",
  gap = 12,
  className
}: SkeletonGroupProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "skeleton-group",
        direction === "column" ? "skeleton-group-column" : "skeleton-group-row",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ gap }}
    >
      {children}
    </div>
  );
}
