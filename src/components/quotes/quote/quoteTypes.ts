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

/**
 * Brug van de (Engelse) formulierwaarden naar de Nederlandse offerteregel-mutatie-args
 * (addQuoteLine/updateQuoteLine). De formulierlaag blijft intern Engels; de API is Nederlands.
 * TODO Fase 2 (frontend-formulieren): QuoteLineFormValues zelf nog naar NL omzetten.
 */
export function quoteLineFormToApi(line: QuoteLineFormValues) {
  return {
    projectRuimteId: line.projectRoomId,
    productId: line.productId,
    regelType: line.lineType,
    titel: line.title,
    omschrijving: line.description,
    aantal: line.quantity,
    eenheid: line.unit,
    eenheidsprijsExBtw: line.unitPriceExVat,
    btwTarief: line.vatRate,
    kortingExBtw: line.discountExVat,
    sortOrder: line.sortOrder,
    metadata: line.metadata
  };
}
