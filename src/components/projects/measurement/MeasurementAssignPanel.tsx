import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
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
  type StairConstruction,
  type StairShape,
  calculateCurtainFabric,
  calculateWallPanels
} from "../../../lib/calculators";
import { buildPvcStairQuoteBundle } from "../../../lib/quotes/stairQuoteBundle";
import {
  PVC_STAIR_RECIPE_KEY,
  PVC_STAIR_RECIPE_VERSION,
  calculatePvcStairComponentQuantity,
  calculatePvcStairRecipe
} from "../../../lib/quotes/pvcStairCalculator";
import { resolveStairMaterialMetadata } from "../../../lib/quotes/stairMaterialCatalog";
import { PVC_STAIR_MATERIAL_FILTER } from "../../../lib/quotes/stairMaterialFilter";
import {
  type AssignableCalculator,
  type AssignmentParams,
  type RoomDimensions,
  calculatorForProduct,
  calculatorForService,
  deriveLineForRoom
} from "../../../lib/quotes/roomLineDerivation";
import { formatCalculationType, isStandaloneServiceRule } from "../../catalog/serviceRuleCatalog";
import CatalogProductPicker from "../../catalog/CatalogProductPicker";
import { Alert } from "../../ui/feedback/Alert";
import { Button } from "../../ui/forms/Button";
import { Field } from "../../ui/forms/Field";
import { Input } from "../../ui/forms/Input";
import { Select } from "../../ui/forms/Select";
import { ConfirmDialog } from "../../ui/overlays/ConfirmDialog";
import { Checkbox } from "../../ui/forms/Checkbox";
import type {
  IndicativePriceResult,
  MatrixIndicativePriceResult,
  MatrixOptions,
  MeasurementRoomDoc
} from "./measurementTypes";

type ServiceRule = {
  _id: string;
  productId?: string;
  sku?: string;
  naam: string;
  berekeningType: string;
  prijsExBtw: number;
  btwTarief: number;
  status: string;
  verkoopEenheid?: string;
  eenheid?: string;
  prijsEenheid?: string;
  priceUnit?: string;
  productGroup?: MeasurementProductGroup;
  serviceFamily?: string;
  covering?: string;
  stairShape?: string;
  serviceRole?: string;
  sectionKey?: string;
};

/** Eén regel zoals addMeasurementLinesBulk hem verwacht. */
export type MeasurementAssignLine = {
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
  bundleId?: string;
  bundleType?: "stair_renovation";
  bundleRole?: "material" | "labor" | "surcharge";
  sectionKey?: string;
  productNaam?: string;
  indicatieveEenheidsprijsExBtw?: number;
  indicatiefBtwTarief?: number;
  indicatievePrijsEenheid?: string;
  indicatievePrijsSoort?: string;
  indicatiefVastgelegdOp?: number;
};

type StairMaterialSelection = {
  product: PortalProduct;
  quantityOverride?: string;
  overrideReason?: string;
};

export type MeasurementAssignPanelProps = {
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
  /** Werksoort-hint uit de dossier-intake: opent op de bijbehorende product-tab
   *  i.p.v. altijd op "vloer". Een herstelde concept-invoer wint hierna alsnog. */
  initialAddType?: AddType;
  /** Alternatieve opslagbestemming; addMeasurementLinesBulk wordt dan overgeslagen. */
  onSubmitLines?: (regels: MeasurementAssignLine[]) => void | Promise<void>;
  /** Contextspecifiek actielabel, bijvoorbeeld "Gebruik in offerte". */
  submitLabel?: string;
  /** Contextspecifieke succesmelding; standaard blijft de regeltelling staan. */
  successCopy?: string;
  /**
   * Isoleert het lokale concept per context, bijvoorbeeld per offerteversie.
   */
  draftScopeId?: string;
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
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
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

function matchesPvcStairService(
  rule: ServiceRule,
  service: { bundleRole: "labor" | "surcharge" },
  stairShape: StairShape
): boolean {
  if (
    rule.serviceFamily !== "stair_renovation" ||
    rule.covering !== "pvc" ||
    rule.sectionKey !== "traprenovatie"
  ) {
    return false;
  }

  if (service.bundleRole === "labor") {
    return rule.serviceRole === "base_labor" && rule.stairShape === stairShape;
  }

  return rule.serviceRole === "surcharge" && !rule.stairShape;
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
  roomPresets,
  initialAddType,
  onSubmitLines,
  submitLabel,
  successCopy,
  draftScopeId
}: MeasurementAssignPanelProps) {
  const [addType, setAddType] = useState<AddType>(initialAddType ?? "vloer");
  const [product, setProduct] = useState<PortalProduct | null>(null);
  const [productPrice, setProductPrice] = useState<IndicativePriceResult | null>(null);
  const [serviceRules, setServiceRules] = useState<ServiceRule[]>([]);
  const [serviceRulesState, setServiceRulesState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [serviceRuleId, setServiceRuleId] = useState("");
  // Aantal voor vaste diensten (berekeningType fixed/manual): "Vinyl trap" of
  // "Strippen" heeft geen maat-afleiding en wordt X keer toegepast.
  const [serviceQuantity, setServiceQuantity] = useState("1");
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
  const [stairCovering, setStairCovering] = useState<"pvc">("pvc");
  const [stairShape, setStairShape] = useState<StairShape>("straight");
  const [stairConstruction, setStairConstruction] = useState<StairConstruction>("closed");
  const [stairMaterials, setStairMaterials] = useState<StairMaterialSelection[]>([]);
  const [treadCount, setTreadCount] = useState("");
  const [materialCompatibilityConfirmed, setMaterialCompatibilityConfirmed] = useState(false);
  const [riserCount, setRiserCount] = useState("");
  const [doubleTreadCount, setDoubleTreadCount] = useState("");
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
  const { clear: clearDraft } = useFormDraft(
    `henke-meetinvoer-${draftScopeId?.trim() || measurementId}`,
    {
      addType,
      product,
      serviceRuleId,
      stairMaterials,
      patternType,
      rollWidthM,
      doorOpeningM,
      rollWidthCm,
      materialCompatibilityConfirmed,
      rollLengthM,
      patternRepeatCm,
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
      stairCovering,
      stairShape,
      stairConstruction,
      treadCount,
      riserCount,
      doubleTreadCount,
      stripLengthM,
      wcType,
      wcPriceGroup,
      wcWidthCm,
      wcHeightCm,
      wcQuantity,
      roomFormOpen,
      editingRoomId,
      rNaam,
      rBreedte,
      rLengte,
      rHoogte
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
      if (productSelection.stairMaterials !== undefined) {
        setStairMaterials(productSelection.stairMaterials);
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
      const legacyStairType = (draft as Record<string, unknown>).stairType;
      if (draft.stairCovering === "pvc") setStairCovering("pvc");
      if (
        draft.stairShape === "straight" ||
        draft.stairShape === "quarter_turn" ||
        draft.stairShape === "half_turn"
      ) {
        setStairShape(draft.stairShape);
      }
      if (typeof draft.materialCompatibilityConfirmed === "boolean") {
        setMaterialCompatibilityConfirmed(draft.materialCompatibilityConfirmed);
      }
      if (draft.stairConstruction === "open" || draft.stairConstruction === "closed") {
        setStairConstruction(draft.stairConstruction);
      }
      if (
        legacyStairType === "straight" ||
        legacyStairType === "quarter_turn" ||
        legacyStairType === "half_turn"
      ) {
        setStairShape(legacyStairType);
      }
      if (legacyStairType === "open" || legacyStairType === "closed") {
        setStairConstruction(legacyStairType);
      }
      str(draft.treadCount, setTreadCount);
      str(draft.riserCount, setRiserCount);
      str(draft.doubleTreadCount, setDoubleTreadCount);
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
    setServiceRulesState("loading");
    let active = true;
    const client = createConvexHttpClient(session);
    if (!client) {
      setServiceRulesState("error");
      return;
    }

    void (async () => {
      try {
        const rules = (await client.query(api.beheer.serviceCostRules.list, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session)
        })) as ServiceRule[];
        if (active) {
          setServiceRules(rules ?? []);
          setServiceRulesState("loaded");
        }
      } catch (loadError) {
        console.error(loadError);
        if (active) setServiceRulesState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [session, tenantConvexId]);

  const standaloneServiceRules = useMemo(
    () => serviceRules.filter((rule) => rule.status === "active" && isStandaloneServiceRule(rule)),
    [serviceRules]
  );
  const selectedService = standaloneServiceRules.find((rule) => rule._id === serviceRuleId) ?? null;

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

  const stairRecipeCandidate = useMemo(
    () => ({
      recipeKey: PVC_STAIR_RECIPE_KEY,
      recipeVersion: PVC_STAIR_RECIPE_VERSION,
      covering: stairCovering,
      stairShape,
      stairConstruction,
      treadCount: parseNum(treadCount),
      ...(riserCount.trim() ? { riserCount: parseNum(riserCount) } : {}),
      ...(doubleTreadCount.trim() ? { doubleTreadCount: parseNum(doubleTreadCount) } : {}),
      ...(stripLengthM.trim() ? { stripLengthM: parseNum(stripLengthM) } : {}),
      materialCompatibilityConfirmed
    }),
    [
      stairCovering,
      stairShape,
      stairConstruction,
      treadCount,
      riserCount,
      doubleTreadCount,
      stripLengthM,
      materialCompatibilityConfirmed
    ]
  );
  const stairRecipeResult = useMemo(
    () => calculatePvcStairRecipe(stairRecipeCandidate),
    [stairRecipeCandidate]
  );

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
      return {
        hasInput: Boolean(treadCount),
        validationError: stairRecipeResult.ok
          ? undefined
          : stairRecipeResult.errors.map((item) => item.message).join(" "),
        aantal: stairRecipeResult.ok ? 1 : 0,
        snijverliesPct: undefined,
        invoer: (stairRecipeResult.ok
          ? stairRecipeResult.value.input
          : stairRecipeCandidate) as Record<string, unknown>,
        resultaat: (stairRecipeResult.ok
          ? { ...stairRecipeResult.value, quoteQuantity: 1, unit: "stairs", isIndicative: true }
          : {
              errors: stairRecipeResult.errors,
              quoteQuantity: 0,
              unit: "stairs",
              isIndicative: true
            }) as Record<string, unknown>,
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
    treadCount,
    stairRecipeResult,
    stairRecipeCandidate
  ]);

  const stairBundleDefinition = useMemo(() => {
    const result = buildPvcStairQuoteBundle({
      covering: stairCovering,
      stairShape,
      stairConstruction
    });
    return result.ok ? result.value : null;
  }, [stairConstruction, stairCovering, stairShape]);

  const stairServiceRules = useMemo(
    () =>
      (stairBundleDefinition?.services ?? []).map((service) => {
        const skuMatches = serviceRules.filter(
          (candidate) =>
            candidate.status === "active" && candidate.sku?.trim().toUpperCase() === service.sku
        );
        const matches = skuMatches.filter((candidate) =>
          matchesPvcStairService(candidate, service, stairShape)
        );

        return {
          ...service,
          rule: matches.length === 1 ? matches[0] : null,
          matchCount: matches.length,
          invalidMetadataCount: skuMatches.length - matches.length
        };
      }),
    [serviceRules, stairBundleDefinition, stairShape]
  );

  const invalidStairServiceMetadataSkus = stairServiceRules
    .filter((service) => service.invalidMetadataCount > 0)
    .map((service) => service.sku);

  const missingStairServiceSkus = stairServiceRules
    .filter((service) => service.matchCount === 0)
    .map((service) => service.sku);
  const duplicateStairServiceSkus = stairServiceRules
    .filter((service) => service.matchCount > 1)
    .map((service) => service.sku);
  const calculatedStairMaterials = useMemo(
    () =>
      stairMaterials.map((selection) => {
        const metadata = resolveStairMaterialMetadata(selection.product);
        const calculation =
          stairRecipeResult.ok && metadata
            ? calculatePvcStairComponentQuantity(stairRecipeResult.value.input, metadata)
            : null;
        const calculatedQuantity = calculation?.ok ? calculation.value.salesQuantity : undefined;
        const quantityText =
          selection.quantityOverride ??
          (calculatedQuantity !== undefined ? String(calculatedQuantity) : "");
        const quantity = parseNum(quantityText);
        const unit = selection.product.verkoopEenheid ?? selection.product.eenheid ?? "piece";
        const salesUnitMatches =
          calculation?.ok === true && unit.trim().toLowerCase() === calculation.value.salesUnit;
        const error = !metadata
          ? "Dit product heeft geen geldige PVC-trapmetadata."
          : !stairRecipeResult.ok
            ? stairRecipeResult.errors[0]?.message
            : calculation && !calculation.ok
              ? calculation.errors[0]?.message
              : !salesUnitMatches
                ? `De verkoopeenheid ${unit} past niet bij de berekende eenheid.`
                : undefined;
        const quantityIsValid =
          quantity !== undefined &&
          Number.isFinite(quantity) &&
          quantity > 0 &&
          (calculation?.ok === true && calculation.value.salesUnit === "m1"
            ? true
            : Number.isInteger(quantity));

        return {
          ...selection,
          metadata,
          calculation,
          calculatedQuantity,
          quantityText,
          quantity,
          unit,
          quantityMode: selection.quantityOverride === undefined ? "calculated" : "manual_override",
          overrideIsValid:
            selection.quantityOverride === undefined ||
            Boolean(selection.overrideReason && selection.overrideReason.trim().length >= 3),
          isValid: !error && quantityIsValid,
          error
        } as const;
      }),
    [stairMaterials, stairRecipeResult]
  );
  const stairPrimaryMaterialCount = calculatedStairMaterials.filter(
    (selection) => selection.metadata?.isPrimary === true
  ).length;
  const stairHasExactlyOnePrimaryMaterial = stairPrimaryMaterialCount === 1;
  const stairMaterialQuantitiesValid =
    calculatedStairMaterials.length > 0 &&
    calculatedStairMaterials.every((selection) => selection.isValid);
  const stairMaterialOverridesValid = calculatedStairMaterials.every(
    (selection) => selection.overrideIsValid
  );
  const stairHasDoubleTreadMaterial = calculatedStairMaterials.some(
    (selection) => selection.metadata?.componentRole === "double_tread"
  );
  const stairMaterialCompatibilityValid =
    !stairHasDoubleTreadMaterial || materialCompatibilityConfirmed;
  const stairKnownTotalExVat =
    calculatedStairMaterials.reduce(
      (total, selection) => total + selection.product.prijsExBtw * (selection.quantity ?? 0),
      0
    ) + stairServiceRules.reduce((total, service) => total + (service.rule?.prijsExBtw ?? 0), 0);
  const stairHasUnknownPrice =
    calculatedStairMaterials.some((selection) => !(selection.product.prijsExBtw > 0)) ||
    stairServiceRules.some((service) => !service.rule);

  // Eenheid voor de richtprijs-lookup: uit de engine-rekenmachine of (bij speciale typen) uit de config.
  const priceUnit = useMemo<string | null>(() => {
    if (isService) return null;
    if (addType === "trap") return null;
    if (calculator) return UNIT_FOR_CALCULATOR[calculator];
    if (specialty) return specialty.eenheid;
    return null;
  }, [addType, isService, calculator, specialty]);

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
  function handleTypeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % ADD_TYPES.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + ADD_TYPES.length) % ADD_TYPES.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = ADD_TYPES.length - 1;
        break;
      default:
        return;
    }

    const nextType = ADD_TYPES[nextIndex];
    if (!nextType) return;

    event.preventDefault();
    chooseType(nextType.key);
    const radios =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        'button[role="radio"]'
      );
    radios?.[nextIndex]?.focus();
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
      patternRepeatCm: Number(patternRepeatCm.replace(",", ".")) || 0,
      // Vaste dienst: aantal keren toepassen (rekenmachine "manual").
      // Eenheid "piece" (canonieke sleutel, weergave = "stuk"): "stuk" zelf is
      // geen geldige prijseenheid voor isUnitCompatible en zou de richtprijs
      // in de regellijst verbergen.
      manualQuantity: Number(serviceQuantity.replace(",", ".")) || 0,
      manualUnit: "piece"
    }),
    [
      patternType,
      rollWidthM,
      doorOpeningM,
      rollWidthCm,
      rollLengthM,
      patternRepeatCm,
      serviceQuantity
    ]
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
        ? addType === "trap"
          ? Boolean(stairBundleDefinition) &&
            stairRecipeResult.ok &&
            Boolean(specialty) &&
            !specialty?.validationError &&
            (specialty?.aantal ?? 0) > 0 &&
            stairHasExactlyOnePrimaryMaterial &&
            stairMaterialQuantitiesValid &&
            stairMaterialOverridesValid &&
            stairMaterialCompatibilityValid &&
            serviceRulesState === "loaded" &&
            invalidStairServiceMetadataSkus.length === 0 &&
            missingStairServiceSkus.length === 0 &&
            duplicateStairServiceSkus.length === 0
          : Boolean(specialty) && !specialty?.validationError && (specialty?.aantal ?? 0) > 0
        : isService
          ? // Diensten: maat-afgeleid (per m²/m¹) kan altijd; vaste tarieven
            // ("Vinyl trap", "Strippen") gaan via een handmatig aantal (> 0).
            calculator !== null &&
            (calculator !== "manual" || (Number(serviceQuantity.replace(",", ".")) || 0) > 0)
          : calculator !== null && calculator !== "manual");

  function productSnapshot(): Partial<MeasurementAssignLine> {
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

  function serviceSnapshot(rule: ServiceRule, eenheid: string): Partial<MeasurementAssignLine> {
    return {
      productId: (rule.productId ?? rule._id) as Id<"products">,
      productNaam: rule.naam,
      indicatieveEenheidsprijsExBtw: rule.prijsExBtw,
      indicatiefBtwTarief: rule.btwTarief,
      indicatievePrijsEenheid: eenheid,
      indicatievePrijsSoort: "service_rule",
      indicatiefVastgelegdOp: Date.now()
    };
  }

  function stairMaterialSnapshot(
    selection: StairMaterialSelection
  ): Partial<MeasurementAssignLine> {
    const unit = selection.product.prijsEenheid ?? selection.product.eenheid ?? "piece";
    return {
      productId: selection.product.id as Id<"products">,
      productNaam: selection.product.weergaveNaam ?? selection.product.naam,
      ...(selection.product.prijsExBtw > 0
        ? {
            indicatieveEenheidsprijsExBtw: selection.product.prijsExBtw,
            indicatiefBtwTarief: selection.product.btwTarief ?? 21,
            indicatievePrijsEenheid: unit,
            indicatievePrijsSoort: "catalog_picker",
            indicatiefVastgelegdOp: Date.now()
          }
        : {})
    };
  }

  async function submit() {
    if (!canSubmit) return;

    const selectedRooms = rooms.filter((room) => selectedRoomIds.includes(room._id));
    const regels: MeasurementAssignLine[] = [];
    const missing: string[] = [];

    if (isMatrix) {
      // Raambekleding: matrix-richtprijs (productloos), per gekozen ruimte als één regel.
      const breedteCm = wcWidthNum ?? 0;
      const hoogteCm = wcHeightNum ?? 0;
      const quantity = wcQuantityNum ?? 1;
      const indicative = wcPrice?.indicative ?? null;
      const label = `Raambekleding ${[wcType, wcPriceGroup].filter(Boolean).join(" – ")}`;
      const matrixSnapshot: Partial<MeasurementAssignLine> = indicative
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
    } else if (addType === "trap" && specialty && stairBundleDefinition) {
      for (const room of selectedRooms) {
        const bundleId = `stair:${measurementId}:${room._id}:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        const sharedInput = {
          ...specialty.invoer,
          source: "pvc-stair-composer",
          bundleId,
          bundleType: stairBundleDefinition.bundleType,
          sectionKey: stairBundleDefinition.sectionKey
        };

        for (const selection of calculatedStairMaterials) {
          const quantity = selection.quantity ?? 0;
          const unit = selection.unit;
          const componentCalculation =
            selection.calculation && selection.calculation.ok ? selection.calculation.value : null;
          regels.push({
            ruimteId: room._id as Id<"measurementRooms">,
            productGroep: "stairs",
            berekeningType: "manual",
            invoer: {
              ...sharedInput,
              bundleRole: "material",
              materialProductId: selection.product.id,
              componentRole: selection.metadata?.componentRole,
              quantity,
              unit,
              quantityMode: selection.quantityMode,
              calculatedQuantity: selection.calculatedQuantity,
              ...(selection.quantityMode === "manual_override"
                ? { quantityOverrideReason: selection.overrideReason?.trim() }
                : {})
            },
            resultaat: {
              stairCalculation: specialty.resultaat,
              componentCalculation,
              quantity,
              unit
            },
            aantal: quantity,
            eenheid: unit,
            offerteRegelType: "product",
            bundleId,
            bundleType: stairBundleDefinition.bundleType,
            bundleRole: "material",
            sectionKey: stairBundleDefinition.sectionKey,
            ...stairMaterialSnapshot(selection)
          });
        }

        for (const service of stairServiceRules) {
          if (!service.rule) continue;
          const unit =
            service.rule.verkoopEenheid ??
            service.rule.eenheid ??
            service.rule.priceUnit ??
            service.rule.prijsEenheid ??
            "piece";
          regels.push({
            ruimteId: room._id as Id<"measurementRooms">,
            productGroep: "stairs",
            berekeningType: "stairs",
            invoer: { ...sharedInput, bundleRole: service.bundleRole, serviceSku: service.sku },
            resultaat: { stairCalculation: specialty.resultaat, serviceSku: service.sku },
            aantal: 1,
            eenheid: unit,
            offerteRegelType: service.bundleRole === "labor" ? "labor" : "service",
            bundleId,
            bundleType: stairBundleDefinition.bundleType,
            bundleRole: service.bundleRole,
            sectionKey: stairBundleDefinition.sectionKey,
            ...serviceSnapshot(service.rule, unit)
          });
        }
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
          // Vaste diensten lopen via de "manual"-rekenmachine maar blijven een
          // werkzaamheid — anders verliest de offerte het Werkzaamheid-label.
          offerteRegelType:
            isService && main.offerteRegelType === "manual" ? "service" : main.offerteRegelType,
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

    setIsSaving(true);
    setError(null);

    try {
      let addedCount = regels.length;
      if (onSubmitLines) {
        await onSubmitLines(regels);
      } else {
        const client = createConvexHttpClient(session);
        if (!client) {
          setError("Kan de inmeting nu niet bereiken.");
          return;
        }
        const result = (await client.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
          tenantId: tenantConvexId as Id<"tenants">,
          actor: mutationActorFromSession(session),
          inmetingId: measurementId as Id<"measurements">,
          regels
        })) as { count: number };
        addedCount = result.count;
      }

      showToast({
        title: successCopy ?? `${addedCount} regel${addedCount === 1 ? "" : "s"} toegevoegd`,
        tone: "success"
      });
      onSelectedRoomIdsChange([]);
      setProduct(null);
      setProductPrice(null);
      setServiceRuleId("");
      setStairMaterials([]);
      clearDraft();

      try {
        await onAdded();
      } catch (refreshError) {
        console.error(refreshError);
        setError("Toegevoegd, maar de gegevens konden niet worden vernieuwd.");
      }
    } catch (saveError) {
      console.error(saveError);
      setError(
        onSubmitLines
          ? `${submitLabel?.trim() || "Toevoegen"} is niet gelukt.`
          : "Toevoegen aan de ruimtes is niet gelukt."
      );
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
        {ADD_TYPES.map((entry, index) => {
          const active = addType === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => handleTypeKeyDown(event, index)}
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

      {isMatrix || addType === "trap" ? null : !isService ? (
        <CatalogProductPicker
          session={session}
          idPrefix="assign"
          productGroupHint={productGroupHint}
          selectedProductId={product?.id ?? ""}
          selectedProductLabel={productLabel}
          onSelect={(next) => {
            setProduct(next);
            // Stofbreedte voorinvullen vanuit het product (bv. kamerhoog 3,05m
            // bij Headlam) — de default 1,40 geeft anders een banenadvies dat
            // niet bij de gekozen stof past. Blijft handmatig aanpasbaar.
            if (addType === "gordijn" && next?.breedteMm && next.breedteMm > 0) {
              setCurtainFabricWidthM(String(next.breedteMm / 1000));
            }
          }}
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
            {standaloneServiceRules.map((rule) => (
              <option key={rule._id} value={rule._id}>
                {rule.naam} — {formatEuro(rule.prijsExBtw)} excl. ·{" "}
                {formatCalculationType(rule.berekeningType)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {isService && calculator === "manual" ? (
        <Field
          htmlFor="assign-service-quantity"
          label="Aantal"
          helpText="Vast tarief of per rol/trede: vul het aantal keren in dat de dienst geldt."
        >
          <Input
            id="assign-service-quantity"
            inputMode="decimal"
            value={serviceQuantity}
            onChange={(event) => setServiceQuantity(event.target.value)}
          />
        </Field>
      ) : calculator === "manual" ? (
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
        <div className="grid" style={{ gap: 14 }}>
          <div className="responsive-form-row">
            <Field htmlFor="assign-stair-covering" label="Bekleding">
              <Select
                id="assign-stair-covering"
                value={stairCovering}
                onChange={(event) => setStairCovering(event.target.value as "pvc")}
              >
                <option value="pvc">PVC</option>
              </Select>
            </Field>
            <Field htmlFor="assign-stair-shape" label="Trapvorm">
              <Select
                id="assign-stair-shape"
                value={stairShape}
                onChange={(event) => setStairShape(event.target.value as StairShape)}
              >
                <option value="straight">Rechte trap</option>
                <option value="quarter_turn">Kwart draai</option>
                <option value="half_turn">Halve draai</option>
              </Select>
            </Field>
            <Field htmlFor="assign-stair-construction" label="Uitvoering">
              <Select
                id="assign-stair-construction"
                value={stairConstruction}
                onChange={(event) => setStairConstruction(event.target.value as StairConstruction)}
              >
                <option value="closed">Dichte trap</option>
                <option value="open">Open trap</option>
              </Select>
            </Field>
            <Field htmlFor="assign-tread-count" label="Aantal treden">
              <Input
                id="assign-tread-count"
                inputMode="numeric"
                min={1}
                step={1}
                value={treadCount}
                onChange={(event) => setTreadCount(event.target.value)}
              />
            </Field>
            <Field htmlFor="assign-riser-count" label="Aantal stootborden">
              <Input
                id="assign-riser-count"
                inputMode="numeric"
                min={0}
                step={1}
                value={riserCount}
                onChange={(event) => setRiserCount(event.target.value)}
              />
            </Field>
            <Field htmlFor="assign-double-tread-count" label="Aantal dubbele treden (optioneel)">
              <Input
                id="assign-double-tread-count"
                inputMode="numeric"
                min={0}
                step={1}
                value={doubleTreadCount}
                onChange={(event) => setDoubleTreadCount(event.target.value)}
              />
            </Field>
            <Field htmlFor="assign-strip-length" label="Strooklengte m (optioneel)">
              <Input
                id="assign-strip-length"
                inputMode="decimal"
                value={stripLengthM}
                onChange={(event) => setStripLengthM(event.target.value)}
              />
            </Field>
          </div>

          <CatalogProductPicker
            session={session}
            stairMaterialFilter={PVC_STAIR_MATERIAL_FILTER}
            idPrefix="assign-stair-material"
            scope="orderable"
            productGroupHint="stairs"
            selectedProductId=""
            onSelect={(next) => {
              if (!next) return;
              const componentRole = resolveStairMaterialMetadata(next)?.componentRole;
              if (componentRole === "standard_tread" || componentRole === "double_tread") {
                setMaterialCompatibilityConfirmed(false);
              }
              setStairMaterials((current) => {
                if (current.some((selection) => selection.product.id === next.id)) {
                  return current;
                }
                return [...current, { product: next }];
              });
            }}
            label="PVC-product toevoegen"
            description="Kies het bestelbare PVC-materiaal. Arbeid en eventuele open-traptoeslag worden apart toegevoegd."
            emptyOptionLabel="Kies PVC-materiaal."
            showPriceInLabel
          />

          {stairMaterials.length > 0 ? (
            <div className="grid" style={{ gap: 8 }}>
              {calculatedStairMaterials.map((selection) => {
                const priceUnit =
                  selection.product.prijsEenheid ??
                  selection.product.verkoopEenheid ??
                  selection.product.eenheid ??
                  "piece";
                const calculatedOrder =
                  selection.calculation && selection.calculation.ok
                    ? selection.calculation.value
                    : null;

                return (
                  <div
                    key={selection.product.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                      gap: 10,
                      alignItems: "end",
                      padding: 12,
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-raised)"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong>{selection.product.weergaveNaam ?? selection.product.naam}</strong>
                      <div className="muted" style={{ marginTop: 3, fontSize: "var(--text-xs)" }}>
                        {selection.metadata?.isPrimary
                          ? "PVC-hoofdproduct"
                          : "Aanvullend trapmateriaal"}
                        {selection.metadata?.piecesPerPack
                          ? ` - ${selection.metadata.piecesPerPack} stuks per pak`
                          : ""}
                      </div>
                      <p
                        className="muted"
                        style={{ margin: "3px 0 0", fontSize: "var(--text-sm)" }}
                      >
                        {selection.product.prijsExBtw > 0
                          ? `${formatEuro(selection.product.prijsExBtw)} / ${formatUnit(priceUnit)} excl. btw`
                          : `Prijs nog niet beschikbaar; ${formatUnit(priceUnit)}`}
                      </p>
                      {calculatedOrder ? (
                        <p
                          className="muted"
                          style={{ margin: "3px 0 0", fontSize: "var(--text-sm)" }}
                        >
                          Besteladvies:{" "}
                          <strong>
                            {calculatedOrder.expectedOrderQuantity}{" "}
                            {formatUnit(calculatedOrder.orderUnit)}
                          </strong>
                        </p>
                      ) : null}
                    </div>
                    <Field
                      htmlFor={`assign-stair-material-${selection.product.id}`}
                      label={
                        selection.quantityMode === "calculated"
                          ? `Berekend aantal ${formatUnit(selection.unit)}`
                          : `Afwijkend aantal ${formatUnit(selection.unit)}`
                      }
                      description={
                        selection.quantityMode === "manual_override" &&
                        selection.calculatedQuantity !== undefined
                          ? `Calculator: ${selection.calculatedQuantity} ${formatUnit(selection.unit)}`
                          : undefined
                      }
                      error={
                        selection.error ??
                        (!selection.isValid
                          ? selection.calculation?.ok === true &&
                            selection.calculation.value.salesUnit === "m1"
                            ? "Vul een lengte groter dan nul in."
                            : "Vul een heel aantal groter dan nul in."
                          : undefined)
                      }
                    >
                      <Input
                        id={`assign-stair-material-${selection.product.id}`}
                        inputMode={calculatedOrder?.salesUnit === "m1" ? "decimal" : "numeric"}
                        min={calculatedOrder?.salesUnit === "m1" ? 0.01 : 1}
                        step={calculatedOrder?.salesUnit === "m1" ? "any" : 1}
                        value={selection.quantityText}
                        onChange={(event) =>
                          setStairMaterials((current) =>
                            current.map((item) =>
                              item.product.id === selection.product.id
                                ? { ...item, quantityOverride: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </Field>
                    {selection.quantityMode === "manual_override" ? (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                          gap: 10,
                          alignItems: "end"
                        }}
                      >
                        <Field
                          htmlFor={`assign-stair-material-reason-${selection.product.id}`}
                          label="Reden van afwijking"
                          required
                          error={
                            selection.overrideIsValid
                              ? undefined
                              : "Beschrijf de afwijking in minimaal 3 tekens."
                          }
                        >
                          <Input
                            id={`assign-stair-material-reason-${selection.product.id}`}
                            value={selection.overrideReason ?? ""}
                            onChange={(event) =>
                              setStairMaterials((current) =>
                                current.map((item) =>
                                  item.product.id === selection.product.id
                                    ? { ...item, overrideReason: event.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Bijv. extra reserve voor beschadigde trede"
                          />
                        </Field>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setStairMaterials((current) =>
                              current.map((item) =>
                                item.product.id === selection.product.id
                                  ? {
                                      product: item.product
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          Gebruik berekend aantal
                        </Button>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                      aria-label={`${selection.product.naam} verwijderen`}
                      onClick={() => {
                        if (
                          selection.metadata?.componentRole === "standard_tread" ||
                          selection.metadata?.componentRole === "double_tread"
                        ) {
                          setMaterialCompatibilityConfirmed(false);
                        }
                        setStairMaterials((current) =>
                          current.filter((item) => item.product.id !== selection.product.id)
                        );
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Verwijder
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Alert
              variant="info"
              description="Kies minimaal een PVC-traptredenset; accessoires alleen zijn geen compleet hoofdproduct."
            />
          )}
          {stairPrimaryMaterialCount > 1 ? (
            <Alert
              variant="warning"
              description="Kies exact een PVC-traptredenset als hoofdproduct. Verwijder extra collecties of kleuren uit deze trapbundel."
            />
          ) : null}

          {stairPrimaryMaterialCount === 0 && stairMaterials.length > 0 ? (
            <Alert
              variant="warning"
              description="Voeg nog een PVC-traptredenset toe. Profielen, stootborden, kit en gereedschap tellen alleen als aanvullend materiaal."
            />
          ) : null}
          {!stairMaterialQuantitiesValid && stairMaterials.length > 0 ? (
            <Alert
              variant="warning"
              description="Controleer het berekende verkoopaantal. Stuks en pakken zijn hele aantallen; lengteprofielen mogen een decimale meterwaarde hebben."
            />
          ) : null}
          {!stairMaterialOverridesValid && stairMaterials.length > 0 ? (
            <Alert
              variant="warning"
              description="Leg bij ieder afwijkend materiaalaantal vast waarom van de calculator wordt afgeweken."
            />
          ) : null}

          {stairHasDoubleTreadMaterial ? (
            <div
              style={{
                padding: 12,
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-muted)"
              }}
            >
              <Checkbox
                checked={materialCompatibilityConfirmed}
                onChange={(event) => setMaterialCompatibilityConfirmed(event.target.checked)}
                error={!materialCompatibilityConfirmed}
                label="Collectie en kleur van de dubbele trede gecontroleerd"
                description="Bevestig dat de gekozen dubbele trede bij het PVC-hoofdproduct past."
              />
            </div>
          ) : null}
          {!stairMaterialCompatibilityValid ? (
            <Alert
              variant="warning"
              description="Bevestig eerst de materiaalcompatibiliteit van de dubbele trede."
            />
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-muted)"
            }}
          >
            <strong>Automatisch gekoppelde dienstprijzen</strong>
            {serviceRulesState === "loading" ? (
              <span className="muted">Dienstcatalogus laden...</span>
            ) : serviceRulesState === "error" ? (
              <span className="muted">Dienstcatalogus niet beschikbaar</span>
            ) : (
              stairServiceRules.map((service) => (
                <div
                  key={service.sku}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <span>
                    {service.bundleRole === "labor" ? "Arbeid" : "Toeslag open trap"}:{" "}
                    {service.rule?.naam ?? service.sku}
                  </span>
                  <strong>
                    {service.matchCount > 1
                      ? "Dubbele configuratie"
                      : service.rule
                        ? `${formatEuro(service.rule.prijsExBtw)} excl. btw`
                        : "Niet gevonden"}
                  </strong>
                </div>
              ))
            )}
          </div>

          {serviceRulesState === "error" ? (
            <Alert
              variant="warning"
              description="De dienstprijzen konden niet worden geladen. Probeer het opnieuw voordat je de trapbundel toevoegt."
            />
          ) : null}
          {serviceRulesState === "loaded" && invalidStairServiceMetadataSkus.length > 0 ? (
            <Alert
              variant="warning"
              description={`Deze vaste SKU heeft onjuiste trapmetadata en wordt daarom niet gekoppeld: ${invalidStairServiceMetadataSkus.join(", ")}. Corrigeer de catalogusmetadata eerst.`}
            />
          ) : null}
          {serviceRulesState === "loaded" && missingStairServiceSkus.length > 0 ? (
            <Alert
              variant="warning"
              description={`De vaste dienstprijs ontbreekt in de actieve catalogus: ${missingStairServiceSkus.join(", ")}. Herimporteer of activeer deze dienst eerst.`}
            />
          ) : null}
          {serviceRulesState === "loaded" && duplicateStairServiceSkus.length > 0 ? (
            <Alert
              variant="warning"
              description={`Er staan meerdere actieve dienstproducten met dezelfde vaste SKU: ${duplicateStairServiceSkus.join(", ")}. Archiveer de duplicaten voordat je de trapbundel toevoegt.`}
            />
          ) : null}
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
                Richtprijs:{" "}
                <strong>{formatEuro(wcPrice.indicative.unitPriceExVat)} / stuk excl. btw</strong> ·
                maat {wcPrice.indicative.matchedWidthCm}×{wcPrice.indicative.matchedHeightCm} cm
              </p>
            ) : null
          ) : null}
        </>
      ) : null}

      {isSpecialty && specialty?.hasInput ? (
        specialty.validationError ? (
          <Alert variant="warning" description={specialty.validationError} />
        ) : addType === "trap" ? (
          <div style={{ display: "grid", gap: 4 }}>
            {stairRecipeResult.ok ? (
              <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                <strong>Trapcalculator v{stairRecipeResult.value.recipeVersion}</strong>:{" "}
                {stairRecipeResult.value.input.treadCount} treden
                {stairRecipeResult.value.input.riserCount !== undefined
                  ? ` - ${stairRecipeResult.value.input.riserCount} stootborden`
                  : ""}
                {stairRecipeResult.value.input.doubleTreadCount !== undefined
                  ? ` - ${stairRecipeResult.value.input.doubleTreadCount} dubbele treden`
                  : ""}
                {stairRecipeResult.value.input.stripLengthM !== undefined
                  ? ` - ${stairRecipeResult.value.input.stripLengthM} m profiel`
                  : ""}
              </p>
            ) : null}
            <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
              Bundel per ruimte:{" "}
              <strong>{stairMaterials.length + stairServiceRules.length} regels</strong>
              {stairKnownTotalExVat > 0
                ? ` - ${formatEuro(stairKnownTotalExVat)} excl. btw${stairHasUnknownPrice ? " plus nog niet geprijsd materiaal" : ""}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
            Berekend:{" "}
            <strong>
              {specialty.aantal} {formatUnit(specialty.eenheid)}
            </strong>
            {productPrice?.indicative
              ? ` · ${formatEuro(productPrice.indicative.unitPriceExVat)} / ${formatUnit(specialty.eenheid)} excl. btw (richtprijs)`
              : ""}
          </p>
        )
      ) : null}

      {addType === "trap" && selectedRoomIds.length > 1 ? (
        <Alert
          variant="info"
          description={`Voor elke van de ${selectedRoomIds.length} ruimtes wordt een zelfstandige PVC-trapbundel aangemaakt.`}
        />
      ) : null}

      <Field htmlFor="assign-rooms" label="Toepassen op ruimtes">
        <div
          id="assign-rooms"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
        >
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
                {rule.naam} — {formatEuro(rule.prijsExBtw)} excl. ·{" "}
                {formatCalculationType(rule.berekeningType)}
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
            : submitLabel?.trim() ||
              `Toevoegen aan ${selectedRoomIds.length} ruimte${selectedRoomIds.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
