import { useState, useRef, useEffect } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import type { AppSession } from "../../lib/auth/session";
import { LogoutButton } from "./LogoutButton";
import {
  activePortalNavGroup,
  activePortalNavItem,
  getCurrentPathname,
  roleLabel,
  visiblePortalNavGroups
} from "./portalNavigation";

type PortalTopbarProps = {
  session: AppSession;
  pathname?: string;
};

export default function PortalTopbar({ session, pathname }: PortalTopbarProps) {
  const currentPathname = getCurrentPathname(pathname);
  const groups = visiblePortalNavGroups(session);
  const activeItem = activePortalNavItem(currentPathname, groups);
  const activeGroup = activePortalNavGroup(currentPathname, groups);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userNameOrEmail = session.name ?? session.email ?? "Gebruiker";
  const userInitial = userNameOrEmail.substring(0, 1).toUpperCase();

  return (
    <header className="portal-topbar">
      <div className="portal-topbar-context">
        <div className="portal-topbar-breadcrumb">
          <span className="breadcrumb-group">{activeGroup?.label ?? "Winkel"}</span>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <strong className="breadcrumb-item">{activeItem?.label ?? "Start"}</strong>
        </div>
      </div>

      <div className="portal-topbar-actions">
        <a className="portal-topbar-link" href="/portal/buitendienst/vandaag">
          <Ruler size={16} aria-hidden="true" />
          <span>Buitendienst</span>
        </a>

        <div className="portal-topbar-user-menu" ref={dropdownRef}>
          <button
            className={`portal-topbar-user-trigger ${dropdownOpen ? "active" : ""}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            type="button"
          >
            <div className="portal-topbar-avatar">{userInitial}</div>
            <span className="portal-topbar-username">{userNameOrEmail}</span>
            <ChevronDown size={14} className={`chevron-icon ${dropdownOpen ? "rotate" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="portal-topbar-dropdown">
              <div className="dropdown-user-header">
                {session.name && <p className="user-name">{session.name}</p>}
                <p className="user-email">{session.email}</p>
                <div className="user-role-container">
                  <span className="user-role-badge">{roleLabel(session.role)}</span>
                </div>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-actions">
                <LogoutButton className="logout-button-dropdown" label="Uitloggen" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
