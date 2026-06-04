import { isActivePortalItem, type PortalNavItem } from "./portalNavigation";

type PortalQuickbarProps = {
  quickbarItems: PortalNavItem[];
  currentPathname: string;
};

export function PortalQuickbar({ quickbarItems, currentPathname }: PortalQuickbarProps) {
  return (
    <nav className="mobile-quickbar" aria-label="Snelle navigatie">
      {quickbarItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePortalItem(currentPathname, item);

        return (
          <a
            aria-current={currentPathname === item.href ? "page" : isActive ? "location" : undefined}
            className={isActive ? "mobile-quickbar-link active" : "mobile-quickbar-link"}
            href={item.href}
            key={item.href}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
