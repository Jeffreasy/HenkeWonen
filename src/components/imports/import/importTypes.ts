/**
 * Gedeelde types voor de import-modules.
 * Vervangt type-duplicaten verspreid over BatchesTable, DetailPanel, Preview, Profiles en ProfilesTable.
 */
import type { ProductImportBatch, ProductImportRow } from "../../../lib/portalTypes";

// ─── Batch filters ─────────────────────────────────────────────────────────────

/** Was gedupliceerd in ImportBatchesTable + ImportPreview */
export type BatchStatusFilter = "all" | ProductImportBatch["status"];

/** Was gedupliceerd in ImportDetailPanel + ImportPreview */
export type DetailTab = "summary" | "rows" | "warnings" | "reconciliation";

/** Was gedupliceerd in ImportDetailPanel + ImportPreview */
export type RowKindFilter = "all" | ProductImportRow["rowKind"];

/** Was gedupliceerd in ImportDetailPanel + ImportPreview */
export type RowStatusFilter = "all" | ProductImportRow["status"];

/** Was gedupliceerd in ImportProfiles + ImportProfilesTable */
export type ProfileStatusFilter = "all" | "active" | "archived";
