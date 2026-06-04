import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import {
  activePortalNavItem,
  getCurrentPathname,
  isActivePortalItem,
  quickbarPortalItems,
  visiblePortalNavGroups,
  type PortalNavGroup
} from "./portalNavigation";
import { SidebarNav } from "./SidebarNav";
import { SidebarSessionCard } from "./SidebarSessionCard";
import { PortalQuickbar } from "./PortalQuickbar";

type SidebarProps = {
  session: AppSession;
  pathname?: string;
};

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

  function toggleGroup(group: PortalNavGroup) {
    const isGroupActive = group.items.some((item) => isActivePortalItem(currentPathname, item));
    const isOpen = !group.collapsible || isGroupActive || (openGroups[group.id] ?? false);

    setOpenGroups((current) => ({ ...current, [group.id]: !isOpen }));
  }

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

          <SidebarNav
            visibleNavGroups={visibleNavGroups}
            currentPathname={currentPathname}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onLinkClick={() => setIsMenuOpen(false)}
          />

          <SidebarSessionCard session={session} />
        </div>
      </aside>

      <PortalQuickbar quickbarItems={quickbarItems} currentPathname={currentPathname} />
    </>
  );
}
