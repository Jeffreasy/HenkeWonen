import type { ReactNode } from "react";

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
  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ui-field-required"> *</span> : null}
      </label>
      {description || helpText ? (
        <p className="ui-field-description">{description ?? helpText}</p>
      ) : null}
      {children}
      {error ? <p className="ui-field-error">{error}</p> : null}
    </div>
  );
}
