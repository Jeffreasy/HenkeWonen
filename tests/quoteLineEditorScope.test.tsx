// @vitest-environment jsdom
//
// Regressietest voor de "geleide composer"-scopes van QuoteLineEditor. Op de Catalogusproduct-
// kaart (scope "product") hoort ALTIJD de productkiezer te verschijnen. Er zijn twee manieren
// waarop dat eerder faalde:
//   1. React hergebruikte de editor-instance bij het wisselen van kaart (opgelost met per-kaart
//      keys in QuoteComposer).
//   2. Een corrupt/cross-scope concept in localStorage (bv. een half getypte Werkzaamheid onder
//      de :product-sleutel, uit een sessie van vóór de per-scope-keys) zette lineType terug op
//      "service" → de werkzaamheid-kiezer kaapte de kaart en de productkiezer verdween.
// Deze test dekt (2): het corrupte concept mag de scope niet kapen, terwijl een geldig in-scope
// concept nog wél netjes herstelt. Echte mount/unmount vereist jsdom (per-bestand).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";

// lucide-react resolvet in de jsdom-omgeving z'n eigen React-kopie (dubbele dispatcher →
// "useContext of null"). De iconen zijn puur decoratief en irrelevant voor deze test (we
// toetsen sectiekop-tekst). We laden het echte module alleen om de export-namen te kennen
// en vervangen elke export door een lege stub, zodat geen enkel lucide-icoon ooit rendert.
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Stub = () => null;
  const mocked: Record<string, unknown> = { __esModule: true, default: Stub };
  for (const name of Object.keys(actual)) {
    mocked[name] = Stub;
  }
  return mocked;
});

// De twee kiezers doen Convex-calls (ServiceRulePicker zelfs meteen bij mount). Deze test gaat
// niet over de kiezer-inhoud maar over WELKE sectie QuoteLineEditor toont op basis van lineType/
// scope — die sectiekoppen ("Catalogusproduct" / "Werkzaamheid uit de lijst") leeft in
// QuoteLineEditor zelf, niet in de kiezers. Dus stubben we de kiezers weg (geen netwerk, geen ruis).
vi.mock("../src/components/catalog/CatalogProductPicker", () => ({ default: () => null }));
vi.mock("../src/components/catalog/ServiceRulePicker", () => ({ default: () => null }));

import QuoteLineEditor from "../src/components/quotes/QuoteLineEditor";
import { quoteLineDraftKey } from "../src/lib/quoteLineDraft";
import type { AppSession } from "../src/lib/auth/session";

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

async function mountEditor(scope: "product" | "manual", draftScopeId: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      h(QuoteLineEditor, {
        scope,
        draftScopeId,
        session,
        sortOrder: 1,
        onAdd: () => undefined,
        // Zoals de composer QuoteLineEditor mount.
        hideHeader: true,
        surface: "plain"
      })
    );
  });
  // Flush de async load van ServiceRulePicker (setState na mount) binnen act.
  await act(async () => {});
  return { root, text: () => container.textContent ?? "" };
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
  });

  it("negeert een corrupt cross-scope concept: catalogus-kaart blijft de productkiezer tonen", async () => {
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
  });

  it("herstelt een geldig in-scope werkzaamheid-concept wél op de handmatig-kaart", async () => {
    memory.clear();
    // Zelfde soort concept, maar nu op de handmatig-kaart waar "service" gewoon geldig is.
    seedDraft("quote-1:manual", {
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

    const view = await mountEditor("manual", "quote-1:manual");
    // Hier hoort de werkzaamheid-kiezer wél te herstellen (guard blokkeert alleen buiten scope).
    expect(view.text()).toContain("Werkzaamheid uit de lijst");
    expect(view.text()).not.toContain("Catalogusproduct");
  });
});
