import type { AppSession } from "../../lib/auth/session";
import { LogoutButton } from "./LogoutButton";
import { roleLabel } from "./portalNavigation";
import { ThemeToggle } from "../ui/ThemeToggle";

type SidebarSessionCardProps = {
  session: AppSession;
};

export function SidebarSessionCard({ session }: SidebarSessionCardProps) {
  return (
    <div className="session-card">
      <p>{session.name ?? session.email}</p>
      <p className="role">{roleLabel(session.role)}</p>
      <div className="session-card-actions">
        <ThemeToggle />
        <LogoutButton className="logout-button-sidebar session-card-logout" />
      </div>
    </div>
  );
}
