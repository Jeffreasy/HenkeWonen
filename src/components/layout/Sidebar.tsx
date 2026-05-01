import {
  BriefcaseBusiness,
  FileText,
  Home,
  Layers3,
  Menu,
  PackageSearch,
  Settings,
  SlidersHorizontal,
  Truck,
  Upload,
  Users,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";

type SidebarProps = {
  session: AppSession;
  pathname?: string;
};

const navGroups = [
  {
    label: "Overzicht",
    items: [{ href: "/portal", label: "Overzicht", icon: Home }]
  },
  {
    label: "Werkproces",
    items: [
      { href: "/portal/klanten", label: "Klanten", icon: Users },
      { href: "/portal/projecten", label: "Projecten", icon: BriefcaseBusiness },
      { href: "/portal/offertes", label: "Offertes", icon: FileText }
    ]
  },
  {
    label: "Catalogus & imports",
    items: [
      { href: "/portal/catalogus", label: "Catalogus", icon: PackageSearch },
      { href: "/portal/leveranciers", label: "Leveranciers", icon: Truck },
      { href: "/portal/imports", label: "Imports", icon: Upload },
      { href: "/portal/import-profielen", label: "Importprofielen", icon: SlidersHorizontal }
    ]
  },
  {
    label: "Instellingen",
    items: [
      { href: "/portal/instellingen/werkzaamheden", label: "Werkzaamheden", icon: Settings },
      { href: "/portal/instellingen/categorieen", label: "Categorieën", icon: Layers3 },
      { href: "/portal/instellingen/offertetemplates", label: "Offertesjablonen", icon: FileText }
    ]
  }
];

function getCurrentPathname(pathname?: string) {
  if (pathname) {
    return pathname;
  }

  if (typeof window !== "undefined") {
    return window.location.pathname;
  }

  return "/portal";
}

function isActivePath(currentPathname: string, href: string) {
  if (href === "/portal") {
    return currentPathname === href;
  }

  return currentPathname === href || currentPathname.startsWith(`${href}/`);
}

function roleLabel(role: AppSession["role"]) {
  const labels: Record<AppSession["role"], string> = {
    viewer: "Kijker",
    user: "Gebruiker",
    editor: "Bewerker",
    admin: "Beheerder"
  };

  return labels[role];
}

export default function Sidebar({ session, pathname }: SidebarProps) {
  const currentPathname = getCurrentPathname(pathname);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeItem = navGroups
    .flatMap((group) => group.items)
    .find((item) => isActivePath(currentPathname, item.href));

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

  return (
    <aside className="sidebar">
      <div className="sidebar-mobile-topbar">
        <div>
          <p className="brand-kicker">Henke Wonen</p>
          <p className="mobile-active-route">{activeItem?.label ?? "Overzicht"}</p>
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
          <h1 className="brand-title">Backoffice</h1>
        </div>

      <nav className="nav-list" aria-label="Navigatie">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            <div className="nav-group-items">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(currentPathname, item.href);

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={isActive ? "nav-link active" : "nav-link"}
                    aria-current={
                      currentPathname === item.href ? "page" : isActive ? "location" : undefined
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

        <div className="session-card">
          <p>{session.name ?? session.email}</p>
          <p className="role">
            {roleLabel(session.role)} | {session.tenantId}
          </p>
        </div>
      </div>
    </aside>
  );
}
