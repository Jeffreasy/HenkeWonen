import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { BaseDialog } from "./BaseDialog";

export type FormModalSize = "sm" | "md" | "lg" | "xl";

type FormModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: FormModalSize;
  children: ReactNode;
  onClose: () => void;
};

/**
 * Formulier-modal op de gedeelde BaseDialog (native <dialog> in de top-layer):
 * focus-trap, Escape, backdrop-sluiten en scroll-lock komen daarvandaan.
 * De browser focust bij openen het eerste focusbare element (de sluitknop) en
 * zet de focus bij sluiten terug op het eerder actieve element.
 */
export function FormModal({
  open,
  title,
  description,
  size = "md",
  children,
  onClose
}: FormModalProps) {
  const titleId = useId();

  return (
    <BaseDialog open={open} onClose={onClose} ariaLabelledBy={titleId} className="form-modal-host">
      <div className={`form-modal form-modal--${size}`}>
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
    </BaseDialog>
  );
}
