// @vitest-environment jsdom
//
// Regressietest voor de "geleide composer"-scopes. Op de Catalogusproduct-kaart (scope "product")
// hoort ALTIJD de productkiezer te verschijnen. Dat faalde eerder op twee manieren:
//   1. React hergebruikte de editor-instance bij het wisselen van kaart (opgelost met per-kaart
//      keys in QuoteComposer) → getest via de QuoteComposer-kaartwissel hieronder.
//   2. Een corrupt/cross-scope concept in localStorage (bv. een half getypte Werkzaamheid onder
//      de :product-sleutel) zette lineType terug op "service" en lekte bovendien de titel naar de
//      productkaart → getest via de guarded restore + "titel lekt niet"-assert.
// Echte mount/unmount vereist jsdom (per-bestand).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";

// lucide-react resolvet in de jsdom-omgeving z'n eigen React-kopie (dubbele dispatcher →
// "useContext of null"). De iconen zijn puur decoratief; we laden het echte module alleen om de
// export-namen te kennen en vervangen elke export door een lege stub.
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Stub = () => null;
  const mocked: Record<string, unknown> = { __esModule: true, default: Stub };
  for (const name of Object.keys(actual)) {
    mocked[name] = Stub;
  }
  return mocked;
});

// De kiezers doen Convex-calls (ServiceRulePicker meteen bij mount). Deze test gaat over WELKE
// sectie er toont (die koppen leven in QuoteLineEditor zelf, niet in de kiezers), dus stubben we
// de kiezers + de inmeet-picker weg (geen netwerk, geen ruis).
vi.mock("../src/components/catalog/CatalogProductPicker", () => ({ default: () => null }));
vi.mock("../src/components/catalog/ServiceRulePicker", () => ({ default: () => null }));
vi.mock("../src/components/quotes/MeasurementLinePicker", () => ({ default: () => null }));
vi.mock("../src/components/quotes/QuoteMeasurementTools", () => ({
  default: () => "Rekenhulpen-flow actief"
}));

import QuoteLineEditor from "../src/components/quotes/QuoteLineEditor";
import QuoteComposer from "../src/components/quotes/QuoteComposer";
import { quoteLineDraftKey } from "../src/lib/quoteLineDraft";
import type { AppSession } from "../src/lib/auth/session";
import type { QuoteTemplateLine } from "../src/lib/portalTypes";

// React 19 vereist deze vlag rond act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom levert hier geen volledige Storage-API; installeer een echte in-memory Storage.
const memory = new Map<string, string>();
const storage: Storage = {
  getItem: (k) => (memory.has(k) ? (memory.get(k) as string) : null),
  setItem: (k, v) => void memory.set(k, String(v)),
  removeItem: (k) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => Array.from(memory.keys())[i] ?? null,
  get length() {
    return memory.size;
  }
} as Storage;
Object.defineProperty(window, "localStorage", { value: storage, configurable: true });

const session: AppSession = {
  userId: "u1",
  tenantId: "t1",
  email: "test@example.com",
  role: "editor",
  workspaceMode: "general"
};

/** Schrijf een concept-envelope zoals useFormDraft dat intern doet ({ t, d }). */
function seedDraft(draftScopeId: string, data: Record<string, unknown>) {
  window.localStorage.setItem(
    quoteLineDraftKey(draftScopeId),
    JSON.stringify({ t: Date.now(), d: data })
  );
}

async function mountEditor(
  scope: "product" | "manual",
  draftScopeId: string,
  templateLines: QuoteTemplateLine[] = [],
  mode: "full" | "field" = "full"
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      h(QuoteLineEditor, {
        scope,
        draftScopeId,
        session,
        mode,
        sortOrder: 1,
        onAdd: () => undefined,
        // Zoals de composer QuoteLineEditor mount.
        templateLines,
        hideHeader: true,
        surface: "plain"
      })
    );
  });
  // Flush de async load van ServiceRulePicker (setState na mount) binnen act.
  await act(async () => {});
  return {
    root,
    text: () => container.textContent ?? "",
    // Waarde van het (read-only bij product) omschrijvingsveld — zo zien we of een concept lekte.
    titleValue: () =>
      (container.querySelector("#line-title") as HTMLInputElement | null)?.value ?? ""
  };
}

afterEach(() => {
  memory.clear();
  document.body.innerHTML = "";
});

describe("QuoteLineEditor scope-invariant", () => {
  it("toont de productkiezer op de catalogus-kaart zonder concept", async () => {
    memory.clear();
    const view = await mountEditor("product", "quote-1:product");
    expect(view.text()).toContain("Catalogusproduct");
    expect(view.text()).not.toContain("Werkzaamheid uit de lijst");
    expect(view.text()).not.toContain("Behangcalculator openen");
  });

  it("toont ook in field-mode geen tweede behangcalculator", async () => {
    memory.clear();
    const view = await mountEditor("product", "quote-field:product", [], "field");
    expect(view.text()).not.toContain("Behangcalculator openen");
  });

  it("negeert een corrupt cross-scope concept: productkiezer blijft én de titel lekt niet", async () => {
    memory.clear();
    // Een half getypte Werkzaamheid, per ongeluk opgeslagen onder de :product-sleutel.
    seedDraft("quote-1:product", {
      lineType: "service",
      title: "Ondervloer voor PVC",
      description: "hoeveelheid per m² invullen",
      quantity: "1",
      unit: "m2",
      unitPriceExVat: "",
      vatRate: "21",
      discountExVat: "",
      projectRoomId: "",
      selectedProduct: null
    });

    const view = await mountEditor("product", "quote-1:product");
    // De productkiezer hoort te staan; de werkzaamheid-kiezer mag de kaart niet gekaapt hebben.
    expect(view.text()).toContain("Catalogusproduct");
    expect(view.text()).not.toContain("Werkzaamheid uit de lijst");
    // Cruciaal (isoleert de guard, niet de clamp): het cross-scope concept lekt géén enkel veld.
    // Zonder de guarded restore zou "Ondervloer voor PVC" in het omschrijvingsveld belanden.
    expect(view.titleValue()).toBe("");
    expect(view.text()).not.toContain("Ondervloer voor PVC");
  });

  it("herstelt een geldig in-scope concept wél op de handmatig-kaart (incl. de titel)", async () => {
    memory.clear();
    // Bewust een NIET-default type ("material"; de default van scope manual is "service") met een
    // eigen titel, zodat een geslaagde restore aantoonbaar is — niet tautologisch.
    seedDraft("quote-1:manual", {
      lineType: "material",
      title: "Ondervloer voor PVC",
      description: "hoeveelheid per m² invullen",
      quantity: "1",
      unit: "m2",
      unitPriceExVat: "",
      vatRate: "21",
      discountExVat: "",
      projectRoomId: "",
      selectedProduct: null
    });

    const view = await mountEditor("manual", "quote-1:manual");
    // In-scope concept → werkzaamheid-kiezer toont, en de titel is echt hersteld (bewijst restore).
    expect(view.text()).toContain("Werkzaamheid uit de lijst");
    expect(view.text()).not.toContain("Catalogusproduct");
    expect(view.titleValue()).toBe("Ondervloer voor PVC");
  });

  it("verbergt de oude PVC-trapregel maar behoudt andere handmatige trapregels", async () => {
    const legacyPvcTitle = "Traprenovatie PVC fabrikant, kleur, kleur strip";
    const carpetTitle = "Traprenovatie tapijt fabrikant en kleur";
    const view = await mountEditor("manual", "quote-1:manual", [
      {
        sectieSleutel: "traprenovatie",
        regelType: "manual",
        titel: legacyPvcTitle,
        eenheid: "post",
        sortOrder: 1
      },
      {
        sectieSleutel: "traprenovatie",
        regelType: "manual",
        titel: carpetTitle,
        eenheid: "post",
        sortOrder: 2
      }
    ]);

    expect(view.text()).not.toContain(legacyPvcTitle);
    expect(view.text()).toContain(carpetTitle);
  });
});
describe("QuoteComposer kaartwissel (pad 1: remount)", () => {
  const PRODUCT_MARKER = "Kies een product uit de catalogus"; // uniek voor de productsectie
  const SERVICE_MARKER = "Werkzaamheid uit de lijst"; // uniek voor de werkzaamheidsectie
  const CALCULATOR_MARKER = "Rekenhulpen-flow actief";

  async function mountComposer(mode: "full" | "field" = "full") {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        h(QuoteComposer, {
          mode,
          session,
          sortOrder: 1,
          templateLines: [],
          projectRooms: [],
          productGroupHint: null,
          quoteId: "quote-9",
          projectId: "project-9",
          tenantSlug: "henke-wonen",
          onAddLine: () => undefined,
          showMeasurement: mode === "full"
        })
      );
    });
    await act(async () => {});
    function clickMethod(titleText: string) {
      const button = [
        ...container.querySelectorAll<HTMLButtonElement>("button.quote-composer-method")
      ].find((candidate) => candidate.textContent?.includes(titleText));
      if (!button) {
        throw new Error(`methode-knop niet gevonden: ${titleText}`);
      }
      act(() => button.click());
    }
    return {
      text: () => container.textContent ?? "",
      clickMethod,
      methodTitles: () =>
        Array.from(container.querySelectorAll<HTMLElement>(".quote-composer-method-title")).map(
          (title) => title.textContent?.trim() ?? ""
        )
    };
  }

  it("toont weer de productkiezer op Catalogusproduct ná een wissel naar Werkzaamheid en terug", async () => {
    memory.clear();
    const view = await mountComposer();

    // Start: catalogus-kaart → productsectie.
    expect(view.text()).toContain(PRODUCT_MARKER);
    expect(view.text()).not.toContain(SERVICE_MARKER);

    // Naar de handmatig-kaart → werkzaamheidsectie.
    view.clickMethod("Werkzaamheid of handmatig");
    expect(view.text()).toContain(SERVICE_MARKER);
    expect(view.text()).not.toContain(PRODUCT_MARKER);

    // Terug naar de catalogus-kaart → productsectie hoort terug te komen (dit faalde vóór de fix).
    view.clickMethod("Catalogusproduct");
    expect(view.text()).toContain(PRODUCT_MARKER);
    expect(view.text()).not.toContain(SERVICE_MARKER);
  });

  it("toont Rekenhulpen als vierde methode en wisselt zonder andere flow te laten staan", async () => {
    memory.clear();
    const view = await mountComposer();

    expect(view.text()).toContain("Rekenhulpen");
    expect(view.text()).not.toContain(CALCULATOR_MARKER);
    expect(view.methodTitles()).toEqual([
      "Catalogusproduct",
      "Werkzaamheid of handmatig",
      "Inmeting overnemen",
      "Rekenhulpen"
    ]);

    view.clickMethod("Rekenhulpen");
    expect(view.text()).toContain(CALCULATOR_MARKER);
    expect(view.text()).not.toContain(PRODUCT_MARKER);
    expect(view.text()).not.toContain(SERVICE_MARKER);

    view.clickMethod("Catalogusproduct");
    expect(view.text()).toContain(PRODUCT_MARKER);
    expect(view.text()).not.toContain(CALCULATOR_MARKER);
  });

  it("beperkt field-mode tot de twee lokale postmethodes", async () => {
    memory.clear();
    const view = await mountComposer("field");

    expect(view.methodTitles()).toEqual(["Catalogusproduct", "Werkzaamheid of handmatig"]);
    expect(view.text()).not.toContain("Rekenhulpen");
    expect(view.text()).not.toContain("Behangcalculator openen");
  });
});
