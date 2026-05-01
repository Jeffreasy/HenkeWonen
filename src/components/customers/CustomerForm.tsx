import { Save } from "lucide-react";
import { useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import type { CustomerType } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

export type CustomerFormValues = {
  type: CustomerType;
  displayName: string;
  email?: string;
  phone?: string;
  city?: string;
  notes?: string;
};

type CustomerFormProps = {
  onCreate: (customer: CustomerFormValues) => Promise<void> | void;
};

export default function CustomerForm({ onCreate }: CustomerFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<CustomerType>("private");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: SubmitEventLike) {
    event.preventDefault();

    const customer: CustomerFormValues = {
      type,
      displayName: displayName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      notes: notes.trim() || undefined
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
      setCity("");
      setNotes("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <SectionHeader
        compact
        title="Nieuwe klant"
        description="Leg snel een klant of lead vast vanuit winkelcontact."
      />
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
      <Field htmlFor="customer-email" label="E-mail">
        <Input
          id="customer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field htmlFor="customer-phone" label="Telefoon">
        <Input
          id="customer-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
      <Button
        isLoading={isSaving}
        leftIcon={<Save size={17} aria-hidden="true" />}
        type="submit"
        variant="primary"
      >
        {isSaving ? "Opslaan..." : "Klant opslaan"}
      </Button>
    </form>
  );
}
