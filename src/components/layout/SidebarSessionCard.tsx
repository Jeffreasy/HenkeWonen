import type { AppSession } from "../../lib/auth/session";
import { LogoutButton } from "./LogoutButton";
import { roleLabel } from "./portalNavigation";

type SidebarSessionCardProps = {
  session: AppSession;
};

export function SidebarSessionCard({ session }: SidebarSessionCardProps) {
  return (
    <div className="session-card">
      <p>{session.name ?? session.email}</p>
      <p className="role">{roleLabel(session.role)}</p>
      <LogoutButton className="logout-button-sidebar" />
    </div>
  );
}
