/**
 * Toast notification system.
 *
 * Architecture: DOM CustomEvent bridge.
 * `showToast()` dispatches a `portal:toast` event on `window`.
 * `ToastContainer` (mounted once in PortalLayout.astro) listens and renders.
 * This works across all React islands on the page without shared React state.
 */

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
