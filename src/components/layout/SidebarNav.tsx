import { ChevronDown } from "lucide-react";
import { classNames } from "../ui/classNames";
import {
  groupHasActiveItem,
  isActivePortalItem,
  isPortalGroupOpen,
  type PortalNavGroup
} from "./portalNavigation";

type SidebarNavProps = {
  visibleNavGroups: PortalNavGroup[];
  currentPathname: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (group: PortalNavGroup) => void;
  onLinkClick: () => void;
};

export function SidebarNav({
  visibleNavGroups,
  currentPathname,
  openGroups,
  onToggleGroup,
  onLinkClick
}: SidebarNavProps) {
  // Gedeeld met Sidebar.toggleGroup (isPortalGroupOpen): een expliciete keuze
  // wint van "groep bevat de actieve pagina", anders kon de Beheer-groep op een
  // beheer-pagina nooit dicht.
  function isGroupOpen(group: PortalNavGroup) {
    return isPortalGroupOpen(group, currentPathname, openGroups);
  }

  return (
    <nav className="nav-list" aria-label="Navigatie">
      {visibleNavGroups.map((group) => {
        const isOpen = isGroupOpen(group);
        const isGroupActive = groupHasActiveItem(group, currentPathname);

        return (
          <div className={classNames("nav-group", isGroupActive && "nav-group-active")} key={group.id}>
            {group.collapsible ? (
              <button
                aria-controls={`nav-group-${group.id}`}
                aria-expanded={isOpen}
                className="nav-group-toggle"
                type="button"
                onClick={() => onToggleGroup(group)}
              >
                <span>{group.label}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            ) : (
              <p className="nav-group-label">{group.label}</p>
            )}
            <div
              className={classNames("nav-group-items", group.collapsible && !isOpen && "nav-group-items-collapsed")}
              id={`nav-group-${group.id}`}
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePortalItem(currentPathname, item);

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={isActive ? "nav-link active" : "nav-link"}
                    aria-current={currentPathname === item.href ? "page" : isActive ? "location" : undefined}
                    onClick={onLinkClick}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
