import { X } from "lucide-react";
import { formatShortcutKeys, type Shortcut } from "../../../lib/keyboard";
import { BaseDialog } from "./BaseDialog";
import { IconButton } from "../forms/IconButton";

type ShortcutGroup = {
  title: string;
  shortcuts: Shortcut[];
};

type ShortcutHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigatie",
    shortcuts: [
      { key: "k", displayKeys: ["G", "→", "K"], description: "Naar Klanten" },
      { key: "p", displayKeys: ["G", "→", "P"], description: "Naar Projecten" },
      { key: "o", displayKeys: ["G", "→", "O"], description: "Naar Offertes" },
      { key: "f", displayKeys: ["G", "→", "F"], description: "Naar Facturen" },
      { key: "l", displayKeys: ["G", "→", "L"], description: "Naar Leveranciers" },
      { key: "i", displayKeys: ["G", "→", "I"], description: "Naar Imports" },
      { key: "s", displayKeys: ["G", "→", "S"], description: "Naar Instellingen" }
    ]
  },
  {
    title: "Acties",
    shortcuts: [
      { key: "n", description: "Nieuw item aanmaken (op huidige pagina)" },
      { key: "k", ctrl: true, description: "Zoekbalk focussen" },
      { key: "s", ctrl: true, description: "Formulier opslaan" },
      { key: "Enter", ctrl: true, description: "Dialoog bevestigen" }
    ]
  },
  {
    title: "Algemeen",
    shortcuts: [
      { key: "?", description: "Dit scherm tonen" },
      { key: "Escape", description: "Sluiten / annuleren" }
    ]
  }
];

function KbdKey({ label }: { label: string }) {
  if (label === "→") {
    return <span className="shortcut-keys-sep">→</span>;
  }
  return <kbd className="kbd">{label}</kbd>;
}

export function ShortcutHelpModal({ open, onClose }: ShortcutHelpModalProps) {
  return (
    <BaseDialog open={open} onClose={onClose} ariaLabel="Toetscombinaties">
      <div className="shortcut-help-modal">
        <div className="shortcut-help-header">
          <h2>Toetscombinaties</h2>
          <IconButton aria-label="Sluiten" variant="ghost" size="sm" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="shortcut-help-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div className="shortcut-group" key={group.title}>
              <p className="shortcut-group-title">{group.title}</p>
              {group.shortcuts.map((shortcut) => {
                const keys = formatShortcutKeys(shortcut);
                return (
                  <div className="shortcut-row" key={`${shortcut.key}-${shortcut.ctrl}`}>
                    <span className="shortcut-description">{shortcut.description}</span>
                    <span className="shortcut-keys" aria-label={keys.join(" + ")}>
                      {keys.map((k, idx) => (
                        <KbdKey key={idx} label={k} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="shortcut-help-footer">
          <p>Druk op <kbd className="kbd">?</kbd> om dit scherm te openen of sluiten.</p>
        </div>
      </div>
    </BaseDialog>
  );
}
