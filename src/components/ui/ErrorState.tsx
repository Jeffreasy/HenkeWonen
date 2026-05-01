import type { ReactNode } from "react";

type ErrorStateProps = {
  title: ReactNode;
  description?: ReactNode;
  retryAction?: ReactNode;
};

export function ErrorState({ title, description, retryAction }: ErrorStateProps) {
  return (
    <div className="ui-error-state" role="alert">
      <p className="ui-state-title">{title}</p>
      {description ? <p className="ui-state-description">{description}</p> : null}
      {retryAction}
    </div>
  );
}
