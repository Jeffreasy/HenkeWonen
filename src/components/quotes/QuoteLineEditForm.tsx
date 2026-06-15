import { Save , X} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { formatLineType } from "../../lib/i18n/statusLabels";
import type { PortalQuoteLine, PortalRoom, QuoteLineType } from "../../lib/portalTypes";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import { LINE_TYPE_OPTIONS, parseDecimal } from "./quote/quoteConstants";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

type QuoteLineEditFormProps = {
  line: PortalQuoteLine;
  projectRooms: PortalRoom[];
  isSaving: boolean;
  onSave: (data: QuoteLineFormValues) => Promise<void>;
  onCancel: () => void;
};

function optionalDecimal(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = parseDecimal(normalized);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

export function QuoteLineEditForm({
  line,
  projectRooms,
  isSaving,
  onSave,
  onCancel
}: QuoteLineEditFormProps) {
  const [lineType, setLineType] = useState<QuoteLineType>("product");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPriceExVat, setUnitPriceExVat] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [discountExVat, setDiscountExVat] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [projectRoomId, setProjectRoomId] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  useAutoFocusPanel(true, formRef);

  useEffect(() => {
    setLineType(line.regelType);
    setTitle(line.titel);
    setDescription(line.omschrijving ?? "");
    setQuantity(String(line.aantal));
    setUnit(line.eenheid);
    setUnitPriceExVat(String(line.eenheidsprijsExBtw));
    setVatRate(String(line.btwTarief));
    setDiscountExVat(
      line.kortingExBtw !== undefined && line.kortingExBtw !== null ? String(line.kortingExBtw) : ""
    );
    setSortOrder(String(line.sortOrder));
    setProjectRoomId(line.projectRuimteId ?? "");
  }, [line]);

  async function handleSubmit(event: SubmitEventLike) {
    event.preventDefault();
    if (!title.trim()) return;

    const isTextLine = lineType === "text";
    await onSave({
      projectRoomId: projectRoomId || undefined,
      productId: line.productId || undefined,
      lineType,
      title: title.trim(),
      description: description.trim() || undefined,
      quantity: isTextLine ? 0 : (parseDecimal(quantity) ?? 0),
      unit: isTextLine ? "tekst" : unit.trim() || line.eenheid,
      unitPriceExVat: isTextLine ? 0 : (parseDecimal(unitPriceExVat) ?? 0),
      vatRate: isTextLine ? 0 : (parseDecimal(vatRate) ?? 0),
      discountExVat: optionalDecimal(discountExVat),
      sortOrder: Math.max(1, Math.round((parseDecimal(sortOrder) ?? 0) || line.sortOrder)),
      metadata: line.metadata
    });
  }

  return (
    <section className="panel edit-work-panel" ref={formRef}>
      <SectionHeader
        compact
        title={`Offertepost bewerken: ${line.titel}`}
        description="Je bewerkt nu deze ene conceptregel. Definitieve of verzonden offertes blijven beschermd tegen losse regelwijzigingen."
        actions={<LineTypeBadge lineType={lineType} />}
      />
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="grid two-column-even">
          <Field htmlFor="quote-line-edit-type" label="Soort post">
            <Select
              id="quote-line-edit-type"
              value={lineType}
              onChange={(event) => setLineType(event.target.value as QuoteLineType)}
            >
              {LINE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {formatLineType(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field htmlFor="quote-line-edit-title" label="Omschrijving" required>
            <Input
              id="quote-line-edit-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
        </div>
        {projectRooms.length > 0 ? (
          <Field htmlFor="quote-line-edit-room" label="Ruimte">
            <Select
              id="quote-line-edit-room"
              value={projectRoomId}
              onChange={(event) => setProjectRoomId(event.target.value)}
            >
              <option value="">Geen specifieke ruimte</option>
              {projectRooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.naam}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field htmlFor="quote-line-edit-description" label="Beschrijving">
          <Textarea
            id="quote-line-edit-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid three-column">
          <Field htmlFor="quote-line-edit-quantity" label="Aantal">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-unit" label="Eenheid">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-price" label="Prijs excl. btw">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-price"
              inputMode="decimal"
              value={unitPriceExVat}
              onChange={(event) => setUnitPriceExVat(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid three-column">
          <Field htmlFor="quote-line-edit-vat" label="Btw %">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-vat"
              inputMode="decimal"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-discount" label="Korting excl. btw">
            <Input
              disabled={lineType === "text"}
              id="quote-line-edit-discount"
              inputMode="decimal"
              value={discountExVat}
              onChange={(event) => setDiscountExVat(event.target.value)}
            />
          </Field>
          <Field htmlFor="quote-line-edit-sort" label="Volgorde">
            <Input
              id="quote-line-edit-sort"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        <div className="toolbar">
          <Button
            isLoading={isSaving}
            leftIcon={<Save size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            Offertepost opslaan
          </Button>
          <Button variant="secondary" leftIcon={<X size={15} aria-hidden="true" />} onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </section>
  );
}
