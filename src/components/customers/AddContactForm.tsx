import { Save } from "lucide-react";
import { useState } from "react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";

export type AddContactFormValues = {
  type: PortalCustomerContact["type"];
  title: string;
  loanedItemName?: string;
};

type AddContactFormProps = {
  onSubmit: (values: AddContactFormValues) => Promise<void> | void;
};

export function AddContactForm({ onSubmit }: AddContactFormProps) {
  const [contactType, setContactType] =
    useState<PortalCustomerContact["type"]>("note");
  const [contactTitle, setContactTitle] = useState("");
  const [loanedItemName, setLoanedItemName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactTitle.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        type: contactType,
        title: contactTitle.trim(),
        loanedItemName: contactType === "loaned_item" ? loanedItemName.trim() || undefined : undefined
      });
      setContactTitle("");
      setLoanedItemName("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel">
      <SectionHeader
        compact
        title="Contactmoment toevoegen"
        description="Registreer afspraken, notities en uitgeleende stalen of boeken."
      />
      <form className="responsive-form-row" onSubmit={handleSubmit}>
        <Field htmlFor="contact-type" label="Type">
          <Select
            id="contact-type"
            value={contactType}
            onChange={(event) =>
              setContactType(event.target.value as PortalCustomerContact["type"])
            }
          >
            <option value="note">Notitie</option>
            <option value="call">Telefoon</option>
            <option value="email">E-mail</option>
            <option value="visit">Bezoek</option>
            <option value="agreement">Afspraak</option>
            <option value="loaned_item">Uitgeleend</option>
          </Select>
        </Field>
        <Field htmlFor="contact-title" label="Korte omschrijving" required>
          <Input
            id="contact-title"
            value={contactTitle}
            onChange={(event) => setContactTitle(event.target.value)}
            required
          />
        </Field>
        <Field htmlFor="loaned-item" label="Uitgeleend item">
          <Input
            disabled={contactType !== "loaned_item"}
            id="loaned-item"
            value={loanedItemName}
            onChange={(event) => setLoanedItemName(event.target.value)}
          />
        </Field>
        <Button
          isLoading={isSaving}
          leftIcon={<Save size={17} aria-hidden="true" />}
          type="submit"
          variant="primary"
        >
          {isSaving ? "Opslaan..." : "Contactmoment opslaan"}
        </Button>
      </form>
    </section>
  );
}
