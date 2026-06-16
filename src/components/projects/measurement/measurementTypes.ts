/**
 * Lokale document-types voor de inmeting (alleen intern gebruik binnen measurement/).
 * Gebaseerd op de Convex API-responses voor projecten/measurements.
 */
import type {
  MeasurementCalculationType,
  MeasurementProductGroup,
  MeasurementStatus,
  QuoteLineType,
  QuotePreparationStatus
} from "../../../lib/portalTypes";
import type { AppSession } from "../../../lib/auth/session";
import type { PortalRoom } from "../../../lib/portalTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

export type MeasurementPanelProps = {
  tenantId: string;
  projectId: string;
  customerId: string;
  projectRooms: PortalRoom[];
  session: AppSession;
  mode?: "full" | "field";
};

// ─── Convex document shapes ───────────────────────────────────────────────────

export type MeasurementDoc = {
  _id: string;
  status: MeasurementStatus;
  inmeetdatum?: number;
  gemetenDoor?: string;
  notities?: string;
  aangemaaktOp: number;
  gewijzigdOp: number;
};

export type MeasurementRoomDoc = {
  _id: string;
  projectRuimteId?: string;
  naam: string;
  verdieping?: string;
  breedteM?: number;
  lengteM?: number;
  hoogteM?: number;
  oppervlakteM2?: number;
  omtrekM?: number;
  notities?: string;
  sortOrder: number;
};

export type MeasurementLineDoc = {
  _id: string;
  ruimteId?: string;
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  invoer: Record<string, unknown>;
  resultaat: Record<string, unknown>;
  snijverliesPct?: number;
  aantal: number;
  eenheid: string;
  notities?: string;
  offerteRegelType: QuoteLineType;
  quotePreparationStatus: QuotePreparationStatus;
  productId?: string;
  productNaam?: string;
  indicatieveEenheidsprijsExBtw?: number;
  indicatiefBtwTarief?: number;
  indicatievePrijsEenheid?: string;
  indicatievePrijsSoort?: string;
  indicatiefVastgelegdOp?: number;
};

/** Richtprijs-respons van api.catalog.pricing.getIndicativePrice. */
export type IndicativePriceResult = {
  productId: string;
  productName: string;
  indicative: {
    unitPriceExVat: number;
    unitPriceIncVat: number;
    vatRate: number;
    priceType: string;
    priceUnit?: string;
    vatModeUsed: "exclusive" | "inclusive";
    validFrom?: number;
    conversionApplied?: "package_to_m2";
  } | null;
};

export type WasteProfileDoc = {
  _id: string;
  productGroep: MeasurementProductGroup;
  naam: string;
  standaardSnijverliesPct: number;
  omschrijving?: string;
};

export type MeasurementData = {
  measurement: MeasurementDoc | null;
  rooms: MeasurementRoomDoc[];
  lines: MeasurementLineDoc[];
  wasteProfiles: WasteProfileDoc[];
};

// ─── Calculator tool types ────────────────────────────────────────────────────

export type FieldMeasureTool =
  | "flooring"
  | "broadloom"
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "window_covering"
  | "stairs"
  | "manual";

/** Beschikbare raambekleding-matrices van api.catalog.pricing.listMatrixOptions. */
export type MatrixOptions = {
  types: string[];
  priceGroups: string[];
  combinations: { bronBlad: string | null; prijsgroep: string }[];
};

/** Matrix-richtprijs-respons van api.catalog.pricing.getMatrixIndicativePrice. */
export type MatrixIndicativePriceResult = {
  indicative: {
    unitPriceExVat: number;
    unitPriceIncVat: number;
    vatRate: number;
    priceType: string;
    priceUnit: string;
    vatModeUsed: "exclusive" | "inclusive";
    prijsgroep: string;
    bronBlad: string | null;
    matchedWidthCm: number;
    matchedHeightCm: number;
  } | null;
  outOfRange: boolean;
  reason: "ok" | "out_of_range" | "matrix_not_found" | "vat_unknown" | "invalid_dimensions";
};

// ─── Constanten ───────────────────────────────────────────────────────────────

export const PRODUCT_GROUP_OPTIONS: MeasurementProductGroup[] = [
  "flooring",
  "plinths",
  "wallpaper",
  "wall_panels",
  "curtains",
  "rails",
  "stairs",
  "other"
];

export const QUOTE_LINE_TYPE_OPTIONS: QuoteLineType[] = [
  "product",
  "service",
  "labor",
  "material",
  "text",
  "manual"
];
