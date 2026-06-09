import { canEditDossiers, type AppSession } from "../../lib/auth/session";
import { FolderOpen, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type QuickActionFabProps = {
  session: AppSession;
};

export function QuickActionFab({ session }: QuickActionFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Viewer-rollen kunnen geen klanten/projecten aanmaken
  const canCreate = canEditDossiers(session.role);

  // Sluit bij klik buiten het menu
  useEffect(() => {
    if (!isOpen || !canCreate) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Gebruik capture: true zodat clicks op backdrop als eerste worden afgevangen
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isOpen, canCreate]);

  // Sluit bij Escape — focus terug naar trigger
  useEffect(() => {
    if (!isOpen || !canCreate) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canCreate]);

  // Guard NA hooks — React Rules of Hooks vereisen dat alle hooks altijd worden aangeroepen
  if (!canCreate) return null;

  function handleAction(href: string) {
    setIsOpen(false);
    window.location.href = href;
  }

  function handleToggle() {
    setIsOpen((v) => !v);
  }

  return (
    <div ref={containerRef} className="quick-action-fab-container">
      {/* Transparante full-screen backdrop — sluit menu bij klik erbuiten */}
      {isOpen && (
        <div
          className="quick-action-fab-backdrop"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Actiemenu — alleen in DOM en zichtbaar voor AT als open */}
      <div
        className={isOpen ? "quick-action-menu quick-action-menu--open" : "quick-action-menu"}
        role="menu"
        aria-label="Snelle acties"
        aria-hidden={!isOpen}
      >
        {/* Actie 1: Klant vastleggen */}
        <button
          id="quick-action-new-customer"
          type="button"
          role="menuitem"
          className="quick-action-item"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => handleAction("/portal/klanten?open=nieuw")}
        >
          <span className="quick-action-item-icon quick-action-item-icon--customer" aria-hidden="true">
            <UserPlus size={18} />
          </span>
          <span className="quick-action-item-text">
            <strong>Nieuwe aanvraag</strong>
            <span>Klant vastleggen</span>
          </span>
        </button>

        {/* Actie 2: Project aanmaken */}
        <button
          id="quick-action-new-project"
          type="button"
          role="menuitem"
          className="quick-action-item"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => handleAction("/portal/projecten?open=nieuw")}
        >
          <span className="quick-action-item-icon quick-action-item-icon--project" aria-hidden="true">
            <FolderOpen size={18} />
          </span>
          <span className="quick-action-item-text">
            <strong>Werk starten</strong>
            <span>Project aanmaken</span>
          </span>
        </button>
      </div>

      {/* Trigger-knop */}
      <button
        ref={triggerRef}
        id="quick-action-fab-trigger"
        type="button"
        className={isOpen ? "quick-action-fab quick-action-fab--open" : "quick-action-fab"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isOpen ? "Snelle acties sluiten" : "Snelle actie starten"}
        onClick={handleToggle}
      >
        <span className="quick-action-fab-icon" aria-hidden="true">
          {isOpen ? <X size={22} /> : <Plus size={22} />}
        </span>
        <span className="quick-action-fab-label">{isOpen ? "Sluiten" : "Actie"}</span>
      </button>
    </div>
  );
}
