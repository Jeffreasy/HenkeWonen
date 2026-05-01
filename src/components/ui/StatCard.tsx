import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames";

type StatTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  tone?: StatTone;
};

export function StatCard({
  label,
  value,
  description,
  tone = "neutral",
  className,
  ...props
}: StatCardProps) {
  return (
    <div className={classNames("ui-stat-card", `ui-stat-card-${tone}`, className)} {...props}>
      <p className="ui-stat-label">{label}</p>
      <strong className="ui-stat-value">{value}</strong>
      {description ? <p className="ui-stat-description">{description}</p> : null}
    </div>
  );
}
