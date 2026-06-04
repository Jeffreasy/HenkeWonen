import { ChevronDown } from "lucide-react";
import { classNames } from "../ui/classNames";
import {
  isActivePortalItem,
  type PortalNavGroup
} from "./portalNavigation";

type SidebarNavProps = {
  visibleNavGroups: PortalNavGroup[];
  currentPathname: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (group: PortalNavGroup) => void;
  onLinkClick: () => void;
};

function groupHasActiveItem(group: PortalNavGroup, currentPathname: string) {
  return group.items.some((item) => isActivePortalItem(currentPathname, item));
}

export function SidebarNav({
  visibleNavGroups,
  currentPathname,
  openGroups,
  onToggleGroup,
  onLinkClick
}: SidebarNavProps) {
  function isGroupOpen(group: PortalNavGroup) {
    if (!group.collapsible) {
      return true;
    }
    return groupHasActiveItem(group, currentPathname) || (openGroups[group.id] ?? false);
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
