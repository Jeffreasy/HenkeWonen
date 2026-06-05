/**
 * Keyboard shortcut type definitions and utilities.
 * No external library required — pure browser keyboard events.
 */

export type ShortcutScope = "global" | string;

export type Shortcut = {
  /** Key name, case-insensitive. E.g. "k", "n", "?", "Escape" */
  key: string;
  /** Requires Ctrl (Windows) or Cmd (Mac) */
  ctrl?: boolean;
  /** Requires Shift */
  shift?: boolean;
  /** Human-readable description shown in the help overlay */
  description: string;
  /** Optional route prefix to scope the shortcut. If omitted: global. */
  scope?: ShortcutScope;
  /** Optional display label override (e.g. "⌘K" vs "Ctrl+K") */
  displayKeys?: string[];
};

export type ActiveShortcut = Shortcut & {
  handler: () => void;
};

/**
 * Returns true if a KeyboardEvent matches the given shortcut definition.
 * Handles Ctrl/Cmd cross-platform.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const ctrlOrCmd = event.ctrlKey || event.metaKey;
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = shortcut.ctrl ? ctrlOrCmd : !ctrlOrCmd;
  const shiftMatch = shortcut.shift ? event.shiftKey : true;

  return keyMatch && ctrlMatch && shiftMatch;
}

/**
 * Returns true if the event target is a focusable text input.
 * Used to skip shortcut handling when user is typing.
 */
export function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

/**
 * Formats shortcut keys for display (cross-platform).
 * Returns array of key labels, e.g. ["Ctrl", "K"] or ["⌘", "K"].
 */
export function formatShortcutKeys(shortcut: Shortcut): string[] {
  if (shortcut.displayKeys) return shortcut.displayKeys;
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const keys: string[] = [];
  if (shortcut.ctrl) keys.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.shift) keys.push(isMac ? "⇧" : "Shift");
  keys.push(shortcut.key === " " ? "Space" : shortcut.key.toUpperCase());
  return keys;
}
