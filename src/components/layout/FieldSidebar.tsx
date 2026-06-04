import { X, type LucideIcon } from "lucide-react";
import type { AppSession } from "../../lib/auth/session";
import { classNames } from "../ui/classNames";
import { LogoutButton } from "./LogoutButton";

export type FieldNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  active: boolean;
  quickbar?: boolean;
};

export type FieldNavGroup = {
  id: string;
  label: string;
  items: FieldNavItem[];
};

type FieldSidebarProps = {
  groups: FieldNavGroup[];
  session: AppSession;
  isMenuOpen: boolean;
  onCloseMenu: () => void;
  roleLabel: string;
  fieldHomePath: string;
};

export function FieldSidebar({
  groups,
  session,
  isMenuOpen,
  onCloseMenu,
  roleLabel,
  fieldHomePath
}: FieldSidebarProps) {
  return (
    <>
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
          <button aria-label="Menu sluiten" className="field-sidebar-close" type="button" onClick={onCloseMenu}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

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
                      onClick={onCloseMenu}
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

        <div className="field-sidebar-session">
          <p>{session.name ?? session.email}</p>
          <p>{roleLabel}</p>
          <LogoutButton className="logout-button-field-sidebar" />
        </div>
      </aside>

      {isMenuOpen ? (
        <button
          aria-hidden="true"
          className="field-mobile-overlay"
          tabIndex={-1}
          type="button"
          onClick={onCloseMenu}
        />
      ) : null}
    </>
  );
}
