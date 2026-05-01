import type { ReactNode } from "react";

type LoadingStateProps = {
  title: ReactNode;
  description?: ReactNode;
};

export function LoadingState({ title, description }: LoadingStateProps) {
  return (
    <div className="ui-loading-state" aria-live="polite">
      <span className="ui-loading-spinner" aria-hidden="true" />
      <p className="ui-state-title">{title}</p>
      {description ? <p className="ui-state-description">{description}</p> : null}
    </div>
  );
}
