import { Check, ChevronDown, Package, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import { formatEuro } from "../../lib/money";
import { formatMeasurementProductGroup, formatUnit } from "../../lib/i18n/statusLabels";
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
  return [name, color ?? variantCode(product), product.displaySupplierName ?? product.supplier]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Variantaanduiding als er geen kleurnaam is: het artikelnummer. Kleurvarianten
 * van hetzelfde product ("MOD ROOTS 0,55 MATTINA 46580CD" vs "…46930CD") krijgen
 * dezelfde opgeschoonde weergavenaam ("Moduleo Mattina") — zonder dit nummer
 * zijn twee pickerrijen niet uit elkaar te houden en pakt de winkel zomaar de
 * verkeerde kleur.
 */
function variantCode(product: PortalProduct): string | undefined {
  return product.artikelnummer || product.leverancierCode || undefined;
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
  // Oneindig scrollen door de catalogus (10.000+ producten): cursor + einde-vlag.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Generatieteller: een lopende "meer laden" die van een oude filter is, wordt genegeerd.
  const loadGenRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Query-argumenten voor de picker: zoekterm + gekozen categorie/werksoort. Bepalen samen de
  // "filtercontext"; wijzigen ze, dan begint het bladeren opnieuw op pagina 1.
  const queryArgs = useMemo(
    () => ({
      tenantSlug: session.tenantId,
      search: debouncedSearch || undefined,
      limit: 40,
      ...(productGroupHint ? { productGroep: productGroupHint } : {}),
      ...(selectedCategoryId ? { categorieId: selectedCategoryId as Id<"categories"> } : {})
    }),
    [session.tenantId, debouncedSearch, productGroupHint, selectedCategoryId]
  );

  // Eerste pagina (her)laden zodra de dialoog opent of de filtercontext wijzigt. Gesloten
  // pickers doen geen netwerkverkeer (meerdere pickers per pagina bij offerteregels/inmeten).
  useEffect(() => {
    if (!open) {
      return;
    }

    const gen = (loadGenRef.current += 1);
    let cancelled = false;

    async function loadFirstPage() {
      const client = createConvexHttpClient(session);

      if (!client) {
        setError("Kan de catalogus nu niet bereiken.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Bewust géén `cursor` meesturen op de eerste pagina: dan werkt de picker ook nog tegen
        // een prod-backend die de nieuwe args nog niet kent (valt terug op de eerste 30, zonder
        // menu/scroll) i.p.v. te breken. `cursor` gaat alleen mee bij "meer laden" hieronder.
        const result = (await client.query(api.catalog.pickerSearch.searchPickerProducts, {
          ...queryArgs
        })) as { items: PortalProduct[]; isDone?: boolean; nextCursor?: string | null };

        if (cancelled || gen !== loadGenRef.current) {
          return;
        }
        setProducts(result.items ?? []);
        setNextCursor(result.nextCursor ?? null);
        setIsDone(result.isDone ?? true);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setProducts([]);
          setNextCursor(null);
          setIsDone(true);
          setError("Catalogusproducten konden niet worden opgehaald.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFirstPage();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queryArgs]);

  // Volgende pagina bijladen (oneindig scrollen). De generatiecheck negeert een antwoord dat
  // binnenkomt nadat de gebruiker de filter alweer heeft gewijzigd.
  const loadMore = useCallback(async () => {
    if (isDone || isLoadingMore || isLoading || !nextCursor) {
      return;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      return;
    }

    const gen = loadGenRef.current;
    setIsLoadingMore(true);

    try {
      const result = (await client.query(api.catalog.pickerSearch.searchPickerProducts, {
        ...queryArgs,
        cursor: nextCursor
      })) as { items: PortalProduct[]; isDone?: boolean; nextCursor?: string | null };

      if (gen !== loadGenRef.current) {
        return;
      }
      setProducts((prev) => [...prev, ...(result.items ?? [])]);
      setNextCursor(result.nextCursor ?? null);
      setIsDone(result.isDone ?? true);
    } catch (loadError) {
      console.error(loadError);
    } finally {
      if (gen === loadGenRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [session, queryArgs, nextCursor, isDone, isLoadingMore, isLoading]);

  // Vult de lijst tot de scrollruimte gevuld is: als een (deels gefilterde) pagina de hoogte
  // niet vult, is er niets om naar te scrollen — dan laden we automatisch door tot het einde.
  useEffect(() => {
    if (!open || isDone || isLoading || isLoadingMore || !nextCursor) {
      return;
    }
    const el = bodyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) {
      void loadMore();
    }
  }, [open, products, isDone, isLoading, isLoadingMore, nextCursor, loadMore]);

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

  // Groepeer de categorieën per werksoort (Vloeren, Behang, …) voor koppen in de rail.
  // Insertievolgorde = beheer-sortering; categorieën zonder groep landen onder "Overig".
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: PickerCategory[] }>();
    for (const category of menuCategories) {
      const key = category.productGroep ?? "overig";
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: category.productGroep ? formatMeasurementProductGroup(category.productGroep) : "Overig",
          items: []
        };
        groups.set(key, group);
      }
      group.items.push(category);
    }
    return [...groups.values()];
  }, [menuCategories]);

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
    setNextCursor(null);
    setIsDone(false);
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
                {categoryGroups.flatMap((group) => [
                  <span
                    key={`heading-${group.key}`}
                    className="catalog-picker-category-heading"
                    aria-hidden="true"
                  >
                    {group.label}
                  </span>,
                  ...group.items.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`catalog-picker-category${selectedCategoryId === category.id ? " is-active" : ""}`}
                      aria-pressed={selectedCategoryId === category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))
                ])}
              </nav>
            ) : null}

            <div
              className="catalog-picker-body"
              ref={bodyRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
                  void loadMore();
                }
              }}
            >
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
                  : "Geen producten in deze selectie."}
              </p>
            ) : (
              <ul className="catalog-picker-list">
                {products.map((product) => {
                  const price = showPriceInLabel ? productPriceText(product) : null;
                  const name = product.weergaveNaam ?? product.naam;
                  const color =
                    product.kleurnaam && !name.toLowerCase().includes(product.kleurnaam.toLowerCase())
                      ? product.kleurnaam
                      : null;
                  const meta = [
                    // Zonder kleurnaam is het artikelnummer de enige zichtbare
                    // variantaanduiding (zie variantCode).
                    color ?? variantCode(product),
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

            {isLoadingMore ? (
              <p className="catalog-picker-status catalog-picker-status-more">Meer laden…</p>
            ) : null}
            </div>
          </div>
        </div>
      </BaseDialog>
    </Field>
  );
}
