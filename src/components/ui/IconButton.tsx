import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames";

type IconButtonVariant = "ghost" | "secondary" | "danger";
type IconButtonSize = "sm" | "md";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
};

export function IconButton({
  variant = "ghost",
  size = "md",
  children,
  className,
  type = "button",
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
      {...props}
    >
      {children}
    </button>
  );
}
