import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { classNames } from "./classNames";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, error = false, ...props },
  ref
) {
  const input = (
    <input
      className={classNames("ui-checkbox", className)}
      type="checkbox"
      ref={ref}
      {...props}
      aria-invalid={error || props["aria-invalid"] || undefined}
    />
  );

  if (!label) {
    return input;
  }

  return (
    <label className="ui-checkbox-label">
      {input}
      <span className="ui-checkbox-content">
        <span>{label}</span>
        {description ? <span className="ui-field-description">{description}</span> : null}
      </span>
    </label>
  );
});
