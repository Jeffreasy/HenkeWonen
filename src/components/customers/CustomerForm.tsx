import { Save } from "lucide-react";
import { useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { CustomerType } from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";

/**
 * Wat er bij het vastleggen gebeurt:
 *  - "customer"  → alleen een klant/lead aanmaken.
 *  - "dossier"   → klant + meteen een leeg dossier (project). Standaardgedrag.
 *  - "snelroute" → klant + dossier én direct doorspringen naar de inmeting (walk-in met
 *                  bekende maten/product). Toont een verkort formulier (naam + telefoon).
 */
export type CustomerIntent = "customer" | "dossier" | "snelroute";

export type CustomerFormValues = {
  type: CustomerType;
  displayName: string;
  email?: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  intent: CustomerIntent;
};

type CustomerFormProps = {
  onCreate: (customer: CustomerFormValues) => Promise<void> | void;
};

export default function CustomerForm({ onCreate }: CustomerFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<CustomerType>("private");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [intent, setIntent] = useState<CustomerIntent>("dossier");
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Snelroute = balie wil snel door naar inmeten: toon standaard alleen naam + telefoon,
  // de rest achter "Meer gegevens". In de andere modi tonen we alle velden zoals voorheen.
  const showExtraFields = intent !== "snelroute" || showMoreFields;

  async function submit(event: SubmitEventLike) {
    event.preventDefault();

    const customer: CustomerFormValues = {
      type,
      displayName: displayName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      street: street.trim() || undefined,
      houseNumber: houseNumber.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      city: city.trim() || undefined,
      notes: notes.trim() || undefined,
      intent
    };

    if (!customer.displayName) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreate(customer);
      setDisplayName("");
      setType("private");
      setEmail("");
      setPhone("");
      setStreet("");
      setHouseNumber("");
      setPostalCode("");
      setCity("");
      setNotes("");
      setIntent("dossier");
      setShowMoreFields(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <Field htmlFor="customer-type" label="Type">
        <Select
          id="customer-type"
          value={type}
          onChange={(event) => setType(event.target.value as CustomerType)}
        >
          <option value="private">Particulier</option>
          <option value="business">Zakelijk</option>
        </Select>
      </Field>
      <Field htmlFor="customer-name" label="Naam" required>
        <Input
          id="customer-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </Field>
      <Field
        htmlFor="customer-intent"
        label="Wat wil je aanmaken?"
        helpText={
          intent === "snelroute"
            ? "Maakt klant + dossier en springt direct door naar de inmeting."
            : undefined
        }
      >
        <Select
          id="customer-intent"
          value={intent}
          onChange={(event) => setIntent(event.target.value as CustomerIntent)}
        >
          <option value="customer">Alleen klant</option>
          <option value="dossier">Klant + dossier aanmaken</option>
          <option value="snelroute">Snelroute: maten bekend → direct inmeten</option>
        </Select>
      </Field>
      <Field htmlFor="customer-phone" label="Telefoon">
        <Input
          id="customer-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      {showExtraFields ? (
        <>
          <Field htmlFor="customer-email" label="E-mail">
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field htmlFor="customer-street" label="Straat">
            <Input
              id="customer-street"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
            />
          </Field>
          <Field htmlFor="customer-house-number" label="Huisnummer">
            <Input
              id="customer-house-number"
              value={houseNumber}
              onChange={(event) => setHouseNumber(event.target.value)}
            />
          </Field>
          <Field htmlFor="customer-postal-code" label="Postcode">
            <Input
              id="customer-postal-code"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
            />
          </Field>
          <Field htmlFor="customer-city" label="Plaats">
            <Input id="customer-city" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
          <Field htmlFor="customer-notes" label="Interne notities">
            <Textarea
              id="customer-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setShowMoreFields(true)}>
          Meer gegevens toevoegen
        </Button>
      )}
      <Button
        isLoading={isSaving}
        leftIcon={<Save size={17} aria-hidden="true" />}
        type="submit"
        variant="primary"
      >
        {isSaving
          ? "Vastleggen..."
          : intent === "snelroute"
            ? "Aanmaken en inmeten"
            : "Klant vastleggen"}
      </Button>
    </form>
  );
}
