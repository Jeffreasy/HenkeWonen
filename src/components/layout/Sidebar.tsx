import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import { classNames } from "../ui/classNames";
import { LogoutButton } from "./LogoutButton";
import {
  activePortalNavItem,
  getCurrentPathname,
  isActivePortalItem,
  quickbarPortalItems,
  roleLabel,
  visiblePortalNavGroups,
  type PortalNavGroup
} from "./portalNavigation";

type SidebarProps = {
  session: AppSession;
  pathname?: string;
};

function groupHasActiveItem(group: PortalNavGroup, currentPathname: string) {
  return group.items.some((item) => isActivePortalItem(currentPathname, item));
}

export default function Sidebar({ session, pathname }: SidebarProps) {
  const currentPathname = getCurrentPathname(pathname);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const visibleNavGroups = visiblePortalNavGroups(session);
  const activeItem = activePortalNavItem(currentPathname, visibleNavGroups);
  const quickbarItems = quickbarPortalItems(visibleNavGroups);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function isGroupOpen(group: PortalNavGroup) {
    if (!group.collapsible) {
      return true;
    }

    return groupHasActiveItem(group, currentPathname) || (openGroups[group.id] ?? false);
  }

  function toggleGroup(group: PortalNavGroup) {
    const nextValue = !isGroupOpen(group);

    setOpenGroups((current) => ({ ...current, [group.id]: nextValue }));
  }

  const navigation = (
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
                onClick={() => toggleGroup(group)}
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
                    onClick={() => setIsMenuOpen(false)}
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

  return (
    <>
      <aside className="sidebar" aria-label="Hoofdnavigatie">
        <div className="sidebar-mobile-topbar">
          <div>
            <p className="brand-kicker">Henke Wonen</p>
            <p className="mobile-active-route">{activeItem?.label ?? "Start"}</p>
          </div>
          <button
            aria-controls="portal-mobile-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Menu sluiten" : "Menu openen"}
            className="sidebar-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            <span>{isMenuOpen ? "Sluiten" : "Menu"}</span>
          </button>
        </div>

        <div
          className={isMenuOpen ? "sidebar-nav-panel open" : "sidebar-nav-panel"}
          id="portal-mobile-navigation"
        >
          <div className="sidebar-desktop-brand">
            <p className="brand-kicker">Henke Wonen</p>
            <h1 className="brand-title">Winkel</h1>
          </div>

          {navigation}

          <div className="session-card">
            <p>{session.name ?? session.email}</p>
            <p className="role">{roleLabel(session.role)}</p>
            <LogoutButton className="logout-button-sidebar" />
          </div>
        </div>
      </aside>

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
    </>
  );
}
