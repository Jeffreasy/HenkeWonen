import { Check, ChevronDown, Package, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import { formatUnit } from "../../lib/i18n/statusLabels";
import type { MeasurementProductGroup, PortalProduct } from "../../lib/portalTypes";
import { Alert } from "../ui/feedback/Alert";
import { Field } from "../ui/forms/Field";
import { IconButton } from "../ui/forms/IconButton";
import { SearchInput } from "../ui/forms/SearchInput";
import { BaseDialog } from "../ui/overlays/BaseDialog";

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

/** Categorie voor het menu in de zoekdialoog (data-driven uit /instellingen/categorieen). */
type PickerCategory = {
  id: string;
  name: string;
  productGroep: MeasurementProductGroup | null;
  sortOrder: number;
};

/** Korte, éénregelige samenvatting van een product (voor de triggerknop). */
function productSummaryText(product: PortalProduct): string {
  const name = product.weergaveNaam ?? product.naam;
  const normalizedName = name.toLowerCase();
  // Kleur weglaten als die al in de (schone) naam zit, anders staat hij dubbel.
  const color =
    product.kleurnaam && !normalizedName.includes(product.kleurnaam.toLowerCase())
      ? product.kleurnaam
      : undefined;
  return [name, color, product.displaySupplierName ?? product.supplier].filter(Boolean).join(" — ");
}

/** Prijs + eenheid, of null als er geen (klantveilige) prijs is. */
function productPriceText(product: PortalProduct): string | null {
  if (!(product.prijsExBtw > 0)) {
    return null;
  }
  const unitSuffix = product.prijsEenheid ? ` / ${formatUnit(product.prijsEenheid)}` : "";
  return `${formatEuro(product.prijsExBtw)}${unitSuffix}`;
}

/**
 * Herbruikbare catalogus-productkiezer.
 *
 * Vervangt de vroegere zoekveld-plus-<select> door een triggerknop die een
 * zoekdialoog (BaseDialog) opent met grote, tikbare resultaatrijen — veel
 * prettiger bij duizenden producten, zeker op de inmeet-tablet. De catalogus
 * wordt alleen geladen zolang de dialoog open is (server-side via
 * searchPickerProducts; pilotregels en klantveilige prijzen gelden automatisch).
 *
 * Drop-in vervanger: zelfde props en onSelect-contract als voorheen.
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
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Onthoud het label van de laatst gekozen keuze, zodat de trigger ook klopt
  // wanneer het product buiten de (weer opgevraagde) zoekresultaten valt.
  const [lastSelected, setLastSelected] = useState<{ id: string; label: string } | null>(null);
  // Categorie-menu (data-driven): éénmalig geladen bij openen; null = "Alles".
  const [categories, setCategories] = useState<PickerCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Alleen laden zolang de dialoog open is: gesloten pickers doen geen
  // netwerkverkeer (meerdere pickers per pagina bij offerteregels/inmeten).
  useEffect(() => {
    if (!open) {
      return;
    }

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
          ...(productGroupHint ? { productGroep: productGroupHint } : {}),
          ...(selectedCategoryId ? { categorieId: selectedCategoryId as Id<"categories"> } : {})
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
    // session.tenantId (niet het session-object) als dep: voorkomt een onnodige
    // her-fetch als de ouder een nieuwe session-referentie doorgeeft. De query
    // hangt alleen van tenantId af; het session-object wordt enkel doorgegeven
    // aan de client-factory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedSearch, session.tenantId, productGroupHint, selectedCategoryId]);

  // Categorieën voor het menu éénmalig laden bij openen (los van de zoekterm). Degradeert
  // netjes: bestaat de query nog niet op de backend (vóór de deploy), dan blijft het menu leeg
  // en werkt zoeken precies zoals voorheen.
  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;

    async function loadCategories() {
      const client = createConvexHttpClient(session);

      if (!client) {
        return;
      }

      try {
        const result = (await client.query(api.catalog.pickerSearch.pickerCategories, {
          tenantSlug: session.tenantId
        })) as PickerCategory[];

        if (isActive) {
          setCategories(result ?? []);
        }
      } catch (loadError) {
        console.error(loadError);
        if (isActive) {
          setCategories([]);
        }
      }
    }

    void loadCategories();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.tenantId]);

  const selectedInResults = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  // In de meetcontext (productGroupHint gezet) tonen we alleen de categorieën van díé werksoort;
  // in de winkel (geen hint) de hele catalogus. Menu pas tonen als er echt iets te kiezen valt.
  const menuCategories = useMemo(
    () =>
      productGroupHint
        ? categories.filter((category) => category.productGroep === productGroupHint)
        : categories,
    [categories, productGroupHint]
  );
  const showCategoryMenu = menuCategories.length >= 2;

  // Triggertekst: eerst het product uit de resultaten, dan het onthouden label,
  // dan het door de ouder meegegeven label, dan een generieke terugval.
  const triggerText = (() => {
    if (!selectedProductId) {
      return null;
    }
    if (selectedInResults) {
      return productSummaryText(selectedInResults);
    }
    if (lastSelected && lastSelected.id === selectedProductId) {
      return lastSelected.label;
    }
    return selectedProductLabel ?? "Gekozen product";
  })();

  function choose(product: PortalProduct | null) {
    if (product) {
      setLastSelected({ id: product.id, label: productSummaryText(product) });
    }
    onSelect(product);
    setOpen(false);
  }

  function openDialog() {
    // Vorige resultaten wegzetten zodat een heropende dialoog niet even de oude
    // lijst toont (en Enter dus niet een verouderd product kan kiezen) voordat
    // de verse zoekopdracht binnen is.
    setSearch("");
    setDebouncedSearch("");
    setProducts([]);
    setSelectedCategoryId(null);
    setOpen(true);
  }

  // Resultaten horen bij debouncedSearch; zolang de gebruiker nog typt of de
  // fetch loopt, zijn ze "in beweging" en mag Enter niet de eerste treffer kiezen.
  const resultsSettled = !isLoading && debouncedSearch === search.trim();

  return (
    <Field
      htmlFor={`${idPrefix}-product`}
      label={label}
      description={description}
      required={required}
    >
      <button
        type="button"
        id={`${idPrefix}-product`}
        className={`ui-control catalog-picker-trigger${triggerText ? "" : " is-placeholder"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={description ? `${idPrefix}-product-desc` : undefined}
        onClick={openDialog}
      >
        <Package size={16} aria-hidden="true" className="catalog-picker-trigger-icon" />
        <span className="catalog-picker-trigger-label">{triggerText ?? "Kies een product…"}</span>
        <ChevronDown size={16} aria-hidden="true" className="catalog-picker-trigger-chevron" />
      </button>

      <BaseDialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabelledBy={titleId}
        className="catalog-picker-dialog"
      >
        <div className={`catalog-picker-panel${showCategoryMenu ? " has-categories" : ""}`}>
          <div className="catalog-picker-header">
            <h2 id={titleId} className="catalog-picker-title">
              {label}
            </h2>
            <IconButton aria-label="Sluiten" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X size={18} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="catalog-picker-search">
            <SearchInput
              aria-label="Catalogusproduct zoeken"
              placeholder="Zoek op naam, kleur, artikelnummer of merk"
              value={search}
              onChange={setSearch}
              data-autofocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Geen formulier submitten; Enter kiest de eerste treffer —
                  // maar alleen als de lijst bij de huidige zoekterm hoort.
                  event.preventDefault();
                  if (resultsSettled && products.length > 0) {
                    choose(products[0]);
                  }
                }
              }}
            />
          </div>

          <div className="catalog-picker-layout">
            {showCategoryMenu ? (
              <nav className="catalog-picker-categories" aria-label="Filter op categorie">
                <button
                  type="button"
                  className={`catalog-picker-category${selectedCategoryId === null ? " is-active" : ""}`}
                  aria-pressed={selectedCategoryId === null}
                  onClick={() => setSelectedCategoryId(null)}
                >
                  Alles
                </button>
                {menuCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`catalog-picker-category${selectedCategoryId === category.id ? " is-active" : ""}`}
                    aria-pressed={selectedCategoryId === category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
            ) : null}

            <div className="catalog-picker-body">
            {error ? <Alert variant="warning" description={error} /> : null}

            {!required && selectedProductId ? (
              <button
                type="button"
                className="catalog-picker-option catalog-picker-option-clear"
                onClick={() => choose(null)}
              >
                <span className="catalog-picker-option-main">{emptyOptionLabel}</span>
              </button>
            ) : null}

            {isLoading ? (
              <p className="catalog-picker-status">Catalogus laden…</p>
            ) : products.length === 0 ? (
              <p className="catalog-picker-status">
                {debouncedSearch
                  ? "Geen producten gevonden — pas de zoekterm aan."
                  : "Begin met typen om te zoeken in de catalogus."}
              </p>
            ) : (
              <ul className="catalog-picker-list">
                {products.map((product) => {
                  const price = showPriceInLabel ? productPriceText(product) : null;
                  const name = product.weergaveNaam ?? product.naam;
                  const meta = [
                    product.kleurnaam && !name.toLowerCase().includes(product.kleurnaam.toLowerCase())
                      ? product.kleurnaam
                      : null,
                    product.displaySupplierName ?? product.supplier
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const isActive = product.id === selectedProductId;

                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className={`catalog-picker-option${isActive ? " is-active" : ""}`}
                        aria-current={isActive || undefined}
                        onClick={() => choose(product)}
                      >
                        <span className="catalog-picker-option-text">
                          <span className="catalog-picker-option-main">{name}</span>
                          {meta ? <span className="catalog-picker-option-meta">{meta}</span> : null}
                        </span>
                        {price ? <span className="catalog-picker-option-price">{price}</span> : null}
                        {isActive ? (
                          <Check size={16} aria-hidden="true" className="catalog-picker-option-check" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </div>
        </div>
      </BaseDialog>
    </Field>
  );
}
