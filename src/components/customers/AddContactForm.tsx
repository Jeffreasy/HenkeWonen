import { CalendarDays, Save } from "lucide-react";
import { useState } from "react";
import type { PortalCustomerContact } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Checkbox } from "../ui/forms/Checkbox";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";
import { dateText } from "../projects/measurement/measurementUtils";

export type AddContactFormValues = {
  type: PortalCustomerContact["type"];
  title: string;
  description?: string;
  loanedItemName?: string;
  expectedReturnDate?: number;
  /** Opvolgdatum: verschijnt tot die datum-afhandeling in Klantopvolging op het dashboard. */
  followUpDate?: number;
  /** Koppeling aan een projectdossier: verschijnt dan ook in de projecttijdlijn. */
  projectId?: string;
  visibleToCustomer?: boolean;
};

type AddContactFormProps = {
  onSubmit: (values: AddContactFormValues) => Promise<void> | void;
  /** Voorinvulling voor de bewerk-variant (typefout corrigeren). */
  initialValues?: AddContactFormValues;
  submitLabel?: string;
  /** Projecten van deze klant, voor de optionele dossierkoppeling. */
  projectOptions?: Array<{ id: string; titel: string }>;
};

function dateInputToTimestamp(value: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(`${value}T12:00:00`).getTime();

  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function timestampToDateInput(value?: number) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function AddContactForm({ onSubmit, initialValues, submitLabel, projectOptions }: AddContactFormProps) {
  const [contactType, setContactType] =
    useState<PortalCustomerContact["type"]>(initialValues?.type ?? "note");
  const [contactTitle, setContactTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [loanedItemName, setLoanedItemName] = useState(initialValues?.loanedItemName ?? "");
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    timestampToDateInput(initialValues?.expectedReturnDate)
  );
  const [followUpDate, setFollowUpDate] = useState(timestampToDateInput(initialValues?.followUpDate));
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [visibleToCustomer, setVisibleToCustomer] = useState(initialValues?.visibleToCustomer ?? false);
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
          : undefined,
        followUpDate: dateInputToTimestamp(followUpDate),
        projectId: projectId || undefined,
        visibleToCustomer
      });
      setContactType("note");
      setContactTitle("");
      setDescription("");
      setLoanedItemName("");
      setExpectedReturnDate("");
      setFollowUpDate("");
      setProjectId("");
      setVisibleToCustomer(false);
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
        <Field
          htmlFor="contact-follow-up"
          label="Opvolgen op"
          description="Verschijnt vanaf die dag onder Klantopvolging op het dashboard; leegmaken = afgehandeld."
        >
          <Input
            id="contact-follow-up"
            type="date"
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
          />
        </Field>
        {projectOptions && projectOptions.length > 0 ? (
          <Field
            htmlFor="contact-project"
            label="Koppel aan project"
            description="Het contactmoment verschijnt dan ook in de tijdlijn van dat dossier."
          >
            <Select
              id="contact-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Geen project</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.titel}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <div className="contact-form-field-full">
          <Checkbox
            checked={visibleToCustomer}
            label="Zichtbaar voor klant"
            description="Verschijnt als afspraak op de klantversie van de offerte."
            onChange={(event) => setVisibleToCustomer(event.target.checked)}
          />
        </div>
      </div>

      <div className="contact-form-footer">
        <Button
          isLoading={isSaving}
          leftIcon={<Save size={17} aria-hidden="true" />}
          type="submit"
          variant="primary"
        >
          {isSaving ? "Opslaan..." : (submitLabel ?? "Contactmoment opslaan")}
        </Button>
      </div>
    </form>
  );
}
