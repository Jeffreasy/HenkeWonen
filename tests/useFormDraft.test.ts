// @vitest-environment jsdom
//
// useFormDraft is de gedeelde hook achter alle concept-vangnetten tegen mobiele tab-eviction
// (inmeting: measurementAssignDraft; offerte: quoteLineDraft). De pure helpers eromheen zijn
// elders getest; deze test dekt de hook zelf: schrijven naar localStorage, éénmalig herstellen
// bij mount, de TTL en veilige afhandeling van een corrupt concept. Dat vraagt een echte
// mount/unmount-cyclus, vandaar de jsdom-omgeving (per-bestand, de rest van de suite blijft node).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { useFormDraft } from "../src/lib/useFormDraft";

// React 19 vereist deze vlag rond act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// De jsdom hier levert geen volledige Storage-API; installeer een echte in-memory Storage zodat
// useFormDraft's window.localStorage-calls tegen echte opslag-semantiek draaien.
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

const KEY = "henke-testconcept";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Een testcomponent die useFormDraft precies gebruikt zoals de echte formulieren. */
function Probe({ storageKey = KEY }: { storageKey?: string }) {
  const [value, setValue] = useState("");
  const { clear } = useFormDraft(storageKey, { value }, (draft) => {
    if (typeof draft.value === "string") setValue(draft.value);
  });
  return h(
    "div",
    null,
    h("span", { "data-testid": "value" }, value || "—"),
    h("button", { "data-testid": "set", onClick: () => setValue("ingevuld") }, "set"),
    h("button", { "data-testid": "clear", onClick: () => clear() }, "clear")
  );
}

function mount(storageKey = KEY) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(h(Probe, { storageKey })));
  const text = (id: string) =>
    container.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
  const click = (id: string) =>
    act(() => container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click());
  return { container, root, text, click };
}

/** Schrijf een concept-envelope zoals useFormDraft dat intern doet. */
function seed(storageKey: string, data: unknown, ageMs = 0) {
  window.localStorage.setItem(storageKey, JSON.stringify({ t: Date.now() - ageMs, d: data }));
}

afterEach(() => {
  memory.clear();
  document.body.innerHTML = "";
});

describe("useFormDraft", () => {
  it("start leeg wanneer er geen concept is", () => {
    memory.clear();
    expect(mount().text("value")).toBe("—");
  });

  it("spiegelt wijzigingen naar localStorage", () => {
    memory.clear();
    const view = mount();
    view.click("set");

    expect(view.text("value")).toBe("ingevuld");
    const raw = window.localStorage.getItem(KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { t: number; d: { value: string } };
    expect(parsed.d.value).toBe("ingevuld");
    expect(typeof parsed.t).toBe("number");
  });

  it("herstelt het concept bij een verse mount (tab-eviction-cyclus)", () => {
    memory.clear();
    const first = mount();
    first.click("set");
    act(() => first.root.unmount()); // tab weggegooid

    const second = mount(); // tab terug -> verse mount leest het concept
    expect(second.text("value")).toBe("ingevuld");
  });

  it("herstelt alleen bij mount, niet opnieuw na een latere externe wijziging", () => {
    memory.clear();
    const view = mount(); // leeg concept -> begint leeg
    expect(view.text("value")).toBe("—");

    // Externe wijziging aan het opgeslagen concept ná de eerste mount...
    seed(KEY, { value: "extern" });
    // ...een latere re-render (gebruikersactie) mag het concept niet opnieuw inladen.
    view.click("set");
    expect(view.text("value")).toBe("ingevuld"); // niet "extern" -> restore liep maar één keer
  });

  it("negeert (en herstelt niet) een concept ouder dan de TTL van 24u", () => {
    memory.clear();
    seed(KEY, { value: "oud" }, DAY_MS + 60_000); // 24u + 1min oud
    expect(mount().text("value")).toBe("—");
  });

  it("herstelt een concept dat net binnen de TTL valt", () => {
    memory.clear();
    seed(KEY, { value: "vers" }, DAY_MS - 60_000); // net geen 24u oud
    expect(mount().text("value")).toBe("vers");
  });

  it("negeert corrupte of onvolledige concepten zonder te crashen", () => {
    memory.clear();
    window.localStorage.setItem(KEY, "{ dit is geen geldige json");
    expect(mount().text("value")).toBe("—");

    memory.clear();
    window.localStorage.setItem(KEY, JSON.stringify({ t: 123 })); // geen d
    expect(mount().text("value")).toBe("—");

    memory.clear();
    window.localStorage.setItem(KEY, JSON.stringify({ t: "nan", d: { value: "x" } })); // t geen number
    expect(mount().text("value")).toBe("—");
  });

  it("houdt concepten per sleutel gescheiden", () => {
    memory.clear();
    seed("henke-testconcept-A", { value: "A" });
    seed("henke-testconcept-B", { value: "B" });
    expect(mount("henke-testconcept-A").text("value")).toBe("A");
    expect(mount("henke-testconcept-B").text("value")).toBe("B");
  });

  it("clear() verwijdert het concept uit localStorage", () => {
    memory.clear();
    const view = mount();
    view.click("set");
    expect(window.localStorage.getItem(KEY)).toBeTruthy();

    view.click("clear");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
