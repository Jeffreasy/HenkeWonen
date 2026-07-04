import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { HelpGuideModal, type HelpGuideMode } from "./HelpGuideModal";

type HelpGuideButtonProps = {
  mode: HelpGuideMode;
  /** Stijlklasse van de trigger; volgt de knopstijl van de omringende topbar. */
  className: string;
  /** Huidige pad voor het route-bewuste standaard-onderwerp (buitendienst negeert dit). */
  pathname?: string;
};

/** [?]-knop in de topbar die de compacte werkgids opent. */
export function HelpGuideButton({ mode, className, pathname = "/portal" }: HelpGuideButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${className} help-guide-trigger`}
        title="Uitleg en hulp"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="help-guide-dialog"
        onClick={() => setOpen(true)}
      >
        <HelpCircle size={16} aria-hidden="true" />
        <span>Uitleg</span>
      </button>
      <HelpGuideModal
        mode={mode}
        open={open}
        pathname={pathname}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
