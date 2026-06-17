import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Printer,
  Ruler
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import {
  FieldSidebar,
  type FieldNavGroup
} from "./FieldSidebar";
import { FieldTopbar } from "./FieldTopbar";
import { FieldQuickbar } from "./FieldQuickbar";

type FieldNavigationProps = {
  session: AppSession;
  pathname?: string;
};

const fieldHomePath = "/portal/buitendienst";
const fieldTodayPath = `${fieldHomePath}/vandaag`;
const fieldMeasurePath = `${fieldHomePath}/inmeten`;
const fieldQuotePath = `${fieldHomePath}/conceptoffertes`;
const fieldAgendaPath = "/portal/agenda";

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

function isTodayPath(pathname: string) {
  return pathname === fieldHomePath || pathname === fieldTodayPath;
}

function workdayHref(pathname: string, pagePath: string, projectHash: string) {
  return isProjectPath(pathname) ? projectHash : pagePath;
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
  const onProject = isProjectPath(pathname);
  const onToday = isTodayPath(pathname);
  const onMeasure = pathname === fieldMeasurePath;
  const onQuote = pathname === fieldQuotePath;
  const onAgenda = pathname === fieldAgendaPath;

  const groups: FieldNavGroup[] = [
    {
      id: "workday",
      label: "Werkdag",
      items: [
        {
          href: fieldTodayPath,
          label: "Vandaag",
          icon: CalendarDays,
          active: onToday,
          quickbar: true
        },
        {
          href: workdayHref(pathname, fieldMeasurePath, "#inmeten"),
          label: "Inmeten",
          icon: Ruler,
          active: onMeasure || (onProject && hash === "#inmeten"),
          quickbar: true
        },
        {
          href: workdayHref(pathname, fieldQuotePath, "#conceptofferte"),
          label: "Conceptoffertes",
          shortLabel: "Offertes",
          icon: FileText,
          active: onQuote || (onProject && hash === "#conceptofferte"),
          quickbar: true
        },
        {
          href: fieldAgendaPath,
          label: "Agenda",
          icon: CalendarClock,
          active: onAgenda
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
          href: fieldMeasurePath,
          label: "Dossiers",
          icon: BriefcaseBusiness,
          active: false
        },
        {
          href: "#conceptofferte",
          label: "Klantversie",
          icon: Printer,
          active: hash === "#conceptofferte"
        }
      ]
    });
  }

  groups.push({
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
  });

  return groups;
}

export default function FieldNavigation({ session, pathname }: FieldNavigationProps) {
  const path = currentPathname(pathname);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hash, setHash] = useState(currentHash);
  
  const roleLabelStr = useMemo(() => fieldRoleLabel(session.role), [session.role]);
  const groups = useMemo(() => fieldNavGroups(path, hash), [hash, path]);
  
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeItem = useMemo(() => flatItems.find((item) => item.active), [flatItems]);
  const quickbarItems = useMemo(() => flatItems.filter((item) => item.quickbar), [flatItems]);
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

      <FieldSidebar
        groups={groups}
        session={session}
        isMenuOpen={isMenuOpen}
        onCloseMenu={closeMenu}
        roleLabel={roleLabelStr}
        fieldHomePath={fieldHomePath}
      />

      <FieldTopbar
        activeTitle={activeTitle}
        session={session}
        roleLabel={roleLabelStr}
      />

      <FieldQuickbar quickbarItems={quickbarItems} />
    </>
  );
}
