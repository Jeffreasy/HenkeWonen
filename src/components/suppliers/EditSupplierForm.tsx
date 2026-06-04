import { Save } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card, SectionHeader, StatusBadge, Field, Input, Select, Textarea, Button } from "../ui";
import { formatStatusLabel, formatProductListStatus } from "../../lib/i18n/statusLabels";
import type { PortalSupplier, ProductListStatus } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";

type SupplierStatus = NonNullable<PortalSupplier["status"]>;

type EditSupplierFormProps = {
  supplier: PortalSupplier;
  onSaveSupplier: (data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    productListStatus: ProductListStatus;
    status: SupplierStatus;
    lastContactAt?: number;
    expectedAt?: number;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
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

const SUPPLIER_STATUSES: SupplierStatus[] = ["active", "inactive", "archived"];

function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T12:00:00`).getTime();
}

function toDateInputValue(value?: number): string {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

export function EditSupplierForm({ supplier, onSaveSupplier, onCancel, isSaving }: EditSupplierFormProps) {
  const [name, setName] = useState(supplier.name);
  const [contactName, setContactName] = useState(supplier.contactName ?? "");
  const [email, setEmail] = useState(supplier.email ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [productListStatus, setProductListStatus] = useState<ProductListStatus>(supplier.productListStatus);
  const [status, setStatus] = useState<SupplierStatus>(supplier.status ?? "active");
  const [lastContactDate, setLastContactDate] = useState(toDateInputValue(supplier.lastContactAt));
  const [expectedDate, setExpectedDate] = useState(toDateInputValue(supplier.expectedAt));
  const [notes, setNotes] = useState(supplier.notes ?? "");

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(true, formRef);

  useEffect(() => {
    setName(supplier.name);
    setContactName(supplier.contactName ?? "");
    setEmail(supplier.email ?? "");
    setPhone(supplier.phone ?? "");
    setProductListStatus(supplier.productListStatus);
    setStatus(supplier.status ?? "active");
    setLastContactDate(toDateInputValue(supplier.lastContactAt));
    setExpectedDate(toDateInputValue(supplier.expectedAt));
    setNotes(supplier.notes ?? "");
  }, [supplier]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    void onSaveSupplier({
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      productListStatus,
      status,
      lastContactAt: fromDateInputValue(lastContactDate),
      expectedAt: fromDateInputValue(expectedDate),
      notes: notes.trim() || undefined
    });
  };

  return (
    <Card>
      <form className="form-grid edit-work-panel" onSubmit={handleSubmit} ref={formRef}>
        <SectionHeader
          compact
          title={`Leverancier bewerken: ${supplier.name}`}
          description="Je past nu deze leverancier aan. Producten, imports en historie blijven bewaard."
          actions={
            <StatusBadge
              status={status}
              label={formatStatusLabel(status)}
            />
          }
        />
        <div className="grid two-column-even">
          <Field htmlFor="supplier-edit-name" label="Naam" required>
            <Input
              id="supplier-edit-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field htmlFor="supplier-edit-status" label="Leverancierstatus">
            <Select
              id="supplier-edit-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as SupplierStatus)}
            >
              {SUPPLIER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid two-column-even">
          <Field htmlFor="supplier-edit-contact" label="Contactpersoon">
            <Input
              id="supplier-edit-contact"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </Field>
          <Field htmlFor="supplier-edit-product-list-status" label="Status prijslijst">
            <Select
              id="supplier-edit-product-list-status"
              value={productListStatus}
              onChange={(event) => setProductListStatus(event.target.value as ProductListStatus)}
            >
              {PRODUCT_LIST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatProductListStatus(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid two-column-even">
          <Field htmlFor="supplier-edit-email" label="E-mailadres">
            <Input
              id="supplier-edit-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field htmlFor="supplier-edit-phone" label="Telefoonnummer">
            <Input
              id="supplier-edit-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid two-column-even">
          <Field htmlFor="supplier-edit-last-contact" label="Laatste contact">
            <Input
              id="supplier-edit-last-contact"
              type="date"
              value={lastContactDate}
              onChange={(event) => setLastContactDate(event.target.value)}
            />
          </Field>
          <Field htmlFor="supplier-edit-expected" label="Verwacht op">
            <Input
              id="supplier-edit-expected"
              type="date"
              value={expectedDate}
              onChange={(event) => setExpectedDate(event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="supplier-edit-notes" label="Notities">
          <Textarea
            id="supplier-edit-notes"
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
          <Button variant="secondary" onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </Card>
  );
}
