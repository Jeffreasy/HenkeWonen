import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import type { MeasurementProductGroup, PortalProduct } from "../../lib/portalTypes";
import { getAllowedCategories } from "../../lib/quotes/measurementCatalogMapping";
import { Alert } from "../ui/Alert";
import { Field } from "../ui/Field";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";

type CatalogProductPickerProps = {
  session: AppSession;
  /** Uniek prefix voor DOM-ids zodat meerdere pickers op één pagina kunnen staan. */
  idPrefix: string;
  /** Filtert de catalogus op de categorieën van deze meetproductgroep. */
  productGroupHint?: MeasurementProductGroup | null;
  selectedProductId: string;
  onSelect: (product: PortalProduct | null) => void;
  label?: string;
  description?: string;
  emptyOptionLabel?: string;
  required?: boolean;
  showFilterHint?: boolean;
  /** Toon de portal-prijs in het optielabel (offertebouwer-gedrag). */
  showPriceInLabel?: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Herbruikbare catalogus-productkiezer (zoekveld + select), geëxtraheerd uit
 * QuoteLineEditor zodat de inmeetmodule dezelfde picker gebruikt.
 * Pilotregels (PVC Click verborgen, Roots→Moduleo) gelden automatisch via
 * listProductsForPortal.
 */
export default function CatalogProductPicker({
  session,
  idPrefix,
  productGroupHint = null,
  selectedProductId,
  onSelect,
  label = "Product kiezen",
  description,
  emptyOptionLabel = "Kies een zichtbaar product",
  required = false,
  showFilterHint = false,
  showPriceInLabel = false
}: CatalogProductPickerProps) {
  const allowedCategories = getAllowedCategories(productGroupHint);
  const allowedCategoriesKey = allowedCategories?.join("|") ?? "";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      const client = createConvexHttpClient(session);

      if (!client) {
        setError("Kan de catalogus nu niet bereiken.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = (await client.query(api.catalog.core.listProductsForPortal, {
          tenantSlug: session.tenantId,
          search: debouncedSearch || undefined,
          status: "active",
          limit: 60,
          ...(allowedCategories ? { categories: allowedCategories } : {})
        })) as { items: PortalProduct[] };

        if (isActive) {
          setProducts(result.items ?? []);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setProducts([]);
          setError("Catalogusproducten konden niet worden opgehaald.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isActive = false;
    };
    // allowedCategoriesKey dekt de inhoud van allowedCategories (afgeleid van productGroupHint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, session.tenantId, allowedCategoriesKey]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  return (
    <div className="grid">
      {showFilterHint && allowedCategories ? (
        <p className="quote-catalog-filter-hint muted">
          Gefilterd op: {allowedCategories.join(", ")}
        </p>
      ) : null}
      <SearchInput
        aria-label="Catalogusproduct zoeken"
        placeholder="Zoek product, Moduleo, kleur, artikelnummer of leverancier"
        value={search}
        onChange={setSearch}
        onKeyDown={(event) => {
          // Enter in het zoekveld mag het omliggende (rekenhulp)formulier niet submitten.
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
      />
      <Field htmlFor={`${idPrefix}-product`} label={label} description={description} required={required}>
        <Select
          id={`${idPrefix}-product`}
          required={required}
          value={selectedProductId}
          onChange={(event) => {
            const productId = event.target.value;

            if (!productId) {
              onSelect(null);
              return;
            }

            const product = products.find((item) => item.id === productId) ?? null;
            onSelect(product);
          }}
        >
          <option value="">{isLoading ? "Catalogus laden..." : emptyOptionLabel}</option>
          {selectedProductId && !selectedProduct ? (
            <option value={selectedProductId}>Gekozen product (buiten huidige zoekresultaten)</option>
          ) : null}
          {products.map((product) => (
            <option value={product.id} key={product.id}>
              {(product.displayName ?? product.name)} - {product.displaySupplierName ?? product.supplier}
              {showPriceInLabel ? ` - ${formatEuro(product.priceExVat)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <Alert variant="warning" description={error} /> : null}
    </div>
  );
}
