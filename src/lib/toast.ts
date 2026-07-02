/**
 * Toast notification system.
 *
 * Architecture: DOM CustomEvent bridge.
 * `showToast()` dispatches a `portal:toast` event on `window`.
 * `ToastContainer` (mounted once in PortalLayout.astro) listens and renders.
 * This works across all React islands on the page without shared React state.
 */

import { ConvexError } from "convex/values";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  /** Auto-dismiss after ms. Defaults: success/info = 4000, warning = 5000, error = 7000 */
  duration?: number;
}

const DEFAULT_DURATIONS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 7000
};

/**
 * Show a toast notification from anywhere in the app — including inside React islands.
 *
 * @example
 * showToast({ title: "Klant aangemaakt", tone: "success" });
 * showToast({ title: "Opslaan mislukt", description: err.message, tone: "error" });
 */
export function showToast(options: Omit<ToastMessage, "id">) {
  const message: ToastMessage = {
    ...options,
    id: crypto.randomUUID(),
    duration: options.duration ?? DEFAULT_DURATIONS[options.tone]
  };

  const event = new CustomEvent("portal:toast", { detail: message });
  window.dispatchEvent(event);
}

/** De leesbare server-reden uit een fout, als die er is (ConvexError met string-data). */
export function errorDescription(error: unknown): string | undefined {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : undefined;
}

/**
 * Fout-toast die de specifieke server-melding als omschrijving toont.
 * Logt de fout ook naar de console (vervangt losse console.error op de call-site).
 * Zonder server-melding (bv. netwerkfout) valt de omschrijving terug op
 * `fallbackDescription`, zodat de gebruiker nooit een kale titel zonder duiding ziet.
 */
export function showErrorToast(
  error: unknown,
  title: string,
  fallbackDescription = "Probeer het opnieuw."
) {
  console.error(error);
  showToast({ title, description: errorDescription(error) ?? fallbackDescription, tone: "error" });
}
