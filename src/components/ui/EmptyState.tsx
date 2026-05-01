import type { ReactNode } from "react";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      {icon}
      <p className="ui-state-title">{title}</p>
      {description ? <p className="ui-state-description">{description}</p> : null}
      {action}
    </div>
  );
}
