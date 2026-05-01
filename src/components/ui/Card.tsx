import type { HTMLAttributes } from "react";
import { classNames } from "./classNames";

type CardVariant = "default" | "raised" | "muted" | "danger" | "warning" | "success" | "info";
type CardPadding = "none" | "sm" | "md" | "lg";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={classNames(
        "ui-card",
        `ui-card-${variant}`,
        `ui-card-padding-${padding}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
