import { Save , X} from "lucide-react";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Card } from "../ui/data-display/Card";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";
import { Button } from "../ui/forms/Button";
import { formatStatusLabel, formatProductListStatus } from "../../lib/i18n/statusLabels";
import type { PortalSupplier, ProductListStatus } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { type SupplierStatus, PRODUCT_LIST_STATUSES, SUPPLIER_STATUSES, fromDateInputValue } from "./supplier/supplierUtils";

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

function toDateInputValue(value?: number): string {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

export function EditSupplierForm({ supplier, onSaveSupplier, onCancel, isSaving }: EditSupplierFormProps) {
  const [name, setName] = useState(supplier.naam);
  const [contactName, setContactName] = useState(supplier.contactpersoon ?? "");
  const [email, setEmail] = useState(supplier.email ?? "");
  const [phone, setPhone] = useState(supplier.telefoon ?? "");
  const [productListStatus, setProductListStatus] = useState<ProductListStatus>(supplier.prijslijstStatus);
  const [status, setStatus] = useState<SupplierStatus>(supplier.status ?? "active");
  const [lastContactDate, setLastContactDate] = useState(toDateInputValue(supplier.laatsteContactOp));
  const [expectedDate, setExpectedDate] = useState(toDateInputValue(supplier.verwachtOp));
  const [notes, setNotes] = useState(supplier.notities ?? "");

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(true, formRef);

  useEffect(() => {
    setName(supplier.naam);
    setContactName(supplier.contactpersoon ?? "");
    setEmail(supplier.email ?? "");
    setPhone(supplier.telefoon ?? "");
    setProductListStatus(supplier.prijslijstStatus);
    setStatus(supplier.status ?? "active");
    setLastContactDate(toDateInputValue(supplier.laatsteContactOp));
    setExpectedDate(toDateInputValue(supplier.verwachtOp));
    setNotes(supplier.notities ?? "");
  }, [supplier]);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
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
          title={`Leverancier bewerken: ${supplier.naam}`}
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
          <Button variant="secondary" leftIcon={<X size={15} aria-hidden="true" />} onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </Card>
  );
}
