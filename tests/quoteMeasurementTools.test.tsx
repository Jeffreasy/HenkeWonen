// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../src/lib/auth/session";

const harness = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  panelProps: [] as Array<Record<string, unknown>>
}));

vi.mock("../src/lib/convex/client", () => ({
  createConvexHttpClient: () => ({
    query: harness.query,
    mutation: harness.mutation
  })
}));

vi.mock("../src/components/projects/measurement/MeasurementAssignPanel", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      harness.panelProps.push(props);
      return createElement("div", { "data-testid": "measurement-assign-panel" });
    }
  };
});

import QuoteMeasurementTools from "../src/components/quotes/QuoteMeasurementTools";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session: AppSession = {
  userId: "user-1",
  tenantId: "tenant-1",
  email: "test@example.com",
  role: "editor",
  workspaceMode: "general",
  authzToken: "test-authz-token"
};

const tenant = { _id: "tenant-convex-1" };
const emptyContext = {
  measurement: null,
  rooms: [],
  lines: [],
  wasteProfiles: []
};
const readyContext = {
  measurement: {
    _id: "measurement-1",
    status: "draft",
    aangemaaktOp: 1,
    gewijzigdOp: 1
  },
  rooms: [
    { _id: "room-calc", naam: "Hal", sortOrder: 1 },
    { _id: "room-other", naam: "Trap", sortOrder: 2 }
  ],
  lines: [],
  wasteProfiles: []
};

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountTools(overrides: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });

  await act(async () => {
    root.render(
      h(QuoteMeasurementTools, {
        quoteId: "quote-1",
        projectId: "project-1",
        tenantSlug: "henke-wonen",
        session,
        sortOrder: 12,
        ...overrides
      })
    );
    await Promise.resolve();
  });

  return container;
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === label
    ) ?? null
  );
}

afterEach(() => {
  for (const view of mounted.splice(0)) {
    act(() => view.root.unmount());
    view.container.remove();
  }
  harness.query.mockReset();
  harness.mutation.mockReset();
  harness.panelProps.length = 0;
  vi.restoreAllMocks();
});

describe("QuoteMeasurementTools", () => {
  it("maakt de rekencontext pas na de expliciete startknop en kiest de context-ruimte", async () => {
    harness.query
      .mockResolvedValueOnce(tenant)
      .mockResolvedValueOnce(emptyContext)
      .mockResolvedValueOnce(tenant)
      .mockResolvedValueOnce(readyContext);
    harness.mutation.mockResolvedValueOnce({
      measurementId: "measurement-1",
      measurementRoomId: "room-calc",
      projectRoomId: null,
      createdMeasurement: true,
      createdMeasurementRoom: true
    });

    const container = await mountTools();
    await flushAsyncWork();

    const heading = container.querySelector("h3");
    expect(heading?.textContent).toBe("Rekenhulpen");
    expect(heading?.closest("section")?.getAttribute("aria-labelledby")).toBe(heading?.id);
    expect(container.textContent).toContain("Bereken materiaal en diensten");
    expect(harness.mutation).not.toHaveBeenCalled();
    expect(harness.query.mock.calls[1]?.[1]).toMatchObject({
      tenantId: "tenant-convex-1",
      projectId: "project-1",
      quoteCalculationQuoteId: "quote-1"
    });

    const startButton = buttonByText(container, "Rekenhulpen starten");
    expect(startButton).not.toBeNull();

    await act(async () => {
      startButton?.click();
      await Promise.resolve();
    });
    await flushAsyncWork();
    await flushAsyncWork();

    expect(harness.mutation).toHaveBeenCalledTimes(1);
    expect(harness.mutation.mock.calls[0]?.[1]).toEqual({
      tenantSlug: "henke-wonen",
      actor: { externalUserId: "user-1", authzToken: "test-authz-token" },
      quoteId: "quote-1"
    });

    const panelProps = harness.panelProps.at(-1);
    expect(panelProps?.selectedRoomIds).toEqual(["room-calc"]);
    expect(panelProps?.submitLabel).toBe("Gebruik in offerte");
    expect(panelProps?.draftScopeId).toBe("quote:quote-1:tools");
    expect(panelProps?.roomPresets).toEqual([
      { label: "Trap", name: "Trap" },
      { label: "Hal", name: "Hal" },
      { label: "Overloop", name: "Overloop" },
      { label: "Woonkamer", name: "Woonkamer" },
      { label: "Slaapkamer", name: "Slaapkamer" }
    ]);
    expect(container.querySelector('[data-testid="measurement-assign-panel"]')).not.toBeNull();
  });

  it("opent na starten ook zonder bestaande ruimte en komt niet in een startlus", async () => {
    const roomlessContext = { ...readyContext, rooms: [] };
    harness.query
      .mockResolvedValueOnce(tenant)
      .mockResolvedValueOnce(emptyContext)
      .mockResolvedValueOnce(tenant)
      .mockResolvedValueOnce(roomlessContext);
    harness.mutation.mockResolvedValueOnce({
      measurementId: "measurement-1",
      createdMeasurement: true,
      createdMeasurementRoom: false
    });

    const container = await mountTools();
    await flushAsyncWork();
    const startButton = buttonByText(container, "Rekenhulpen starten");

    await act(async () => {
      startButton?.click();
      await Promise.resolve();
    });
    await flushAsyncWork();
    await flushAsyncWork();

    expect(harness.mutation).toHaveBeenCalledTimes(1);
    expect(buttonByText(container, "Rekenhulpen starten")).toBeNull();
    expect(container.querySelector('[data-testid="measurement-assign-panel"]')).not.toBeNull();
    expect(harness.panelProps.at(-1)?.rooms).toEqual([]);
    expect(harness.panelProps.at(-1)?.selectedRoomIds).toEqual([]);
  });

  it("stuurt berekende regels direct naar de offerte en ververst de aanroeper", async () => {
    const importResult = {
      measurementLineIds: ["measurement-line-1"],
      quoteLineIds: ["quote-line-1"],
      count: 1
    };
    const onImported = vi.fn();
    const refresh = vi.fn();

    harness.query.mockResolvedValueOnce(tenant).mockResolvedValueOnce(readyContext);
    harness.mutation.mockResolvedValueOnce(importResult);

    const container = await mountTools({ onImported, refresh });
    await flushAsyncWork();

    expect(harness.mutation).not.toHaveBeenCalled();
    expect(buttonByText(container, "Rekenhulpen starten")).toBeNull();

    const regels = [
      {
        ruimteId: "room-calc",
        productGroep: "stairs",
        berekeningType: "stairs",
        invoer: { stairShape: "half_turn" },
        resultaat: { quantity: 1 },
        aantal: 1,
        eenheid: "piece",
        offerteRegelType: "service"
      }
    ];
    const submitLines = harness.panelProps.at(-1)?.onSubmitLines as
      | ((lines: typeof regels) => Promise<void>)
      | undefined;

    expect(submitLines).toBeTypeOf("function");
    await act(async () => {
      await submitLines?.(regels);
    });

    expect(harness.mutation).toHaveBeenCalledTimes(1);
    expect(harness.mutation.mock.calls[0]?.[1]).toEqual({
      tenantSlug: "henke-wonen",
      actor: { externalUserId: "user-1", authzToken: "test-authz-token" },
      quoteId: "quote-1",
      measurementId: "measurement-1",
      startSortOrder: 12,
      regels
    });
    expect(onImported).toHaveBeenCalledWith(importResult);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("houdt een gecommitteerde import succesvol als verversen faalt en herselecteert niet", async () => {
    const importResult = {
      measurementLineIds: ["measurement-line-1"],
      quoteLineIds: ["quote-line-1"],
      count: 1
    };
    const onImported = vi.fn().mockRejectedValue(new Error("refresh failed"));
    const refresh = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    harness.query.mockResolvedValueOnce(tenant).mockResolvedValueOnce(readyContext);
    harness.mutation.mockResolvedValueOnce(importResult);

    const container = await mountTools({ onImported, refresh });
    await flushAsyncWork();

    const panelProps = harness.panelProps.at(-1);
    const regels = [
      {
        ruimteId: "room-calc",
        productGroep: "stairs",
        berekeningType: "stairs",
        invoer: { stairShape: "half_turn" },
        resultaat: { quantity: 1 },
        aantal: 1,
        eenheid: "piece",
        offerteRegelType: "service"
      }
    ];
    const submitLines = panelProps?.onSubmitLines as
      | ((lines: typeof regels) => Promise<void>)
      | undefined;

    await act(async () => {
      await submitLines?.(regels);
    });

    expect(harness.mutation).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalledWith(importResult);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain(
      "De regels zijn toegevoegd, maar het scherm kon niet volledig worden ververst."
    );

    harness.query.mockResolvedValueOnce(tenant).mockResolvedValueOnce(readyContext);
    await act(async () => {
      const clearRooms = panelProps?.onSelectedRoomIdsChange as
        | ((roomIds: string[]) => void)
        | undefined;
      const onAdded = panelProps?.onAdded as (() => Promise<void>) | undefined;
      clearRooms?.([]);
      await onAdded?.();
    });
    await flushAsyncWork();

    expect(harness.panelProps.at(-1)?.selectedRoomIds).toEqual([]);
    expect(harness.mutation).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("vereist een expliciete start als de nieuwste inmeting niet meer in concept staat", async () => {
    harness.query.mockResolvedValueOnce(tenant).mockResolvedValueOnce({
      ...readyContext,
      measurement: { ...readyContext.measurement, status: "completed" }
    });

    const container = await mountTools();
    await flushAsyncWork();

    expect(buttonByText(container, "Rekenhulpen starten")).not.toBeNull();
    expect(container.querySelector('[data-testid="measurement-assign-panel"]')).toBeNull();
    expect(harness.mutation).not.toHaveBeenCalled();
  });

  it("meldt laden en laadfouten toegankelijk zonder automatisch iets aan te maken", async () => {
    let resolveTenant: ((value: typeof tenant) => void) | undefined;
    const pendingTenant = new Promise<typeof tenant>((resolve) => {
      resolveTenant = resolve;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    harness.query
      .mockReturnValueOnce(pendingTenant)
      .mockRejectedValueOnce(new Error("measurement unavailable"));

    const container = await mountTools();

    expect(container.querySelector('[role="status"]')?.textContent).toContain("Rekenhulpen laden");
    expect(container.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
    expect(harness.mutation).not.toHaveBeenCalled();

    await act(async () => {
      resolveTenant?.(tenant);
      await pendingTenant;
    });
    await flushAsyncWork();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Rekenhulpen niet beschikbaar"
    );
    expect(buttonByText(container, "Opnieuw proberen")).not.toBeNull();
    expect(container.querySelector("section")?.hasAttribute("aria-busy")).toBe(false);
    expect(harness.mutation).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
