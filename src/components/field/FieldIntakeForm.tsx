import { ClipboardList } from "lucide-react";
import { useState } from "react";
import type { CustomerType } from "../../lib/portalTypes";
import { useFormDraft } from "../../lib/useFormDraft";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { Checkbox } from "../ui/forms/Checkbox";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";

export type IntakeFormValues = {
  type: CustomerType;
  displayName: string;
  email?: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  createDossier: boolean;
  projectTitle?: string;
};

type FieldIntakeFormProps = {
  /** Retourneert of het vastleggen is gelukt, zodat het formulier zijn draft kan wissen. */
  onSubmit: (values: IntakeFormValues) => Promise<boolean>;
  isSaving: boolean;
  error: string | null;
};

export function FieldIntakeForm({ onSubmit, isSaving, error }: FieldIntakeFormProps) {
  const [leadType, setLeadType] = useState<CustomerType>("private");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStreet, setLeadStreet] = useState("");
  const [leadHouseNumber, setLeadHouseNumber] = useState("");
  const [leadPostalCode, setLeadPostalCode] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [createDossier, setCreateDossier] = useState(true);
  const [projectTitle, setProjectTitle] = useState("");

  // Draft-vangnet voor mobiel: de intake gebeurt bij de klant aan de deur; als de
  // browser de tab weggooit (wisselen naar telefoon/camera) was alle invoer weg.
  const { clear: clearDraft } = useFormDraft(
    "henke-veld-intake",
    {
      leadType, leadName, leadPhone, leadEmail, leadStreet, leadHouseNumber,
      leadPostalCode, leadCity, leadNotes, createDossier, projectTitle
    },
    (draft) => {
      if (draft.leadType === "private" || draft.leadType === "business") {
        setLeadType(draft.leadType);
      }
      if (typeof draft.leadName === "string") setLeadName(draft.leadName);
      if (typeof draft.leadPhone === "string") setLeadPhone(draft.leadPhone);
      if (typeof draft.leadEmail === "string") setLeadEmail(draft.leadEmail);
      if (typeof draft.leadStreet === "string") setLeadStreet(draft.leadStreet);
      if (typeof draft.leadHouseNumber === "string") setLeadHouseNumber(draft.leadHouseNumber);
      if (typeof draft.leadPostalCode === "string") setLeadPostalCode(draft.leadPostalCode);
      if (typeof draft.leadCity === "string") setLeadCity(draft.leadCity);
      if (typeof draft.leadNotes === "string") setLeadNotes(draft.leadNotes);
      if (typeof draft.createDossier === "boolean") setCreateDossier(draft.createDossier);
      if (typeof draft.projectTitle === "string") setProjectTitle(draft.projectTitle);
    }
  );

  function resetForm() {
    setLeadType("private");
    setLeadName("");
    setLeadPhone("");
    setLeadEmail("");
    setLeadStreet("");
    setLeadHouseNumber("");
    setLeadPostalCode("");
    setLeadCity("");
    setLeadNotes("");
    setCreateDossier(true);
    setProjectTitle("");
    clearDraft();
  }

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadName.trim()) return;

    void (async () => {
      const gelukt = await onSubmit({
        type: leadType,
        displayName: leadName.trim(),
        email: leadEmail.trim() || undefined,
        phone: leadPhone.trim() || undefined,
        street: leadStreet.trim() || undefined,
        houseNumber: leadHouseNumber.trim() || undefined,
        postalCode: leadPostalCode.trim() || undefined,
        city: leadCity.trim() || undefined,
        notes: leadNotes.trim() || undefined,
        createDossier,
        projectTitle: projectTitle.trim() || undefined
      });
      // Alleen bij succes wissen: bij een fout blijft de invoer (én de draft) staan
      // zodat de monteur direct kan corrigeren.
      if (gelukt) {
        clearDraft();
      }
    })();
  };

  return (
    <>
      {error ? <Alert variant="danger" description={error} /> : null}
      <form className="field-intake-form" onSubmit={handleSubmit}>
        <div className="grid two-column-even">
          <Field htmlFor="field-lead-type" label="Type">
            <Select
              id="field-lead-type"
              value={leadType}
              onChange={(event) => setLeadType(event.target.value as CustomerType)}
            >
              <option value="private">Particulier</option>
              <option value="business">Zakelijk</option>
            </Select>
          </Field>
          <Field htmlFor="field-lead-name" label="Naam" required>
            <Input
              id="field-lead-name"
              value={leadName}
              onChange={(event) => setLeadName(event.target.value)}
              placeholder="Bijv. Familie Jansen"
              required
            />
          </Field>
        </div>

        <div className="grid two-column-even">
          <Field htmlFor="field-lead-phone" label="Telefoon">
            <Input
              id="field-lead-phone"
              value={leadPhone}
              onChange={(event) => setLeadPhone(event.target.value)}
              placeholder="06..."
            />
          </Field>
          <Field htmlFor="field-lead-email" label="E-mail">
            <Input
              id="field-lead-email"
              type="email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.target.value)}
              placeholder="naam@example.nl"
            />
          </Field>
        </div>

        <div className="grid three-column">
          <Field htmlFor="field-lead-street" label="Straat">
            <Input
              id="field-lead-street"
              value={leadStreet}
              onChange={(event) => setLeadStreet(event.target.value)}
            />
          </Field>
          <Field htmlFor="field-lead-house-number" label="Huisnr.">
            <Input
              id="field-lead-house-number"
              value={leadHouseNumber}
              onChange={(event) => setLeadHouseNumber(event.target.value)}
            />
          </Field>
          <Field htmlFor="field-lead-postal-code" label="Postcode">
            <Input
              id="field-lead-postal-code"
              value={leadPostalCode}
              onChange={(event) => setLeadPostalCode(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid two-column-even">
          <Field htmlFor="field-lead-city" label="Plaats">
            <Input
              id="field-lead-city"
              value={leadCity}
              onChange={(event) => setLeadCity(event.target.value)}
            />
          </Field>
          <Field htmlFor="field-lead-project-title" label="Dossiernaam">
            <Input
              id="field-lead-project-title"
              disabled={!createDossier}
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              placeholder={leadName.trim() ? `${leadName.trim()} - inmeten` : "Automatisch op klantnaam"}
            />
          </Field>
        </div>

        <Field htmlFor="field-lead-notes" label="Notitie">
          <Textarea
            id="field-lead-notes"
            rows={3}
            value={leadNotes}
            onChange={(event) => setLeadNotes(event.target.value)}
            placeholder="Korte aanleiding, gewenste ruimte of afspraaknotitie."
          />
        </Field>

        <div className="field-intake-footer">
          <Checkbox
            checked={createDossier}
            label="Direct dossier voor inmeten/opvolging aanmaken"
            description="Na opslaan opent de buitendienst meteen het nieuwe dossier."
            onChange={(event) => setCreateDossier(event.target.checked)}
          />
          <div className="field-intake-actions">
            <Button
              onClick={resetForm}
              type="button"
              variant="secondary"
            >
              Wissen
            </Button>
            <Button
              disabled={!leadName.trim()}
              isLoading={isSaving}
              leftIcon={<ClipboardList size={17} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              {createDossier ? "Opslaan en dossier openen" : "Lead vastleggen"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
