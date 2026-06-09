import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "../utils/classNames";

type IconButtonVariant = "ghost" | "secondary" | "danger";
type IconButtonSize = "sm" | "md";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  children: ReactNode;
};

export function IconButton({
  variant = "ghost",
  size = "md",
  isLoading = false,
  children,
  className,
  type = "button",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={classNames(
        "ui-icon-button",
        `ui-icon-button-${variant}`,
        `ui-icon-button-${size}`,
        className
      )}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <span className="ui-button-spinner" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
}
