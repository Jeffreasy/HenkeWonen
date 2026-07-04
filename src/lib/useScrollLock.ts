import { useEffect } from "react";

/**
 * Gedeelde pagina-scroll-lock voor overlays (modals, mobiel menu).
 *
 * De lock hoort op <html>: dat is hier het scrollende element (html heeft
 * effectief overflow-y: auto doordat 01-tokens.css overflow-x: hidden zet,
 * dus body-overflow propageert níet naar de viewport). Voor de zekerheid
 * zetten we beide.
 *
 * Refcounted: meerdere gelijktijdige locks (gestapelde dialogen, menu + modal)
 * delen één lock; pas als de laatste loslaat worden de oorspronkelijke waarden
 * hersteld. Dat voorkomt zowel te vroeg ontgrendelen als het "hidden"
 * terug-restaureren wanneer overlays in een andere volgorde sluiten dan ze
 * openden.
 */

let lockCount = 0;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";

function acquireScrollLock() {
  if (lockCount === 0) {
    const html = document.documentElement;
    previousHtmlOverflow = html.style.overflow;
    previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function releaseScrollLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overflow = previousBodyOverflow;
  }
}

/** Bevries de pagina-scroll zolang `active` waar is. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    acquireScrollLock();
    return releaseScrollLock;
  }, [active]);
}
