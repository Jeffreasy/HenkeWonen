import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Card, SectionHeader, Field, Input, Select, Textarea, Button } from "../ui";
import { formatProductListStatus } from "../../lib/i18n/statusLabels";
import type { ProductListStatus } from "../../lib/portalTypes";

type AddSupplierFormProps = {
  onCreateSupplier: (data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    productListStatus: ProductListStatus;
    lastContactAt?: number;
    expectedAt?: number;
    notes?: string;
  }) => Promise<void>;
  isSaving: boolean;
};

const PRODUCT_LIST_STATUSES: ProductListStatus[] = [
  "unknown",
  "requested",
  "received",
  "download_available",
  "not_available",
  "manual_only"
];

function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T12:00:00`).getTime();
}

export function AddSupplierForm({ onCreateSupplier, isSaving }: AddSupplierFormProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [productListStatus, setProductListStatus] = useState<ProductListStatus>("unknown");
  const [lastContactDate, setLastContactDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    onCreateSupplier({
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      productListStatus,
      lastContactAt: fromDateInputValue(lastContactDate),
      expectedAt: fromDateInputValue(expectedDate),
      notes: notes.trim() || undefined
    })
      .then(() => {
        setName("");
        setContactName("");
        setEmail("");
        setPhone("");
        setProductListStatus("unknown");
        setLastContactDate("");
        setExpectedDate("");
        setNotes("");
      })
      .catch(() => {
        // Parent takes care of setting error states, so we just let it fail silently locally.
      });
  };

  return (
    <section className="grid two-column">
      <Card>
        <form className="form-grid" onSubmit={handleSubmit}>
          <SectionHeader
            compact
            title="Leverancier toevoegen"
            description="Leg contactgegevens en prijslijststatus vast voor opvolging."
          />
          <Field htmlFor="supplier-name" label="Naam" required>
            <Input
              id="supplier-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="grid two-column-even">
            <Field htmlFor="supplier-contact" label="Contactpersoon">
              <Input
                id="supplier-contact"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </Field>
            <Field htmlFor="supplier-status" label="Status prijslijst">
              <Select
                id="supplier-status"
                value={productListStatus}
                onChange={(event) => setProductListStatus(event.target.value as ProductListStatus)}
              >
                {PRODUCT_LIST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatProductListStatus(status)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid two-column-even">
            <Field htmlFor="supplier-email" label="E-mailadres">
              <Input
                id="supplier-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field htmlFor="supplier-phone" label="Telefoonnummer">
              <Input
                id="supplier-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid two-column-even">
            <Field htmlFor="supplier-last-contact" label="Laatste contact">
              <Input
                id="supplier-last-contact"
                type="date"
                value={lastContactDate}
                onChange={(event) => setLastContactDate(event.target.value)}
              />
            </Field>
            <Field htmlFor="supplier-expected" label="Verwacht op">
              <Input
                id="supplier-expected"
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
              />
            </Field>
          </div>
          <Field htmlFor="supplier-notes" label="Notities">
            <Textarea
              id="supplier-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <div className="toolbar">
            <Button
              isLoading={isSaving}
              leftIcon={<Save size={17} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              Leverancier opslaan
            </Button>
          </div>
        </form>
      </Card>

      <Card variant="info">
        <SectionHeader
          compact
          title="Opvolging"
          description="Gebruik de status om te zien welke leveranciers nog actie nodig hebben."
        />
        <div className="checklist" style={{ marginTop: 12 }}>
          <div className="checklist-item checklist-item-success">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Ontvangen of download beschikbaar</strong>
              <small>De prijslijst kan worden verwerkt of is al gekoppeld aan de catalogus.</small>
            </div>
          </div>
          <div className="checklist-item checklist-item-warning">
            <span aria-hidden="true">!</span>
            <div>
              <strong>Opgevraagd of onbekend</strong>
              <small>Plan opvolging met de leverancier en vul eventueel de verwachte datum.</small>
            </div>
          </div>
          <div className="checklist-item checklist-item-danger">
            <span aria-hidden="true">!</span>
            <div>
              <strong>Niet beschikbaar</strong>
              <small>Deze leverancier vraagt om handmatige verwerking of een later alternatief.</small>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
