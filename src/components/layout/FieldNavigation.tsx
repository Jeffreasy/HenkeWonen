import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Printer,
  Ruler,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import { classNames } from "../ui/classNames";
import { LogoutButton } from "./LogoutButton";

type FieldNavigationProps = {
  session: AppSession;
  pathname?: string;
};

type FieldNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  active: boolean;
  quickbar?: boolean;
};

type FieldNavGroup = {
  id: string;
  label: string;
  items: FieldNavItem[];
};

const fieldHomePath = "/portal/buitendienst";

function currentPathname(pathname?: string) {
  if (pathname) {
    return pathname;
  }

  if (typeof window !== "undefined") {
    return window.location.pathname;
  }

  return fieldHomePath;
}

function currentHash() {
  if (typeof window !== "undefined") {
    return window.location.hash;
  }

  return "";
}

function isProjectPath(pathname: string) {
  return pathname.startsWith(`${fieldHomePath}/projecten`);
}

function workspaceAnchor(pathname: string, hash: string) {
  return pathname === fieldHomePath ? hash : `${fieldHomePath}${hash}`;
}

function visitAnchor(pathname: string, hash: string) {
  return isProjectPath(pathname) ? hash : `${fieldHomePath}${hash === "#inmeten" ? "#dossiers" : "#conceptoffertes"}`;
}

function fieldRoleLabel(role: AppSession["role"]) {
  const labels: Record<AppSession["role"], string> = {
    viewer: "Kijker",
    user: "Buitendienst",
    editor: "Bewerker",
    admin: "Admin"
  };

  return labels[role];
}

function fieldNavGroups(pathname: string, hash: string): FieldNavGroup[] {
  const onWorkspace = pathname === fieldHomePath;
  const onProject = isProjectPath(pathname);
  const isDefaultWorkspace = onWorkspace && !hash;

  const groups: FieldNavGroup[] = [
    {
      id: "workday",
      label: "Werkdag",
      items: [
        {
          href: fieldHomePath,
          label: "Vandaag",
          icon: CalendarDays,
          active: isDefaultWorkspace,
          quickbar: true
        },
        {
          href: workspaceAnchor(pathname, "#dossiers"),
          label: "Inmeten",
          icon: Ruler,
          active: (onWorkspace && hash === "#dossiers") || (onProject && hash === "#inmeten"),
          quickbar: true
        },
        {
          href: workspaceAnchor(pathname, "#conceptoffertes"),
          label: "Conceptoffertes",
          shortLabel: "Offertes",
          icon: FileText,
          active: (onWorkspace && hash === "#conceptoffertes") || (onProject && hash === "#conceptofferte"),
          quickbar: true
        }
      ]
    }
  ];

  if (onProject) {
    groups.push({
      id: "visit",
      label: "Klantbezoek",
      items: [
        {
          href: fieldHomePath,
          label: "Dossiers",
          icon: BriefcaseBusiness,
          active: !hash
        },
        {
          href: visitAnchor(pathname, "#conceptofferte"),
          label: "Klantversie",
          icon: Printer,
          active: false
        }
      ]
    });
  }

  groups.push(
    {
      id: "workspace",
      label: "Winkel",
      items: [
        {
          href: "/portal?full=1",
          label: "Winkel",
          shortLabel: "Winkel",
          icon: LayoutDashboard,
          active: false,
          quickbar: true
        }
      ]
    }
  );

  return groups;
}

export default function FieldNavigation({ session, pathname }: FieldNavigationProps) {
  const path = currentPathname(pathname);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hash, setHash] = useState(currentHash);
  const groups = useMemo(() => fieldNavGroups(path, hash), [hash, path]);
  const flatItems = groups.flatMap((group) => group.items);
  const activeItem = flatItems.find((item) => item.active);
  const quickbarItems = flatItems.filter((item) => item.quickbar);
  const activeTitle = activeItem?.label ?? (isProjectPath(path) ? "Klantbezoek" : "Vandaag");

  useEffect(() => {
    function handleHashChange() {
      setHash(window.location.hash);
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [hash, path]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  const navigation = (
    <nav className="field-sidebar-nav" aria-label="Buitendienst navigatie">
      {groups.map((group) => (
        <div className="field-nav-group" key={group.id}>
          <p className="field-nav-group-label">{group.label}</p>
          <div className="field-nav-group-items">
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  aria-current={item.active ? "page" : undefined}
                  className={item.active ? "field-nav-link active" : "field-nav-link"}
                  href={item.href}
                  key={`${group.id}-${item.label}`}
                  onClick={closeMenu}
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
  );

  return (
    <>
      {!isMenuOpen ? (
        <header className="field-mobile-bar">
          <a className="field-mobile-brand" href={fieldHomePath} aria-label="Buitendienst start">
            <span>Henke Wonen</span>
            <strong>{activeTitle}</strong>
          </a>
          <button
            aria-controls="field-navigation-drawer"
            aria-expanded="false"
            aria-label="Menu openen"
            className="field-mobile-menu-button"
            type="button"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
            <span>Menu</span>
          </button>
        </header>
      ) : null}

      <aside
        aria-label="Buitendienst menu"
        className={classNames("field-sidebar", isMenuOpen && "field-sidebar-open")}
        id="field-navigation-drawer"
      >
        <div className="field-sidebar-head">
          <a className="field-sidebar-brand" href={fieldHomePath} aria-label="Buitendienst start">
            <span>Henke Wonen</span>
            <strong>Buitendienst</strong>
          </a>
          <button aria-label="Menu sluiten" className="field-sidebar-close" type="button" onClick={closeMenu}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {navigation}

        <div className="field-sidebar-session">
          <p>{session.name ?? session.email}</p>
          <p>{fieldRoleLabel(session.role)}</p>
          <LogoutButton className="logout-button-field-sidebar" />
        </div>
      </aside>

      {isMenuOpen ? (
        <button
          aria-hidden="true"
          className="field-mobile-overlay"
          tabIndex={-1}
          type="button"
          onClick={closeMenu}
        />
      ) : null}

      <header className="field-topbar">
        <div className="field-topbar-context">
          <span>Buitendienst</span>
          <strong>{activeTitle}</strong>
        </div>
        <div className="field-topbar-actions">
          <a className="field-workspace-link" href="/portal?full=1">
            <LayoutDashboard size={17} aria-hidden="true" />
            <span>Winkel</span>
          </a>
          <div className="field-topbar-session">
            <strong>{session.name ?? session.email}</strong>
            <span>{fieldRoleLabel(session.role)}</span>
          </div>
          <LogoutButton className="logout-button-field-topbar" />
        </div>
      </header>

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
    </>
  );
}
