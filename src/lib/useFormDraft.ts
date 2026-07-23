import { useEffect, useRef } from "react";

/**
 * Spiegelt vluchtige formulier-state naar localStorage en zet die bij mount terug.
 *
 * Voor de buitendienst op mobiel: de browser gooit achtergrond-tabs agressief weg
 * (even naar de camera-app wisselen bij de klant is genoeg), waardoor alle nog niet
 * opgeslagen invoer — React-state — verloren ging en de monteur opnieuw moest meten
 * en typen waar de klant bij stond.
 *
 * `values` wordt bij elke wijziging weggeschreven; `restore` draait één keer bij
 * mount met het opgeslagen concept (indien aanwezig en niet ouder dan de TTL) en is
 * zelf verantwoordelijk voor het valideren/terugzetten van de velden. Roep `clear()`
 * aan zodra de invoer succesvol is opgeslagen.
 */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type DraftEnvelope = { t: number; d: unknown };

export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  values: T,
  restore: (draft: Partial<T>) => void
): { clear: () => void } {
  const hasRestored = useRef(false);
  const skipNextWrite = useRef(false);
  const serialized = JSON.stringify({ t: Date.now(), d: values } satisfies DraftEnvelope);

  useEffect(() => {
    if (hasRestored.current) {
      return;
    }
    hasRestored.current = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return;
      }
      const envelope = JSON.parse(raw) as DraftEnvelope;
      if (
        !envelope ||
        typeof envelope.t !== "number" ||
        Date.now() - envelope.t > DRAFT_TTL_MS ||
        !envelope.d ||
        typeof envelope.d !== "object"
      ) {
        window.localStorage.removeItem(key);
        return;
      }
      restore(envelope.d as Partial<T>);
    } catch {
      // Storage niet beschikbaar of corrupt concept: stil negeren, het formulier
      // start dan gewoon leeg.
    }
    // Restore is bewust eenmalig bij mount; latere wijzigingen lopen via de spiegel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hasRestored.current) {
      return;
    }
    // Na een succesvolle submit veranderen formulieren vaak direct hun state.
    // Zonder dit vangnet zou die reset-render het zojuist gewiste concept meteen
    // opnieuw opslaan. De eerstvolgende echte gebruikerswijziging wordt weer normaal
    // bewaard.
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      // Storage vol of geblokkeerd: dan geen vangnet, maar ook geen crash.
    }
  }, [key, serialized]);

  return {
    clear: () => {
      skipNextWrite.current = true;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // idem: stil negeren
      }
    }
  };
}
