import type { FieldNavItem } from "./FieldSidebar";

type FieldQuickbarProps = {
  quickbarItems: FieldNavItem[];
};

export function FieldQuickbar({ quickbarItems }: FieldQuickbarProps) {
  return (
    <nav className="field-quickbar" aria-label="Snelle buitendienst navigatie">
      {quickbarItems.map((item) => {
        const Icon = item.icon;

        return (
          <a
            aria-current={item.active ? "page" : undefined}
            className={item.active ? "field-quickbar-link active" : "field-quickbar-link"}
            href={item.href}
            key={`quickbar-${item.label}`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.shortLabel ?? item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
