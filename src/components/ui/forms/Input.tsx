import { forwardRef, type InputHTMLAttributes } from "react";
import { classNames } from "../utils/classNames";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error = false, ...props },
  ref
) {
  return (
    <input
      className={classNames("ui-control", className)}
      ref={ref}
      {...props}
      aria-invalid={error || props["aria-invalid"] || undefined}
    />
  );
});
