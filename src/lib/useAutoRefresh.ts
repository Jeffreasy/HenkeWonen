import { useEffect, useRef } from "react";

/**
 * Ververst one-shot geladen data automatisch: bij terugkeer naar de tab/het venster
 * (visibilitychange/focus) en periodiek zolang de tab zichtbaar is.
 *
 * De veld-schermen laden hun data eenmalig via HTTP (geen Convex-subscription).
 * Wijzigt de winkel intussen iets — inmeting herplant, afspraak afgezegd, offerte
 * verstuurd — dan bleef het openstaande scherm van de monteur dat gewoon tonen en
 * reed hij op verouderde informatie naar de klant. Dit is het minimale vangnet:
 * geen realtime, wel altijd vers bij het oppakken van de telefoon en elke paar
 * minuten een stille verversing.
 */
const DEFAULT_INTERVAL_MS = 3 * 60 * 1000;

export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs = DEFAULT_INTERVAL_MS) {
  // Ref zodat interval/listeners niet opnieuw opgezet worden als de callback-identiteit wijzigt.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    // Iets ouder dan het interval voorkomt dubbel laden (focus + interval vlak na elkaar).
    let lastRun = Date.now();

    const run = () => {
      lastRun = Date.now();
      void refreshRef.current();
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      // Alleen verversen als de tab er even uit is geweest; een vluchtige blur/focus
      // (bv. een toetsenbord-popup op mobiel) hoeft geen reload te triggeren.
      if (Date.now() - lastRun > 10_000) {
        run();
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        run();
      }
    }, intervalMs);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs]);
}
