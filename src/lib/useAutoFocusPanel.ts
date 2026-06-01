import { useEffect, type RefObject } from "react";

const focusableSelector = [
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]"
].join(", ");

export function useAutoFocusPanel<T extends HTMLElement>(
  active: boolean,
  panelRef: RefObject<T | null>
) {
  useEffect(() => {
    if (!active) {
      return;
    }

    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      const focusTarget = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      focusTarget?.focus({ preventScroll: true });
    }, 120);
  }, [active, panelRef]);
}
