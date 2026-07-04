import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { HelpGuideModal, type HelpGuideMode } from "./HelpGuideModal";

type HelpGuideButtonProps = {
  mode: HelpGuideMode;
  /** Stijlklasse van de trigger; volgt de knopstijl van de omringende topbar. */
  className: string;
  pathname?: string;
};

function currentPathname(pathname?: string): string {
  if (pathname) {
    return pathname;
  }
  if (typeof window !== "undefined") {
    return window.location.pathname;
  }
  return "/portal";
}

/** [?]-knop in de topbar die de compacte werkgids opent. */
export function HelpGuideButton({ mode, className, pathname }: HelpGuideButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "help-guide-dialog" : undefined}
        onClick={() => setOpen(true)}
      >
        <HelpCircle size={16} aria-hidden="true" />
        <span>Uitleg</span>
      </button>
      <HelpGuideModal
        mode={mode}
        open={open}
        pathname={currentPathname(pathname)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
