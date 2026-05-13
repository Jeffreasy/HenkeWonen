import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import { formatLineType } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalProduct, PortalRoom, QuoteLineType, QuoteTemplateLine } from "../../lib/portalTypes";
import { polishQuoteTemplateText } from "../../lib/quoteTemplateCopy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import WallpaperCalculator from "./WallpaperCalculator";

export type QuoteLineFormValues = {
  projectRoomId?: string;
  productId?: string;
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
  session: AppSession;
  projectRooms?: PortalRoom[];
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
  session,
  projectRooms = [],
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
  const [projectRoomId, setProjectRoomId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  useEffect(() => {
    if (lineType !== "product") {
      setProducts([]);
      setSelectedProductId("");
      setProductError(null);
      return;
    }

    let isActive = true;

    async function loadProducts() {
      const client = createConvexHttpClient();

      if (!client) {
        setProductError("Kan de catalogus nu niet bereiken.");
        return;
      }

      setIsLoadingProducts(true);
      setProductError(null);

      try {
        const result = (await client.query(api.catalog.listProductsForPortal, {
          tenantSlug: session.tenantId,
          search: productSearch || undefined,
          status: "active",
          limit: 60
        })) as { items: PortalProduct[] };

        if (isActive) {
          setProducts(result.items ?? []);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setProducts([]);
          setProductError("Catalogusproducten konden niet worden opgehaald.");
        }
      } finally {
        if (isActive) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isActive = false;
    };
  }, [lineType, productSearch, session.tenantId]);

  function applyProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    setTitle(product.displayName ?? product.name);
    setUnit(product.unit);
    setUnitPriceExVat(String(product.priceExVat));
    setVatRate(String(product.vatRate));
    setDescription((current) =>
      current ||
      [
        product.displaySupplierName ?? product.supplier,
        product.category,
        product.colorName
      ]
        .filter(Boolean)
        .join(" - ")
    );
  }

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
    if (templateLine.lineType !== "product") {
      setSelectedProductId("");
    }
    setTitle(polishQuoteTemplateText(templateLine.title));
    setDescription(templateLine.description ? polishQuoteTemplateText(templateLine.description) : "");
    setQuantity(String(templateLine.defaultQuantity ?? 1));
    setUnit(templateLine.unit);
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
            sectionKey: selectedTemplateLine.sectionKey,
            categoryHint: selectedTemplateLine.categoryHint,
            productKindHint: selectedTemplateLine.productKindHint
          }).filter(([, value]) => value !== undefined)
        )
      : undefined;
    const productMetadata = selectedProduct
      ? {
          source: "catalog",
          productId: selectedProduct.id,
          displayName: selectedProduct.displayName ?? selectedProduct.name,
          supplier: selectedProduct.displaySupplierName ?? selectedProduct.supplier,
          category: selectedProduct.category,
          articleNumber: selectedProduct.articleNumber,
          supplierCode: selectedProduct.supplierCode,
          commercialCode: selectedProduct.commercialCode
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
      setSelectedProductId("");
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
                {room.name}
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
          <SearchInput
            aria-label="Catalogusproduct zoeken"
            placeholder="Zoek product, Moduleo, kleur, artikelnummer of leverancier"
            value={productSearch}
            onChange={setProductSearch}
          />
          <Field htmlFor="catalog-product" label="Product kiezen" required>
            <Select
              id="catalog-product"
              required
              value={selectedProductId}
              onChange={(event) => applyProduct(event.target.value)}
            >
              <option value="">
                {isLoadingProducts ? "Catalogus laden..." : "Kies een zichtbaar product"}
              </option>
              {products.map((product) => (
                <option value={product.id} key={product.id}>
                  {(product.displayName ?? product.name)} - {product.displaySupplierName ?? product.supplier} - {formatEuro(product.priceExVat)}
                </option>
              ))}
            </Select>
          </Field>
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
