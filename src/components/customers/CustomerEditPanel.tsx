import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Textarea } from "../ui/Textarea";

export type CustomerDraft = {
  displayName: string;
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  notes: string;
};

type CustomerEditPanelProps = {
  initialDraft: CustomerDraft;
  onSave: (draft: CustomerDraft) => Promise<void> | void;
  onCancel: () => void;
  formRef: React.RefObject<HTMLFormElement | null>;
};

export function CustomerEditPanel({
  initialDraft,
  onSave,
  onCancel,
  formRef
}: CustomerEditPanelProps) {
  const [draft, setDraft] = useState<CustomerDraft>(initialDraft);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.displayName.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel edit-work-panel">
      <SectionHeader
        compact
        title="Klantgegevens aanpassen"
        description="Wijzig contactgegevens en notities voor dit klantdossier."
      />
      <form className="form-grid" onSubmit={handleSubmit} ref={formRef}>
        <div className="grid two-column-even">
          <Field htmlFor="edit-customer-name" label="Naam" required>
            <Input
              id="edit-customer-name"
              value={draft.displayName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, displayName: event.target.value }))
              }
              required
            />
          </Field>
          <Field htmlFor="edit-customer-phone" label="Telefoon">
            <Input
              id="edit-customer-phone"
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid two-column-even">
          <Field htmlFor="edit-customer-email" label="E-mail">
            <Input
              id="edit-customer-email"
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({ ...current, email: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="edit-customer-city" label="Plaats">
            <Input
              id="edit-customer-city"
              value={draft.city}
              onChange={(event) =>
                setDraft((current) => ({ ...current, city: event.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid three-column">
          <Field htmlFor="edit-customer-street" label="Straat">
            <Input
              id="edit-customer-street"
              value={draft.street}
              onChange={(event) =>
                setDraft((current) => ({ ...current, street: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="edit-customer-house-number" label="Huisnummer">
            <Input
              id="edit-customer-house-number"
              value={draft.houseNumber}
              onChange={(event) =>
                setDraft((current) => ({ ...current, houseNumber: event.target.value }))
              }
            />
          </Field>
          <Field htmlFor="edit-customer-postal-code" label="Postcode">
            <Input
              id="edit-customer-postal-code"
              value={draft.postalCode}
              onChange={(event) =>
                setDraft((current) => ({ ...current, postalCode: event.target.value }))
              }
            />
          </Field>
        </div>
        <Field htmlFor="edit-customer-notes" label="Notities">
          <Textarea
            id="edit-customer-notes"
            rows={4}
            value={draft.notes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </Field>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            {isSaving ? "Opslaan..." : "Klantgegevens opslaan"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </section>
  );
}
