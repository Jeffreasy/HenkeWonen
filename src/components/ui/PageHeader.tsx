import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "../layout/Breadcrumbs";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  meta?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  meta,
  children
}: PageHeaderProps) {
  const headerActions = actions ?? children;

  return (
    <section className="ui-page-header">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="ui-page-header-row">
        <div className="ui-page-header-copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
          {meta ? <div className="ui-page-header-meta">{meta}</div> : null}
        </div>
        {headerActions ? <div className="ui-page-header-actions">{headerActions}</div> : null}
      </div>
    </section>
  );
}
