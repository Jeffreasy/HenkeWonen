import { CalendarClock, Pencil, Plus, Ruler, Save, Trash2 } from "lucide-react";
import { CALC_TAB_ICONS, CalculatorTabs, type CalcTab, type CalcTabId } from "./CalculatorTabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import { canEditDossiers } from "../../lib/auth/session";
import {
  calculateFlooring,
  calculatePlinths,
  calculateStairs,
  calculateWallPanels,
  calculateWallpaperRolls
} from "../../lib/calculators";
import { createConvexHttpClient } from "../../lib/convex/client";
import type { SubmitEventLike } from "../../lib/events";
import { calculateIncVat, formatEuro, roundMoney } from "../../lib/money";
import { showToast } from "../../lib/toast";
import {
  MEASUREMENT_AUTOSTART_PARAM,
  shouldAutostartMeasurement
} from "../../lib/measurementIntent";
import { useAutoFocusPanel } from "../../lib/useAutoFocusPanel";
import {
  formatLineType,
  formatMeasurementProductGroup,
  formatMeasurementStatus,
  formatQuotePreparationStatus,
  formatUnit
} from "../../lib/i18n/statusLabels";
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  MeasurementStatus,
  PortalProduct,
  QuoteLineType,
  QuotePreparationStatus
} from "../../lib/portalTypes";
import CatalogProductPicker from "../catalog/CatalogProductPicker";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import { Textarea } from "../ui/Textarea";
import type {
  FieldMeasureTool,
  IndicativePriceResult,
  MatrixIndicativePriceResult,
  MatrixOptions,
  MeasurementData,
  MeasurementLineDoc,
  MeasurementRoomDoc,
  MeasurementPanelProps,
  WasteProfileDoc
} from "./measurement/measurementTypes";
import { PRODUCT_GROUP_OPTIONS, QUOTE_LINE_TYPE_OPTIONS } from "./measurement/measurementTypes";
import {
  dateText,
  decimalText,
  formatNumber,
  fromDateInputValue,
  parseDecimal,
  toDateInputValue
} from "./measurement/measurementUtils";


const FIELD_ROOM_PRESETS: Array<{ label: string; name: string }> = [
  { label: "Hal",        name: "Hal" },
  { label: "Overloop",   name: "Overloop" },
  { label: "Woonkamer",  name: "Woonkamer" },
  { label: "Keuken",     name: "Keuken" },
  { label: "Bijkeuken",  name: "Bijkeuken" },
  { label: "Berging",    name: "Berging" },
  { label: "Garage",     name: "Garage" },
  { label: "Wc",         name: "Wc" },
  { label: "Sk BG",      name: "Sk BG" },
  { label: "Sk1",        name: "Sk1" },
  { label: "Sk2",        name: "Sk2" },
  { label: "Sk3",        name: "Sk3" },
  { label: "Sk4",        name: "Sk4" },
];

export default function MeasurementPanel({
  tenantId,
  projectId,
  customerId,
  projectRooms,
  session,
  mode = "full"
}: MeasurementPanelProps) {
  const [tenantConvexId, setTenantConvexId] = useState<string | null>(null);
  const [data, setData] = useState<MeasurementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditMeasurement = canEditDossiers(session.role);
  const isFieldMode = mode === "field";
  const [activeFieldTool, setActiveFieldTool] = useState<FieldMeasureTool>("flooring");

  const [measurementStatus, setMeasurementStatus] = useState<MeasurementStatus>("draft");
  const [measurementDate, setMeasurementDate] = useState("");
  const [measuredBy, setMeasuredBy] = useState("");
  const [measurementNotes, setMeasurementNotes] = useState("");

  const [projectRoomId, setProjectRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [roomWidthM, setRoomWidthM] = useState("");
  const [roomLengthM, setRoomLengthM] = useState("");
  const [roomHeightM, setRoomHeightM] = useState("");
  const [roomAreaM2, setRoomAreaM2] = useState("");
  const [roomPerimeterM, setRoomPerimeterM] = useState("");
  const [roomNotes, setRoomNotes] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomCorrectionDraft, setRoomCorrectionDraft] = useState({
    name: "",
    floor: "",
    widthM: "",
    lengthM: "",
    heightM: "",
    areaM2: "",
    perimeterM: "",
    notes: ""
  });
  const [pendingRoomDelete, setPendingRoomDelete] = useState<MeasurementRoomDoc | null>(null);
  const [roomDeleteError, setRoomDeleteError] = useState<string | null>(null);

  const [floorRoomId, setFloorRoomId] = useState("");
  const [floorLengthM, setFloorLengthM] = useState("");
  const [floorWidthM, setFloorWidthM] = useState("");
  const [floorWastePercent, setFloorWastePercent] = useState("7");
  const [floorPatternType, setFloorPatternType] = useState("straight");
  const [floorNotes, setFloorNotes] = useState("");
  const [floorPatternAutoFilled, setFloorPatternAutoFilled] = useState(false);

  const [plinthRoomId, setPlinthRoomId] = useState("");
  const [plinthPerimeterM, setPlinthPerimeterM] = useState("");
  const [plinthDoorOpeningM, setPlinthDoorOpeningM] = useState("0");
  const [plinthWastePercent, setPlinthWastePercent] = useState("5");
  const [plinthNotes, setPlinthNotes] = useState("");

  const [wallpaperRoomId, setWallpaperRoomId] = useState("");
  const [wallpaperWidthM, setWallpaperWidthM] = useState("");
  const [wallpaperHeightM, setWallpaperHeightM] = useState("");
  const [rollWidthCm, setRollWidthCm] = useState("53");
  const [rollLengthM, setRollLengthM] = useState("10.05");
  const [patternRepeatCm, setPatternRepeatCm] = useState("0");
  const [wallpaperWastePercent, setWallpaperWastePercent] = useState("10");
  const [wallpaperNotes, setWallpaperNotes] = useState("");

  const [wallPanelRoomId, setWallPanelRoomId] = useState("");
  const [wallWidthM, setWallWidthM] = useState("");
  const [wallHeightM, setWallHeightM] = useState("");
  const [panelWidthM, setPanelWidthM] = useState("");
  const [panelHeightM, setPanelHeightM] = useState("");
  const [wallPanelWastePercent, setWallPanelWastePercent] = useState("8");
  const [wallPanelNotes, setWallPanelNotes] = useState("");

  const [stairRoomId, setStairRoomId] = useState("");
  const [stairType, setStairType] = useState("closed");
  const [treadCount, setTreadCount] = useState("");
  const [riserCount, setRiserCount] = useState("0");
  const [stripLengthM, setStripLengthM] = useState("");
  const [stairNotes, setStairNotes] = useState("");

  // Raambekleding (matrix): geen catalogusproduct, maar prijsgroep + type + breedte×hoogte → richtprijs.
  const [wcRoomId, setWcRoomId] = useState("");
  const [wcType, setWcType] = useState(""); // bronBlad, bv. "16 mm" / "Duo Rolgordijn"
  const [wcPriceGroup, setWcPriceGroup] = useState("");
  const [wcWidthCm, setWcWidthCm] = useState("");
  const [wcHeightCm, setWcHeightCm] = useState("");
  const [wcQuantity, setWcQuantity] = useState("1");
  const [wcNotes, setWcNotes] = useState("");
  const [wcOptions, setWcOptions] = useState<MatrixOptions | null>(null);
  const [wcPrice, setWcPrice] = useState<MatrixIndicativePriceResult | null>(null);
  const [wcPriceLoading, setWcPriceLoading] = useState(false);

  const [manualRoomId, setManualRoomId] = useState("");
  const [manualProductGroup, setManualProductGroup] = useState<MeasurementProductGroup>("other");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualUnit, setManualUnit] = useState("custom");
  const [manualQuoteLineType, setManualQuoteLineType] = useState<QuoteLineType>("manual");
  const [manualWastePercent, setManualWastePercent] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineCorrectionDraft, setLineCorrectionDraft] = useState({
    roomId: "",
    quantity: "",
    unit: "",
    wastePercent: "",
    notes: "",
    quotePreparationStatus: "draft" as QuotePreparationStatus,
    productId: "",
    productName: "",
    indicativeUnitPriceExVat: undefined as number | undefined,
    indicativeVatRate: undefined as number | undefined,
    indicativePriceUnit: undefined as string | undefined,
    indicativePriceType: undefined as string | undefined,
    productTouched: false
  });
  const [pendingLineDelete, setPendingLineDelete] = useState<MeasurementLineDoc | null>(null);
  const priceRequestSeq = useRef<Partial<Record<FieldMeasureTool | "edit", number>>>({});

  // Richtprijs: per rekenhulp-tab een gekozen product + indicatieve prijs.
  const [tabProducts, setTabProducts] = useState<Partial<Record<FieldMeasureTool, PortalProduct | null>>>({});
  const [tabPrices, setTabPrices] = useState<Partial<Record<FieldMeasureTool, IndicativePriceResult | null>>>({});
  const [tabPriceLoading, setTabPriceLoading] = useState<Partial<Record<FieldMeasureTool, boolean>>>({});
  const [showPricesIncVat, setShowPricesIncVat] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem("henke-richtprijs-btw-weergave") !== "exclusief";
  });
  const roomEditFormRef = useRef<HTMLFormElement>(null);
  const lineEditFormRef = useRef<HTMLFormElement>(null);
  const hasAutoStartedRef = useRef(false);

  const measurement = data?.measurement ?? null;
  const rooms = data?.rooms ?? [];
  const lines = data?.lines ?? [];
  const wasteProfiles = data?.wasteProfiles ?? [];
  const readyLineCount = lines.filter((line) => line.quotePreparationStatus === "ready_for_quote")
    .length;

  const loadMeasurement = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tenant = await client.query(api.beheer.tenants.getBySlug, { slug: tenantId });
      const resolvedTenantId = String(tenant?._id ?? tenantId);
      setTenantConvexId(resolvedTenantId);

      const result = await client.query(api.projecten.measurements.getForProject, {
        tenantId: resolvedTenantId as Id<"tenants">,
        projectId: projectId as Id<"projects">
      });

      setData(result as MeasurementData);
    } catch (loadError) {
      console.error(loadError);
      setError("Inmeting kon niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tenantId]);

  useEffect(() => {
    void loadMeasurement();
  }, [loadMeasurement]);

  // Snelroute "maten bekend": als de klant/dossier-aanmaak hierheen heeft doorgestuurd met de
  // intent-vlag, start de inmeting automatisch (status → measurement_planned via
  // startOrPlanMeasurement). Wacht tot de data geladen is zodat we weten of er al een inmeting is,
  // draait exact één keer, en wist daarna de vlag uit de URL zodat een refresh niets herstart.
  useEffect(() => {
    if (data === null) {
      return;
    }
    if (
      !shouldAutostartMeasurement({
        search: typeof window === "undefined" ? "" : window.location.search,
        hasMeasurement: Boolean(measurement),
        canEdit: canEditMeasurement,
        alreadyAutostarted: hasAutoStartedRef.current
      })
    ) {
      return;
    }

    hasAutoStartedRef.current = true;

    void (async () => {
      const client = createConvexHttpClient(session);

      if (client) {
        try {
          await client.mutation(api.portal.startOrPlanMeasurement, {
            tenantSlug: tenantId,
            actor: mutationActorFromSession(session),
            projectId,
            gemetenDoor: session.name ?? session.email
          });
          await loadMeasurement();
        } catch (autostartError) {
          console.error(autostartError);
          setError("Inmeting kon niet automatisch worden gestart. Start handmatig met 'Inmeting starten'.");
        }
      }

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete(MEASUREMENT_AUTOSTART_PARAM);
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    })();
  }, [data, measurement, canEditMeasurement, loadMeasurement, projectId, session, tenantId]);

  useAutoFocusPanel(Boolean(editingRoomId), roomEditFormRef);
  useAutoFocusPanel(Boolean(editingLineId), lineEditFormRef);

  useEffect(() => {
    if (!measurement) {
      return;
    }

    setMeasurementStatus(measurement.status);
    setMeasurementDate(toDateInputValue(measurement.measurementDate));
    setMeasuredBy(measurement.measuredBy ?? "");
    setMeasurementNotes(measurement.notes ?? "");
  }, [measurement]);

  // Koppel legpatroon aan snijverlies via wasteProfiles (best-effort op naam)
  useEffect(() => {
    if (wasteProfiles.length === 0) return;

    const PATTERN_PROFILE_NAMES: Partial<Record<string, string>> = {
      straight:    "PVC rechte plank",
      herringbone: "PVC visgraat"
      // "tile" en "custom": geen automatische koppeling
    };

    const targetName = PATTERN_PROFILE_NAMES[floorPatternType];

    if (!targetName) {
      setFloorPatternAutoFilled(false);
      return;
    }

    const match = wasteProfiles.find(
      (p) => p.productGroup === "flooring" && p.name === targetName
    );

    if (match) {
      setFloorWastePercent(String(match.defaultWastePercent));
      setFloorPatternAutoFilled(true);
    } else {
      setFloorPatternAutoFilled(false);
    }
  }, [floorPatternType, wasteProfiles]);

  const roomNameById = useMemo(() => {
    const names = new Map<string, string>();
    rooms.forEach((room) => names.set(room._id, room.name));
    return names;
  }, [rooms]);

  const getProfilesForGroup = useCallback(
    (group: MeasurementProductGroup) => {
      return wasteProfiles.filter((profile) => profile.productGroup === group);
    },
    [wasteProfiles]
  );

  const setWasteFromProfile = useCallback(
    (
      profileId: string,
      setter: (value: string) => void,
      productGroupFilter?: MeasurementProductGroup
    ) => {
      const profile = wasteProfiles.find(
        (item) =>
          item._id === profileId &&
          (!productGroupFilter || item.productGroup === productGroupFilter)
      );

      if (profile) {
        setter(String(profile.defaultWastePercent));
      }
    },
    [wasteProfiles]
  );

  const selectedRoomArea = useMemo(() => {
    const width = parseDecimal(roomWidthM);
    const length = parseDecimal(roomLengthM);

    return width && length ? width * length : undefined;
  }, [roomLengthM, roomWidthM]);

  const selectedRoomPerimeter = useMemo(() => {
    const width = parseDecimal(roomWidthM);
    const length = parseDecimal(roomLengthM);

    return width && length ? 2 * (width + length) : undefined;
  }, [roomLengthM, roomWidthM]);

  const floorResult = useMemo(
    () =>
      calculateFlooring({
        lengthM: parseDecimal(floorLengthM) ?? 0,
        widthM: parseDecimal(floorWidthM) ?? 0,
        wastePercent: parseDecimal(floorWastePercent) ?? 0,
        patternType: floorPatternType as "straight" | "herringbone" | "tile" | "custom"
      }),
    [floorLengthM, floorPatternType, floorWastePercent, floorWidthM]
  );

  const plinthResult = useMemo(
    () =>
      calculatePlinths({
        perimeterM: parseDecimal(plinthPerimeterM) ?? 0,
        doorOpeningM: parseDecimal(plinthDoorOpeningM) ?? 0,
        wastePercent: parseDecimal(plinthWastePercent) ?? 0
      }),
    [plinthDoorOpeningM, plinthPerimeterM, plinthWastePercent]
  );

  const wallpaperResult = useMemo(
    () =>
      calculateWallpaperRolls({
        wallWidthM: parseDecimal(wallpaperWidthM) ?? 0,
        wallHeightM: parseDecimal(wallpaperHeightM) ?? 0,
        rollWidthCm: parseDecimal(rollWidthCm),
        rollLengthM: parseDecimal(rollLengthM),
        patternRepeatCm: parseDecimal(patternRepeatCm),
        wastePercent: parseDecimal(wallpaperWastePercent)
      }),
    [
      patternRepeatCm,
      rollLengthM,
      rollWidthCm,
      wallpaperHeightM,
      wallpaperWastePercent,
      wallpaperWidthM
    ]
  );

  const wallPanelResult = useMemo(
    () =>
      calculateWallPanels({
        wallWidthM: parseDecimal(wallWidthM) ?? 0,
        wallHeightM: parseDecimal(wallHeightM) ?? 0,
        panelWidthM: parseDecimal(panelWidthM) ?? 0,
        panelHeightM: parseDecimal(panelHeightM) ?? 0,
        wastePercent: parseDecimal(wallPanelWastePercent) ?? 0
      }),
    [panelHeightM, panelWidthM, wallHeightM, wallPanelWastePercent, wallWidthM]
  );

  const stairResult = useMemo(
    () =>
      calculateStairs({
        stairType: stairType as "straight" | "quarter_turn" | "half_turn" | "open" | "closed",
        treadCount: parseDecimal(treadCount) ?? 0,
        riserCount: parseDecimal(riserCount) ?? 0,
        stripLengthM: parseDecimal(stripLengthM)
      }),
    [riserCount, stairType, stripLengthM, treadCount]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "henke-richtprijs-btw-weergave",
        showPricesIncVat ? "inclusief" : "exclusief"
      );
    } catch {
      // localStorage kan ontbreken (privémodus) — weergavevoorkeur is niet kritiek.
    }
  }, [showPricesIncVat]);

  /** Meeteenheid die per rekenhulp-tab naar de prijs-lookup gaat. */
  const measurementUnitForTool = useCallback(
    (tool: FieldMeasureTool) => {
      switch (tool) {
        case "flooring":
          return "m2";
        case "plinths":
          return "meter";
        case "wallpaper":
          return "roll";
        case "wall_panels":
          return "piece";
        case "window_covering":
          return "piece";
        case "stairs":
          return "stairs";
        case "manual":
          return manualUnit;
      }
    },
    [manualUnit]
  );

  const fetchIndicativePrice = useCallback(
    async (productId: string, measurementUnit: string) => {
      const client = createConvexHttpClient(session);

      if (!client) {
        return null;
      }

      return (await client.query(api.catalog.pricing.getIndicativePrice, {
        tenantSlug: tenantId,
        productId: productId as Id<"products">,
        measurementUnit
      })) as IndicativePriceResult;
    },
    [session, tenantId]
  );

  const selectTabProduct = useCallback(
    async (tool: FieldMeasureTool, product: PortalProduct | null) => {
      // Volgorde-guard: bij snel wisselen mag een trage respons van product A
      // nooit onder product B worden vastgelegd.
      const requestSeq = (priceRequestSeq.current[tool] ?? 0) + 1;
      priceRequestSeq.current[tool] = requestSeq;

      setTabProducts((current) => ({ ...current, [tool]: product }));
      setTabPrices((current) => ({ ...current, [tool]: null }));

      if (!product) {
        setTabPriceLoading((current) => ({ ...current, [tool]: false }));
        return;
      }

      setTabPriceLoading((current) => ({ ...current, [tool]: true }));

      try {
        const result = await fetchIndicativePrice(product.id, measurementUnitForTool(tool));

        if (priceRequestSeq.current[tool] !== requestSeq) {
          return;
        }

        setTabPrices((current) => ({ ...current, [tool]: result }));
      } catch (priceError) {
        console.error(priceError);

        if (priceRequestSeq.current[tool] !== requestSeq) {
          return;
        }

        setTabPrices((current) => ({ ...current, [tool]: null }));
      } finally {
        if (priceRequestSeq.current[tool] === requestSeq) {
          setTabPriceLoading((current) => ({ ...current, [tool]: false }));
        }
      }
    },
    [fetchIndicativePrice, measurementUnitForTool]
  );

  // Vrije regel: eenheid of productgroep kan ná de productkeuze wijzigen —
  // dan moet de richtprijs opnieuw worden opgezocht met de actuele eenheid.
  // Gedebounced: het eenheid-veld is vrije tekst en mag niet per toetsaanslag
  // een query afvuren.
  useEffect(() => {
    const product = tabProducts.manual;

    if (!product) {
      return;
    }

    const timer = setTimeout(() => {
      void selectTabProduct("manual", product);
    }, 400);

    return () => clearTimeout(timer);
    // Alleen heruitvoeren bij eenheid-/groepswijziging, niet bij elke productwissel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualUnit, manualProductGroup]);

  // ── Raambekleding-matrix (productloze richtprijs) ───────────────────────────
  const fetchMatrixOptions = useCallback(async () => {
    const client = createConvexHttpClient(session);

    if (!client) {
      return null;
    }

    return (await client.query(api.catalog.pricing.listMatrixOptions, {
      tenantSlug: tenantId,
      productToolSleutel: "raambekleding"
    })) as MatrixOptions;
  }, [session, tenantId]);

  const fetchMatrixPrice = useCallback(
    async (bronBlad: string, prijsgroep: string, breedteCm: number, hoogteCm: number) => {
      const client = createConvexHttpClient(session);

      if (!client) {
        return null;
      }

      return (await client.query(api.catalog.pricing.getMatrixIndicativePrice, {
        tenantSlug: tenantId,
        productToolSleutel: "raambekleding",
        prijsgroep,
        bronBlad,
        breedteCm,
        hoogteCm
      })) as MatrixIndicativePriceResult;
    },
    [session, tenantId]
  );

  // Laad de beschikbare matrices (type + prijsgroep) één keer voor de dropdowns.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchMatrixOptions();

        if (!cancelled) {
          setWcOptions(result);
        }
      } catch (optionsError) {
        console.error(optionsError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchMatrixOptions]);

  // Live matrix-richtprijs: gedebounced + volgorde-guard (zelfde patroon als selectTabProduct).
  useEffect(() => {
    const breedteCm = parseDecimal(wcWidthCm);
    const hoogteCm = parseDecimal(wcHeightCm);

    if (!wcType || !wcPriceGroup || !breedteCm || !hoogteCm) {
      setWcPrice(null);
      setWcPriceLoading(false);
      return;
    }

    const requestSeq = (priceRequestSeq.current.window_covering ?? 0) + 1;
    priceRequestSeq.current.window_covering = requestSeq;
    setWcPriceLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchMatrixPrice(wcType, wcPriceGroup, breedteCm, hoogteCm);

          if (priceRequestSeq.current.window_covering !== requestSeq) {
            return;
          }

          setWcPrice(result);
        } catch (priceError) {
          console.error(priceError);

          if (priceRequestSeq.current.window_covering !== requestSeq) {
            return;
          }

          setWcPrice(null);
        } finally {
          if (priceRequestSeq.current.window_covering === requestSeq) {
            setWcPriceLoading(false);
          }
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [wcType, wcPriceGroup, wcWidthCm, wcHeightCm, fetchMatrixPrice]);

  /** Prijsresultaat van een tab, maar alleen als het bij het gekozen product hoort. */
  function matchedTabPrice(tool: FieldMeasureTool) {
    const product = tabProducts[tool];
    const priceResult = tabPrices[tool];

    if (!product || !priceResult || priceResult.productId !== product.id) {
      return null;
    }

    return priceResult;
  }

  /** Snapshot-velden voor addMeasurementLine op basis van de tab-keuze. */
  function indicativeSnapshotForTool(tool: FieldMeasureTool) {
    const product = tabProducts[tool];

    if (!product) {
      return {};
    }

    const priceResult = matchedTabPrice(tool);
    const indicative = priceResult?.indicative ?? null;

    return {
      productId: product.id as Id<"products">,
      productName: priceResult?.productName ?? product.weergaveNaam ?? product.naam,
      ...(indicative
        ? {
            indicativeUnitPriceExVat: indicative.unitPriceExVat,
            indicativeVatRate: indicative.vatRate,
            indicativePriceUnit: indicative.priceUnit,
            indicativePriceType: indicative.priceType,
            indicativeCapturedAt: Date.now()
          }
        : {})
    };
  }

  /** SummaryList-regels met productkeuze + richtprijs voor in het live resultaatpaneel. */
  function indicativeSummaryItems(tool: FieldMeasureTool, quantity: number | undefined) {
    const product = tabProducts[tool];

    if (!product) {
      return [];
    }

    const priceResult = matchedTabPrice(tool);
    const items: Array<{ label: string; value: string }> = [
      { label: "Product", value: priceResult?.productName ?? product.weergaveNaam ?? product.naam }
    ];

    if (tabPriceLoading[tool]) {
      items.push({ label: "Richtprijs", value: "Laden..." });
      return items;
    }

    const indicative = priceResult?.indicative ?? null;

    if (!indicative) {
      items.push({ label: "Richtprijs", value: "Nog niet beschikbaar" });
      return items;
    }

    const unitAmount = showPricesIncVat ? indicative.unitPriceIncVat : indicative.unitPriceExVat;
    const vatLabel = showPricesIncVat ? "incl. btw" : "excl. btw";
    const safeQuantity = quantity && quantity > 0 ? quantity : 0;

    items.push({
      label: `Richtprijs ${vatLabel}`,
      value:
        safeQuantity > 0
          ? `${formatEuro(roundMoney(safeQuantity * unitAmount))} (${formatEuro(unitAmount)} per ${formatUnit(indicative.priceUnit ?? "custom")})`
          : `${formatEuro(unitAmount)} per ${formatUnit(indicative.priceUnit ?? "custom")}`
    });

    return items;
  }

  /** Richtprijs-totaal van een opgeslagen meetregel op basis van het snapshot. */
  function lineIndicativeTotal(line: MeasurementLineDoc) {
    if (line.indicativeUnitPriceExVat === undefined || line.indicativeVatRate === undefined) {
      return null;
    }

    const unitAmount = showPricesIncVat
      ? calculateIncVat(line.indicativeUnitPriceExVat, line.indicativeVatRate)
      : line.indicativeUnitPriceExVat;

    return formatEuro(roundMoney(line.quantity * unitAmount));
  }

  /** SummaryList-regels voor de live matrix-richtprijs (raambekleding). */
  function windowCoveringSummaryItems() {
    const items: Array<{ label: string; value: string }> = [];
    const indicative = wcPrice?.indicative ?? null;

    if (indicative) {
      items.push({
        label: "Maatklasse",
        value: `${indicative.matchedWidthCm} × ${indicative.matchedHeightCm} cm`
      });
    }

    if (wcPriceLoading) {
      items.push({ label: "Richtprijs", value: "Laden..." });
      return items;
    }

    if (wcPrice?.outOfRange) {
      items.push({ label: "Richtprijs", value: "Buiten matrixbereik — offerte op maat" });
      return items;
    }

    if (!indicative) {
      items.push({ label: "Richtprijs", value: "Nog niet beschikbaar" });
      return items;
    }

    const quantity = parseDecimal(wcQuantity) ?? 1;
    const unitAmount = showPricesIncVat ? indicative.unitPriceIncVat : indicative.unitPriceExVat;
    const vatLabel = showPricesIncVat ? "incl. btw" : "excl. btw";

    items.push({
      label: `Richtprijs ${vatLabel}`,
      value: `${formatEuro(roundMoney(quantity * unitAmount))} (${formatEuro(unitAmount)} per stuk)`
    });

    return items;
  }

  /** Blokkeer opslaan van een matrix-regel tot er een geldige richtprijs is. */
  function windowCoveringValidationError(): string | undefined {
    if (!wcType || !wcPriceGroup) {
      return "Kies type en prijsgroep.";
    }
    if (!parseDecimal(wcWidthCm) || !parseDecimal(wcHeightCm)) {
      return "Vul breedte en hoogte in.";
    }
    const quantity = parseDecimal(wcQuantity);
    if (!quantity || quantity <= 0) {
      return "Vul een geldig aantal in.";
    }
    if (wcPriceLoading) {
      return "Richtprijs wordt nog geladen.";
    }
    if (wcPrice?.outOfRange) {
      return "Buiten matrixbereik — gebruik een vrije regel voor offerte op maat.";
    }
    if (!wcPrice?.indicative) {
      return "Geen richtprijs beschikbaar voor deze keuze.";
    }
    return undefined;
  }

  function requireClientAndMeasurement() {
    const client = createConvexHttpClient(session);

    if (!client || !tenantConvexId || !measurement) {
      setError("Inmeting is nog niet beschikbaar.");
      return null;
    }

    return {
      client,
      tenantId: tenantConvexId as Id<"tenants">,
      measurementId: measurement._id as Id<"measurements">
    };
  }

  async function startMeasurement() {
    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const client = createConvexHttpClient(session);

    if (!client || !tenantConvexId) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.projecten.measurements.createForProject, {
        tenantId: tenantConvexId as Id<"tenants">,
        actor: mutationActorFromSession(session),
        projectId: projectId as Id<"projects">,
        klantId: customerId as Id<"customers">,
        gemetenDoor: session.name ?? session.email,
        createdByExternalUserId: session.userId
      });
      showToast({ title: "Inmeting gestart", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeting kon niet worden gestart.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMeasurementMeta(event: SubmitEventLike) {
    event.preventDefault();

    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurement, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        status: measurementStatus,
        inmeetdatum: fromDateInputValue(measurementDate),
        gemetenDoor: measuredBy.trim(),
        notities: measurementNotes.trim()
      });
      showToast({ title: "Inmeting bijgewerkt", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeting kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addRoom(event: SubmitEventLike) {
    event.preventDefault();

    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context || !roomName.trim()) {
      return;
    }

    const widthM = parseDecimal(roomWidthM);
    const lengthM = parseDecimal(roomLengthM);
    const areaM2 = parseDecimal(roomAreaM2) ?? selectedRoomArea;
    const perimeterM = parseDecimal(roomPerimeterM) ?? selectedRoomPerimeter;

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.addMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        projectRuimteId: projectRoomId ? (projectRoomId as Id<"projectRooms">) : undefined,
        naam: roomName.trim(),
        verdieping: roomFloor.trim() || undefined,
        breedteM: widthM,
        lengteM: lengthM,
        hoogteM: parseDecimal(roomHeightM),
        oppervlakteM2: areaM2,
        omtrekM: perimeterM,
        notities: roomNotes.trim() || undefined
      });
      setProjectRoomId("");
      setRoomName("");
      setRoomFloor("");
      setRoomWidthM("");
      setRoomLengthM("");
      setRoomHeightM("");
      setRoomAreaM2("");
      setRoomPerimeterM("");
      setRoomNotes("");
      showToast({ title: "Ruimte toegevoegd aan de inmeting", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("De ruimte kon niet aan de inmeting worden toegevoegd.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addRoomByPreset(presetName: string) {
    if (!canEditMeasurement) return;

    const context = requireClientAndMeasurement();

    if (!context) return;

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.addMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        naam: presetName
      });
      showToast({ title: `${presetName} toegevoegd`, tone: "success" });
      await loadMeasurement();
    } catch {
      setError("Ruimte kon niet worden toegevoegd.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addLine(
    event: SubmitEventLike,
    line: {
      roomId?: string;
      productGroup: MeasurementProductGroup;
      calculationType: MeasurementCalculationType;
      input: Record<string, unknown>;
      result: Record<string, unknown>;
      wastePercent?: number;
      quantity: number;
      unit: string;
      notes?: string;
      quoteLineType: QuoteLineType;
      tool?: FieldMeasureTool;
      productId?: Id<"products">;
      productName?: string;
      indicativeUnitPriceExVat?: number;
      indicativeVatRate?: number;
      indicativePriceUnit?: string;
      indicativePriceType?: string;
      indicativeCapturedAt?: number;
      validationError?: string;
      successMessage: string;
    }
  ) {
    event.preventDefault();

    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    if (line.validationError || line.quantity <= 0) {
      setError("Controleer de invoer voordat je de inmeetregel opslaat.");
      return;
    }

    // Niet opslaan terwijl de richtprijs van het gekozen product nog laadt:
    // anders belandt de regel zonder prijssnapshot in de inmeting.
    if (line.tool && tabProducts[line.tool] && tabPriceLoading[line.tool]) {
      setError("De richtprijs wordt nog geladen. Probeer het over een moment opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.addMeasurementLine, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        inmetingId: context.measurementId,
        ruimteId: line.roomId ? (line.roomId as Id<"measurementRooms">) : undefined,
        productGroep: line.productGroup,
        berekeningType: line.calculationType,
        invoer: line.input,
        resultaat: line.result,
        snijverliesPct: line.wastePercent,
        aantal: line.quantity,
        eenheid: line.unit,
        notities: line.notes,
        offerteRegelType: line.quoteLineType,
        productId: line.productId,
        productNaam: line.productName,
        indicatieveEenheidsprijsExBtw: line.indicativeUnitPriceExVat,
        indicatiefBtwTarief: line.indicativeVatRate,
        indicatievePrijsEenheid: line.indicativePriceUnit,
        indicatievePrijsSoort: line.indicativePriceType,
        indicatiefVastgelegdOp: line.indicativeCapturedAt
      });
      showToast({ title: line.successMessage, tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeetregel kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markLineReady(lineId: string) {
    if (!canEditMeasurement) {
      setError("Je hebt geen rechten om de inmeting te wijzigen.");
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurementLineStatus, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: lineId as Id<"measurementLines">,
        quotePreparationStatus: "ready_for_quote"
      });
      showToast({ title: "Inmeetregel klaargezet voor de offerte", tone: "success" });
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Inmeetregel kon niet worden klaargezet.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditRoom(room: MeasurementRoomDoc) {
    setEditingRoomId(room._id);
    setRoomCorrectionDraft({
      name: room.name,
      floor: room.floor ?? "",
      widthM: decimalText(room.widthM),
      lengthM: decimalText(room.lengthM),
      heightM: decimalText(room.heightM),
      areaM2: decimalText(room.areaM2),
      perimeterM: decimalText(room.perimeterM),
      notes: room.notes ?? ""
    });
  }

  async function saveRoomCorrection(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingRoomId || !roomCorrectionDraft.name.trim()) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        ruimteId: editingRoomId as Id<"measurementRooms">,
        naam: roomCorrectionDraft.name.trim(),
        verdieping: roomCorrectionDraft.floor.trim() || undefined,
        breedteM: parseDecimal(roomCorrectionDraft.widthM),
        lengteM: parseDecimal(roomCorrectionDraft.lengthM),
        hoogteM: parseDecimal(roomCorrectionDraft.heightM),
        oppervlakteM2: parseDecimal(roomCorrectionDraft.areaM2),
        omtrekM: parseDecimal(roomCorrectionDraft.perimeterM),
        notities: roomCorrectionDraft.notes.trim() || undefined
      });
      showToast({ title: "Meetruimte bijgewerkt", tone: "success" });
      setEditingRoomId(null);
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetruimte kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRoomCorrection() {
    if (!pendingRoomDelete) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setRoomDeleteError(null);

    try {
      await context.client.mutation(api.projecten.measurements.deleteMeasurementRoom, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        ruimteId: pendingRoomDelete._id as Id<"measurementRooms">
      });
      showToast({ title: "Meetruimte verwijderd", tone: "warning" });
      setPendingRoomDelete(null);
      setRoomDeleteError(null);
      await loadMeasurement();
    } catch (deleteError) {
      console.error(deleteError);
      // Fout tonen IN de dialoog — niet sluiten, zodat de gebruiker de melding ziet
      setRoomDeleteError(
        "Deze ruimte heeft nog meetregels gekoppeld. Verwijder eerst alle meetregels van deze ruimte."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditLine(line: MeasurementLineDoc) {
    setEditingLineId(line._id);
    setLineCorrectionDraft({
      roomId: line.roomId ?? "",
      quantity: decimalText(line.quantity),
      unit: line.unit,
      wastePercent: decimalText(line.wastePercent),
      notes: line.notes ?? "",
      quotePreparationStatus: line.quotePreparationStatus,
      productId: line.productId ?? "",
      productName: line.productName ?? "",
      indicativeUnitPriceExVat: line.indicativeUnitPriceExVat,
      indicativeVatRate: line.indicativeVatRate,
      indicativePriceUnit: line.indicativePriceUnit,
      indicativePriceType: line.indicativePriceType,
      productTouched: false
    });
  }

  /**
   * Productwissel in het editformulier: keuze direct vastleggen, richtprijs
   * async erbij (alleen voor weergave — bij opslaan wordt sowieso een verse
   * prijs opgehaald met de definitieve eenheid).
   */
  async function selectEditLineProduct(product: PortalProduct | null) {
    const requestSeq = (priceRequestSeq.current.edit ?? 0) + 1;
    priceRequestSeq.current.edit = requestSeq;

    setLineCorrectionDraft((current) => ({
      ...current,
      productId: product?.id ?? "",
      productName: product ? product.weergaveNaam ?? product.naam : "",
      indicativeUnitPriceExVat: undefined,
      indicativeVatRate: undefined,
      indicativePriceUnit: undefined,
      indicativePriceType: undefined,
      productTouched: true
    }));

    if (!product) {
      return;
    }

    let priceResult: IndicativePriceResult | null = null;

    try {
      priceResult = await fetchIndicativePrice(
        product.id,
        lineCorrectionDraft.unit.trim() || "custom"
      );
    } catch (priceError) {
      console.error(priceError);
    }

    if (priceRequestSeq.current.edit !== requestSeq) {
      return;
    }

    const indicative = priceResult?.indicative ?? null;

    setLineCorrectionDraft((current) => {
      if (current.productId !== product.id) {
        return current;
      }

      return {
        ...current,
        productName: priceResult?.productName ?? current.productName,
        indicativeUnitPriceExVat: indicative?.unitPriceExVat,
        indicativeVatRate: indicative?.vatRate,
        indicativePriceUnit: indicative?.priceUnit,
        indicativePriceType: indicative?.priceType
      };
    });
  }

  async function saveLineCorrection(event: SubmitEventLike) {
    event.preventDefault();

    const line = lines.find((item) => item._id === editingLineId);
    const context = requireClientAndMeasurement();

    if (!line || !context) {
      return;
    }

    const quantity = parseDecimal(lineCorrectionDraft.quantity);

    if (!quantity || quantity <= 0) {
      setError("Vul een geldige hoeveelheid in.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const finalUnit = lineCorrectionDraft.unit.trim() || line.unit;

    // Bij een gekozen product altijd een verse richtprijs ophalen met de
    // definitieve eenheid: dit voorkomt verouderde snapshots (eenheid gewijzigd
    // na productkeuze) én races met nog lopende weergave-lookups.
    let productArgs: Record<string, unknown> = {};

    if (lineCorrectionDraft.productTouched && !lineCorrectionDraft.productId) {
      productArgs = { clearProduct: true };
    } else if (lineCorrectionDraft.productId) {
      let freshPrice: IndicativePriceResult | null = null;

      try {
        freshPrice = await fetchIndicativePrice(lineCorrectionDraft.productId, finalUnit);
      } catch (priceError) {
        console.error(priceError);
      }

      const indicative = freshPrice?.indicative ?? null;

      if (!freshPrice && !lineCorrectionDraft.productTouched) {
        // Lookup mislukt en de keuze is niet gewijzigd: niets meesturen, dan
        // behoudt de server het bestaande snapshot (incl. eenheid-guard).
        productArgs = {};
      } else {
        productArgs = {
          productId: lineCorrectionDraft.productId as Id<"products">,
          productName:
            freshPrice?.productName ?? (lineCorrectionDraft.productName || undefined),
          ...(indicative
            ? {
                indicativeUnitPriceExVat: indicative.unitPriceExVat,
                indicativeVatRate: indicative.vatRate,
                indicativePriceUnit: indicative.priceUnit,
                indicativePriceType: indicative.priceType,
                indicativeCapturedAt: Date.now()
              }
            : {})
        };
      }
    }

    try {
      await context.client.mutation(api.projecten.measurements.updateMeasurementLine, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: line._id as Id<"measurementLines">,
        ruimteId: lineCorrectionDraft.roomId ? (lineCorrectionDraft.roomId as Id<"measurementRooms">) : undefined,
        productGroep: line.productGroup,
        berekeningType: line.calculationType,
        invoer: line.input,
        resultaat: {
          ...line.result,
          correctedQuantity: quantity,
          correctedAt: Date.now()
        },
        snijverliesPct: parseDecimal(lineCorrectionDraft.wastePercent),
        aantal: quantity,
        eenheid: finalUnit,
        notities: lineCorrectionDraft.notes.trim() || undefined,
        offerteRegelType: line.quoteLineType,
        quotePreparationStatus: lineCorrectionDraft.quotePreparationStatus,
        ...productArgs
      });
      showToast({ title: "Meetregel bijgewerkt", tone: "success" });
      setEditingLineId(null);
      await loadMeasurement();
    } catch (saveError) {
      console.error(saveError);
      setError("Meetregel kon niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLineCorrection() {
    if (!pendingLineDelete) {
      return;
    }

    const context = requireClientAndMeasurement();

    if (!context) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await context.client.mutation(api.projecten.measurements.deleteMeasurementLine, {
        tenantId: context.tenantId,
        actor: mutationActorFromSession(session),
        lineId: pendingLineDelete._id as Id<"measurementLines">
      });
      showToast({ title: "Meetregel verwijderd", tone: "warning" });
      setPendingLineDelete(null);
      await loadMeasurement();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Verwerkte meetregels kunnen niet direct worden verwijderd.");
      setPendingLineDelete(null);
    } finally {
      setIsSaving(false);
    }
  }

  function applyProjectRoom(projectRoomValue: string) {
    setProjectRoomId(projectRoomValue);

    const sourceRoom = projectRooms.find((room) => room.id === projectRoomValue);

    if (!sourceRoom) {
      return;
    }

    setRoomName(sourceRoom.naam);
    setRoomFloor(sourceRoom.verdieping ?? "");
    setRoomWidthM(decimalText(sourceRoom.breedteCm ? sourceRoom.breedteCm / 100 : undefined));
    setRoomLengthM(decimalText(sourceRoom.lengteCm ? sourceRoom.lengteCm / 100 : undefined));
    setRoomAreaM2(decimalText(sourceRoom.oppervlakteM2));
    setRoomPerimeterM(decimalText(sourceRoom.omtrekMeter));
    setRoomNotes(sourceRoom.notities ?? "");
  }

  function applyMeasurementRoomToFloor(roomId: string) {
    setFloorRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setFloorLengthM(decimalText(room.lengthM));
      setFloorWidthM(decimalText(room.widthM));
    }
  }

  function applyMeasurementRoomToPlinth(roomId: string) {
    setPlinthRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setPlinthPerimeterM(decimalText(room.perimeterM));
    }
  }

  function applyMeasurementRoomToWallpaper(roomId: string) {
    setWallpaperRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setWallpaperWidthM(decimalText(room.widthM));
      setWallpaperHeightM(decimalText(room.heightM));
    }
  }

  function applyMeasurementRoomToWallPanel(roomId: string) {
    setWallPanelRoomId(roomId);
    const room = rooms.find((item) => item._id === roomId);

    if (room) {
      setWallWidthM(decimalText(room.widthM));
      setWallHeightM(decimalText(room.heightM));
    }
  }

  const roomColumns = useMemo<Array<DataTableColumn<MeasurementRoomDoc>>>(
    () => {
      const actionColumn: DataTableColumn<MeasurementRoomDoc> = {
        key: "actions",
        header: "Acties",
        width: "180px",
        render: (room) =>
          canEditMeasurement ? (
            <div className="toolbar">
              <Button size="sm" variant="secondary" onClick={() => startEditRoom(room)}>
                <Pencil size={16} aria-hidden="true" />
                Bewerken
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPendingRoomDelete(room)}>
                <Trash2 size={16} aria-hidden="true" />
                Verwijderen
              </Button>
            </div>
          ) : (
            "-"
          )
      };
      const baseColumns: Array<DataTableColumn<MeasurementRoomDoc>> = [
        {
          key: "name",
          header: "Ruimte",
          priority: "primary",
          render: (room) => <strong>{room.name}</strong>
        },
        {
          key: "floor",
          header: "Verdieping",
          hideOnMobile: true,
          render: (room) => room.floor ?? "-"
        }
      ];

      if (isFieldMode) {
        return [
          ...baseColumns,
          {
            key: "notes",
            header: "Notitie",
            hideOnMobile: true,
            render: (room) => room.notes ?? "-"
          },
          actionColumn
        ];
      }

      return [
        ...baseColumns,
        {
          key: "width",
          header: "Breedte",
          align: "right",
          render: (room) => formatNumber(room.widthM, " m")
        },
        {
          key: "length",
          header: "Lengte",
          align: "right",
          render: (room) => formatNumber(room.lengthM, " m")
        },
        {
          key: "height",
          header: "Hoogte",
          align: "right",
          hideOnMobile: true,
          render: (room) => formatNumber(room.heightM, " m")
        },
        {
          key: "area",
          header: "Oppervlakte",
          align: "right",
          render: (room) => formatNumber(room.areaM2, " m²")
        },
        {
          key: "perimeter",
          header: "Omtrek",
          align: "right",
          render: (room) => formatNumber(room.perimeterM, " m")
        },
        {
          key: "notes",
          header: "Notitie",
          hideOnMobile: true,
          render: (room) => room.notes ?? "-"
        },
        actionColumn
      ];
    },
    [canEditMeasurement, isFieldMode]
  );

  const lineColumns = useMemo<Array<DataTableColumn<MeasurementLineDoc>>>(
    () => [
      {
        key: "group",
        header: "Productgroep",
        priority: "primary",
        render: (line) => <strong>{formatMeasurementProductGroup(line.productGroup)}</strong>
      },
      {
        key: "room",
        header: "Ruimte",
        render: (line) =>
          line.roomId ? roomNameById.get(line.roomId) ?? "-" : isFieldMode ? "Algemeen" : "-"
      },
      {
        key: "quantity",
        header: "Hoeveelheid",
        align: "right",
        render: (line) => (
          <span style={{ whiteSpace: "nowrap" }}>
            {formatNumber(line.quantity)} {formatUnit(line.unit)}
          </span>
        )
      },
      {
        key: "waste",
        header: "Snijverlies",
        align: "right",
        hideOnMobile: true,
        render: (line) => (line.wastePercent !== undefined ? `${line.wastePercent}%` : "-")
      },
      {
        key: "indicative",
        header: "Richtprijs",
        align: "right",
        render: (line) => {
          if (!line.productName) {
            return "-";
          }

          return (
            <div style={{ textAlign: "right" }}>
              <strong style={{ whiteSpace: "nowrap" }}>
                {lineIndicativeTotal(line) ?? "Nog geen prijs"}
              </strong>
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                {line.productName}
              </div>
            </div>
          );
        }
      },
      {
        key: "status",
        header: "Status",
        render: (line) => (
          <StatusBadge
            status={line.quotePreparationStatus}
            label={formatQuotePreparationStatus(line.quotePreparationStatus)}
          />
        )
      },
      {
        key: "notes",
        header: "Notitie",
        hideOnMobile: true,
        render: (line) => line.notes ?? "-"
      },
      {
        key: "action",
        header: "Actie",
        render: (line) => {
          if (!canEditMeasurement || line.quotePreparationStatus === "converted") {
            return "-";
          }

          return (
            <div className="toolbar">
              {line.quotePreparationStatus === "draft" ? (
                <Button
                  disabled={isSaving}
                  onClick={() => void markLineReady(line._id)}
                  size="sm"
                  variant="secondary"
                >
                  Naar offerte
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => startEditLine(line)}>
                <Pencil size={16} aria-hidden="true" />
                Bewerken
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPendingLineDelete(line)}>
                <Trash2 size={16} aria-hidden="true" />
                Verwijderen
              </Button>
            </div>
          );
        }
      }
    ],
    [canEditMeasurement, isFieldMode, isSaving, roomNameById, showPricesIncVat]
  );

  if (isLoading) {
    return <LoadingState title="Inmeting laden" description="Inmeting ophalen." />;
  }

  if (error && !data) {
    return <ErrorState title="Inmeting niet geladen" description={error} />;
  }

  return (
    <section className={isFieldMode ? "measurement-panel measurement-panel-field" : "panel measurement-panel"}>
      <ConfirmDialog
        open={Boolean(pendingRoomDelete)}
        title="Meetruimte verwijderen?"
        description={
          roomDeleteError
            ? roomDeleteError
            : "Dit kan alleen als er nog geen meetregels aan deze ruimte gekoppeld zijn."
        }
        confirmLabel={roomDeleteError ? "Sluiten" : "Meetruimte verwijderen"}
        cancelLabel={roomDeleteError ? undefined : "Annuleren"}
        tone={roomDeleteError ? "warning" : "danger"}
        isBusy={isSaving}
        onCancel={() => { setPendingRoomDelete(null); setRoomDeleteError(null); }}
        onConfirm={() => {
          if (roomDeleteError) {
            setPendingRoomDelete(null);
            setRoomDeleteError(null);
          } else {
            void deleteRoomCorrection();
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingLineDelete)}
        title="Meetregel verwijderen?"
        description="De meetregel verdwijnt uit de inmeting. Verwerkte regels blijven beschermd."
        confirmLabel="Meetregel verwijderen"
        tone="danger"
        isBusy={isSaving}
        onCancel={() => setPendingLineDelete(null)}
        onConfirm={() => void deleteLineCorrection()}
      />
      <SectionHeader
        compact
        title={isFieldMode ? "Meten bij de klant" : "Inmeting"}
        description={
          isFieldMode
            ? "Werk van klantgegevens naar ruimtes, meetregels en een conceptofferte."
            : "Leg ruimtes, maten en indicatieve hoeveelheden vast voor latere offertevoorbereiding."
        }
      />

      {!isFieldMode ? (
        <Alert
          variant="info"
          title="Richtprijzen zijn indicatief"
          description="Kies bij het inmeten optioneel een product om direct een richtprijs te zien. De definitieve prijs en btw bepaal je in de offerte."
        />
      ) : null}

      {error ? <Alert variant="danger" description={error} style={{ marginTop: 12 }} /> : null}

      {!measurement ? (
        <EmptyState
          title="Nog geen inmeting"
          description="Start een inmeting om ruimtes en indicatieve hoeveelheden vast te leggen."
          action={
            canEditMeasurement ? (
              <Button
                isLoading={isSaving}
                leftIcon={<Ruler size={17} aria-hidden="true" />}
                onClick={() => void startMeasurement()}
                variant="primary"
              >
                Inmeting starten
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid">
          <section className={isFieldMode ? "grid field-measurement-summary" : "grid three-column"}>
            <StatCard
              label="Status"
              value={formatMeasurementStatus(measurement.status)}
              tone={measurement.status === "reviewed" ? "success" : "warning"}
            />
            <StatCard label="Ruimtes gemeten" value={rooms.length} tone="info" />
            <StatCard
              label="Klaar voor offerte"
              value={readyLineCount}
              description={`${lines.length} inmeetregels totaal`}
              tone={readyLineCount > 0 ? "success" : "neutral"}
            />
          </section>

          <Card>
            <form onSubmit={saveMeasurementMeta}>
              <SectionHeader
                compact
                title="Inmeting samenvatting"
                description="Deze gegevens horen bij het projectdossier en wijzigen geen offerte."
                actions={
                  <StatusBadge
                    status={measurement.status}
                    label={formatMeasurementStatus(measurement.status)}
                  />
                }
              />
              <SummaryList
                items={[
                  { id: "date", label: "Inmeetdatum", value: dateText(measurement.measurementDate) },
                  { id: "person", label: "Ingemeten door", value: measurement.measuredBy ?? "-" },
                  { id: "updated", label: "Bijgewerkt", value: dateText(measurement.updatedAt) }
                ]}
              />
              <div className="responsive-form-row" style={{ marginTop: 16 }}>
                <Field htmlFor="measurement-status" label="Status">
                  <Select
                    id="measurement-status"
                    value={measurementStatus}
                    onChange={(event) =>
                      setMeasurementStatus(event.target.value as MeasurementStatus)
                    }
                  >
                    {(["draft", "measured", "reviewed", "converted_to_quote"] as const).map(
                      (status) => (
                        <option key={status} value={status}>
                          {formatMeasurementStatus(status)}
                        </option>
                      )
                    )}
                  </Select>
                </Field>
                <Field htmlFor="measurement-date" label="Inmeetdatum">
                  <Input
                    id="measurement-date"
                    type="date"
                    value={measurementDate}
                    onChange={(event) => setMeasurementDate(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measured-by" label="Ingemeten door">
                  <Input
                    id="measured-by"
                    value={measuredBy}
                    onChange={(event) => setMeasuredBy(event.target.value)}
                  />
                </Field>
              </div>
              <Field htmlFor="measurement-notes" label="Notities">
                <Textarea
                  id="measurement-notes"
                  rows={3}
                  value={measurementNotes}
                  onChange={(event) => setMeasurementNotes(event.target.value)}
                />
              </Field>
              <div className="toolbar" style={{ marginTop: 12 }}>
                {canEditMeasurement ? (
                  <Button
                    isLoading={isSaving}
                    leftIcon={<CalendarClock size={16} aria-hidden="true" />}
                    type="submit"
                    variant="secondary"
                  >
                    Inmeting opslaan
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeader
              compact
              title={isFieldMode ? "Stap 1 - Waar meet je?" : "Ruimtes inmeten"}
              description={
                isFieldMode
                  ? "Een ruimte is de plek in de woning. Daarna kies je welke hoeveelheid je wilt vastleggen."
                  : "Een meetruimte is de vastgelegde maatvoering binnen deze inmeting."
              }
            />
            {canEditMeasurement ? (
              <div className="field-room-presets">
                <p className="field-room-presets-label">
                  {isFieldMode ? "Snel toevoegen" : "Naam invullen via preset"}
                </p>
                <div className="field-room-presets-grid">
                  {FIELD_ROOM_PRESETS.map((preset) => {
                    const alreadyAdded = rooms.some((r) => r.name === preset.name);
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        className={alreadyAdded ? "field-room-preset-btn added" : "field-room-preset-btn"}
                        disabled={isSaving}
                        onClick={() =>
                          isFieldMode
                            ? void addRoomByPreset(preset.name)
                            : setRoomName(preset.name)
                        }
                        aria-label={alreadyAdded ? `${preset.label} — al toegevoegd` : `${preset.label} toevoegen`}
                      >
                        {preset.label}
                        {alreadyAdded ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <form onSubmit={addRoom}>
              <div className="responsive-form-row">
                <Field
                  htmlFor="project-room-source"
                  label={isFieldMode ? "Ruimte uit dossier" : "Bestaande projectruimte"}
                >
                  <Select
                    id="project-room-source"
                    value={projectRoomId}
                    onChange={(event) => applyProjectRoom(event.target.value)}
                  >
                    <option value="">{isFieldMode ? "Nieuwe ruimte" : "Geen basisruimte"}</option>
                    {projectRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.naam}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field htmlFor="measurement-room-name" label="Ruimte" required>
                  <Input
                    id="measurement-room-name"
                    required
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                  />
                </Field>
                <Field htmlFor="measurement-room-floor" label="Verdieping">
                  <Input
                    id="measurement-room-floor"
                    value={roomFloor}
                    onChange={(event) => setRoomFloor(event.target.value)}
                  />
                </Field>
                {!isFieldMode ? (
                  <>
                    <Field htmlFor="measurement-room-width" label="Breedte in meter">
                      <Input
                        id="measurement-room-width"
                        inputMode="decimal"
                        value={roomWidthM}
                        onChange={(event) => setRoomWidthM(event.target.value)}
                      />
                    </Field>
                    <Field htmlFor="measurement-room-length" label="Lengte in meter">
                      <Input
                        id="measurement-room-length"
                        inputMode="decimal"
                        value={roomLengthM}
                        onChange={(event) => setRoomLengthM(event.target.value)}
                      />
                    </Field>
                    <Field htmlFor="measurement-room-height" label="Hoogte in meter">
                      <Input
                        id="measurement-room-height"
                        inputMode="decimal"
                        value={roomHeightM}
                        onChange={(event) => setRoomHeightM(event.target.value)}
                      />
                    </Field>
                    <Field
                      htmlFor="measurement-room-area"
                      label="Oppervlakte"
                      description={
                        selectedRoomArea
                          ? `Voorstel: ${formatNumber(selectedRoomArea, " m²")}`
                          : undefined
                      }
                    >
                      <Input
                        id="measurement-room-area"
                        inputMode="decimal"
                        value={roomAreaM2}
                        onChange={(event) => setRoomAreaM2(event.target.value)}
                      />
                    </Field>
                    <Field
                      htmlFor="measurement-room-perimeter"
                      label="Omtrek"
                      description={
                        selectedRoomPerimeter
                          ? `Voorstel: ${formatNumber(selectedRoomPerimeter, " m")}`
                          : undefined
                      }
                    >
                      <Input
                        id="measurement-room-perimeter"
                        inputMode="decimal"
                        value={roomPerimeterM}
                        onChange={(event) => setRoomPerimeterM(event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
              <Field htmlFor="measurement-room-notes" label="Notitie">
                <Textarea
                  id="measurement-room-notes"
                  rows={2}
                  value={roomNotes}
                  onChange={(event) => setRoomNotes(event.target.value)}
                />
              </Field>
              <div className="toolbar" style={{ marginTop: 12 }}>
                {canEditMeasurement ? (
                  <Button
                    isLoading={isSaving}
                    leftIcon={<Plus size={16} aria-hidden="true" />}
                    type="submit"
                    variant="primary"
                  >
                    {isFieldMode ? "Ruimte opslaan" : "Ruimte toevoegen"}
                  </Button>
                ) : null}
              </div>
            </form>
            <div style={{ marginTop: 16 }}>
              <DataTable
                ariaLabel="Ruimtes inmeten"
                columns={roomColumns}
                density="compact"
                emptyDescription={
                  isFieldMode
                    ? "Sla een ruimte op als je meetregels aan een plek wilt koppelen. Je kunt ook direct doorgaan zonder ruimte."
                    : "Voeg een meetruimte toe of gebruik een bestaande projectruimte als basis."
                }
                emptyTitle={
                  isFieldMode ? "Nog geen ruimte opgeslagen" : "Nog geen ruimtes ingemeten"
                }
                getRowKey={(room) => room._id}
                mobileMode="cards"
                renderMobileCard={(room) => (
                  <div className="mobile-card-section">
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        <strong>{room.name}</strong>
                        <small className="muted">{room.floor ?? "Geen verdieping"}</small>
                      </div>
                      {!isFieldMode ? (
                        <strong>{formatNumber(room.areaM2, " m²")}</strong>
                      ) : null}
                    </div>
                    <div className="mobile-card-meta">
                      {!isFieldMode ? <span>{formatNumber(room.perimeterM, " m")} omtrek</span> : null}
                      <span>{room.notes ?? "Geen notitie"}</span>
                    </div>
                    {canEditMeasurement ? (
                      <div className="mobile-card-actions">
                        <Button
                          leftIcon={<Pencil size={16} aria-hidden="true" />}
                          onClick={() => startEditRoom(room)}
                          size="sm"
                          variant="secondary"
                        >
                          Bewerken
                        </Button>
                        <Button
                          leftIcon={<Trash2 size={16} aria-hidden="true" />}
                          onClick={() => setPendingRoomDelete(room)}
                          size="sm"
                          variant="danger"
                        >
                          Verwijderen
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
                rows={rooms}
              />
            </div>
            {editingRoomId ? (
              <form
                className="form-grid edit-work-panel"
                onSubmit={saveRoomCorrection}
                ref={roomEditFormRef}
                style={{ marginTop: 16 }}
              >
                <SectionHeader
                  compact
                  title={`Meetruimte bewerken: ${roomCorrectionDraft.name}`}
                  description="Je past nu deze opgeslagen ruimte aan zonder een dubbele ruimte aan te maken."
                />
                <div className="grid three-column">
                  <Field htmlFor="measurement-room-edit-name" label="Ruimte" required>
                    <Input
                      id="measurement-room-edit-name"
                      value={roomCorrectionDraft.name}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-floor" label="Verdieping">
                    <Input
                      id="measurement-room-edit-floor"
                      value={roomCorrectionDraft.floor}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, floor: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-area" label="Oppervlakte">
                    <Input
                      id="measurement-room-edit-area"
                      inputMode="decimal"
                      value={roomCorrectionDraft.areaM2}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, areaM2: event.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid three-column">
                  <Field htmlFor="measurement-room-edit-width" label="Breedte in meter">
                    <Input
                      id="measurement-room-edit-width"
                      inputMode="decimal"
                      value={roomCorrectionDraft.widthM}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, widthM: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-length" label="Lengte in meter">
                    <Input
                      id="measurement-room-edit-length"
                      inputMode="decimal"
                      value={roomCorrectionDraft.lengthM}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, lengthM: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="measurement-room-edit-perimeter" label="Omtrek">
                    <Input
                      id="measurement-room-edit-perimeter"
                      inputMode="decimal"
                      value={roomCorrectionDraft.perimeterM}
                      onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, perimeterM: event.target.value }))}
                    />
                  </Field>
                </div>
                <Field htmlFor="measurement-room-edit-notes" label="Notitie">
                  <Textarea
                    id="measurement-room-edit-notes"
                    rows={3}
                    value={roomCorrectionDraft.notes}
                    onChange={(event) => setRoomCorrectionDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </Field>
                <div className="toolbar">
                  <Button isLoading={isSaving} leftIcon={<Save size={16} aria-hidden="true" />} type="submit" variant="primary">
                    Meetruimte opslaan
                  </Button>
                  <Button disabled={isSaving} variant="secondary" onClick={() => setEditingRoomId(null)}>
                    Annuleren
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>

          {!isFieldMode ? renderMeasurementLinesCard() : null}

          {canEditMeasurement ? (
            <section className="panel">
              <SectionHeader
                compact
                title={isFieldMode ? "Stap 2 — Wat meet je?" : "Rekenhulpen"}
                description={
                  isFieldMode
                    ? "Kies de soort meting en vul de maten in. Het resultaat wordt live berekend."
                    : "Gebruik een rekenhulp om een indicatieve hoeveelheid vast te leggen."
                }
              />
              <CalculatorTabs
                activeTab={activeFieldTool}
                onTabChange={(id: CalcTabId) => setActiveFieldTool(id)}
                tabs={buildCalcTabs()}
              />
            </section>
          ) : null}
          {isFieldMode ? renderMeasurementLinesCard() : null}

        </div>
      )}
    </section>
  );

  function buildCalcTabs(): CalcTab[] {
    return [
      {
        id: "flooring",
        label: isFieldMode ? "Vloer meten" : "Vloer",
        icon: CALC_TAB_ICONS.flooring,
        resultKey: floorResult.quoteQuantityM2 ?? 0,
        hasInput: Boolean(floorLengthM || floorWidthM),
        validationError: floorLengthM || floorWidthM ? floorResult.validationError : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: floorRoomId || undefined,
            productGroup: "flooring",
            calculationType: "area",
            input: { lengthM: parseDecimal(floorLengthM), widthM: parseDecimal(floorWidthM), wastePercent: parseDecimal(floorWastePercent), patternType: floorPatternType },
            result: floorResult,
            wastePercent: parseDecimal(floorWastePercent),
            quantity: floorResult.quoteQuantityM2,
            unit: "m2",
            notes: floorNotes.trim() || undefined,
            quoteLineType: "product",
            tool: "flooring",
            ...indicativeSnapshotForTool("flooring"),
            validationError: floorResult.validationError,
            successMessage: "Vloerinmeting opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Netto oppervlakte", value: formatNumber(floorResult.areaM2, " m²") },
            { label: "Snijverlies", value: formatNumber(floorResult.wasteM2, " m²") },
            { label: "Offertehoeveelheid", value: formatNumber(floorResult.quoteQuantityM2, " m²") },
            ...indicativeSummaryItems("flooring", floorResult.quoteQuantityM2)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("floor-room", "Ruimte", floorRoomId, applyMeasurementRoomToFloor)}
            {renderWasteProfileSelect("floor-waste-profile", "Standaard snijverlies", getProfilesForGroup("flooring"), (profileId) => setWasteFromProfile(profileId, setFloorWastePercent, "flooring"))}
            <Field htmlFor="floor-length" label="Lengte in meter">
              <Input id="floor-length" inputMode="decimal" value={floorLengthM} onChange={(e) => setFloorLengthM(e.target.value)} />
            </Field>
            <Field htmlFor="floor-width" label="Breedte in meter">
              <Input id="floor-width" inputMode="decimal" value={floorWidthM} onChange={(e) => setFloorWidthM(e.target.value)} />
            </Field>
            <Field htmlFor="floor-pattern" label="Legpatroon">
              <Select id="floor-pattern" value={floorPatternType} onChange={(e) => setFloorPatternType(e.target.value)}>
                <option value="straight">Rechte plank</option>
                <option value="herringbone">Visgraat</option>
                <option value="tile">Tegelpatroon</option>
                <option value="custom">Maatwerk</option>
              </Select>
            </Field>
            <Field htmlFor="floor-waste" label="Snijverlies %">
              <Input
                id="floor-waste"
                inputMode="decimal"
                value={floorWastePercent}
                onChange={(e) => {
                  setFloorWastePercent(e.target.value);
                  setFloorPatternAutoFilled(false);
                }}
              />
              {floorPatternAutoFilled ? (
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--text-xs)" }}>
                  Automatisch ingesteld op basis van legpatroon.
                </p>
              ) : null}
            </Field>
            <Field htmlFor="floor-notes" label="Notitie">
              <Input id="floor-notes" value={floorNotes} onChange={(e) => setFloorNotes(e.target.value)} />
            </Field>
            {renderProductPicker("flooring", "flooring")}
          </>
        )
      },
      {
        id: "plinths",
        label: isFieldMode ? "Plinten meten" : "Plinten",
        icon: CALC_TAB_ICONS.plinths,
        resultKey: plinthResult.quoteQuantityMeter ?? 0,
        hasInput: Boolean(plinthPerimeterM),
        validationError: plinthPerimeterM ? plinthResult.validationError : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: plinthRoomId || undefined,
            productGroup: "plinths",
            calculationType: "perimeter",
            input: { perimeterM: parseDecimal(plinthPerimeterM), doorOpeningM: parseDecimal(plinthDoorOpeningM), wastePercent: parseDecimal(plinthWastePercent) },
            result: plinthResult,
            wastePercent: parseDecimal(plinthWastePercent),
            quantity: plinthResult.quoteQuantityMeter,
            unit: "meter",
            notes: plinthNotes.trim() || undefined,
            quoteLineType: "material",
            tool: "plinths",
            ...indicativeSnapshotForTool("plinths"),
            validationError: plinthResult.validationError,
            successMessage: "Plintinmeting opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Netto meters", value: formatNumber(plinthResult.netMeter, " m") },
            { label: "Snijverlies", value: formatNumber(plinthResult.wasteMeter, " m") },
            { label: "Offertehoeveelheid", value: formatNumber(plinthResult.quoteQuantityMeter, " m") },
            ...indicativeSummaryItems("plinths", plinthResult.quoteQuantityMeter)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("plinth-room", "Ruimte", plinthRoomId, applyMeasurementRoomToPlinth)}
            {renderWasteProfileSelect("plinth-waste-profile", "Standaard snijverlies", getProfilesForGroup("plinths"), (profileId) => setWasteFromProfile(profileId, setPlinthWastePercent, "plinths"))}
            <Field htmlFor="plinth-perimeter" label="Omtrek in meter">
              <Input id="plinth-perimeter" inputMode="decimal" value={plinthPerimeterM} onChange={(e) => setPlinthPerimeterM(e.target.value)} />
            </Field>
            <Field htmlFor="plinth-door" label="Deuropeningen in meter">
              <Input id="plinth-door" inputMode="decimal" value={plinthDoorOpeningM} onChange={(e) => setPlinthDoorOpeningM(e.target.value)} />
            </Field>
            <Field htmlFor="plinth-waste" label="Snijverlies %">
              <Input id="plinth-waste" inputMode="decimal" value={plinthWastePercent} onChange={(e) => setPlinthWastePercent(e.target.value)} />
            </Field>
            <Field htmlFor="plinth-notes" label="Notitie">
              <Input id="plinth-notes" value={plinthNotes} onChange={(e) => setPlinthNotes(e.target.value)} />
            </Field>
            {renderProductPicker("plinths", "plinths")}
          </>
        )
      },
      {
        id: "wallpaper",
        label: isFieldMode ? "Behang meten" : "Behang",
        icon: CALC_TAB_ICONS.wallpaper,
        resultKey: wallpaperResult.rollsNeeded ?? 0,
        hasInput: Boolean(wallpaperWidthM || wallpaperHeightM),
        validationError: wallpaperWidthM || wallpaperHeightM ? wallpaperResult.validationError : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: wallpaperRoomId || undefined,
            productGroup: "wallpaper",
            calculationType: "rolls",
            input: { wallWidthM: parseDecimal(wallpaperWidthM), wallHeightM: parseDecimal(wallpaperHeightM), rollWidthCm: parseDecimal(rollWidthCm), rollLengthM: parseDecimal(rollLengthM), patternRepeatCm: parseDecimal(patternRepeatCm), wastePercent: parseDecimal(wallpaperWastePercent) },
            result: wallpaperResult as unknown as Record<string, unknown>,
            wastePercent: parseDecimal(wallpaperWastePercent),
            quantity: wallpaperResult.rollsNeeded,
            unit: "roll",
            notes: wallpaperNotes.trim() || undefined,
            quoteLineType: "product",
            tool: "wallpaper",
            ...indicativeSnapshotForTool("wallpaper"),
            validationError: wallpaperResult.validationError,
            successMessage: "Behanginmeting opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Banen nodig", value: wallpaperResult.banenNeeded },
            { label: "Banen per rol", value: wallpaperResult.banenPerRol },
            { label: "Offertehoeveelheid", value: `${wallpaperResult.rollsNeeded} rollen` },
            ...indicativeSummaryItems("wallpaper", wallpaperResult.rollsNeeded)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("wallpaper-room", "Ruimte", wallpaperRoomId, applyMeasurementRoomToWallpaper)}
            {renderWasteProfileSelect("wallpaper-waste-profile", "Standaard snijverlies", getProfilesForGroup("wallpaper"), (profileId) => setWasteFromProfile(profileId, setWallpaperWastePercent, "wallpaper"))}
            <Field htmlFor="wallpaper-width" label="Wandbreedte in meter">
              <Input id="wallpaper-width" inputMode="decimal" value={wallpaperWidthM} onChange={(e) => setWallpaperWidthM(e.target.value)} />
            </Field>
            <Field htmlFor="wallpaper-height" label="Wandhoogte in meter">
              <Input id="wallpaper-height" inputMode="decimal" value={wallpaperHeightM} onChange={(e) => setWallpaperHeightM(e.target.value)} />
            </Field>
            <Field htmlFor="roll-width" label="Rolbreedte cm">
              <Input id="roll-width" inputMode="decimal" value={rollWidthCm} onChange={(e) => setRollWidthCm(e.target.value)} />
            </Field>
            <Field htmlFor="roll-length" label="Rollengte m">
              <Input id="roll-length" inputMode="decimal" value={rollLengthM} onChange={(e) => setRollLengthM(e.target.value)} />
            </Field>
            <Field htmlFor="pattern-repeat" label="Patroonrapport cm">
              <Input id="pattern-repeat" inputMode="decimal" value={patternRepeatCm} onChange={(e) => setPatternRepeatCm(e.target.value)} />
            </Field>
            <Field htmlFor="wallpaper-waste" label="Snijverlies %">
              <Input id="wallpaper-waste" inputMode="decimal" value={wallpaperWastePercent} onChange={(e) => setWallpaperWastePercent(e.target.value)} />
            </Field>
            <Field htmlFor="wallpaper-notes" label="Notitie">
              <Input id="wallpaper-notes" value={wallpaperNotes} onChange={(e) => setWallpaperNotes(e.target.value)} />
            </Field>
            {renderProductPicker("wallpaper", "wallpaper")}
          </>
        )
      },
      {
        id: "wall_panels",
        label: isFieldMode ? "Wandpanelen" : "Wandpanelen",
        icon: CALC_TAB_ICONS.wall_panels,
        resultKey: wallPanelResult.quoteQuantityPieces ?? 0,
        hasInput: Boolean(wallWidthM || wallHeightM || panelWidthM || panelHeightM),
        validationError: wallWidthM || wallHeightM || panelWidthM || panelHeightM ? wallPanelResult.validationError : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: wallPanelRoomId || undefined,
            productGroup: "wall_panels",
            calculationType: "panels",
            input: { wallWidthM: parseDecimal(wallWidthM), wallHeightM: parseDecimal(wallHeightM), panelWidthM: parseDecimal(panelWidthM), panelHeightM: parseDecimal(panelHeightM), wastePercent: parseDecimal(wallPanelWastePercent) },
            result: wallPanelResult,
            wastePercent: parseDecimal(wallPanelWastePercent),
            quantity: wallPanelResult.quoteQuantityPieces,
            unit: "piece",
            notes: wallPanelNotes.trim() || undefined,
            quoteLineType: "product",
            tool: "wall_panels",
            ...indicativeSnapshotForTool("wall_panels"),
            validationError: wallPanelResult.validationError,
            successMessage: "Wandpaneleninmeting opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Wandoppervlakte", value: formatNumber(wallPanelResult.wallAreaM2, " m²") },
            { label: "Panelen nodig", value: wallPanelResult.panelsNeeded },
            { label: "Offertehoeveelheid", value: `${wallPanelResult.quoteQuantityPieces} stuks` },
            ...indicativeSummaryItems("wall_panels", wallPanelResult.quoteQuantityPieces)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("wall-panel-room", "Ruimte", wallPanelRoomId, applyMeasurementRoomToWallPanel)}
            {renderWasteProfileSelect("wall-panel-waste-profile", "Standaard snijverlies", getProfilesForGroup("wall_panels"), (profileId) => setWasteFromProfile(profileId, setWallPanelWastePercent, "wall_panels"))}
            <Field htmlFor="wall-panel-wall-width" label="Wandbreedte in meter">
              <Input id="wall-panel-wall-width" inputMode="decimal" value={wallWidthM} onChange={(e) => setWallWidthM(e.target.value)} />
            </Field>
            <Field htmlFor="wall-panel-wall-height" label="Wandhoogte in meter">
              <Input id="wall-panel-wall-height" inputMode="decimal" value={wallHeightM} onChange={(e) => setWallHeightM(e.target.value)} />
            </Field>
            <Field htmlFor="panel-width" label="Paneelbreedte in meter">
              <Input id="panel-width" inputMode="decimal" value={panelWidthM} onChange={(e) => setPanelWidthM(e.target.value)} />
            </Field>
            <Field htmlFor="panel-height" label="Paneelhoogte in meter">
              <Input id="panel-height" inputMode="decimal" value={panelHeightM} onChange={(e) => setPanelHeightM(e.target.value)} />
            </Field>
            <Field htmlFor="wall-panel-waste" label="Snijverlies %">
              <Input id="wall-panel-waste" inputMode="decimal" value={wallPanelWastePercent} onChange={(e) => setWallPanelWastePercent(e.target.value)} />
            </Field>
            <Field htmlFor="wall-panel-notes" label="Notitie">
              <Input id="wall-panel-notes" value={wallPanelNotes} onChange={(e) => setWallPanelNotes(e.target.value)} />
            </Field>
            {renderProductPicker("wall_panels", "wall_panels")}
          </>
        )
      },
      {
        id: "stairs",
        label: isFieldMode ? "Trap meten" : "Trap",
        icon: CALC_TAB_ICONS.stairs,
        resultKey: stairResult.quoteQuantity ?? 0,
        hasInput: Boolean(treadCount),
        validationError: treadCount ? stairResult.validationError : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: stairRoomId || undefined,
            productGroup: "stairs",
            calculationType: "stairs",
            input: { stairType, treadCount: parseDecimal(treadCount), riserCount: parseDecimal(riserCount), stripLengthM: parseDecimal(stripLengthM) },
            result: stairResult as unknown as Record<string, unknown>,
            quantity: stairResult.quoteQuantity,
            unit: "stairs",
            notes: stairNotes.trim() || undefined,
            quoteLineType: "service",
            tool: "stairs",
            ...indicativeSnapshotForTool("stairs"),
            validationError: stairResult.validationError,
            successMessage: "Trapinmeting opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Treden", value: stairResult.treadCount },
            { label: "Stootborden", value: stairResult.riserCount },
            { label: "Offertehoeveelheid", value: `${stairResult.quoteQuantity} trap` },
            ...indicativeSummaryItems("stairs", stairResult.quoteQuantity)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("stair-room", "Ruimte", stairRoomId, setStairRoomId)}
            <Field htmlFor="stair-type" label="Traptype">
              <Select id="stair-type" value={stairType} onChange={(e) => setStairType(e.target.value)}>
                <option value="straight">Rechte trap</option>
                <option value="quarter_turn">Kwart draai</option>
                <option value="half_turn">Halve draai</option>
                <option value="open">Open trap</option>
                <option value="closed">Dichte trap</option>
              </Select>
            </Field>
            <Field htmlFor="tread-count" label="Aantal treden">
              <Input id="tread-count" inputMode="numeric" value={treadCount} onChange={(e) => setTreadCount(e.target.value)} />
            </Field>
            <Field htmlFor="riser-count" label="Aantal stootborden">
              <Input id="riser-count" inputMode="numeric" value={riserCount} onChange={(e) => setRiserCount(e.target.value)} />
            </Field>
            <Field htmlFor="strip-length" label="Striplengte in meter">
              <Input id="strip-length" inputMode="decimal" value={stripLengthM} onChange={(e) => setStripLengthM(e.target.value)} />
            </Field>
            <Field htmlFor="stair-notes" label="Notitie">
              <Input id="stair-notes" value={stairNotes} onChange={(e) => setStairNotes(e.target.value)} />
            </Field>
            {renderProductPicker("stairs", "stairs")}
          </>
        )
      },
      {
        id: "window_covering",
        label: isFieldMode ? "Raambekleding meten" : "Raambekleding",
        icon: CALC_TAB_ICONS.window_covering,
        resultKey: `${wcType}-${wcPriceGroup}-${wcWidthCm}-${wcHeightCm}-${wcQuantity}`,
        hasInput: Boolean(wcType || wcWidthCm || wcHeightCm),
        validationError:
          wcType || wcWidthCm || wcHeightCm ? windowCoveringValidationError() : undefined,
        isSaving,
        onSubmit: (event) => {
          const breedteCm = parseDecimal(wcWidthCm);
          const hoogteCm = parseDecimal(wcHeightCm);
          const quantity = parseDecimal(wcQuantity) ?? 1;
          const indicative = wcPrice?.indicative ?? null;
          const label = `Raambekleding ${[wcType, wcPriceGroup].filter(Boolean).join(" – ")}`;

          void addLine(event, {
            roomId: wcRoomId || undefined,
            productGroup: "curtains",
            calculationType: "matrix",
            input: {
              source: "raambekleding-matrix",
              productToolSleutel: "raambekleding",
              bronBlad: wcType,
              prijsgroep: wcPriceGroup,
              breedteCm,
              hoogteCm,
              matchedWidthCm: indicative?.matchedWidthCm,
              matchedHeightCm: indicative?.matchedHeightCm,
              quantity
            },
            result: {
              unitPriceExVat: indicative?.unitPriceExVat,
              matchedWidthCm: indicative?.matchedWidthCm,
              matchedHeightCm: indicative?.matchedHeightCm,
              quantity,
              outOfRange: wcPrice?.outOfRange ?? false,
              isIndicative: true
            },
            quantity,
            unit: "piece",
            notes: wcNotes.trim() || undefined,
            quoteLineType: "product",
            ...(indicative
              ? {
                  productName: `${label} – ${indicative.matchedWidthCm}×${indicative.matchedHeightCm} cm`,
                  indicativeUnitPriceExVat: indicative.unitPriceExVat,
                  indicativeVatRate: indicative.vatRate,
                  indicativePriceUnit: "piece",
                  indicativePriceType: "matrix",
                  indicativeCapturedAt: Date.now()
                }
              : {}),
            validationError: windowCoveringValidationError(),
            successMessage: "Raambekleding-inmeting opgeslagen."
          });
        },
        result: (
          <SummaryList
            items={[
              { label: "Type", value: wcType || "-" },
              { label: "Prijsgroep", value: wcPriceGroup || "-" },
              {
                label: "Maat (B×H)",
                value: wcWidthCm && wcHeightCm ? `${wcWidthCm} × ${wcHeightCm} cm` : "-"
              },
              { label: "Aantal", value: wcQuantity || "1" },
              ...windowCoveringSummaryItems()
            ]}
          />
        ),
        fields: (
          <>
            {renderRoomSelect("wc-room", "Ruimte", wcRoomId, setWcRoomId)}
            <Field htmlFor="wc-type" label="Type raambekleding">
              <Select
                id="wc-type"
                value={wcType}
                onChange={(e) => {
                  setWcType(e.target.value);
                  setWcPriceGroup("");
                }}
              >
                <option value="">Kies type</option>
                {(wcOptions?.types ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="wc-group" label="Prijsgroep">
              <Select
                id="wc-group"
                value={wcPriceGroup}
                onChange={(e) => setWcPriceGroup(e.target.value)}
                disabled={!wcType}
              >
                <option value="">Kies prijsgroep</option>
                {(wcOptions?.combinations ?? [])
                  .filter((combo) => combo.bronBlad === wcType)
                  .map((combo) => combo.prijsgroep)
                  .filter((group, index, all) => all.indexOf(group) === index)
                  .map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field htmlFor="wc-width" label="Breedte in cm">
              <Input
                id="wc-width"
                inputMode="decimal"
                value={wcWidthCm}
                onChange={(e) => setWcWidthCm(e.target.value)}
              />
            </Field>
            <Field htmlFor="wc-height" label="Hoogte in cm">
              <Input
                id="wc-height"
                inputMode="decimal"
                value={wcHeightCm}
                onChange={(e) => setWcHeightCm(e.target.value)}
              />
            </Field>
            <Field htmlFor="wc-qty" label="Aantal">
              <Input
                id="wc-qty"
                inputMode="decimal"
                value={wcQuantity}
                onChange={(e) => setWcQuantity(e.target.value)}
              />
            </Field>
            <Field htmlFor="wc-notes" label="Notitie">
              <Input id="wc-notes" value={wcNotes} onChange={(e) => setWcNotes(e.target.value)} />
            </Field>
          </>
        )
      },
      {
        id: "manual",
        label: isFieldMode ? "Vrije regel" : "Vrij",
        icon: CALC_TAB_ICONS.manual,
        resultKey: `${manualQuantity}-${manualUnit}`,
        hasInput: Boolean(manualQuantity),
        validationError: manualQuantity && !parseDecimal(manualQuantity) ? "Hoeveelheid verplicht." : undefined,
        isSaving,
        onSubmit: (event) =>
          void addLine(event, {
            roomId: manualRoomId || undefined,
            productGroup: manualProductGroup,
            calculationType: "manual",
            input: { quantity: parseDecimal(manualQuantity), unit: manualUnit, wastePercent: parseDecimal(manualWastePercent) },
            result: { quantity: parseDecimal(manualQuantity), unit: manualUnit, isIndicative: true },
            wastePercent: parseDecimal(manualWastePercent),
            quantity: parseDecimal(manualQuantity) ?? 0,
            unit: manualUnit,
            notes: manualNotes.trim() || undefined,
            quoteLineType: manualQuoteLineType,
            tool: "manual",
            ...indicativeSnapshotForTool("manual"),
            validationError: parseDecimal(manualQuantity) ? undefined : "quantity is required.",
            successMessage: "Vrije inmeetregel opgeslagen."
          }),
        result: (
          <SummaryList items={[
            { label: "Productgroep", value: formatMeasurementProductGroup(manualProductGroup) },
            { label: "Soort post", value: formatLineType(manualQuoteLineType) },
            { label: "Hoeveelheid", value: `${manualQuantity || "-"} ${formatUnit(manualUnit)}` },
            ...indicativeSummaryItems("manual", parseDecimal(manualQuantity) ?? 0)
          ]} />
        ),
        fields: (
          <>
            {renderRoomSelect("manual-room", "Ruimte", manualRoomId, setManualRoomId)}
            <Field htmlFor="manual-group" label="Productgroep">
              <Select id="manual-group" value={manualProductGroup} onChange={(e) => setManualProductGroup(e.target.value as MeasurementProductGroup)}>
                {PRODUCT_GROUP_OPTIONS.map((group) => <option key={group} value={group}>{formatMeasurementProductGroup(group)}</option>)}
              </Select>
            </Field>
            <Field htmlFor="manual-quantity" label="Hoeveelheid">
              <Input id="manual-quantity" inputMode="decimal" value={manualQuantity} onChange={(e) => setManualQuantity(e.target.value)} />
            </Field>
            <Field htmlFor="manual-unit" label="Eenheid">
              <Input id="manual-unit" value={manualUnit} onChange={(e) => setManualUnit(e.target.value)} />
            </Field>
            <Field htmlFor="manual-line-type" label="Soort offertepost">
              <Select id="manual-line-type" value={manualQuoteLineType} onChange={(e) => setManualQuoteLineType(e.target.value as QuoteLineType)}>
                {QUOTE_LINE_TYPE_OPTIONS.map((lineType) => <option key={lineType} value={lineType}>{formatLineType(lineType)}</option>)}
              </Select>
            </Field>
            <Field htmlFor="manual-waste" label="Snijverlies %">
              <Input id="manual-waste" inputMode="decimal" value={manualWastePercent} onChange={(e) => setManualWastePercent(e.target.value)} />
            </Field>
            <Field htmlFor="manual-notes" label="Notitie">
              <Input id="manual-notes" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
            </Field>
            {renderProductPicker("manual", manualProductGroup)}
          </>
        )
      }
    ];
  }

  function renderMeasurementLinesCard() {
    return (
      <Card>
        <SectionHeader
          compact
          title={isFieldMode ? "Stap 3 - Opgeslagen meetregels" : "Inmeetregels"}
          description={
            isFieldMode
              ? `Dit zijn de hoeveelheden die klaarstaan voor de conceptofferte. Richtprijzen zijn indicatief en ${showPricesIncVat ? "incl." : "excl."} btw.`
              : `Zet inmeetregels klaar zodat je ze in een offerte kunt overnemen. Richtprijzen zijn indicatief en ${showPricesIncVat ? "incl." : "excl."} btw; de definitieve prijs bepaal je in de offerte.`
          }
          actions={
            <Button
              size="sm"
              variant="secondary"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => setShowPricesIncVat((current) => !current)}
            >
              {showPricesIncVat ? "Excl. btw" : "Incl. btw"}
            </Button>
          }
        />
        <DataTable
          ariaLabel={isFieldMode ? "Opgeslagen meetregels" : "Inmeetregels"}
          columns={lineColumns}
          density="compact"
          emptyDescription={
            isFieldMode
              ? "Kies hierboven een meetactie om de eerste hoeveelheid op te slaan."
              : "Gebruik hieronder een rekenhulp om de eerste inmeetregel op te slaan."
          }
          emptyTitle={isFieldMode ? "Nog geen meetregels opgeslagen" : "Nog geen inmeetregels"}
          getRowKey={(line) => line._id}
          mobileMode="cards"
          renderMobileCard={(line) => (
            <div>
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <strong>{formatMeasurementProductGroup(line.productGroup)}</strong>
                <StatusBadge
                  status={line.quotePreparationStatus}
                  label={formatQuotePreparationStatus(line.quotePreparationStatus)}
                />
              </div>
              <p className="muted">
                {line.roomId
                  ? roomNameById.get(line.roomId) ?? "-"
                  : isFieldMode
                    ? "Algemeen"
                    : "Geen ruimte"}{" "}
                · {formatNumber(line.quantity)} {formatUnit(line.unit)}
              </p>
              {line.productName ? (
                <p>
                  {line.productName}
                  {" · "}
                  <strong>{lineIndicativeTotal(line) ?? "Nog geen richtprijs"}</strong>
                  {lineIndicativeTotal(line) ? (
                    <span className="muted"> ({showPricesIncVat ? "incl." : "excl."} btw, indicatief)</span>
                  ) : null}
                </p>
              ) : null}
              <p className="muted">{line.notes ?? "Geen notitie"}</p>
              {canEditMeasurement && line.quotePreparationStatus !== "converted" ? (
                <div className="mobile-card-actions">
                  {line.quotePreparationStatus === "draft" ? (
                    <Button
                      disabled={isSaving}
                      onClick={() => void markLineReady(line._id)}
                      size="sm"
                      variant="secondary"
                    >
                      Naar offerte zetten
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={() => startEditLine(line)}>
                    <Pencil size={16} aria-hidden="true" />
                    Bewerken
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setPendingLineDelete(line)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Verwijderen
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          rows={lines}
        />
        {editingLineId ? (
          <form
            className="form-grid edit-work-panel"
            onSubmit={saveLineCorrection}
            ref={lineEditFormRef}
            style={{ marginTop: 16 }}
          >
            <SectionHeader
              compact
              title="Meetregel bewerken"
              description="Je past nu deze meetregel aan. Verwerkte regels blijven beschermd."
            />
            <div className="grid three-column">
              <Field htmlFor="measurement-line-edit-room" label="Ruimte">
                <Select
                  id="measurement-line-edit-room"
                  value={lineCorrectionDraft.roomId}
                  onChange={(event) => setLineCorrectionDraft((current) => ({ ...current, roomId: event.target.value }))}
                >
                  <option value="">Algemene meting</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field htmlFor="measurement-line-edit-quantity" label="Hoeveelheid" required>
                <Input
                  id="measurement-line-edit-quantity"
                  inputMode="decimal"
                  value={lineCorrectionDraft.quantity}
                  onChange={(event) => setLineCorrectionDraft((current) => ({ ...current, quantity: event.target.value }))}
                  required
                />
              </Field>
              <Field htmlFor="measurement-line-edit-unit" label="Eenheid">
                <Input
                  id="measurement-line-edit-unit"
                  value={lineCorrectionDraft.unit}
                  onChange={(event) => setLineCorrectionDraft((current) => ({ ...current, unit: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid two-column-even">
              <Field htmlFor="measurement-line-edit-waste" label="Snijverlies %">
                <Input
                  id="measurement-line-edit-waste"
                  inputMode="decimal"
                  value={lineCorrectionDraft.wastePercent}
                  onChange={(event) => setLineCorrectionDraft((current) => ({ ...current, wastePercent: event.target.value }))}
                />
              </Field>
              <Field htmlFor="measurement-line-edit-status" label="Status">
                <Select
                  id="measurement-line-edit-status"
                  value={lineCorrectionDraft.quotePreparationStatus}
                  onChange={(event) =>
                    setLineCorrectionDraft((current) => ({
                      ...current,
                      quotePreparationStatus: event.target.value as QuotePreparationStatus
                    }))
                  }
                >
                  <option value="draft">Concept</option>
                  <option value="ready_for_quote">Klaar voor offerte</option>
                </Select>
              </Field>
            </div>
            <SectionHeader
              compact
              title="Product en richtprijs"
              description={
                lineCorrectionDraft.productId
                  ? `Gekozen: ${lineCorrectionDraft.productName || "product"}${
                      lineCorrectionDraft.indicativeUnitPriceExVat !== undefined &&
                      lineCorrectionDraft.indicativeVatRate !== undefined
                        ? ` — richtprijs ${formatEuro(
                            showPricesIncVat
                              ? calculateIncVat(
                                  lineCorrectionDraft.indicativeUnitPriceExVat,
                                  lineCorrectionDraft.indicativeVatRate
                                )
                              : lineCorrectionDraft.indicativeUnitPriceExVat
                          )} per ${formatUnit(lineCorrectionDraft.indicativePriceUnit ?? "custom")} (${
                            showPricesIncVat ? "incl." : "excl."
                          } btw, indicatief)`
                        : " — nog geen richtprijs beschikbaar"
                    }`
                  : "Geen product gekozen. Kies hieronder een product om een richtprijs vast te leggen."
              }
              actions={
                lineCorrectionDraft.productId ? (
                  <Button size="sm" variant="ghost" onClick={() => void selectEditLineProduct(null)}>
                    Productkeuze wissen
                  </Button>
                ) : undefined
              }
            />
            {(() => {
              const editingLine = lines.find((item) => item._id === editingLineId);

              return (
                <CatalogProductPicker
                  session={session}
                  idPrefix="measure-edit"
                  productGroupHint={
                    editingLine && editingLine.productGroup !== "other"
                      ? editingLine.productGroup
                      : null
                  }
                  selectedProductId={lineCorrectionDraft.productId}
                  selectedProductLabel={lineCorrectionDraft.productName || undefined}
                  onSelect={(product) => void selectEditLineProduct(product)}
                  label="Product (optioneel)"
                  emptyOptionLabel="Geen product gekozen"
                />
              );
            })()}
            <Field htmlFor="measurement-line-edit-notes" label="Notitie">
              <Textarea
                id="measurement-line-edit-notes"
                rows={3}
                value={lineCorrectionDraft.notes}
                onChange={(event) => setLineCorrectionDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </Field>
            <div className="toolbar">
              <Button isLoading={isSaving} leftIcon={<Save size={16} aria-hidden="true" />} type="submit" variant="primary">
                Meetregel opslaan
              </Button>
              <Button disabled={isSaving} variant="secondary" onClick={() => setEditingLineId(null)}>
                Annuleren
              </Button>
            </div>
          </form>
        ) : null}
      </Card>
    );
  }

  function renderRoomSelect(
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void
  ) {
    return (
      <Field htmlFor={id} label={label}>
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{isFieldMode ? "Algemene meting" : "Geen specifieke ruimte"}</option>
          {rooms.map((room) => (
            <option key={room._id} value={room._id}>
              {room.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  function renderProductPicker(tool: FieldMeasureTool, productGroup: MeasurementProductGroup) {
    if (!canEditMeasurement) {
      return null;
    }

    return (
      <CatalogProductPicker
        session={session}
        idPrefix={`measure-${tool}`}
        productGroupHint={productGroup === "other" ? null : productGroup}
        selectedProductId={tabProducts[tool]?.id ?? ""}
        onSelect={(product) => void selectTabProduct(tool, product)}
        label="Richtprijs: kies een product (optioneel)"
        description="De richtprijs verschijnt direct in de live berekening."
        emptyOptionLabel="Geen product gekozen"
      />
    );
  }

  function renderWasteProfileSelect(
    id: string,
    label: string,
    profiles: WasteProfileDoc[],
    onChange: (value: string) => void
  ) {
    return (
      <Field htmlFor={id} label={label}>
        <Select id={id} defaultValue="" onChange={(event) => onChange(event.target.value)}>
          <option value="">Handmatig percentage</option>
          {profiles.map((profile) => (
            <option key={profile._id} value={profile._id}>
              {profile.name} ({profile.defaultWastePercent}%)
            </option>
          ))}
        </Select>
      </Field>
    );
  }
}
