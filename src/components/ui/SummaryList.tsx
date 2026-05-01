import type { ReactNode } from "react";

export type SummaryListItem = {
  id?: string;
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
};

type SummaryListProps = {
  items: SummaryListItem[];
};

export function SummaryList({ items }: SummaryListProps) {
  return (
    <dl className="summary-list">
      {items.map((item, index) => (
        <div
          className="summary-list-item"
          key={item.id ?? (typeof item.label === "string" ? item.label : index)}
        >
          <dt>{item.label}</dt>
          <dd>
            <span>{item.value}</span>
            {item.description ? <small>{item.description}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
