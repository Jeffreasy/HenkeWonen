import { Plus } from "lucide-react";
import { useState } from "react";
import type { SubmitEventLike } from "../../lib/events";
import { formatLineType } from "../../lib/i18n/statusLabels";
import type { QuoteLineType, QuoteTemplateLine } from "../../lib/portalTypes";
import { polishQuoteTemplateText } from "../../lib/quoteTemplateCopy";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import WallpaperCalculator from "./WallpaperCalculator";

export type QuoteLineFormValues = {
  projectRoomId?: string;
  lineType: QuoteLineType;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPriceExVat: number;
  vatRate: number;
  discountExVat?: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};

type QuoteLineEditorProps = {
  sortOrder: number;
  templateLines?: QuoteTemplateLine[];
  onAdd: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  mode?: "full" | "field";
  surface?: "panel" | "plain";
};

const lineTypes: QuoteLineType[] = [
  "product",
  "service",
  "labor",
  "material",
  "discount",
  "text",
  "manual"
];

export default function QuoteLineEditor({
  sortOrder,
  templateLines = [],
  onAdd,
  mode = "full",
  surface = "panel"
}: QuoteLineEditorProps) {
  const isFieldMode = mode === "field";
  const [lineType, setLineType] = useState<QuoteLineType>("product");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("m2");
  const [unitPriceExVat, setUnitPriceExVat] = useState("");
  const [vatRate, setVatRate] = useState("21");
  const [discountExVat, setDiscountExVat] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedTemplateLine, setSelectedTemplateLine] = useState<QuoteTemplateLine | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function applyTemplateLine(templateKey: string) {
    setSelectedTemplateKey(templateKey);
    const templateLine = templateLines.find(
      (line) => `${line.sortOrder}-${line.title}` === templateKey
    );

    if (!templateLine) {
      setSelectedTemplateLine(null);
      return;
    }

    setSelectedTemplateLine(templateLine);
    setLineType(templateLine.lineType);
    setTitle(polishQuoteTemplateText(templateLine.title));
    setDescription(templateLine.description ? polishQuoteTemplateText(templateLine.description) : "");
    setQuantity(String(templateLine.defaultQuantity ?? 1));
    setUnit(templateLine.unit);
    setUnitPriceExVat("");
    setDiscountExVat("");
  }

  async function submit(event: SubmitEventLike) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    const templateMetadata = selectedTemplateLine
      ? Object.fromEntries(
          Object.entries({
            source: "quoteTemplate",
            sectionKey: selectedTemplateLine.sectionKey,
            categoryHint: selectedTemplateLine.categoryHint,
            productKindHint: selectedTemplateLine.productKindHint
          }).filter(([, value]) => value !== undefined)
        )
      : undefined;

    setIsSaving(true);
    try {
      await onAdd({
        lineType,
        title: title.trim(),
        description: description.trim() || undefined,
        quantity: lineType === "text" ? 0 : Number(quantity) || 0,
        unit: lineType === "text" ? "tekst" : unit,
        unitPriceExVat: lineType === "text" ? 0 : Number(unitPriceExVat) || 0,
        vatRate: lineType === "text" ? 0 : Number(vatRate) || 0,
        discountExVat: Number(discountExVat) || undefined,
        sortOrder,
        metadata: templateMetadata
      });
      setTitle("");
      setDescription("");
      setQuantity("1");
      setUnitPriceExVat("");
      setDiscountExVat("");
      setSelectedTemplateKey("");
      setSelectedTemplateLine(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={surface === "panel" ? "panel form-grid" : "form-grid"} onSubmit={submit}>
      <SectionHeader
        compact
        title={isFieldMode ? "Extra offertepost toevoegen" : "Offertepost toevoegen"}
        description={
          isFieldMode
            ? "Gebruik dit voor extra posten die niet uit de inmeting komen."
            : "Kies wat er op de offerte komt: product, werkzaamheid, materiaal, korting of tekst."
        }
        actions={<LineTypeBadge lineType={lineType} />}
      />
      {templateLines.length > 0 ? (
        <Field
          htmlFor="template-line"
          label="Standaardregel gebruiken"
          description="Kies een standaardregel uit het offertevoorbeeld en pas deze aan voordat je hem toevoegt."
        >
          <Select
            id="template-line"
            value={selectedTemplateKey}
            onChange={(event) => applyTemplateLine(event.target.value)}
          >
            <option value="">Geen standaardregel</option>
            {templateLines
              .slice()
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((line) => (
                <option value={`${line.sortOrder}-${line.title}`} key={`${line.sortOrder}-${line.title}`}>
                  {line.sortOrder}. {polishQuoteTemplateText(line.title)}
                </option>
              ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid two-column-even">
        <Field htmlFor="line-type" label="Soort post">
          <Select
            id="line-type"
            value={lineType}
            onChange={(event) => setLineType(event.target.value as QuoteLineType)}
          >
            {lineTypes.map((type) => (
              <option value={type} key={type}>
                {formatLineType(type)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="line-title" label="Omschrijving" required>
          <Input
            id="line-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
      </div>
      <Field htmlFor="line-description" label="Beschrijving">
        <Textarea
          id="line-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="grid three-column">
        <Field htmlFor="line-quantity" label="Aantal">
          <Input
            disabled={lineType === "text"}
            id="line-quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field htmlFor="line-unit" label="Eenheid">
          <Input
            disabled={lineType === "text"}
            id="line-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </Field>
        <Field htmlFor="line-price" label="Prijs excl. btw">
          <Input
            disabled={lineType === "text"}
            id="line-price"
            inputMode="decimal"
            value={unitPriceExVat}
            onChange={(event) => setUnitPriceExVat(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid three-column">
        <Field htmlFor="line-vat" label="Btw %">
          <Input
            disabled={lineType === "text"}
            id="line-vat"
            inputMode="decimal"
            value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
          />
        </Field>
        <Field htmlFor="line-discount" label="Korting excl. btw">
          <Input
            disabled={lineType === "text"}
            id="line-discount"
            inputMode="decimal"
            value={discountExVat}
            onChange={(event) => setDiscountExVat(event.target.value)}
          />
        </Field>
        <div className="form-action-cell">
          <Button
            isLoading={isSaving}
            leftIcon={<Plus size={17} aria-hidden="true" />}
            type="submit"
            variant="primary"
          >
            {isSaving ? "Toevoegen..." : "Offertepost toevoegen"}
          </Button>
        </div>
      </div>
      {!isFieldMode ? (
        <details className="wallpaper-calculator-details">
          <summary>Behangcalculator openen</summary>
          <WallpaperCalculator
            onUseResult={(result) => {
              setLineType("product");
              setTitle((current) => current || "Behang merk, kleur");
              setDescription((current) =>
                current || "Aantal rollen indicatief berekend met de behangcalculator."
              );
              setQuantity(String(result.rollsNeeded));
              setUnit("roll");
            }}
          />
        </details>
      ) : null}
    </form>
  );
}
