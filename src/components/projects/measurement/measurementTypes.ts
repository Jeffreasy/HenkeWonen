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
  measurementDate?: number;
  measuredBy?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type MeasurementRoomDoc = {
  _id: string;
  projectRoomId?: string;
  name: string;
  floor?: string;
  widthM?: number;
  lengthM?: number;
  heightM?: number;
  areaM2?: number;
  perimeterM?: number;
  notes?: string;
  sortOrder: number;
};

export type MeasurementLineDoc = {
  _id: string;
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
  quotePreparationStatus: QuotePreparationStatus;
};

export type WasteProfileDoc = {
  _id: string;
  productGroup: MeasurementProductGroup;
  name: string;
  defaultWastePercent: number;
  description?: string;
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
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "stairs"
  | "manual";

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
