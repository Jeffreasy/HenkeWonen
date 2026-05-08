import { Ruler } from "lucide-react";
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

  return (
    <header className="portal-topbar">
      <div className="portal-topbar-context">
        <span>{activeGroup?.label ?? "Winkel"}</span>
        <strong>{activeItem?.label ?? "Start"}</strong>
      </div>
      <div className="portal-topbar-actions">
        <a className="portal-topbar-link" href="/portal/buitendienst">
          <Ruler size={16} aria-hidden="true" />
          <span>Buitendienst</span>
        </a>
        <div className="portal-topbar-session">
          <strong>{session.name ?? session.email}</strong>
          <span>{roleLabel(session.role)}</span>
        </div>
        <LogoutButton className="logout-button-topbar" />
      </div>
    </header>
  );
}
