import type { ReactNode } from "react";
import { Badge, type BadgeVariant } from "./Badge";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  tone?: BadgeVariant;
};

type TimelineProps = {
  items: TimelineItem[];
  emptyState?: ReactNode;
};

export function Timeline({ items, emptyState }: TimelineProps) {
  if (items.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <ol className="timeline">
      {items.map((item) => (
        <li className={`timeline-item timeline-item-${item.tone ?? "neutral"}`} key={item.id}>
          <div className="timeline-marker" aria-hidden="true" />
          <div className="timeline-content">
            <div className="timeline-header">
              <strong>{item.title}</strong>
              {item.badge ? <Badge variant={item.tone ?? "neutral"}>{item.badge}</Badge> : null}
            </div>
            {item.description ? <p className="muted">{item.description}</p> : null}
            {item.meta ? <small>{item.meta}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
