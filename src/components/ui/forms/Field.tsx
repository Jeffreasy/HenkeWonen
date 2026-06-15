import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode
} from "react";

type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  helpText?: ReactNode;
  error?: ReactNode;
  required?: boolean;
};

export function Field({
  label,
  children,
  htmlFor,
  description,
  helpText,
  error,
  required = false
}: FieldProps) {
  const generatedId = useId();
  const base = htmlFor ?? generatedId;
  const descId = `${base}-desc`;
  const errorId = `${base}-error`;
  const hasDescription = Boolean(description || helpText);

  let control = children;
  if (isValidElement(children)) {
    const childProps = children.props as {
      "aria-describedby"?: string;
      "aria-invalid"?: boolean | string;
    };

    const describedBy = [
      childProps["aria-describedby"],
      hasDescription ? descId : null,
      error ? errorId : null
    ]
      .filter(Boolean)
      .join(" ");

    const nextProps: {
      "aria-describedby"?: string;
      "aria-invalid"?: boolean;
    } = {
      "aria-describedby": describedBy || undefined
    };

    // Respecteer een reeds door de child gezette aria-invalid.
    if (error && childProps["aria-invalid"] === undefined) {
      nextProps["aria-invalid"] = true;
    }

    control = cloneElement(children as ReactElement, nextProps);
  }

  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ui-field-required"> *</span> : null}
      </label>
      {hasDescription ? (
        <p id={descId} className="ui-field-description">
          {description ?? helpText}
        </p>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} className="ui-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
