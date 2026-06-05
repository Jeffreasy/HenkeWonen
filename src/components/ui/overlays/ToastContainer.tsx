import { CheckCircle, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { ToastMessage, ToastTone } from "../../../lib/toast";

const ICONS: Record<ToastTone, React.ReactElement> = {
  success: <CheckCircle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  error: <XCircle size={18} aria-hidden="true" />
};

type ToastItemProps = {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role="alert"
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="toast-icon">{ICONS[toast.tone]}</span>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.description ? (
          <span className="toast-description">{toast.description}</span>
        ) : null}
      </div>
      <button
        className="toast-close"
        aria-label="Melding sluiten"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * ToastContainer — mount this ONCE in PortalLayout.astro as `client:load`.
 *
 * Listens for `portal:toast` CustomEvents dispatched by `showToast()` from
 * anywhere in the app. Renders a stack of dismissable toast notifications
 * in the bottom-right corner with slide-up animations.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    function handler(event: Event) {
      const toast = (event as CustomEvent<ToastMessage>).detail;
      setToasts((current) => [...current, toast]);
    }

    window.addEventListener("portal:toast", handler);
    return () => window.removeEventListener("portal:toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Meldingen">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
