import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode
} from "react";

export type FormModalSize = "sm" | "md" | "lg" | "xl";

type FormModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: FormModalSize;
  children: ReactNode;
  onClose: () => void;
};

export function FormModal({
  open,
  title,
  description,
  size = "md",
  children,
  onClose
}: FormModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key + focus trap
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          [
            "a[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])"
          ].join(", ")
        ) ?? []
      ).filter((el) => !el.hasAttribute("hidden"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Body scroll lock + initial focus
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="form-modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      aria-hidden="false"
    >
      <div
        className={`form-modal form-modal--${size}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="form-modal-header">
          <div className="form-modal-header-text">
            <h2 id={titleId} className="form-modal-title">
              {title}
            </h2>
            {description ? (
              <p className="form-modal-description">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            className="form-modal-close"
            aria-label="Sluiten"
            onClick={onClose}
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="form-modal-body">{children}</div>
      </div>
    </div>
  );
}
