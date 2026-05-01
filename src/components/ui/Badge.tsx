import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  icon?: ReactNode;
  label?: string;
};

export function Badge({
  variant = "neutral",
  icon,
  label,
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={classNames("ui-badge", `ui-badge-${variant}`, className)}
      aria-label={label}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
