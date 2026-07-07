import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import type {
  MeasurementProductGroup,
  PortalProduct,
  PortalRoom,
  QuoteLineType,
  QuoteTemplateLine
} from "../../lib/portalTypes";
import { polishQuoteTemplateText } from "../../lib/quotes/quoteTemplateCopy";
import type { ServiceRuleRow } from "../settings/settings/settingsTypes";
import { useFormDraft } from "../../lib/useFormDraft";
import { quoteLineDraftKey, readQuoteLineDraft } from "../../lib/quoteLineDraft";
import CatalogProductPicker from "../catalog/CatalogProductPicker";
import ServiceRulePicker from "../catalog/ServiceRulePicker";
import { calculationTypeToUnit } from "../catalog/serviceRuleCatalog";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";
import { Field } from "../ui/forms/Field";
import { Input } from "../ui/forms/Input";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { Textarea } from "../ui/forms/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import { LineTypeButtons } from "./LineTypeButtons";
import WallpaperCalculator from "./WallpaperCalculator";
import { LINE_TYPE_OPTIONS, isServiceRuleLineType } from "./quote/quoteConstants";
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
  /** Verberg de eigen kop (als een omhullend paneel de titel al levert). */
  hideHeader?: boolean;
  /** Hint vanuit de meetcontext — filtert de catalogus op bijbehorende categorieën. */
  productGroupHint?: MeasurementProductGroup | null;
  /**
   * Beperk de posttypen die de editor aanbiedt (voor de geleide composer):
   * "product" = alleen catalogusproduct, "manual" = alles behalve product, "all" = alles.
   */
  scope?: "all" | "product" | "manual";
  /**
   * Unieke offerte-id. Scope't het concept-vangnet (localStorage) per offerte, zodat een half
   * getypte regel na een mobiele tab-eviction herstelt zonder in een andere offerte te lekken.
   */
  draftScopeId: string;
};

export default function QuoteLineEditor({
  sortOrder,
  templateLines = [],
  session,
  projectRooms = [],
  onAdd,
  mode = "full",
  surface = "panel",
  hideHeader = false,
  productGroupHint = null,
  scope = "all",
  draftScopeId
}: QuoteLineEditorProps) {
  const isFieldMode = mode === "field";
  const availableLineTypes: QuoteLineType[] =
    scope === "product"
      ? ["product"]
      : scope === "manual"
        ? LINE_TYPE_OPTIONS.filter((type) => type !== "product")
        : LINE_TYPE_OPTIONS;
  const [lineType, setLineType] = useState<QuoteLineType>(
    scope === "manual" ? "service" : "product"
  );
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
  const [selectedServiceRule, setSelectedServiceRule] = useState<ServiceRuleRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showServicePicker = isServiceRuleLineType(lineType);

  // Concept-vangnet tegen mobiele tab-eviction: spiegel de nog niet toegevoegde regelinvoer
  // per offerte naar localStorage en zet 'm bij (re)mount terug. De sleutel is uniek per
  // offerte (quoteLineDraftKey) zodat regels niet tussen offertes lekken. Het product wordt in
  // z'n geheel bewaard; de richtprijsvelden staan als tekst al in de invoer. Zie
  // src/lib/quoteLineDraft.ts.
  useFormDraft(
    quoteLineDraftKey(draftScopeId),
    {
      lineType, title, description, quantity, unit,
      unitPriceExVat, vatRate, discountExVat, projectRoomId, selectedProduct
    },
    (draft) => {
      const restored = readQuoteLineDraft(draft);
      if (restored.lineType !== undefined) setLineType(restored.lineType);
      if (restored.title !== undefined) setTitle(restored.title);
      if (restored.description !== undefined) setDescription(restored.description);
      if (restored.quantity !== undefined) setQuantity(restored.quantity);
      if (restored.unit !== undefined) setUnit(restored.unit);
      if (restored.unitPriceExVat !== undefined) setUnitPriceExVat(restored.unitPriceExVat);
      if (restored.vatRate !== undefined) setVatRate(restored.vatRate);
      if (restored.discountExVat !== undefined) setDiscountExVat(restored.discountExVat);
      if (restored.projectRoomId !== undefined) setProjectRoomId(restored.projectRoomId);
      if (restored.selectedProduct !== undefined) setSelectedProduct(restored.selectedProduct);
    }
  );

  useEffect(() => {
    if (lineType !== "product") {
      setSelectedProduct(null);
      setProductError(null);
    }
    if (!isServiceRuleLineType(lineType)) {
      setSelectedServiceRule(null);
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
    setDescription(
      (current) =>
        current ||
        [product.displaySupplierName ?? product.supplier, product.category, product.kleurnaam]
          .filter(Boolean)
          .join(" - ")
    );
  }

  function applyServiceRule(rule: ServiceRuleRow | null) {
    setSelectedServiceRule(rule);

    if (!rule) {
      return;
    }

    // Naam, prijs, btw en eenheid overnemen; beschrijving alleen als die nog leeg is.
    setTitle(rule.name);
    setUnit(calculationTypeToUnit(rule.calculationType));
    setUnitPriceExVat(String(rule.priceExVat));
    setVatRate(String(rule.vatRate));
    setDescription((current) => current || rule.description || "");
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
    setDescription(
      templateLine.omschrijving ? polishQuoteTemplateText(templateLine.omschrijving) : ""
    );
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
    const serviceMetadata =
      showServicePicker && selectedServiceRule
        ? {
            source: "serviceRule",
            serviceRuleId: selectedServiceRule.id,
            calculationType: selectedServiceRule.calculationType
          }
        : undefined;
    const metadata =
      templateMetadata || productMetadata || serviceMetadata
        ? {
            ...(templateMetadata ?? {}),
            ...(productMetadata ?? {}),
            ...(serviceMetadata ?? {})
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
      setSelectedServiceRule(null);
      setProjectRoomId("");
    } catch {
      // Fout is al gemeld via toast in de workspace; behoud de ingevoerde regel.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={surface === "panel" ? "panel form-grid" : "form-grid"} onSubmit={submit}>
      {hideHeader ? null : (
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
      )}
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
                <option
                  value={`${line.sortOrder}-${line.titel}`}
                  key={`${line.sortOrder}-${line.titel}`}
                >
                  {line.sortOrder}. {polishQuoteTemplateText(line.titel)}
                </option>
              ))}
          </Select>
        </Field>
      ) : null}
      {availableLineTypes.length > 1 ? (
        <LineTypeButtons value={lineType} options={availableLineTypes} onChange={setLineType} />
      ) : null}
      <Field htmlFor="line-title" label="Omschrijving" required>
        <Input
          id="line-title"
          readOnly={lineType === "product"}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>
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
            description="Kies een product uit de catalogus; prijs, eenheid en btw worden overgenomen."
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
      {showServicePicker ? (
        <section className="quote-product-picker">
          <SectionHeader
            compact
            title="Werkzaamheid uit de lijst"
            description="Kies een vaste werkzaamheid; naam, prijs, btw en eenheid worden overgenomen. Zelf typen mag ook."
          />
          <ServiceRulePicker
            session={session}
            idPrefix="service-rule"
            selectedRuleId={selectedServiceRule?.id ?? ""}
            onSelect={applyServiceRule}
            label="Werkzaamheid kiezen"
            showPriceInLabel
          />
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
      {scope !== "manual" ? (
        <details className="wallpaper-calculator-details">
          <summary>Behangcalculator openen</summary>
          <WallpaperCalculator
            onUseResult={(result) => {
              setLineType("product");
              setTitle((current) => current || "Behang merk, kleur");
              setDescription(
                (current) => current || "Aantal rollen indicatief berekend met de behangcalculator."
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
