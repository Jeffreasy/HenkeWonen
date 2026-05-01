import { forwardRef, type SelectHTMLAttributes } from "react";
import { classNames } from "./classNames";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error = false, children, ...props },
  ref
) {
  return (
    <select
      className={classNames("ui-control", className)}
      ref={ref}
      {...props}
      aria-invalid={error || props["aria-invalid"] || undefined}
    >
      {children}
    </select>
  );
});
