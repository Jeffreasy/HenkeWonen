// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AppSession } from "../src/lib/auth/session";
import type { PortalProduct } from "../src/lib/portalTypes";

const mutationMock = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 2 }));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Stub = () => null;
  const mocked: Record<string, unknown> = { __esModule: true, default: Stub };
  for (const name of Object.keys(actual)) {
    mocked[name] = Stub;
  }
  return mocked;
});

vi.mock("../src/components/catalog/CatalogProductPicker", () => ({
  default: () => null
}));

vi.mock("../src/lib/convex/client", () => ({
  createConvexHttpClient: () => ({
    query: async () => [
      {
        _id: "service-half-turn",
        productId: "service-product-half-turn",
        sku: "HW-DIENST-014",
        naam: "PVC trap halve draai",
        berekeningType: "stairs",
        prijsExBtw: 495,
        btwTarief: 21,
        status: "active",
        verkoopEenheid: "piece",
        eenheid: "piece",
        productGroup: "stairs",
        serviceFamily: "stair_renovation",
        covering: "pvc",
        stairShape: "half_turn",
        serviceRole: "base_labor",
        sectionKey: "traprenovatie"
      }
    ],
    mutation: mutationMock
  })
}));

import MeasurementAssignPanel, {
  type MeasurementAssignLine,
  type MeasurementAssignPanelProps
} from "../src/components/projects/measurement/MeasurementAssignPanel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session: AppSession = {
  userId: "user-1",
  tenantId: "tenant-1",
  email: "test@example.com",
  role: "editor",
  workspaceMode: "general",
  authzToken: "test-authz-token"
};

function stairProduct(
  id: string,
  sku: string,
  unit: "step" | "pack" | "m1",
  name: string
): PortalProduct {
  return {
    id,
    tenantId: "tenant-1",
    sku,
    productAard: "standard",
    category: "PVC traprenovatie",
    supplier: "Gelasta",
    displaySupplierName: "Gelasta",
    naam: name,
    weergaveNaam: name,
    eenheid: unit,
    verkoopEenheid: unit,
    bestelEenheid: "pack",
    stuksPerPak: unit === "step" ? 4 : 1,
    prijsExBtw: unit === "step" ? 29.95 : 119.8,
    prijsEenheid: unit,
    btwTarief: 21,
    status: "active"
  };
}

const primaryProduct = stairProduct(
  "product-primary",
  "5635380011",
  "step",
  "PVC traptredenset Natural Oak"
);
const doubleTreadProduct = stairProduct(
  "product-double",
  "5646520011",
  "pack",
  "PVC dubbele trede Natural Oak"
);

const secondPrimaryProduct = stairProduct(
  "product-primary-2",
  "5637160011",
  "step",
  "PVC traptredenset Smoked Oak"
);
const profileProduct = stairProduct(
  "product-profile",
  "5607145111",
  "m1",
  "PVC trapneusprofiel zilver 3 meter"
);

function seedDraft(measurementId: string, stairMaterials: PortalProduct[], extra = {}) {
  window.localStorage.setItem(
    `henke-meetinvoer-${measurementId}`,
    JSON.stringify({
      t: Date.now(),
      d: {
        addType: "trap",
        stairCovering: "pvc",
        stairShape: "half_turn",
        stairConstruction: "closed",
        treadCount: "13",
        riserCount: "",
        doubleTreadCount: "",
        stripLengthM: "",
        materialCompatibilityConfirmed: false,
        stairMaterials: stairMaterials.map((product) => ({ product })),
        ...extra
      }
    })
  );
}

type MountedPanel = {
  container: HTMLDivElement;
  root: Root;
  submitButton: () => HTMLButtonElement;
};

async function mountPanel(
  measurementId: string,
  stairMaterials: PortalProduct[],
  extra: Record<string, unknown> = {},
  overrides: Partial<MeasurementAssignPanelProps> = {}
): Promise<MountedPanel> {
  seedDraft(overrides.draftScopeId ?? measurementId, stairMaterials, extra);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      h(MeasurementAssignPanel, {
        session,
        tenantSlug: "henke-wonen",
        tenantConvexId: "tenant-1",
        measurementId,
        rooms: [{ _id: "room-1", naam: "Trap", sortOrder: 1 }],
        canEdit: true,
        selectedRoomIds: ["room-1"],
        onSelectedRoomIdsChange: () => undefined,
        onAdded: () => undefined,
        roomPresets: [],
        initialAddType: "trap",
        ...overrides
      })
    );
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return {
    container,
    root,
    submitButton: () => {
      const expectedLabel = overrides.submitLabel?.trim() || "Toevoegen aan";
      const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
        candidate.textContent?.includes(expectedLabel)
      );
      if (!button) throw new Error("Toevoegknop niet gevonden.");
      return button;
    }
  };
}

function inputValue(container: HTMLElement, id: string): string {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Input ${id} niet gevonden.`);
  return input.value;
}

async function changeInput(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Input ${id} niet gevonden.`);
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(async () => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  mutationMock.mockClear();
  mutationMock.mockResolvedValue({ count: 2 });
});

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = "";
});

describe("geleide PVC-trapcalculator", () => {
  it("herberekent verkoop- en bestelhoeveelheid live wanneer het aantal treden wijzigt", async () => {
    const view = await mountPanel("measurement-live", [primaryProduct]);

    expect(inputValue(view.container, "assign-stair-material-product-primary")).toBe("13");
    expect(view.container.textContent).toContain("Besteladvies: 4 pak");
    expect(view.container.textContent).toContain("Trapcalculator v1");
    expect(view.submitButton().disabled).toBe(false);

    await changeInput(view.container, "assign-tread-count", "9");

    expect(inputValue(view.container, "assign-stair-material-product-primary")).toBe("9");
    expect(view.container.textContent).toContain("Besteladvies: 3 pak");
    expect(view.submitButton().disabled).toBe(false);
    await act(async () => view.root.unmount());
  });

  it("vereist een reden voor een handmatige materiaalafwijking en kan terug naar berekend", async () => {
    const view = await mountPanel("measurement-override", [primaryProduct]);
    const quantityId = "assign-stair-material-product-primary";

    await changeInput(view.container, quantityId, "15");

    expect(inputValue(view.container, quantityId)).toBe("15");
    expect(view.container.textContent).toContain("Reden van afwijking");
    expect(view.container.textContent).toContain("Calculator: 13 trede");
    expect(view.submitButton().disabled).toBe(true);

    await changeInput(
      view.container,
      "assign-stair-material-reason-product-primary",
      "Extra reservetrede"
    );
    expect(view.submitButton().disabled).toBe(false);

    const resetButton = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Gebruik berekend aantal"
    );
    if (!resetButton) throw new Error("Herstelknop niet gevonden.");
    await act(async () => resetButton.click());

    expect(inputValue(view.container, quantityId)).toBe("13");
    expect(view.container.textContent).not.toContain("Reden van afwijking");
    expect(view.submitButton().disabled).toBe(false);
    await act(async () => view.root.unmount());
  });

  it("blokkeert een dubbele trede totdat collectie en kleur expliciet zijn gecontroleerd", async () => {
    const view = await mountPanel(
      "measurement-compatibility",
      [primaryProduct, doubleTreadProduct],
      { doubleTreadCount: "1" }
    );

    const compatibilityLabel = Array.from(view.container.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("Collectie en kleur")
    );
    const checkbox = compatibilityLabel?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!checkbox) throw new Error("Compatibiliteitscontrole niet gevonden.");

    expect(view.submitButton().disabled).toBe(true);
    await act(async () => checkbox.click());

    expect(checkbox.checked).toBe(true);
    expect(view.submitButton().disabled).toBe(false);
    await act(async () => view.root.unmount());
  });

  it("blokkeert meerdere PVC-hoofdproducten binnen dezelfde trapbundel", async () => {
    const view = await mountPanel("measurement-two-primary", [
      primaryProduct,
      secondPrimaryProduct
    ]);

    expect(view.container.textContent).toContain("Kies exact een PVC-traptredenset");
    expect(view.submitButton().disabled).toBe(true);
    await act(async () => view.root.unmount());
  });
  it("houdt profielverkoop per meter en toont de afgeronde leveranciersverpakking", async () => {
    const view = await mountPanel("measurement-profile-length", [primaryProduct, profileProduct], {
      stripLengthM: "6.1"
    });

    expect(inputValue(view.container, "assign-stair-material-product-profile")).toBe("6.1");
    expect(view.container.textContent).toContain("Besteladvies: 3 pak");
    expect(view.submitButton().disabled).toBe(false);
    await act(async () => view.root.unmount());
  });

  it("levert dezelfde complete trapregels aan een externe submit-adapter", async () => {
    const measurementId = "measurement-adapter";
    const draftScopeId = "quote:quote-1:version-2:tools";
    const onAdded = vi.fn();
    const onSelectedRoomIdsChange = vi.fn();
    let submittedLines: MeasurementAssignLine[] | undefined;
    let resolveSubmit: (() => void) | undefined;
    const onSubmitLines = vi.fn((lines: MeasurementAssignLine[]) => {
      submittedLines = lines;
      return new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
    });

    // Een ouder inmeetconcept mag niet in deze offerteversie terechtkomen.
    seedDraft(measurementId, [primaryProduct], { treadCount: "7" });
    const view = await mountPanel(
      measurementId,
      [primaryProduct],
      {},
      {
        draftScopeId,
        submitLabel: "Gebruik in offerte",
        successCopy: "Trapbundel aan offerte toegevoegd",
        onSubmitLines,
        onAdded,
        onSelectedRoomIdsChange
      }
    );

    expect(inputValue(view.container, "assign-tread-count")).toBe("13");
    const button = view.submitButton();
    expect(button.textContent).toContain("Gebruik in offerte");

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(onSubmitLines).toHaveBeenCalledOnce();
    expect(mutationMock).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(button.textContent).toContain("Bezig");

    const materialLine = submittedLines?.find((line) => line.bundleRole === "material");
    const laborLine = submittedLines?.find((line) => line.bundleRole === "labor");
    expect(submittedLines).toHaveLength(2);
    expect(materialLine).toMatchObject({
      ruimteId: "room-1",
      productId: "product-primary",
      productGroep: "stairs",
      berekeningType: "manual",
      aantal: 13,
      eenheid: "step",
      offerteRegelType: "product",
      bundleType: "stair_renovation",
      sectionKey: "traprenovatie"
    });
    expect(materialLine?.invoer).toMatchObject({
      recipeKey: "pvc_stair",
      recipeVersion: 1,
      stairShape: "half_turn",
      componentRole: "standard_tread",
      quantityMode: "calculated",
      calculatedQuantity: 13
    });
    expect(laborLine).toMatchObject({
      ruimteId: "room-1",
      productId: "service-product-half-turn",
      aantal: 1,
      offerteRegelType: "labor",
      bundleType: "stair_renovation"
    });
    expect(laborLine?.bundleId).toBe(materialLine?.bundleId);

    await act(async () => {
      resolveSubmit?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSelectedRoomIdsChange).toHaveBeenCalledWith([]);
    expect(onAdded).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(`henke-meetinvoer-${draftScopeId}`)).toBeNull();
    expect(window.localStorage.getItem(`henke-meetinvoer-${measurementId}`)).not.toBeNull();
    await act(async () => view.root.unmount());
  });

  it("behoudt commit-succes en wist het scoped concept als alleen verversen faalt", async () => {
    const measurementId = "measurement-refresh-failure";
    const draftScopeId = "quote:quote-refresh:tools";
    const onSubmitLines = vi.fn().mockResolvedValue(undefined);
    const onAdded = vi.fn().mockRejectedValue(new Error("refresh failed"));
    const onSelectedRoomIdsChange = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = await mountPanel(
      measurementId,
      [primaryProduct],
      {},
      {
        draftScopeId,
        submitLabel: "Gebruik in offerte",
        onSubmitLines,
        onAdded,
        onSelectedRoomIdsChange
      }
    );

    await act(async () => {
      view.submitButton().click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSubmitLines).toHaveBeenCalledOnce();
    expect(mutationMock).not.toHaveBeenCalled();
    expect(onSelectedRoomIdsChange).toHaveBeenCalledWith([]);
    expect(onAdded).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(`henke-meetinvoer-${draftScopeId}`)).toBeNull();
    expect(view.container.textContent).toContain(
      "Toegevoegd, maar de gegevens konden niet worden vernieuwd."
    );
    expect(view.container.textContent).not.toContain("Gebruik in offerte is niet gelukt.");
    expect(consoleError).toHaveBeenCalledOnce();
    await act(async () => view.root.unmount());
  });

  it("koppelt het ruimtelabel en ondersteunt roving toetsenbordfocus voor producttypen", async () => {
    const view = await mountPanel("measurement-a11y", [primaryProduct]);
    const group = view.container.querySelector<HTMLElement>('[role="radiogroup"]');
    const radios = Array.from(
      group?.querySelectorAll<HTMLButtonElement>('button[role="radio"]') ?? []
    );
    const activeIndex = radios.findIndex((radio) => radio.getAttribute("aria-checked") === "true");
    const nextIndex = (activeIndex + 1) % radios.length;

    expect(view.container.querySelector('label[for="assign-rooms"]')).not.toBeNull();
    expect(view.container.querySelector("#assign-rooms")).not.toBeNull();
    expect(activeIndex).toBeGreaterThanOrEqual(0);
    expect(radios[activeIndex]?.tabIndex).toBe(0);
    expect(
      radios.filter((_, index) => index !== activeIndex).every((radio) => radio.tabIndex === -1)
    ).toBe(true);

    await act(async () => {
      radios[activeIndex]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });

    expect(radios[nextIndex]?.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[nextIndex]);
    await act(async () => view.root.unmount());
  });

  it("behoudt zonder adapter de bestaande bulkmutatie en het standaardlabel", async () => {
    const view = await mountPanel("measurement-default-submit", [primaryProduct]);
    const button = view.submitButton();
    expect(button.textContent).toContain("Toevoegen aan 1 ruimte");

    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mutationMock).toHaveBeenCalledOnce();
    expect(mutationMock.mock.calls[0]?.[1]).toMatchObject({
      inmetingId: "measurement-default-submit",
      regels: expect.arrayContaining([
        expect.objectContaining({ bundleRole: "material", aantal: 13 }),
        expect.objectContaining({ bundleRole: "labor", aantal: 1 })
      ])
    });
    await act(async () => view.root.unmount());
  });
});
