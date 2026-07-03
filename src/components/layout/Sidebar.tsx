import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import {
  activePortalNavItem,
  getCurrentPathname,
  isPortalGroupOpen,
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

  // Scroll-lock zolang het mobiele menu open is: zonder lock scrolde de pagina
  // gewoon door onder het (sticky) geopende paneel — op iOS voelde het menu
  // daardoor kapot zodra het interne paneel-scrollen doorkettte naar de pagina.
  // De lock hoort op <html>: dat is hier het scrollende element (html heeft
  // overflow-y: auto, dus body-overflow propageert níet naar de viewport).
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const html = document.documentElement;
    const vorigeHtml = html.style.overflow;
    const vorigeBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = vorigeHtml;
      document.body.style.overflow = vorigeBody;
    };
  }, [isMenuOpen]);

  function toggleGroup(group: PortalNavGroup) {
    // Zelfde open-bepaling als de weergave (isPortalGroupOpen), anders kon een
    // groep met de actieve pagina erin nooit dicht.
    const isOpen = isPortalGroupOpen(group, currentPathname, openGroups);

    setOpenGroups((current) => ({ ...current, [group.id]: !isOpen }));
  }

  return (
    <>
      <aside className="sidebar" aria-label="Hoofdnavigatie">
        <div className="sidebar-mobile-topbar">
          <a href="/portal" aria-label="Henke Wonen - ga naar dashboard" className="sidebar-logo-link">
            <img
              src="/images/logo-henke-wonen.png"
              alt="Henke Wonen"
              className="sidebar-logo-mobile"
              width="120"
              height="38"
            />
          </a>
          <p className="mobile-active-route">{activeItem?.label ?? "Start"}</p>
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
            <a href="/portal" aria-label="Henke Wonen - ga naar dashboard" className="sidebar-logo-link">
              <img
                src="/images/logo-henke-wonen.png"
                alt="Henke Wonen"
                className="sidebar-logo"
                width="148"
                height="48"
              />
            </a>
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
