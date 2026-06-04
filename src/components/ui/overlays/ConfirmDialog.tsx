import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { Alert } from "../feedback/Alert";
import { Button } from "../forms/Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Annuleren",
  tone = "warning",
  isBusy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isBusy) {
          onCancel();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          [
            "a[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])"
          ].join(", ")
        ) ?? []
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
        return;
      }

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
  }, [isBusy, onCancel, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = "hidden";
    window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedElement?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function cancelFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isBusy) {
      onCancel();
    }
  }

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={cancelFromBackdrop}>
      <div
        className="confirm-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <Alert
          variant={tone}
          title={<span id={titleId}>{title}</span>}
          description={<span id={descriptionId}>{description}</span>}
        />
        {children ? <div className="confirm-dialog-body">{children}</div> : null}
        <div className="confirm-dialog-actions">
          <Button ref={cancelButtonRef} variant="secondary" disabled={isBusy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            isLoading={isBusy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
