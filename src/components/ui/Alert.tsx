import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames";

type AlertVariant = "info" | "success" | "warning" | "danger";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: ReactNode;
  description?: ReactNode;
};

export function Alert({
  variant = "info",
  title,
  description,
  children,
  className,
  ...props
}: AlertProps) {
  return (
    <div
      className={classNames("ui-alert", `ui-alert-${variant}`, className)}
      {...props}
      role={variant === "danger" ? "alert" : props.role}
    >
      {title ? <p className="ui-alert-title">{title}</p> : null}
      {description ? <p className="ui-alert-description">{description}</p> : null}
      {children}
    </div>
  );
}
