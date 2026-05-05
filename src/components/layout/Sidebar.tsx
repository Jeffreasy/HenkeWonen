import {
  BriefcaseBusiness,
  FileText,
  Home,
  Menu,
  PackageSearch,
  Settings,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { canManage } from "../../lib/auth/session";
import type { AppSession } from "../../lib/auth/session";

type SidebarProps = {
  session: AppSession;
  pathname?: string;
};

type NavMatch = {
  path: string;
  exact?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  matches?: NavMatch[];
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Werkplek",
    items: [
      { href: "/portal", label: "Start", icon: Home },
      {
        href: "/portal/dossiers",
        label: "Dossiers",
        icon: BriefcaseBusiness,
        matches: [
          { path: "/portal/dossiers" },
          { path: "/portal/klanten" },
          { path: "/portal/projecten" }
        ]
      },
      { href: "/portal/offertes", label: "Offertes", icon: FileText },
      {
        href: "/portal/catalogus",
        label: "Catalogus",
        icon: PackageSearch,
        matches: [{ path: "/portal/catalogus", exact: true }]
      },
      {
        href: "/portal/beheer",
        label: "Beheer",
        icon: Settings,
        adminOnly: true,
        matches: [
          { path: "/portal/beheer" },
          { path: "/portal/leveranciers" },
          { path: "/portal/imports" },
          { path: "/portal/import-profielen" },
          { path: "/portal/catalogus/data-issues" },
          { path: "/portal/instellingen" }
        ]
      }
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

function isActiveMatch(currentPathname: string, match: NavMatch) {
  if (match.exact) {
    return currentPathname === match.path;
  }

  return currentPathname === match.path || currentPathname.startsWith(`${match.path}/`);
}

function isActivePath(currentPathname: string, item: NavItem) {
  const matches = item.matches ?? [{ path: item.href }];

  if (item.href === "/portal" && !item.matches) {
    return currentPathname === item.href;
  }

  return matches.some((match) => isActiveMatch(currentPathname, match));
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
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || canManage(session.role))
    }))
    .filter((group) => group.items.length > 0);
  const activeItem = visibleNavGroups
    .flatMap((group) => group.items)
    .find((item) => isActivePath(currentPathname, item));

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
          <h1 className="brand-title">Werkplek</h1>
        </div>

        <nav className="nav-list" aria-label="Navigatie">
          {visibleNavGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActivePath(currentPathname, item);

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
          <p className="role">{roleLabel(session.role)}</p>
        </div>
      </div>
    </aside>
  );
}
