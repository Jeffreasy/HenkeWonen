import { forwardRef, type TextareaHTMLAttributes } from "react";
import { classNames } from "./classNames";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error = false, ...props },
  ref
) {
  return (
    <textarea
      className={classNames("ui-control", "ui-textarea", className)}
      ref={ref}
      {...props}
      aria-invalid={error || props["aria-invalid"] || undefined}
    />
  );
});
