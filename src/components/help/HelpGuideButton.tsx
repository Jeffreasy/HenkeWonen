import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { HelpGuideModal, type HelpGuideMode } from "./HelpGuideModal";

type HelpGuideButtonProps = {
  mode: HelpGuideMode;
  /** Stijlklasse van de trigger; volgt de knopstijl van de omringende topbar. */
  className: string;
  /** Huidige pad voor het route-bewuste standaard-onderwerp (buitendienst negeert dit). */
  pathname?: string;
  /**
   * id van de gekoppelde dialoog. Moet uniek zijn per pagina: de desktop-topbar
   * en de mobiele bar renderen elk een eigen instantie (CSS toont er telkens
   * één), dus twee triggers met dezelfde id zouden een dubbele dialog-id geven.
   */
  dialogId?: string;
};

/** [?]-knop in de topbar die de compacte werkgids opent. */
export function HelpGuideButton({
  mode,
  className,
  pathname = "/portal",
  dialogId = "help-guide-dialog"
}: HelpGuideButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${className} help-guide-trigger`}
        title="Uitleg en hulp"
        aria-label="Uitleg en hulp"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen(true)}
      >
        <HelpCircle size={16} aria-hidden="true" />
        <span>Uitleg</span>
      </button>
      <HelpGuideModal
        mode={mode}
        open={open}
        pathname={pathname}
        id={dialogId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
