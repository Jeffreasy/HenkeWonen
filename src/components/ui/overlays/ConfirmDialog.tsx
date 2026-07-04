import { useId, type ReactNode } from "react";
import { Alert } from "../feedback/Alert";
import { Button } from "../forms/Button";
import { BaseDialog } from "./BaseDialog";

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

/**
 * Bevestigingsdialoog op de gedeelde BaseDialog (native <dialog> in de
 * top-layer): focus-trap, Escape en backdrop-sluiten komen daarvandaan;
 * zolang isBusy aanstaat blokkeert closeDisabled het wegsluiten. De browser
 * focust bij openen het eerste focusbare element — de annuleerknop.
 */
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

  return (
    <BaseDialog
      open={open}
      onClose={onCancel}
      ariaLabelledBy={titleId}
      ariaDescribedBy={descriptionId}
      closeDisabled={isBusy}
      className="confirm-dialog-host"
    >
      <div className="confirm-dialog">
        <Alert
          variant={tone}
          title={<span id={titleId}>{title}</span>}
          description={<span id={descriptionId}>{description}</span>}
        />
        {children ? <div className="confirm-dialog-body">{children}</div> : null}
        <div className="confirm-dialog-actions">
          <Button variant="secondary" disabled={isBusy} onClick={onCancel}>
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
    </BaseDialog>
  );
}
