import type { ReactNode } from "react";
import { classNames } from "./classNames";

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function SectionHeader({ title, description, actions, compact = false }: SectionHeaderProps) {
  return (
    <div className={classNames("ui-section-header", compact && "ui-section-header-compact")}>
      <div>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-header-actions">{actions}</div> : null}
    </div>
  );
}
