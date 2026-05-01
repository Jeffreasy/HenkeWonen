import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";

type ChecklistTone = "success" | "warning" | "danger" | "info";

export type ChecklistItem = {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  tone: ChecklistTone;
};

type ChecklistProps = {
  title?: ReactNode;
  items: ChecklistItem[];
};

const iconByTone = {
  success: CheckCircle2,
  warning: CircleAlert,
  danger: CircleAlert,
  info: Info
} as const;

export function Checklist({ title, items }: ChecklistProps) {
  return (
    <div className="checklist">
      {title ? <p className="checklist-title">{title}</p> : null}
      <ul className="checklist-list">
        {items.map((item, index) => {
          const Icon = iconByTone[item.tone];

          return (
            <li
              className={`checklist-item checklist-item-${item.tone}`}
              key={item.id ?? (typeof item.label === "string" ? item.label : index)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
