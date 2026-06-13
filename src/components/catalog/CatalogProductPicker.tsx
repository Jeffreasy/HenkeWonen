import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import type { MeasurementProductGroup, PortalProduct } from "../../lib/portalTypes";
import { Alert } from "../ui/Alert";
import { Field } from "../ui/Field";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";

type CatalogProductPickerProps = {
  session: AppSession;
  /** Uniek prefix voor DOM-ids zodat meerdere pickers op één pagina kunnen staan. */
  idPrefix: string;
  /** Filtert de catalogus server-side op de categorieën van deze meetproductgroep. */
  productGroupHint?: MeasurementProductGroup | null;
  selectedProductId: string;
  /** Weergavenaam van de huidige keuze, voor als die buiten de zoekresultaten valt. */
  selectedProductLabel?: string;
  onSelect: (product: PortalProduct | null) => void;
  label?: string;
  description?: string;
  emptyOptionLabel?: string;
  required?: boolean;
  /** Toon de verkoopprijs in het optielabel (offertebouwer-gedrag). */
  showPriceInLabel?: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Herbruikbare catalogus-productkiezer: label → zoekveld → keuzelijst.
 * Zoekt server-side via searchPickerProducts (search-index + categorie-indexen
 * van de productgroep); pilotregels en klantveilige prijzen gelden automatisch.
 */
export default function CatalogProductPicker({
  session,
  idPrefix,
  productGroupHint = null,
  selectedProductId,
  selectedProductLabel,
  onSelect,
  label = "Product",
  description,
  emptyOptionLabel = "Geen product gekozen",
  required = false,
  showPriceInLabel = false
}: CatalogProductPickerProps) {
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
        const result = (await client.query(api.catalog.pickerSearch.searchPickerProducts, {
          tenantSlug: session.tenantId,
          search: debouncedSearch || undefined,
          limit: 30,
          ...(productGroupHint ? { productGroup: productGroupHint } : {})
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
  }, [debouncedSearch, session.tenantId, productGroupHint]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function optionLabel(product: PortalProduct) {
    const parts = [
      product.displayName ?? product.name,
      product.colorName,
      product.displaySupplierName ?? product.supplier
    ].filter(Boolean);

    let text = parts.join(" — ");

    if (showPriceInLabel && product.priceExVat > 0) {
      text += ` — ${formatEuro(product.priceExVat)}`;
    }

    return text;
  }

  return (
    <Field htmlFor={`${idPrefix}-product`} label={label} description={description} required={required}>
      <div className="grid" style={{ gap: 8 }}>
        <SearchInput
          aria-label="Catalogusproduct zoeken"
          placeholder="Zoek op naam, kleur, artikelnummer of merk"
          value={search}
          onChange={setSearch}
          onKeyDown={(event) => {
            // Enter in het zoekveld mag het omliggende (rekenhulp)formulier niet submitten.
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
        />
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
          <option value="">
            {isLoading
              ? "Catalogus laden..."
              : products.length === 0
                ? debouncedSearch
                  ? "Geen producten gevonden — pas de zoekterm aan"
                  : emptyOptionLabel
                : emptyOptionLabel}
          </option>
          {selectedProductId && !selectedProduct ? (
            <option value={selectedProductId}>
              {selectedProductLabel ?? "Gekozen product (buiten huidige zoekresultaten)"}
            </option>
          ) : null}
          {products.map((product) => (
            <option value={product.id} key={product.id}>
              {optionLabel(product)}
            </option>
          ))}
        </Select>
        {error ? <Alert variant="warning" description={error} /> : null}
      </div>
    </Field>
  );
}
