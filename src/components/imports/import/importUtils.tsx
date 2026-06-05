/**
 * Gedeelde utility functies voor de import-modules.
 * Vervangt identieke kopieën verspreid over meerdere bestanden.
 */
import { Archive, RotateCcw } from "lucide-react";
import type { ProductImportBatch } from "../../../lib/portalTypes";
import type { BadgeVariant } from "../../ui/Badge";
import type { VatMappingReviewRow } from "../ImportProfiles";

// ─── Getal / datum weergave ───────────────────────────────────────────────────

/**
 * Formatteert een getal met nl-NL locale.
 * Was gedupliceerd in: ImportBatchesTable, ImportDetailPanel, ImportPreview,
 * ImportProfiles, ProductionReadiness, VatMappingGroups, VatWorkbenchHeader (7×).
 */
export function numberText(value: number): string {
  return new Intl.NumberFormat("nl-NL").format(value);
}

/**
 * Formatteert een Unix-timestamp naar korte datum (nl-NL).
 * Was gedupliceerd in: ImportBatchesTable, ImportDetailPanel, ImportPreview, ProductionReadiness (4×).
 */
export function dateText(value?: number): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

/**
 * Genormaliseerde lowercase string voor zoeken.
 * Was gedupliceerd in: ImportPreview + ImportProfiles (2×).
 */
export function normalizedText(value?: string): string {
  return (value ?? "").toLocaleLowerCase("nl-NL");
}

// ─── Batch helpers ─────────────────────────────────────────────────────────────

/**
 * Badge-variant op basis van batch-status.
 * Was gedupliceerd in: ImportBatchesTable + ImportDetailPanel (2×, identiek).
 */
export function batchStatusVariant(batch: ProductImportBatch): BadgeVariant {
  if (batch.status === "failed") {
    return "danger";
  }

  if (batch.status === "needs_mapping") {
    return "warning";
  }

  if (batch.status === "ready_to_import" || batch.status === "imported") {
    return "success";
  }

  if (batch.unknownVatModeRows > 0) {
    return "warning";
  }

  if (batch.status === "importing" || batch.status === "analyzing") {
    return "info";
  }

  return "neutral";
}

/**
 * Levenscyclus-tekst van een importbatch.
 * Was gedupliceerd in: ImportBatchesTable + ImportDetailPanel (2×, identiek).
 */
export function lifecycleText(batch: ProductImportBatch): string {
  if (batch.status === "archived") {
    return batch.archivedAt ? `gearchiveerd ${dateText(batch.archivedAt)}` : "gearchiveerd";
  }

  if (batch.failedAt) {
    return `mislukt ${dateText(batch.failedAt)}`;
  }

  if (batch.committedAt) {
    return `verwerkt ${dateText(batch.committedAt)}`;
  }

  return `aangemaakt ${dateText(batch.createdAt)}`;
}

// ─── VAT mapping helpers ───────────────────────────────────────────────────────

/**
 * Unieke sleutel voor een VAT-mapping rij.
 * Was gedupliceerd in: ImportProfiles + VatMappingGroups (2×, identiek).
 */
export function rowKey(row: VatMappingReviewRow): string {
  return `${row.profileId}::${row.sourceColumnIndex}::${row.sourceColumnName}`;
}

/**
 * Berekent voortgangspercentage.
 * Was gedupliceerd in: ImportProfiles + VatMappingGroups (2×, identiek).
 */
export function progressPercentage(done: number, total: number): number {
  if (total <= 0) {
    return 100;
  }

  return Math.round((done / total) * 100);
}

// ─── Archief actie ─────────────────────────────────────────────────────────────

/**
 * Bepaalt de archiveer/terugzetten-actie voor een batch.
 * Was gedupliceerd in: ImportBatchesTable + ImportDetailPanel (2×, identiek).
 */
export function archiveActionFor(batch: ProductImportBatch) {
  return batch.status === "archived"
    ? {
        label: "Terugzetten",
        nextStatus: batch.archivedFromStatus ?? ("uploaded" as ProductImportBatch["status"]),
        icon: <RotateCcw size={16} aria-hidden="true" />,
        variant: "secondary" as const
      }
    : {
        label: "Archiveren",
        nextStatus: "archived" as ProductImportBatch["status"],
        icon: <Archive size={16} aria-hidden="true" />,
        variant: "danger" as const
      };
}
