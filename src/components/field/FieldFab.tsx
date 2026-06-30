import {
  MapPin,
  Navigation,
  Plus,
  Ruler,
  FileText,
  UserPlus,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navigate } from "astro:transitions/client";
import { canEditDossiers, type AppSession } from "../../lib/auth/session";

type FieldFabProps = {
  session: AppSession;
  pathname?: string;
};

/**
 * Bepaal of we op een projectpagina zitten (/portal/buitendienst/projecten/{id})
 * zodat we contextgevoelige acties kunnen tonen.
 */
function isProjectPath(pathname: string) {
  return pathname.startsWith("/portal/buitendienst/projecten/");
}

/**
 * Haal het adres op via het `data-field-address` attribuut dat de
 * FieldProjectWorkspace op de root-div plaatst (optioneel). Zo kunnen we
 * de Route-actie tonen zonder extra state-lifting.
 */
function resolveFieldAddress(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-field-address]");
  return el?.dataset.fieldAddress ?? null;
}

export function FieldFab({ session, pathname }: FieldFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const canCreate = canEditDossiers(session.role);
  const path =
    pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "/portal/buitendienst");
  const onProject = isProjectPath(path);

  // Probeer adres op te halen na mount (alleen op projectscherm)
  useEffect(() => {
    if (onProject) {
      const found = resolveFieldAddress();
      setAddress(found);
    }
  }, [onProject, path]);

  // Sluit bij klik buiten
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isOpen]);

  // Sluit bij Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Guard NA hooks
  if (!canCreate) return null;

  function handleAction(href: string) {
    setIsOpen(false);
    void navigate(href);
  }

  function handleToggle() {
    setIsOpen((v) => !v);
  }

  // Google Maps URL helper
  function mapsUrl(addr: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  }

  return (
    <div ref={containerRef} className="field-fab-container">
      {/* Transparante backdrop */}
      {isOpen && (
        <div
          className="quick-action-fab-backdrop"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Actiemenu */}
      <div
        className={isOpen ? "quick-action-menu quick-action-menu--open" : "quick-action-menu"}
        role="menu"
        aria-label="Buitendienst snelle acties"
        aria-hidden={!isOpen}
      >
        {onProject ? (
          /* ── PROJECTSCHERM: navigate to sections ── */
          <>
            {/* Naar Inmeten */}
            <a
              id="field-fab-action-measure"
              className="quick-action-item"
              role="menuitem"
              tabIndex={isOpen ? 0 : -1}
              href="#inmeten"
              onClick={() => setIsOpen(false)}
            >
              <span className="quick-action-item-icon quick-action-item-icon--measure" aria-hidden="true">
                <Ruler size={18} />
              </span>
              <span className="quick-action-item-text">
                <strong>Inmeten</strong>
                <span>Ruimtes en meetregels vastleggen</span>
              </span>
            </a>

            {/* Naar Conceptofferte */}
            <a
              id="field-fab-action-quote"
              className="quick-action-item"
              role="menuitem"
              tabIndex={isOpen ? 0 : -1}
              href="#conceptofferte"
              onClick={() => setIsOpen(false)}
            >
              <span className="quick-action-item-icon quick-action-item-icon--project" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span className="quick-action-item-text">
                <strong>Conceptofferte</strong>
                <span>Meetregels omzetten naar klantversie</span>
              </span>
            </a>

            {/* Route openen — alleen als adres beschikbaar */}
            {address ? (
              <a
                id="field-fab-action-route"
                className="quick-action-item"
                role="menuitem"
                tabIndex={isOpen ? 0 : -1}
                href={mapsUrl(address)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsOpen(false)}
              >
                <span className="quick-action-item-icon quick-action-item-icon--route" aria-hidden="true">
                  <Navigation size={18} />
                </span>
                <span className="quick-action-item-text">
                  <strong>Route openen</strong>
                  <span>
                    <MapPin size={12} style={{ display: "inline", verticalAlign: "middle" }} aria-hidden="true" />{" "}
                    {address}
                  </span>
                </span>
              </a>
            ) : null}
          </>
        ) : (
          /* ── LIJSTSCHERM: nieuwe klant/lead ── */
          <button
            id="field-fab-action-new-lead"
            type="button"
            role="menuitem"
            className="quick-action-item"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => handleAction("/portal/buitendienst/vandaag?open=nieuw")}
          >
            <span className="quick-action-item-icon quick-action-item-icon--customer" aria-hidden="true">
              <UserPlus size={18} />
            </span>
            <span className="quick-action-item-text">
              <strong>Nieuwe klant / lead</strong>
              <span>Klantdossier aanmaken bij bezoek</span>
            </span>
          </button>
        )}
      </div>

      {/* Trigger */}
      <button
        ref={triggerRef}
        id="field-fab-trigger"
        type="button"
        className={
          isOpen
            ? "quick-action-fab quick-action-fab--open"
            : "quick-action-fab"
        }
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isOpen ? "Buitendienst acties sluiten" : "Snelle buitendienst actie"}
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
