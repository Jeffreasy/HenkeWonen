import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { FormModal } from "../ui/overlays/FormModal";

type DeleteCustomerDialogProps = {
  open: boolean;
  customerName: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

/**
 * Bevestigingsdialoog voor het verwijderen/anonimiseren van een klant (AVG). Dubbele
 * bevestiging: de gebruiker moet de klantnaam exact overtypen voordat de gevaarknop
 * beschikbaar komt (de server controleert die naam nogmaals).
 */
export function DeleteCustomerDialog({
  open,
  customerName,
  isBusy = false,
  onCancel,
  onConfirm
}: DeleteCustomerDialogProps) {
  const [typedName, setTypedName] = useState("");

  // Reset het invoerveld telkens als de dialoog opent/sluit.
  useEffect(() => {
    if (!open) {
      setTypedName("");
    }
  }, [open]);

  const matches = typedName.trim() === customerName.trim();

  return (
    <FormModal
      open={open}
      title="Klant definitief verwijderen"
      description="AVG — recht op vergetelheid"
      size="md"
      onClose={isBusy ? () => {} : onCancel}
    >
      <div className="grid">
        <Alert
          variant="danger"
          title="Dit kan niet ongedaan worden gemaakt"
          description="Alle dossierstukken, foto's, contactmomenten, inmetingen, offertes en projecten van deze klant worden definitief verwijderd, inclusief de bijbehorende bestanden."
        />
        <p className="muted">
          Zijn er facturen? Die blijven wettelijk 7 jaar bewaard — de klant wordt dan
          geanonimiseerd (naam en adres blijven staan, de overige persoonsgegevens worden
          gewist) in plaats van verwijderd.
        </p>

        <Field
          htmlFor="delete-customer-confirm"
          label={`Typ ter bevestiging de klantnaam: ${customerName}`}
          required
        >
          <Input
            id="delete-customer-confirm"
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            placeholder={customerName}
            autoComplete="off"
            disabled={isBusy}
          />
        </Field>

        <div className="confirm-dialog-actions">
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Annuleren
          </Button>
          <Button
            variant="danger"
            leftIcon={<Trash2 size={16} aria-hidden="true" />}
            disabled={!matches || isBusy}
            isLoading={isBusy}
            onClick={() => void onConfirm()}
          >
            Definitief verwijderen
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
