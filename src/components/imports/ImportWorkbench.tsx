import { CheckCircle2, FileSpreadsheet, ShieldAlert } from "lucide-react";
import type { ProductImportBatch } from "../../lib/portalTypes";
import { Badge } from "../ui/data-display/Badge";

type ImportWorkbenchProps = {
  batchSummary: {
    total: number;
    failed: number;
    needsMapping: number;
    imported: number;
    ready: number;
    warningRows: number;
    unknownVatModeRows: number;
    errorRows: number;
    products: number;
    priceRules: number;
  };
  nextAttentionBatch: ProductImportBatch | null;
  selectedBatch: ProductImportBatch | null;
  isLoading: boolean;
  visibleCount: number;
  numberText: (value: number) => string;
};

export function ImportWorkbench({
  batchSummary,
  nextAttentionBatch,
  selectedBatch,
  isLoading,
  visibleCount,
  numberText
}: ImportWorkbenchProps) {
  const needsAttentionCount = batchSummary.failed + batchSummary.needsMapping;

  return (
    <section
      className={
        needsAttentionCount > 0
          ? "panel import-workbench import-workbench-attention"
          : "panel import-workbench"
      }
    >
      <div className="toolbar import-workbench-titlebar">
        <div>
          <p className="eyebrow">Prijslijstwerkbank</p>
          <h2 className="import-workbench-title">
            {isLoading
              ? "Prijslijsten laden"
              : needsAttentionCount > 0
                ? `${numberText(needsAttentionCount)} controles vragen aandacht`
                : "Prijslijstcontroles zijn bijgewerkt"}
          </h2>
          <p className="muted import-workbench-copy">
            Start controles, bekijk meldingen en verwerk pas definitief als de poort vrij is.
          </p>
        </div>
        <div className="toolbar">
          <Badge
            variant={
              isLoading
                ? "neutral"
                : batchSummary.failed > 0
                  ? "danger"
                  : batchSummary.needsMapping > 0
                    ? "warning"
                    : "success"
            }
            icon={
              isLoading ? (
                <FileSpreadsheet size={14} aria-hidden="true" />
              ) : needsAttentionCount > 0 ? (
                <ShieldAlert size={14} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )
            }
          >
            {isLoading
              ? "Laden"
              : batchSummary.failed > 0
                ? "Mislukte controles"
                : batchSummary.needsMapping > 0
                  ? "Btw-keuze nodig"
                  : "Overzicht gereed"}
          </Badge>
        </div>
      </div>

      <div className="import-overview-layout">
        <div className="import-focus-block">
          <p className="eyebrow">Nu eerst</p>
          <strong>
            {nextAttentionBatch
              ? `${nextAttentionBatch.leverancierNaam} · ${nextAttentionBatch.bestandsnaam}`
              : selectedBatch
                ? selectedBatch.bestandsnaam
                : "Geen open blokkades"}
          </strong>
          <p className="muted">
            {nextAttentionBatch
              ? nextAttentionBatch.status === "failed"
                ? "Deze controle is mislukt. Bekijk de melding voordat je opnieuw verwerkt."
                : "Deze controle heeft nog een btw-keuze of mapping nodig."
              : "Gebruik de lijst hieronder voor detailcontrole of om een nieuwe prijslijstcontrole te starten."}
          </p>
        </div>
        <div className="import-focus-block">
          <p className="eyebrow">Catalogusvolume</p>
          <strong>{numberText(batchSummary.products)} productregels</strong>
          <p className="muted">
            {numberText(batchSummary.priceRules)} prijsregels over {numberText(batchSummary.total)} controles.
          </p>
        </div>
      </div>

      <div className="import-summary-strip" aria-label="Samenvatting prijslijsten">
        <div className="import-summary-item import-summary-danger">
          <span>Aandacht nodig</span>
          <strong>{numberText(needsAttentionCount)}</strong>
        </div>
        <div className="import-summary-item import-summary-success">
          <span>Verwerkt</span>
          <strong>{numberText(batchSummary.imported)}</strong>
        </div>
        <div className="import-summary-item import-summary-info">
          <span>Klaar</span>
          <strong>{numberText(batchSummary.ready)}</strong>
        </div>
        <div className="import-summary-item import-summary-warning">
          <span>Rijmeldingen</span>
          <strong>{numberText(batchSummary.warningRows)}</strong>
          <small>
            {batchSummary.unknownVatModeRows > 0
              ? "Vooral btw-modus onbekend"
              : "Geen btw-meldingen"}
          </small>
        </div>
        <div className="import-summary-item">
          <span>Zichtbaar</span>
          <strong>{numberText(visibleCount)}</strong>
        </div>
      </div>
    </section>
  );
}
