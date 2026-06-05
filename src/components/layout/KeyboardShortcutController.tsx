import { useState } from "react";
import { useKeyboardShortcuts, useSequenceShortcuts } from "../../lib/useKeyboardShortcuts";
import { ShortcutHelpModal } from "../ui/overlays/ShortcutHelpModal";

/**
 * Central keyboard shortcut controller — mounted once in PortalLayout.
 * Handles all global and page-contextual shortcuts.
 */
export function KeyboardShortcutController() {
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Simple global shortcuts ────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: "?",
      description: "Toetscombinaties tonen",
      handler: () => setHelpOpen((prev) => !prev)
    },
    {
      key: "Escape",
      description: "Sluiten",
      handler: () => {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        // Trigger close on open modals / confirm dialogs
        const closeBtn = document.querySelector<HTMLElement>(
          "[data-modal-close], .shortcut-help-overlay"
        );
        closeBtn?.click();
      }
    },
    {
      key: "k",
      ctrl: true,
      description: "Zoekbalk focussen",
      handler: () => {
        const searchBar = document.querySelector<HTMLElement>("[data-searchbar]");
        searchBar?.focus();
      }
    },
    {
      key: "n",
      description: "Nieuw item aanmaken",
      handler: () => {
        // Find the first visible "new item" button on the current page
        const newBtn = document.querySelector<HTMLElement>("[data-shortcut^='new-']");
        newBtn?.click();
      }
    },
    {
      key: "s",
      ctrl: true,
      description: "Formulier opslaan",
      handler: () => {
        // Submit the currently active form
        const activeForm = document.querySelector<HTMLFormElement>(
          "form[data-active-form], .panel form"
        );
        if (activeForm) {
          activeForm.requestSubmit();
        }
      }
    },
    {
      key: "Enter",
      ctrl: true,
      description: "Dialoog bevestigen",
      handler: () => {
        const confirmBtn = document.querySelector<HTMLElement>(
          "[data-confirm-primary]"
        );
        confirmBtn?.click();
      }
    }
  ]);

  // ── Sequence shortcuts: G → letter ────────────────────────────────────────
  useSequenceShortcuts("g", [
    {
      key: "k",
      description: "Naar Klanten",
      handler: () => { window.location.href = "/portal/klanten"; }
    },
    {
      key: "p",
      description: "Naar Projecten",
      handler: () => { window.location.href = "/portal/projecten"; }
    },
    {
      key: "o",
      description: "Naar Offertes",
      handler: () => { window.location.href = "/portal/offertes"; }
    },
    {
      key: "f",
      description: "Naar Facturen",
      handler: () => { window.location.href = "/portal/facturen"; }
    },
    {
      key: "l",
      description: "Naar Leveranciers",
      handler: () => { window.location.href = "/portal/leveranciers"; }
    },
    {
      key: "i",
      description: "Naar Imports",
      handler: () => { window.location.href = "/portal/imports"; }
    },
    {
      key: "s",
      description: "Naar Instellingen",
      handler: () => { window.location.href = "/portal/instellingen"; }
    }
  ]);

  return <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
