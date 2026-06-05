import { useEffect, useRef } from "react";
import { type ActiveShortcut, isTypingTarget, matchesShortcut } from "./keyboard";

type UseKeyboardShortcutsOptions = {
  /** When true, shortcuts are ignored when focus is inside a text input. Default: true */
  ignoreInputs?: boolean;
  /** When false, the hook will not register any listeners. Useful for conditional enabling. */
  enabled?: boolean;
};

/**
 * Registers a list of keyboard shortcuts on the window.
 * Automatically cleans up on unmount.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "?", description: "Help openen", handler: () => setHelpOpen(true) },
 *   { key: "k", ctrl: true, description: "Zoeken", handler: () => searchRef.current?.focus() },
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: ActiveShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { ignoreInputs = true, enabled = true } = options;
  // Keep shortcuts in a ref so the effect doesn't re-run on every render
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (ignoreInputs && isTypingTarget(event)) return;

      for (const shortcut of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, ignoreInputs]);
}

/**
 * Registers a "sequence" shortcut: press a trigger key, then within `windowMs`
 * press a follow-up key to fire the handler.
 *
 * Example: G → K (navigate to customers, GitHub-style)
 */
export function useSequenceShortcuts(
  triggerKey: string,
  sequences: Array<{ key: string; handler: () => void; description: string }>,
  windowMs = 600
) {
  const waitingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event)) return;

      const key = event.key.toLowerCase();

      if (!waitingRef.current) {
        if (key === triggerKey.toLowerCase()) {
          event.preventDefault();
          waitingRef.current = true;
          timerRef.current = setTimeout(() => {
            waitingRef.current = false;
          }, windowMs);
        }
        return;
      }

      // We are in the sequence window
      clearTimeout(timerRef.current ?? undefined);
      waitingRef.current = false;

      for (const seq of sequences) {
        if (key === seq.key.toLowerCase()) {
          event.preventDefault();
          seq.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [triggerKey, sequences, windowMs]);
}
