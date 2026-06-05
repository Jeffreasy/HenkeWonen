/**
 * Gedeelde types voor de offerte-modules (quotes/).
 * Importeer types hier vandaan, niet via QuoteLineEditor.
 */
import type { QuoteLineType } from "../../../lib/portalTypes";

// ─── Formulier-waarden ────────────────────────────────────────────────────────

/**
 * De veldwaarden van een offertepost-formulier.
 * Wordt gebruikt door: QuoteLineEditor, QuoteLineEditForm,
 * QuoteBuilder, MeasurementLinePicker, QuoteWorkspace.
 */
export type QuoteLineFormValues = {
  projectRoomId?: string;
  productId?: string;
  lineType: QuoteLineType;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPriceExVat: number;
  vatRate: number;
  discountExVat?: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};
