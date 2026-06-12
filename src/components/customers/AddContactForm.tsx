import { CalendarDays, Save } from "lucide-react";
import { useState } from "react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { dateText } from "../projects/measurement/measurementUtils";

export type AddContactFormValues = {
  type: PortalCustomerContact["type"];
  title: string;
  description?: string;
  loanedItemName?: string;
  expectedReturnDate?: number;
};

type AddContactFormProps = {
  onSubmit: (values: AddContactFormValues) => Promise<void> | void;
};

function dateInputToTimestamp(value: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(`${value}T12:00:00`).getTime();

  return Number.isNaN(timestamp) ? undefined : timestamp;
}

export function AddContactForm({ onSubmit }: AddContactFormProps) {
  const [contactType, setContactType] =
    useState<PortalCustomerContact["type"]>("note");
  const [contactTitle, setContactTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loanedItemName, setLoanedItemName] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isLoanedItem = contactType === "loaned_item";
  const canSubmit =
    contactTitle.trim().length > 0 &&
    (!isLoanedItem || loanedItemName.trim().length > 0);

  function handleTypeChange(nextType: PortalCustomerContact["type"]) {
    setContactType(nextType);

    if (nextType !== "loaned_item") {
      setLoanedItemName("");
      setExpectedReturnDate("");
    }
  }

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        type: contactType,
        title: contactTitle.trim(),
        description: description.trim() || undefined,
        loanedItemName: isLoanedItem ? loanedItemName.trim() : undefined,
        expectedReturnDate: isLoanedItem
          ? dateInputToTimestamp(expectedReturnDate)
          : undefined
      });
      setContactType("note");
      setContactTitle("");
      setDescription("");
      setLoanedItemName("");
      setExpectedReturnDate("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="contact-moment-form" onSubmit={handleSubmit}>
      <div className="contact-form-grid">
        <Field htmlFor="contact-type" label="Type">
          <Select
            id="contact-type"
            value={contactType}
            onChange={(event) =>
              handleTypeChange(event.target.value as PortalCustomerContact["type"])
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
            placeholder="Bijv. offerte besproken"
            value={contactTitle}
            onChange={(event) => setContactTitle(event.target.value)}
            required
          />
        </Field>
        <div className="contact-form-field-full">
          <Field htmlFor="contact-description" label="Notitie/details">
            <Textarea
              id="contact-description"
              placeholder="Leg kort vast wat er is afgesproken of besproken."
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="contact-date" label="Datum contact">
          <div className="contact-date-indicator" id="contact-date">
            <CalendarDays size={14} aria-hidden="true" />
            <span>{dateText(Date.now())}</span>
            <small className="muted">(automatisch vastgelegd bij opslaan)</small>
          </div>
        </Field>
        {isLoanedItem ? (
          <>
            <Field htmlFor="loaned-item" label="Uitgeleend item" required>
              <Input
                id="loaned-item"
                placeholder="Bijv. PVC staalboek"
                value={loanedItemName}
                onChange={(event) => setLoanedItemName(event.target.value)}
                required
              />
            </Field>
            <Field htmlFor="loaned-return-date" label="Retour verwacht">
              <Input
                id="loaned-return-date"
                type="date"
                value={expectedReturnDate}
                onChange={(event) => setExpectedReturnDate(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="contact-form-footer">
        <Button
          isLoading={isSaving}
          leftIcon={<Save size={17} aria-hidden="true" />}
          type="submit"
          variant="primary"
        >
          {isSaving ? "Opslaan..." : "Contactmoment opslaan"}
        </Button>
      </div>
    </form>
  );
}
