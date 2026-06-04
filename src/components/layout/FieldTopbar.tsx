import { LayoutDashboard } from "lucide-react";
import type { AppSession } from "../../lib/auth/session";
import { LogoutButton } from "./LogoutButton";

type FieldTopbarProps = {
  activeTitle: string;
  session: AppSession;
  roleLabel: string;
};

export function FieldTopbar({ activeTitle, session, roleLabel }: FieldTopbarProps) {
  return (
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
          <span>{roleLabel}</span>
        </div>
        <LogoutButton className="logout-button-field-topbar" />
      </div>
    </header>
  );
}
