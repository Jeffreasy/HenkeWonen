import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import { formatLineType } from "../../lib/i18n/statusLabels";
import type { MeasurementProductGroup, PortalProduct, PortalRoom, QuoteLineType, QuoteTemplateLine } from "../../lib/portalTypes";
import { polishQuoteTemplateText } from "../../lib/quotes/quoteTemplateCopy";
import CatalogProductPicker from "../catalog/CatalogProductPicker";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import WallpaperCalculator from "./WallpaperCalculator";
import { LINE_TYPE_OPTIONS } from "./quote/quoteConstants";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

// Re-export voor backwards compatibiliteit — importeer liever direct van ./quote/quoteTypes
export type { QuoteLineFormValues } from "./quote/quoteTypes";

type QuoteLineEditorProps = {
  sortOrder: number;
  templateLines?: QuoteTemplateLine[];
  session: AppSession;
  projectRooms?: PortalRoom[];
  onAdd: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  mode?: "full" | "field";
  surface?: "panel" | "plain";
  /** Hint vanuit de meetcontext — filtert de catalogus op bijbehorende categorieën. */
  productGroupHint?: MeasurementProductGroup | null;
};

export default function QuoteLineEditor({
  sortOrder,
  templateLines = [],
  session,
  projectRooms = [],
  onAdd,
  mode = "full",
  surface = "panel",
  productGroupHint = null
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
  const [projectRoomId, setProjectRoomId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PortalProduct | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lineType !== "product") {
      setSelectedProduct(null);
      setProductError(null);
    }
  }, [lineType]);

  function applyProduct(product: PortalProduct | null) {
    setSelectedProduct(product);
    setProductError(null);

    if (!product) {
      return;
    }

    setTitle(product.weergaveNaam ?? product.naam);
    setUnit(product.eenheid);
    setUnitPriceExVat(String(product.prijsExBtw));
    setVatRate(String(product.btwTarief));
    setDescription((current) =>
      current ||
      [
        product.displaySupplierName ?? product.supplier,
        product.category,
        product.kleurnaam
      ]
        .filter(Boolean)
        .join(" - ")
    );
  }

  function applyTemplateLine(templateKey: string) {
    setSelectedTemplateKey(templateKey);
    const templateLine = templateLines.find(
      (line) => `${line.sortOrder}-${line.titel}` === templateKey
    );

    if (!templateLine) {
      setSelectedTemplateLine(null);
      return;
    }

    setSelectedTemplateLine(templateLine);
    setLineType(templateLine.regelType);
    if (templateLine.regelType !== "product") {
      setSelectedProduct(null);
    }
    setTitle(polishQuoteTemplateText(templateLine.titel));
    setDescription(templateLine.omschrijving ? polishQuoteTemplateText(templateLine.omschrijving) : "");
    setQuantity(String(templateLine.standaardAantal ?? 1));
    setUnit(templateLine.eenheid);
    setUnitPriceExVat("");
    setDiscountExVat("");
  }

  async function submit(event: SubmitEventLike) {
    event.preventDefault();

    if (lineType === "product" && !selectedProduct) {
      setProductError("Kies eerst een zichtbaar catalogusproduct voor deze productregel.");
      return;
    }

    if (!title.trim()) {
      return;
    }

    const templateMetadata = selectedTemplateLine
      ? Object.fromEntries(
          Object.entries({
            source: "quoteTemplate",
            sectionKey: selectedTemplateLine.sectieSleutel,
            categoryHint: selectedTemplateLine.categorieHint,
            productKindHint: selectedTemplateLine.productSoortHint
          }).filter(([, value]) => value !== undefined)
        )
      : undefined;
    const productMetadata = selectedProduct
      ? {
          source: "catalog",
          productId: selectedProduct.id,
          displayName: selectedProduct.weergaveNaam ?? selectedProduct.naam,
          supplier: selectedProduct.displaySupplierName ?? selectedProduct.supplier,
          category: selectedProduct.category,
          articleNumber: selectedProduct.artikelnummer,
          supplierCode: selectedProduct.leverancierCode,
          commercialCode: selectedProduct.commercieleCode
        }
      : undefined;
    const metadata =
      templateMetadata || productMetadata
        ? {
            ...(templateMetadata ?? {}),
            ...(productMetadata ?? {})
          }
        : undefined;

    setIsSaving(true);
    try {
      await onAdd({
        projectRoomId: projectRoomId || undefined,
        productId: selectedProduct?.id,
        lineType,
        title: title.trim(),
        description: description.trim() || undefined,
        quantity: lineType === "text" ? 0 : Number(quantity) || 0,
        unit: lineType === "text" ? "tekst" : unit,
        unitPriceExVat: lineType === "text" ? 0 : Number(unitPriceExVat) || 0,
        vatRate: lineType === "text" ? 0 : Number(vatRate) || 0,
        discountExVat: Number(discountExVat) || undefined,
        sortOrder,
        metadata
      });
      setTitle("");
      setDescription("");
      setQuantity("1");
      setUnitPriceExVat("");
      setDiscountExVat("");
      setSelectedTemplateKey("");
      setSelectedTemplateLine(null);
      setSelectedProduct(null);
      setProjectRoomId("");
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
                <option value={`${line.sortOrder}-${line.titel}`} key={`${line.sortOrder}-${line.titel}`}>
                  {line.sortOrder}. {polishQuoteTemplateText(line.titel)}
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
            {LINE_TYPE_OPTIONS.map((type) => (
              <option value={type} key={type}>
                {formatLineType(type)}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="line-title" label="Omschrijving" required>
          <Input
            id="line-title"
            readOnly={lineType === "product"}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
      </div>
      {projectRooms.length > 0 ? (
        <Field
          htmlFor="line-room"
          label="Ruimte"
          description="Koppel hetzelfde product gerust aan meerdere ruimtes met eigen aantallen."
        >
          <Select
            id="line-room"
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
      {lineType === "product" ? (
        <section className="quote-product-picker">
          <SectionHeader
            compact
            title="Catalogusproduct"
            description="Pilotkeuze uit zichtbare catalogusproducten; PVC Click blijft hier verborgen."
          />
          <CatalogProductPicker
            session={session}
            idPrefix="catalog"
            productGroupHint={productGroupHint}
            selectedProductId={selectedProduct?.id ?? ""}
            onSelect={applyProduct}
            label="Product kiezen"
            required
            showPriceInLabel
          />
          {productError ? <Alert variant="warning" description={productError} /> : null}
        </section>
      ) : null}
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
