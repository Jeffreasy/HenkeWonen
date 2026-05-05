import { BriefcaseBusiness, CalendarDays, FileText, LayoutDashboard } from "lucide-react";
import type { AppSession } from "../../lib/auth/session";

type FieldNavigationProps = {
  session: AppSession;
  pathname?: string;
};

const navItems = [
  {
    href: "/portal/buitendienst",
    label: "Vandaag",
    icon: CalendarDays,
    match: (pathname: string) => pathname === "/portal/buitendienst"
  },
  {
    href: "/portal/buitendienst#dossiers",
    label: "Dossiers",
    icon: BriefcaseBusiness,
    match: (pathname: string) => pathname.startsWith("/portal/buitendienst/projecten")
  },
  {
    href: "/portal/buitendienst#conceptoffertes",
    label: "Conceptoffertes",
    icon: FileText,
    match: () => false
  }
];

function currentPathname(pathname?: string) {
  if (pathname) {
    return pathname;
  }

  if (typeof window !== "undefined") {
    return window.location.pathname;
  }

  return "/portal/buitendienst";
}

export default function FieldNavigation({ session, pathname }: FieldNavigationProps) {
  const path = currentPathname(pathname);

  return (
    <header className="field-nav-shell">
      <div className="field-nav-inner">
        <a className="field-brand" href="/portal/buitendienst" aria-label="Buitendienst start">
          <span>Henke Wonen</span>
          <strong>Buitendienst</strong>
        </a>

        <nav className="field-nav-list" aria-label="Buitendienst navigatie">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(path);

            return (
              <a
                key={item.href}
                href={item.href}
                className={isActive ? "field-nav-link active" : "field-nav-link"}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="field-nav-actions">
          <span className="field-session-name">{session.name ?? session.email}</span>
          <a className="field-full-link" href="/portal?full=1">
            <LayoutDashboard size={17} aria-hidden="true" />
            <span>Volledige werkplek</span>
          </a>
        </div>
      </div>
    </header>
  );
}
