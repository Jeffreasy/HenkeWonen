import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SquareStack,
  Minus,
  Layers,
  PanelRight,
  Blinds,
  ArrowUpDown,
  LayoutGrid,
  Wrench,
  Plus,
  Pencil,
  Trash2
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AppSession } from "../../../lib/auth/session";
import { mutationActorFromSession } from "../../../lib/auth/authzToken";
import { createConvexHttpClient } from "../../../lib/convex/client";
import { formatEuro } from "../../../lib/money";
import { formatUnit } from "../../../lib/i18n/statusLabels";
import { showToast } from "../../../lib/toast";
import { restoreMeasurementProductSelection } from "../../../lib/measurementAssignDraft";
import { useFormDraft } from "../../../lib/useFormDraft";
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  PortalProduct,
  QuoteLineType
} from "../../../lib/portalTypes";
import {
  type CurtainMakeUp,
  type PatternType,
  type StairType,
  calculateCurtainFabric,
  calculateStairs,
  calculateWallPanels
} from "../../../lib/calculators";
import {
  type AssignableCalculator,
  type AssignmentParams,
  type RoomDimensions,
  calculatorForProduct,
  calculatorForService,
  deriveLineForRoom
} from "../../../lib/quotes/roomLineDerivation";
import CatalogProductPicker from "../../catalog/CatalogProductPicker";
import { Alert } from "../../ui/feedback/Alert";
import { Button } from "../../ui/forms/Button";
import { Field } from "../../ui/forms/Field";
import { Input } from "../../ui/forms/Input";
import { Select } from "../../ui/forms/Select";
import { ConfirmDialog } from "../../ui/overlays/ConfirmDialog";
import type {
  IndicativePriceResult,
  MatrixIndicativePriceResult,
  MatrixOptions,
  MeasurementRoomDoc
} from "./measurementTypes";

type ServiceRule = {
  _id: string;
  naam: string;
  berekeningType: string;
  prijsExBtw: number;
  btwTarief: number;
  status: string;
};

/** Eén regel zoals addMeasurementLinesBulk hem verwacht. */
type BulkRegel = {
  ruimteId?: Id<"measurementRooms">;
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  invoer: unknown;
  resultaat: unknown;
  snijverliesPct?: number;
  aantal: number;
  eenheid: string;
  notities?: string;
  offerteRegelType: QuoteLineType;
  productId?: Id<"products">;
  productNaam?: string;
  indicatieveEenheidsprijsExBtw?: number;
  indicatiefBtwTarief?: number;
  indicatievePrijsEenheid?: string;
  indicatievePrijsSoort?: string;
  indicatiefVastgelegdOp?: number;
};

type MeasurementAssignPanelProps = {
  session: AppSession;
  /** Tenant-slug (voor catalogus-/prijsquery's). */
  tenantSlug: string;
  /** Convex tenant-id (voor de mutaties). */
  tenantConvexId: string;
  measurementId: string;
  rooms: MeasurementRoomDoc[];
  canEdit: boolean;
  /** Geselecteerde ruimtes (controlled) zodat een ruimtekaart er één kan voorselecteren. */
  selectedRoomIds: string[];
  onSelectedRoomIdsChange: (ids: string[]) => void;
  onAdded: () => void | Promise<void>;
  /** Snelle ruimtenamen voor het inline toevoegen. */
  roomPresets: Array<{ label: string; name: string }>;
};

/** Eenheid waarmee de richtprijs wordt opgezocht, per rekenmachine. */
const UNIT_FOR_CALCULATOR: Record<AssignableCalculator, string> = {
  floor_area: "m2",
  floor_roll: "meter",
  underlay_area: "m2",
  plinth: "meter",
  wallpaper: "roll",
  service_area: "m2",
  service_perimeter: "m1",
  manual: "stuk"
};

/** Compacte "Wat toevoegen?"-keuzes. Elke keuze scope't de picker op de bijbehorende
 *  categorie en bepaalt de rekenmachine. (Speciale typen — wandpaneel/gordijn/trap/
 *  raambekleding — volgen als eigen invoer.) */
type AddType =
  | "vloer"
  | "plint"
  | "behang"
  | "wandpaneel"
  | "gordijn"
  | "trap"
  | "raambekleding"
  | "dienst";

type SpecialtyType = "wandpaneel" | "gordijn" | "trap";

const ADD_TYPES: Array<{ key: AddType; label: string; hint: MeasurementProductGroup | null }> = [
  { key: "vloer", label: "Vloer", hint: "flooring" },
  { key: "plint", label: "Plint", hint: "plinths" },
  { key: "behang", label: "Behang", hint: "wallpaper" },
  { key: "wandpaneel", label: "Wandpaneel", hint: "wall_panels" },
  { key: "gordijn", label: "Gordijn", hint: "curtains" },
  { key: "trap", label: "Trap", hint: "stairs" },
  { key: "raambekleding", label: "Raambekleding", hint: null },
  { key: "dienst", label: "Dienst / legkost", hint: null }
];

/** Icoon per producttype voor de tegel-keuze (hergebruikt de stijl van CALC_TAB_ICONS). */
const ADD_TYPE_ICONS: Record<AddType, ReactNode> = {
  vloer: <SquareStack size={22} aria-hidden="true" />,
  plint: <Minus size={22} aria-hidden="true" />,
  behang: <Layers size={22} aria-hidden="true" />,
  wandpaneel: <PanelRight size={22} aria-hidden="true" />,
  gordijn: <Blinds size={22} aria-hidden="true" />,
  trap: <ArrowUpDown size={22} aria-hidden="true" />,
  raambekleding: <LayoutGrid size={22} aria-hidden="true" />,
  dienst: <Wrench size={22} aria-hidden="true" />
};

/** Vaste regel-eigenschappen per speciaal type (eigen rekenmachine, niet ruimte-afgeleid). */
const SPECIALTY_CONFIG: Record<
  SpecialtyType,
  {
    productGroep: MeasurementProductGroup;
    berekeningType: MeasurementCalculationType;
    eenheid: string;
    offerteRegelType: QuoteLineType;
  }
> = {
  wandpaneel: {
    productGroep: "wall_panels",
    berekeningType: "panels",
    eenheid: "piece",
    offerteRegelType: "product"
  },
  gordijn: {
    productGroep: "curtains",
    berekeningType: "manual",
    eenheid: "meter",
    offerteRegelType: "product"
  },
  trap: {
    productGroep: "stairs",
    berekeningType: "stairs",
    eenheid: "stairs",
    offerteRegelType: "service"
  }
};

/** "12,5" → 12.5; lege/ongeldige invoer → undefined. */
function parseNum(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roomDimensions(room: MeasurementRoomDoc): RoomDimensions {
  return {
    breedteM: room.breedteM,
    lengteM: room.lengteM,
    hoogteM: room.hoogteM,
    oppervlakteM2: room.oppervlakteM2,
    omtrekM: room.omtrekM
  };
}

const lower = (value: string) => value.toLowerCase();

/** Diensten die vaak samen met een vloer horen — voor de bundel-suggesties. */
function bundleSuggestions(
  rules: ServiceRule[],
  calculator: AssignableCalculator,
  pattern: PatternType
): ServiceRule[] {
  if (calculator !== "floor_area" && calculator !== "floor_roll") {
    return [];
  }

  const active = rules.filter((rule) => rule.status === "active");
  const suggestions: ServiceRule[] = [];

  if (calculator === "floor_area") {
    const legkostKey = pattern === "herringbone" ? "visgraat" : "rechte plank";
    const legkost = active.find(
      (rule) =>
        lower(rule.naam).includes("legkost") &&
        lower(rule.naam).includes(legkostKey) &&
        !lower(rule.naam).includes("bies")
    );
    if (legkost) suggestions.push(legkost);
  }

  const egaliseren = active.find(
    (rule) => lower(rule.naam).includes("egaliseren") && !lower(rule.naam).includes("plavuizen")
  );
  if (egaliseren) suggestions.push(egaliseren);

  const ondervloer = active.find((rule) => lower(rule.naam).includes("ondervloer"));
  if (ondervloer) suggestions.push(ondervloer);

  return suggestions;
}

export default function MeasurementAssignPanel({
  session,
  tenantSlug,
  tenantConvexId,
  measurementId,
  rooms,
  canEdit,
  selectedRoomIds,
  onSelectedRoomIdsChange,
  onAdded,
  roomPresets
}: MeasurementAssignPanelProps) {
  const [addType, setAddType] = useState<AddType>("vloer");
  const [product, setProduct] = useState<PortalProduct | null>(null);
  const [productPrice, setProductPrice] = useState<IndicativePriceResult | null>(null);
  const [serviceRules, setServiceRules] = useState<ServiceRule[]>([]);
  const [serviceRuleId, setServiceRuleId] = useState("");
  const [bundleRuleIds, setBundleRuleIds] = useState<string[]>([]);

  const [patternType, setPatternType] = useState<PatternType>("straight");
  const [rollWidthM, setRollWidthM] = useState("4");
  const [doorOpeningM, setDoorOpeningM] = useState("0");
  const [rollWidthCm, setRollWidthCm] = useState("53");
  const [rollLengthM, setRollLengthM] = useState("10.05");
  const [patternRepeatCm, setPatternRepeatCm] = useState("0");

  // Wandpaneel
  const [wallWidthM, setWallWidthM] = useState("");
  const [wallHeightM, setWallHeightM] = useState("");
  const [panelWidthM, setPanelWidthM] = useState("");
  const [panelHeightM, setPanelHeightM] = useState("");
  const [wallPanelWastePercent, setWallPanelWastePercent] = useState("8");
  // Gordijn
  const [curtainRailWidthM, setCurtainRailWidthM] = useState("");
  const [curtainHeightM, setCurtainHeightM] = useState("");
  const [curtainFabricWidthM, setCurtainFabricWidthM] = useState("1.4");
  const [curtainFullness, setCurtainFullness] = useState("2");
  const [curtainMakeUp, setCurtainMakeUp] = useState<CurtainMakeUp>("banen");
  const [curtainRapportM, setCurtainRapportM] = useState("0");
  // Trap
  const [stairType, setStairType] = useState<StairType>("closed");
  const [treadCount, setTreadCount] = useState("");
  const [riserCount, setRiserCount] = useState("");
  const [stripLengthM, setStripLengthM] = useState("");
  // Raambekleding (matrix — productloos, eigen prijslookup)
  const [wcType, setWcType] = useState("");
  const [wcPriceGroup, setWcPriceGroup] = useState("");
  const [wcWidthCm, setWcWidthCm] = useState("");
  const [wcHeightCm, setWcHeightCm] = useState("");
  const [wcQuantity, setWcQuantity] = useState("1");
  const [wcOptions, setWcOptions] = useState<MatrixOptions | null>(null);
  const [wcPrice, setWcPrice] = useState<MatrixIndicativePriceResult | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline ruimte toevoegen/bewerken (vervangt de aparte "Waar meet je?"-stap).
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);
  const [rNaam, setRNaam] = useState("");
  const [rBreedte, setRBreedte] = useState("");
  const [rLengte, setRLengte] = useState("");
  const [rHoogte, setRHoogte] = useState("");
  const [isRoomSaving, setIsRoomSaving] = useState(false);

  // Draft-vangnet voor mobiel (buitendienst): alle maatinvoer leeft in React-state en
  // was weg zodra de browser de tab weggooide (bv. even naar de camera-app). Spiegel
  // de vluchtige invoer per inmeting naar localStorage en zet 'm bij mount terug.
  useFormDraft(
    `henke-meetinvoer-${measurementId}`,
    {
      addType, product, serviceRuleId,
      patternType, rollWidthM, doorOpeningM, rollWidthCm, rollLengthM,
      patternRepeatCm, wallWidthM, wallHeightM, panelWidthM, panelHeightM,
      wallPanelWastePercent, curtainRailWidthM, curtainHeightM, curtainFabricWidthM,
      curtainFullness, curtainMakeUp, curtainRapportM, stairType, treadCount,
      riserCount, stripLengthM, wcType, wcPriceGroup, wcWidthCm, wcHeightCm,
      wcQuantity, roomFormOpen, editingRoomId, rNaam, rBreedte, rLengte, rHoogte
    },
    (draft) => {
      const str = (value: unknown, set: (v: string) => void) => {
        if (typeof value === "string") set(value);
      };
      if (typeof draft.addType === "string") setAddType(draft.addType as AddType);
      // De productselectie: het hele product (voor picker-trigger én rekenmachine) plus de
      // losse dienstkeuze. De richtprijs volgt vanzelf uit het herstelde product (re-fetch).
      const productSelection = restoreMeasurementProductSelection(draft);
      if (productSelection.product !== undefined) setProduct(productSelection.product);
      if (productSelection.serviceRuleId !== undefined) {
        setServiceRuleId(productSelection.serviceRuleId);
      }
      if (typeof draft.patternType === "string") setPatternType(draft.patternType as PatternType);
      str(draft.rollWidthM, setRollWidthM);
      str(draft.doorOpeningM, setDoorOpeningM);
      str(draft.rollWidthCm, setRollWidthCm);
      str(draft.rollLengthM, setRollLengthM);
      str(draft.patternRepeatCm, setPatternRepeatCm);
      str(draft.wallWidthM, setWallWidthM);
      str(draft.wallHeightM, setWallHeightM);
      str(draft.panelWidthM, setPanelWidthM);
      str(draft.panelHeightM, setPanelHeightM);
      str(draft.wallPanelWastePercent, setWallPanelWastePercent);
      str(draft.curtainRailWidthM, setCurtainRailWidthM);
      str(draft.curtainHeightM, setCurtainHeightM);
      str(draft.curtainFabricWidthM, setCurtainFabricWidthM);
      str(draft.curtainFullness, setCurtainFullness);
      if (typeof draft.curtainMakeUp === "string") {
        setCurtainMakeUp(draft.curtainMakeUp as CurtainMakeUp);
      }
      str(draft.curtainRapportM, setCurtainRapportM);
      if (typeof draft.stairType === "string") setStairType(draft.stairType as StairType);
      str(draft.treadCount, setTreadCount);
      str(draft.riserCount, setRiserCount);
      str(draft.stripLengthM, setStripLengthM);
      str(draft.wcType, setWcType);
      str(draft.wcPriceGroup, setWcPriceGroup);
      str(draft.wcWidthCm, setWcWidthCm);
      str(draft.wcHeightCm, setWcHeightCm);
      str(draft.wcQuantity, setWcQuantity);
      if (typeof draft.roomFormOpen === "boolean") setRoomFormOpen(draft.roomFormOpen);
      if (typeof draft.editingRoomId === "string" || draft.editingRoomId === null) {
        setEditingRoomId(draft.editingRoomId ?? null);
      }
      str(draft.rNaam, setRNaam);
      str(draft.rBreedte, setRBreedte);
      str(draft.rLengte, setRLengte);
      str(draft.rHoogte, setRHoogte);
    }
  );

  // Diensten/legkosten laden voor de dienst-kiezer + bundel-suggesties.
  useEffect(() => {
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) return;

    void (async () => {
      try {
        const rules = (await client.query(api.beheer.serviceCostRules.list, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session)
        })) as ServiceRule[];
        if (active) setServiceRules(rules ?? []);
      } catch (loadError) {
        console.error(loadError);
      }
    })();

    return () => {
      active = false;
    };
  }, [session, tenantConvexId]);

  const selectedService = useMemo(
    () => serviceRules.find((rule) => rule._id === serviceRuleId) ?? null,
    [serviceRules, serviceRuleId]
  );

  const isService = addType === "dienst";
  const productGroupHint = useMemo<MeasurementProductGroup | null>(
    () => ADD_TYPES.find((entry) => entry.key === addType)?.hint ?? null,
    [addType]
  );

  const calculator: AssignableCalculator | null = useMemo(() => {
    if (addType === "dienst") {
      return selectedService ? calculatorForService(selectedService.berekeningType) : null;
    }
    if (!product) return null;
    if (addType === "plint") return "plinth";
    if (addType === "behang") return "wallpaper";
    if (addType === "vloer") {
      // Leid af uit het product (harde vloer per m², rolgoed per meter, of ondervloer).
      return calculatorForProduct({
        category: product.category,
        productSoort: product.productSoort
      });
    }
    return null; // wandpaneel/gordijn/trap hebben een eigen rekenmachine (zie `specialty`).
  }, [addType, product, selectedService]);

  const isSpecialty = addType === "wandpaneel" || addType === "gordijn" || addType === "trap";
  const isMatrix = addType === "raambekleding";

  // Raambekleding-matrix: beschikbare typen/prijsgroepen laden zodra dit type gekozen is.
  useEffect(() => {
    if (!isMatrix) return;
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) return;

    void (async () => {
      try {
        const result = (await client.query(api.catalog.pricing.listMatrixOptions, {
          tenantSlug,
          actor: mutationActorFromSession(session),
          productToolSleutel: "raambekleding"
        })) as MatrixOptions;
        if (active) setWcOptions(result);
      } catch (loadError) {
        console.error(loadError);
        if (active) setWcOptions(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [isMatrix, session, tenantSlug]);

  const wcWidthNum = parseNum(wcWidthCm);
  const wcHeightNum = parseNum(wcHeightCm);
  const wcQuantityNum = parseNum(wcQuantity);
  const isMatrixReady =
    isMatrix &&
    Boolean(wcType) &&
    Boolean(wcPriceGroup) &&
    (wcWidthNum ?? 0) > 0 &&
    (wcHeightNum ?? 0) > 0 &&
    (wcQuantityNum ?? 0) > 0;

  // Matrix-richtprijs ophalen zodra type + prijsgroep + maten ingevuld zijn (productloos).
  useEffect(() => {
    if (
      !isMatrix ||
      !wcType ||
      !wcPriceGroup ||
      !((wcWidthNum ?? 0) > 0) ||
      !((wcHeightNum ?? 0) > 0)
    ) {
      setWcPrice(null);
      return;
    }
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) return;

    void (async () => {
      try {
        const result = (await client.query(api.catalog.pricing.getMatrixIndicativePrice, {
          tenantSlug,
          actor: mutationActorFromSession(session),
          productToolSleutel: "raambekleding",
          prijsgroep: wcPriceGroup,
          bronBlad: wcType,
          breedteCm: wcWidthNum ?? 0,
          hoogteCm: wcHeightNum ?? 0
        })) as MatrixIndicativePriceResult;
        if (active) setWcPrice(result);
      } catch (priceError) {
        console.error(priceError);
        if (active) setWcPrice(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [isMatrix, wcType, wcPriceGroup, wcWidthNum, wcHeightNum, session, tenantSlug]);

  // Eigen rekenmachine voor de speciale typen (niet ruimte-afgeleid). Hergebruikt de pure
  // calculator-functies uit lib/calculators; het product (optioneel) levert alleen de richtprijs.
  const specialty = useMemo(() => {
    if (addType === "wandpaneel") {
      const result = calculateWallPanels({
        wallWidthM: parseNum(wallWidthM) ?? 0,
        wallHeightM: parseNum(wallHeightM) ?? 0,
        panelWidthM: parseNum(panelWidthM) ?? 0,
        panelHeightM: parseNum(panelHeightM) ?? 0,
        wastePercent: parseNum(wallPanelWastePercent) ?? 0
      });
      return {
        hasInput: Boolean(wallWidthM || wallHeightM || panelWidthM || panelHeightM),
        validationError: result.validationError,
        aantal: result.quoteQuantityPieces,
        snijverliesPct: parseNum(wallPanelWastePercent),
        invoer: {
          wallWidthM: parseNum(wallWidthM),
          wallHeightM: parseNum(wallHeightM),
          panelWidthM: parseNum(panelWidthM),
          panelHeightM: parseNum(panelHeightM),
          wastePercent: parseNum(wallPanelWastePercent)
        } as Record<string, unknown>,
        resultaat: result as unknown as Record<string, unknown>,
        ...SPECIALTY_CONFIG.wandpaneel
      };
    }
    if (addType === "gordijn") {
      const result = calculateCurtainFabric({
        railWidthM: parseNum(curtainRailWidthM) ?? 0,
        curtainHeightM: parseNum(curtainHeightM) ?? 0,
        fabricWidthM: parseNum(curtainFabricWidthM) ?? 0,
        fullness: parseNum(curtainFullness) ?? 0,
        makeUp: curtainMakeUp,
        rapportM: parseNum(curtainRapportM) ?? 0
      });
      return {
        hasInput: Boolean(curtainRailWidthM || curtainHeightM),
        validationError: result.validationError,
        aantal: result.quoteQuantityM,
        snijverliesPct: undefined,
        invoer: {
          railWidthM: parseNum(curtainRailWidthM),
          curtainHeightM: parseNum(curtainHeightM),
          fabricWidthM: parseNum(curtainFabricWidthM),
          fullness: parseNum(curtainFullness),
          makeUp: curtainMakeUp,
          rapportM: parseNum(curtainRapportM)
        } as Record<string, unknown>,
        resultaat: result as unknown as Record<string, unknown>,
        ...SPECIALTY_CONFIG.gordijn
      };
    }
    if (addType === "trap") {
      const result = calculateStairs({
        stairType,
        treadCount: parseNum(treadCount) ?? 0,
        riserCount: parseNum(riserCount) ?? 0,
        stripLengthM: parseNum(stripLengthM)
      });
      return {
        hasInput: Boolean(treadCount),
        validationError: result.validationError,
        aantal: result.quoteQuantity,
        snijverliesPct: undefined,
        invoer: {
          stairType,
          treadCount: parseNum(treadCount),
          riserCount: parseNum(riserCount),
          stripLengthM: parseNum(stripLengthM)
        } as Record<string, unknown>,
        resultaat: result as unknown as Record<string, unknown>,
        ...SPECIALTY_CONFIG.trap
      };
    }
    return null;
  }, [
    addType,
    wallWidthM,
    wallHeightM,
    panelWidthM,
    panelHeightM,
    wallPanelWastePercent,
    curtainRailWidthM,
    curtainHeightM,
    curtainFabricWidthM,
    curtainFullness,
    curtainMakeUp,
    curtainRapportM,
    stairType,
    treadCount,
    riserCount,
    stripLengthM
  ]);

  // Eenheid voor de richtprijs-lookup: uit de engine-rekenmachine of (bij speciale typen) uit de config.
  const priceUnit = useMemo<string | null>(() => {
    if (isService) return null;
    if (calculator) return UNIT_FOR_CALCULATOR[calculator];
    if (specialty) return specialty.eenheid;
    return null;
  }, [isService, calculator, specialty]);

  // Bij wisselen van type: gekozen product/dienst wissen zodat er niets blijft hangen.
  function chooseType(next: AddType) {
    setAddType(next);
    setProduct(null);
    setProductPrice(null);
    setServiceRuleId("");
    setWcType("");
    setWcPriceGroup("");
    setWcPrice(null);
    setError(null);
  }

  // Richtprijs ophalen voor het gekozen product (eenheid hangt van de rekenmachine af).
  useEffect(() => {
    if (!product || !priceUnit) {
      setProductPrice(null);
      return;
    }
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) return;

    void (async () => {
      try {
        const result = (await client.query(api.catalog.pricing.getIndicativePrice, {
          tenantSlug,
          productId: product.id as Id<"products">,
          measurementUnit: priceUnit
        })) as IndicativePriceResult;
        if (active) setProductPrice(result);
      } catch (priceError) {
        console.error(priceError);
        if (active) setProductPrice(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [product, priceUnit, session, tenantSlug]);

  const suggestions = useMemo(
    () => (calculator ? bundleSuggestions(serviceRules, calculator, patternType) : []),
    [serviceRules, calculator, patternType]
  );

  // Bundels staan in v1 standaard aangevinkt; de winkel vinkt af wat niet hoeft.
  useEffect(() => {
    setBundleRuleIds(suggestions.map((rule) => rule._id));
  }, [suggestions]);

  const params: AssignmentParams = useMemo(
    () => ({
      patternType,
      rollWidthM: Number(rollWidthM.replace(",", ".")) || undefined,
      doorOpeningM: Number(doorOpeningM.replace(",", ".")) || 0,
      rollWidthCm: Number(rollWidthCm.replace(",", ".")) || undefined,
      rollLengthM: Number(rollLengthM.replace(",", ".")) || undefined,
      patternRepeatCm: Number(patternRepeatCm.replace(",", ".")) || 0
    }),
    [patternType, rollWidthM, doorOpeningM, rollWidthCm, rollLengthM, patternRepeatCm]
  );

  function toggleRoom(roomId: string) {
    onSelectedRoomIdsChange(
      selectedRoomIds.includes(roomId)
        ? selectedRoomIds.filter((id) => id !== roomId)
        : [...selectedRoomIds, roomId]
    );
  }

  function openNewRoom() {
    setEditingRoomId(null);
    setRNaam("");
    setRBreedte("");
    setRLengte("");
    setRHoogte("");
    setRoomFormOpen(true);
  }

  function openEditRoom(room: MeasurementRoomDoc) {
    setEditingRoomId(room._id);
    setRNaam(room.naam);
    setRBreedte(room.breedteM !== undefined ? String(room.breedteM) : "");
    setRLengte(room.lengteM !== undefined ? String(room.lengteM) : "");
    setRHoogte(room.hoogteM !== undefined ? String(room.hoogteM) : "");
    setRoomFormOpen(true);
  }

  async function submitRoom() {
    if (!rNaam.trim()) return;

    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de inmeting nu niet bereiken.");
      return;
    }

    // Lege maten blijven leeg (undefined); weiger negatieve of niet-numerieke invoer
    // zodat een ruimte met alleen een naam geen schijn-0m × 0m krijgt.
    const parseDim = (value: string, label: string): number | undefined => {
      if (!value.trim()) return undefined;
      const parsed = parseNum(value);
      if (parsed === undefined || parsed < 0) {
        throw new Error(`${label} is geen geldige maat.`);
      }
      return parsed;
    };

    let breedteM: number | undefined;
    let lengteM: number | undefined;
    let hoogteM: number | undefined;
    try {
      breedteM = parseDim(rBreedte, "Breedte");
      lengteM = parseDim(rLengte, "Lengte");
      hoogteM = parseDim(rHoogte, "Hoogte");
    } catch (validationError) {
      setError(
        validationError instanceof Error ? validationError.message : "Vul geldige ruimtematen in."
      );
      return;
    }
    const hasBoth = breedteM !== undefined && lengteM !== undefined;
    const oppervlakteM2 = hasBoth ? Math.round(breedteM! * lengteM! * 100) / 100 : undefined;
    const omtrekM = hasBoth ? Math.round(2 * (breedteM! + lengteM!) * 100) / 100 : undefined;

    setIsRoomSaving(true);
    setError(null);
    try {
      if (editingRoomId) {
        const result = (await client.mutation(api.projecten.measurements.updateMeasurementRoom, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session),
          ruimteId: editingRoomId as Id<"measurementRooms">,
          naam: rNaam.trim(),
          breedteM,
          lengteM,
          hoogteM,
          oppervlakteM2,
          omtrekM
        })) as { ruimteId: string; herekendeRegels: number };
        // Maatcorrectie: de automatische meetregels van deze ruimte zijn server-side
        // mee-herrekend — laat dat expliciet zien, zodat duidelijk is dat de nieuwe
        // maten ook in de klaarstaande regels (en dus de offerte) landen.
        if (result.herekendeRegels > 0) {
          showToast({
            title: `${result.herekendeRegels} meetregel${result.herekendeRegels === 1 ? "" : "s"} herrekend met de nieuwe maten`,
            tone: "info"
          });
        }
      } else {
        const newId = (await client.mutation(api.projecten.measurements.addMeasurementRoom, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session),
          inmetingId: measurementId as Id<"measurements">,
          naam: rNaam.trim(),
          breedteM,
          lengteM,
          hoogteM,
          oppervlakteM2,
          omtrekM
        })) as Id<"measurementRooms">;
        if (!selectedRoomIds.includes(String(newId))) {
          onSelectedRoomIdsChange([...selectedRoomIds, String(newId)]);
        }
      }
      setRoomFormOpen(false);
      setEditingRoomId(null);
      await onAdded();
    } catch (saveError) {
      console.error(saveError);
      setError("Ruimte kon niet worden opgeslagen.");
    } finally {
      setIsRoomSaving(false);
    }
  }

  async function deleteRoom(roomId: string) {
    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de inmeting nu niet bereiken.");
      return;
    }

    setIsRoomSaving(true);
    setError(null);
    try {
      await client.mutation(api.projecten.measurements.deleteMeasurementRoom, {
        tenantId: tenantConvexId as Id<"tenants">,
        actor: mutationActorFromSession(session),
        ruimteId: roomId as Id<"measurementRooms">
      });
      onSelectedRoomIdsChange(selectedRoomIds.filter((id) => id !== roomId));
      setRoomFormOpen(false);
      setEditingRoomId(null);
      await onAdded();
    } catch (deleteError) {
      console.error(deleteError);
      // Een ruimte met meetregels kan niet verwijderd worden — leg dat uit.
      setError(
        deleteError instanceof Error && /regel|line|in gebruik/i.test(deleteError.message)
          ? "Deze ruimte heeft nog meetregels — verwijder die eerst."
          : "Ruimte kon niet worden verwijderd."
      );
    } finally {
      setIsRoomSaving(false);
    }
  }

  function toggleBundle(ruleId: string) {
    setBundleRuleIds((current) =>
      current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId]
    );
  }

  const canSubmit =
    canEdit &&
    !isSaving &&
    selectedRoomIds.length > 0 &&
    (isMatrix
      ? isMatrixReady
      : isSpecialty
        ? Boolean(specialty) && !specialty?.validationError && (specialty?.aantal ?? 0) > 0
        : calculator !== null && calculator !== "manual");

  function productSnapshot(): Partial<BulkRegel> {
    if (!product) return {};
    const indicative = productPrice?.indicative ?? null;
    return {
      productId: product.id as Id<"products">,
      productNaam: productPrice?.productName ?? product.weergaveNaam ?? product.naam,
      ...(indicative
        ? {
            indicatieveEenheidsprijsExBtw: indicative.unitPriceExVat,
            indicatiefBtwTarief: indicative.vatRate,
            indicatievePrijsEenheid: indicative.priceUnit,
            indicatievePrijsSoort: indicative.priceType,
            indicatiefVastgelegdOp: Date.now()
          }
        : {})
    };
  }

  function serviceSnapshot(rule: ServiceRule, eenheid: string): Partial<BulkRegel> {
    return {
      productNaam: rule.naam,
      indicatieveEenheidsprijsExBtw: rule.prijsExBtw,
      indicatiefBtwTarief: rule.btwTarief,
      indicatievePrijsEenheid: eenheid,
      indicatievePrijsSoort: "service_rule",
      indicatiefVastgelegdOp: Date.now()
    };
  }

  async function submit() {
    if (!canSubmit) return;

    const selectedRooms = rooms.filter((room) => selectedRoomIds.includes(room._id));
    const regels: BulkRegel[] = [];
    const missing: string[] = [];

    if (isMatrix) {
      // Raambekleding: matrix-richtprijs (productloos), per gekozen ruimte als één regel.
      const breedteCm = wcWidthNum ?? 0;
      const hoogteCm = wcHeightNum ?? 0;
      const quantity = wcQuantityNum ?? 1;
      const indicative = wcPrice?.indicative ?? null;
      const label = `Raambekleding ${[wcType, wcPriceGroup].filter(Boolean).join(" – ")}`;
      const matrixSnapshot: Partial<BulkRegel> = indicative
        ? {
            productNaam: `${label} – ${indicative.matchedWidthCm}×${indicative.matchedHeightCm} cm`,
            indicatieveEenheidsprijsExBtw: indicative.unitPriceExVat,
            indicatiefBtwTarief: indicative.vatRate,
            indicatievePrijsEenheid: "piece",
            indicatievePrijsSoort: "matrix",
            indicatiefVastgelegdOp: Date.now()
          }
        : {};
      for (const room of selectedRooms) {
        regels.push({
          ruimteId: room._id as Id<"measurementRooms">,
          productGroep: "curtains",
          berekeningType: "matrix",
          invoer: {
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
          resultaat: {
            unitPriceExVat: indicative?.unitPriceExVat,
            matchedWidthCm: indicative?.matchedWidthCm,
            matchedHeightCm: indicative?.matchedHeightCm,
            quantity,
            outOfRange: wcPrice?.outOfRange ?? false,
            isIndicative: true
          },
          aantal: quantity,
          eenheid: "piece",
          offerteRegelType: "product",
          ...matrixSnapshot
        });
      }
    } else if (isSpecialty && specialty) {
      // Speciaal type: één eigen berekening (eigen maten), toegepast op elke gekozen ruimte.
      const snapshot = productSnapshot();
      for (const room of selectedRooms) {
        regels.push({
          ruimteId: room._id as Id<"measurementRooms">,
          productGroep: specialty.productGroep,
          berekeningType: specialty.berekeningType,
          invoer: specialty.invoer,
          resultaat: specialty.resultaat,
          snijverliesPct: specialty.snijverliesPct,
          aantal: specialty.aantal,
          eenheid: specialty.eenheid,
          offerteRegelType: specialty.offerteRegelType,
          ...snapshot
        });
      }
    } else if (calculator) {
      for (const room of selectedRooms) {
        const dims = roomDimensions(room);
        const main = deriveLineForRoom(calculator, dims, params);

        if (main.validationError) {
          missing.push(room.naam);
          continue;
        }

        const snapshot = !isService
          ? productSnapshot()
          : selectedService
            ? serviceSnapshot(selectedService, main.eenheid)
            : {};

        regels.push({
          ruimteId: room._id as Id<"measurementRooms">,
          productGroep: main.productGroep,
          berekeningType: main.berekeningType,
          invoer: main.invoer,
          resultaat: main.resultaat,
          snijverliesPct: main.snijverliesPct,
          aantal: main.aantal,
          eenheid: main.eenheid,
          offerteRegelType: main.offerteRegelType,
          ...snapshot
        });

        // Bundel-diensten voor dezelfde ruimte (alleen bij producten, niet bij een losse dienst).
        if (!isService) {
          for (const rule of suggestions) {
            if (!bundleRuleIds.includes(rule._id)) continue;
            const bundleCalc = calculatorForService(rule.berekeningType);
            const bundleLine = deriveLineForRoom(bundleCalc, dims, params);
            if (bundleLine.validationError) continue;
            regels.push({
              ruimteId: room._id as Id<"measurementRooms">,
              productGroep: bundleLine.productGroep,
              berekeningType: bundleLine.berekeningType,
              invoer: bundleLine.invoer,
              resultaat: bundleLine.resultaat,
              snijverliesPct: bundleLine.snijverliesPct,
              aantal: bundleLine.aantal,
              eenheid: bundleLine.eenheid,
              offerteRegelType: bundleLine.offerteRegelType,
              ...serviceSnapshot(rule, bundleLine.eenheid)
            });
          }
        }
      }
    }

    if (missing.length > 0) {
      setError(`Deze ruimtes missen nog maten: ${missing.join(", ")}.`);
      return;
    }

    if (regels.length === 0) {
      setError("Niets om toe te voegen.");
      return;
    }

    const client = createConvexHttpClient(session);
    if (!client) {
      setError("Kan de inmeting nu niet bereiken.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = (await client.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
        tenantId: tenantConvexId as Id<"tenants">,
        actor: mutationActorFromSession(session),
        inmetingId: measurementId as Id<"measurements">,
        regels
      })) as { count: number };

      showToast({
        title: `${result.count} regel${result.count === 1 ? "" : "s"} toegevoegd`,
        tone: "success"
      });
      onSelectedRoomIdsChange([]);
      setProduct(null);
      setProductPrice(null);
      setServiceRuleId("");
      await onAdded();
    } catch (saveError) {
      console.error(saveError);
      setError("Toevoegen aan de ruimtes is niet gelukt.");
    } finally {
      setIsSaving(false);
    }
  }

  const productLabel = product?.weergaveNaam ?? product?.naam ?? "";
  const activeTypeLabel = ADD_TYPES.find((entry) => entry.key === addType)?.label ?? "Product";

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div
        role="radiogroup"
        aria-label="Producttype"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
          gap: 8
        }}
      >
        {ADD_TYPES.map((entry) => {
          const active = addType === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseType(entry.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "12px 8px",
                cursor: "pointer",
                font: "inherit",
                border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                background: active ? "var(--surface-muted)" : "var(--surface-raised)",
                color: active ? "var(--accent)" : "var(--ink)"
              }}
            >
              {ADD_TYPE_ICONS[entry.key]}
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: active ? 700 : 500,
                  textAlign: "center",
                  lineHeight: 1.2
                }}
              >
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>

      {isMatrix ? null : !isService ? (
        <CatalogProductPicker
          session={session}
          idPrefix="assign"
          productGroupHint={productGroupHint}
          selectedProductId={product?.id ?? ""}
          selectedProductLabel={productLabel}
          onSelect={(next) => setProduct(next)}
          label={`${activeTypeLabel} kiezen`}
          showPriceInLabel
        />
      ) : (
        <Field htmlFor="assign-service" label="Dienst / legkost">
          <Select
            id="assign-service"
            value={serviceRuleId}
            onChange={(event) => setServiceRuleId(event.target.value)}
          >
            <option value="">Kies een dienst…</option>
            {serviceRules
              .filter((rule) => rule.status === "active")
              .map((rule) => (
                <option key={rule._id} value={rule._id}>
                  {rule.naam} — {formatEuro(rule.prijsExBtw)} /{" "}
                  {rule.berekeningType === "per_meter" ? "m" : "m²"}
                </option>
              ))}
          </Select>
        </Field>
      )}

      {calculator === "manual" ? (
        <Alert
          variant="info"
          description="Dit product wordt per stuk/maatwerk afgerekend en kan hier niet automatisch berekend worden (bv. een karpet). Gebruik hiervoor een vrije regel in de winkel-inmeting."
        />
      ) : null}

      {calculator === "floor_area" ? (
        <Field
          htmlFor="assign-pattern"
          label="Legpatroon"
          helpText="Stuurt het snijverlies automatisch: recht 3%, visgraat 5%."
        >
          <Select
            id="assign-pattern"
            value={patternType}
            onChange={(event) => setPatternType(event.target.value as PatternType)}
          >
            <option value="straight">Rechte plank</option>
            <option value="herringbone">Visgraat</option>
            <option value="tile">Tegelpatroon</option>
            <option value="custom">Maatwerk</option>
          </Select>
        </Field>
      ) : null}

      {calculator === "floor_roll" ? (
        <Field htmlFor="assign-roll-width" label="Rolbreedte in meter">
          <Input
            id="assign-roll-width"
            inputMode="decimal"
            value={rollWidthM}
            onChange={(event) => setRollWidthM(event.target.value)}
          />
        </Field>
      ) : null}

      {calculator === "plinth" ? (
        <Field htmlFor="assign-door" label="Deuropening in meter (eraf)">
          <Input
            id="assign-door"
            inputMode="decimal"
            value={doorOpeningM}
            onChange={(event) => setDoorOpeningM(event.target.value)}
          />
        </Field>
      ) : null}

      {calculator === "wallpaper" ? (
        <div className="responsive-form-row">
          <Field htmlFor="assign-roll-width-cm" label="Rolbreedte cm">
            <Input
              id="assign-roll-width-cm"
              inputMode="decimal"
              value={rollWidthCm}
              onChange={(event) => setRollWidthCm(event.target.value)}
            />
          </Field>
          <Field htmlFor="assign-roll-length" label="Rollengte m">
            <Input
              id="assign-roll-length"
              inputMode="decimal"
              value={rollLengthM}
              onChange={(event) => setRollLengthM(event.target.value)}
            />
          </Field>
          <Field
            htmlFor="assign-pattern-repeat"
            label="Patroonrapport cm"
            helpText="0 = effen, geen snijverlies."
          >
            <Input
              id="assign-pattern-repeat"
              inputMode="decimal"
              value={patternRepeatCm}
              onChange={(event) => setPatternRepeatCm(event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {addType === "wandpaneel" ? (
        <div className="responsive-form-row">
          <Field htmlFor="assign-wall-width" label="Wandbreedte m">
            <Input
              id="assign-wall-width"
              inputMode="decimal"
              value={wallWidthM}
              onChange={(e) => setWallWidthM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-wall-height" label="Wandhoogte m">
            <Input
              id="assign-wall-height"
              inputMode="decimal"
              value={wallHeightM}
              onChange={(e) => setWallHeightM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-panel-width" label="Paneelbreedte m">
            <Input
              id="assign-panel-width"
              inputMode="decimal"
              value={panelWidthM}
              onChange={(e) => setPanelWidthM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-panel-height" label="Paneelhoogte m">
            <Input
              id="assign-panel-height"
              inputMode="decimal"
              value={panelHeightM}
              onChange={(e) => setPanelHeightM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-wallpanel-waste" label="Snijverlies %">
            <Input
              id="assign-wallpanel-waste"
              inputMode="decimal"
              value={wallPanelWastePercent}
              onChange={(e) => setWallPanelWastePercent(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {addType === "gordijn" ? (
        <div className="responsive-form-row">
          <Field htmlFor="assign-rail-width" label="Railbreedte m">
            <Input
              id="assign-rail-width"
              inputMode="decimal"
              value={curtainRailWidthM}
              onChange={(e) => setCurtainRailWidthM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-curtain-height" label="Gordijnhoogte m">
            <Input
              id="assign-curtain-height"
              inputMode="decimal"
              value={curtainHeightM}
              onChange={(e) => setCurtainHeightM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-fabric-width" label="Stofbreedte m">
            <Input
              id="assign-fabric-width"
              inputMode="decimal"
              value={curtainFabricWidthM}
              onChange={(e) => setCurtainFabricWidthM(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-fullness" label="Plooifactor">
            <Input
              id="assign-fullness"
              inputMode="decimal"
              value={curtainFullness}
              onChange={(e) => setCurtainFullness(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-makeup" label="Confectie">
            <Select
              id="assign-makeup"
              value={curtainMakeUp}
              onChange={(e) => setCurtainMakeUp(e.target.value as CurtainMakeUp)}
            >
              <option value="banen">Banen</option>
              <option value="kamerhoog">Kamerhoog</option>
            </Select>
          </Field>
          <Field
            htmlFor="assign-curtain-rapport"
            label="Patroonrapport m"
            helpText="0 = geen rapport."
          >
            <Input
              id="assign-curtain-rapport"
              inputMode="decimal"
              value={curtainRapportM}
              onChange={(e) => setCurtainRapportM(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {addType === "trap" ? (
        <div className="responsive-form-row">
          <Field htmlFor="assign-stair-type" label="Traptype">
            <Select
              id="assign-stair-type"
              value={stairType}
              onChange={(e) => setStairType(e.target.value as StairType)}
            >
              <option value="closed">Dicht</option>
              <option value="open">Open</option>
              <option value="straight">Recht</option>
              <option value="quarter_turn">Kwartslag</option>
              <option value="half_turn">Halfslag</option>
            </Select>
          </Field>
          <Field htmlFor="assign-tread-count" label="Aantal treden">
            <Input
              id="assign-tread-count"
              inputMode="decimal"
              value={treadCount}
              onChange={(e) => setTreadCount(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-riser-count" label="Aantal stootborden">
            <Input
              id="assign-riser-count"
              inputMode="decimal"
              value={riserCount}
              onChange={(e) => setRiserCount(e.target.value)}
            />
          </Field>
          <Field htmlFor="assign-strip-length" label="Strooklengte m (optioneel)">
            <Input
              id="assign-strip-length"
              inputMode="decimal"
              value={stripLengthM}
              onChange={(e) => setStripLengthM(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {isMatrix ? (
        <>
          <div className="responsive-form-row">
            <Field htmlFor="assign-wc-type" label="Type raambekleding">
              <Select
                id="assign-wc-type"
                value={wcType}
                onChange={(e) => {
                  setWcType(e.target.value);
                  setWcPriceGroup("");
                }}
              >
                <option value="">Kies type…</option>
                {(wcOptions?.types ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="assign-wc-group" label="Prijsgroep">
              <Select
                id="assign-wc-group"
                value={wcPriceGroup}
                disabled={!wcType}
                onChange={(e) => setWcPriceGroup(e.target.value)}
              >
                <option value="">Kies prijsgroep…</option>
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
          </div>
          <div className="responsive-form-row">
            <Field
              htmlFor="assign-wc-width"
              label="Breedte cm"
              helpText="Raammaat in cm (bijv. 120)."
            >
              <Input
                id="assign-wc-width"
                inputMode="decimal"
                placeholder="bijv. 120"
                value={wcWidthCm}
                onChange={(e) => setWcWidthCm(e.target.value)}
              />
            </Field>
            <Field
              htmlFor="assign-wc-height"
              label="Hoogte cm"
              helpText="Raammaat in cm (bijv. 120)."
            >
              <Input
                id="assign-wc-height"
                inputMode="decimal"
                placeholder="bijv. 120"
                value={wcHeightCm}
                onChange={(e) => setWcHeightCm(e.target.value)}
              />
            </Field>
            <Field htmlFor="assign-wc-qty" label="Aantal">
              <Input
                id="assign-wc-qty"
                inputMode="numeric"
                value={wcQuantity}
                onChange={(e) => setWcQuantity(e.target.value)}
              />
            </Field>
          </div>
          {wcWidthCm && wcHeightCm ? (
            wcPrice?.outOfRange ? (
              <Alert
                variant="info"
                description="Buiten matrixbereik — offerte op maat (komt binnen op €0, prijs handmatig zetten)."
              />
            ) : wcPrice?.indicative ? (
              <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                Richtprijs: <strong>{formatEuro(wcPrice.indicative.unitPriceExVat)} / stuk</strong>{" "}
                · maat {wcPrice.indicative.matchedWidthCm}×{wcPrice.indicative.matchedHeightCm} cm
              </p>
            ) : null
          ) : null}
        </>
      ) : null}

      {isSpecialty && specialty?.hasInput ? (
        specialty.validationError ? (
          <Alert variant="warning" description={specialty.validationError} />
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
            Berekend:{" "}
            <strong>
              {specialty.aantal} {formatUnit(specialty.eenheid)}
            </strong>
            {productPrice?.indicative
              ? ` · ${formatEuro(productPrice.indicative.unitPriceExVat)} / ${formatUnit(specialty.eenheid)} (richtprijs)`
              : ""}
          </p>
        )
      ) : null}

      <Field htmlFor="assign-rooms" label="Toepassen op ruimtes">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {rooms.map((room) => {
            const checked = selectedRoomIds.includes(room._id);
            const area =
              room.oppervlakteM2 ??
              (room.breedteM && room.lengteM ? room.breedteM * room.lengteM : undefined);
            return (
              <span
                key={room._id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  border: checked ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  background: checked ? "var(--surface-muted)" : "var(--surface-raised)",
                  padding: "4px 6px 4px 10px"
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer"
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleRoom(room._id)} />
                  {room.naam}
                  {area !== undefined ? ` · ${Math.round(area * 100) / 100} m²` : ""}
                </label>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => openEditRoom(room)}
                    aria-label={`Maten van ${room.naam} bewerken`}
                    style={{
                      display: "inline-flex",
                      border: 0,
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 2
                    }}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </span>
            );
          })}
          {canEdit ? (
            <Button type="button" size="sm" variant="secondary" onClick={openNewRoom}>
              <Plus size={15} aria-hidden="true" /> Nieuwe ruimte
            </Button>
          ) : null}
        </div>
        {rooms.length === 0 && !roomFormOpen ? (
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "var(--text-sm)" }}>
            Nog geen ruimtes — voeg er een toe met &quot;Nieuwe ruimte&quot;.
          </p>
        ) : null}
      </Field>

      {roomFormOpen ? (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-muted)",
            padding: 12,
            display: "grid",
            gap: 12
          }}
        >
          {!editingRoomId && roomPresets.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roomPresets.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  size="sm"
                  variant={rNaam === preset.name ? "primary" : "secondary"}
                  onClick={() => setRNaam(preset.name)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="responsive-form-row">
            <Field htmlFor="assign-room-name" label="Ruimte" required>
              <Input
                id="assign-room-name"
                value={rNaam}
                onChange={(event) => setRNaam(event.target.value)}
                required
              />
            </Field>
            <Field htmlFor="assign-room-width" label="Breedte m">
              <Input
                id="assign-room-width"
                inputMode="decimal"
                value={rBreedte}
                onChange={(event) => setRBreedte(event.target.value)}
              />
            </Field>
            <Field htmlFor="assign-room-length" label="Lengte m">
              <Input
                id="assign-room-length"
                inputMode="decimal"
                value={rLengte}
                onChange={(event) => setRLengte(event.target.value)}
              />
            </Field>
            <Field htmlFor="assign-room-height" label="Hoogte m" helpText="Voor behang/wandpaneel.">
              <Input
                id="assign-room-height"
                inputMode="decimal"
                value={rHoogte}
                onChange={(event) => setRHoogte(event.target.value)}
              />
            </Field>
          </div>
          <div className="toolbar" style={{ gap: 8 }}>
            <Button
              type="button"
              variant="primary"
              disabled={!rNaam.trim()}
              isLoading={isRoomSaving}
              onClick={() => void submitRoom()}
            >
              {editingRoomId ? "Maten opslaan" : "Ruimte toevoegen"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRoomFormOpen(false);
                setEditingRoomId(null);
              }}
            >
              Annuleren
            </Button>
            {editingRoomId ? (
              <Button
                type="button"
                variant="danger"
                isLoading={isRoomSaving}
                onClick={() => setConfirmDeleteRoomId(editingRoomId)}
                style={{ marginLeft: "auto" }}
              >
                <Trash2 size={15} aria-hidden="true" /> Verwijderen
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDeleteRoomId)}
        title="Ruimte verwijderen?"
        description={`"${rNaam.trim() || "Deze ruimte"}" wordt verwijderd. Dit kan alleen als er nog geen meetregels aan gekoppeld zijn.`}
        confirmLabel="Ruimte verwijderen"
        tone="danger"
        isBusy={isRoomSaving}
        onCancel={() => setConfirmDeleteRoomId(null)}
        onConfirm={() => {
          const id = confirmDeleteRoomId;
          setConfirmDeleteRoomId(null);
          if (id) void deleteRoom(id);
        }}
      />

      {!isService && suggestions.length > 0 ? (
        <Field htmlFor="assign-bundles" label="Vaak samen — voeg meteen toe">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((rule) => (
              <label key={rule._id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={bundleRuleIds.includes(rule._id)}
                  onChange={() => toggleBundle(rule._id)}
                />
                {rule.naam} — {formatEuro(rule.prijsExBtw)} /{" "}
                {rule.berekeningType === "per_meter" ? "m" : "m²"}
              </label>
            ))}
          </div>
        </Field>
      ) : null}

      {error ? <Alert variant="danger" description={error} /> : null}

      <div>
        <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
          {isSaving
            ? "Bezig…"
            : `Toevoegen aan ${selectedRoomIds.length} ruimte${selectedRoomIds.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
