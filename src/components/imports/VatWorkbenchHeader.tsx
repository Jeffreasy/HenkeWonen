import type { VatMappingReview } from "./ImportProfiles";
import { numberText } from "./import/importUtils";
import { StatValue } from "../ui/feedback/StatValue";

type VatWorkbenchHeaderProps = {
  isLoading: boolean;
  hasUnresolvedVatChoices: boolean;
  summary: {
    unresolved: number;
    inclusive: number;
    exclusive: number;
    allowUnknown: number;
    reviewed: number;
  };
  review: VatMappingReview | null;
  completionPercentage: number;
};

export function VatWorkbenchHeader({
  isLoading,
  hasUnresolvedVatChoices,
  summary,
  review,
  completionPercentage
}: VatWorkbenchHeaderProps) {
  return (
    <section
      className={
        hasUnresolvedVatChoices
          ? "panel vat-workbench vat-workbench-blocked"
          : "panel vat-workbench"
      }
    >
      <div className="toolbar vat-workbench-titlebar">
        <div>
          <p className="eyebrow">Btw-werkbank</p>
          <h2 className="vat-workbench-title">
            {isLoading
              ? "Btw-keuzes laden"
              : hasUnresolvedVatChoices
                ? `${numberText(summary.unresolved)} prijskolommen vragen nog een keuze`
                : "Alle prijskolommen hebben een btw-keuze"}
          </h2>
          <p className="muted vat-workbench-copy">
            {isLoading
              ? "De controles worden opgehaald."
              : `${numberText(review?.totalProfiles ?? 0)} importprofielen met ${numberText(
                  review?.totalPriceColumns ?? 0
                )} prijskolommen.`}
          </p>
        </div>
      </div>

      <div className="vat-overview-layout">
        <div className="vat-focus-block">
          <p className="eyebrow">Voortgang btw-keuzes</p>
          <strong><StatValue loading={isLoading} value={`${completionPercentage}% gereed`} width={80} /></strong>
          <div className="vat-progress-bar" aria-hidden="true">
            <span style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
        <div className="vat-focus-block">
          <p className="eyebrow">Btw te beoordelen</p>
          <strong><StatValue loading={isLoading} value={`${numberText(summary.unresolved)} kolommen`} width={90} /></strong>
          <p className="muted">
            {summary.unresolved > 0
              ? "Kies per kolom de btw-modus in de tabel hieronder."
              : "De verwerkingspoort is open voor prijslijsten."}
          </p>
        </div>
      </div>

      <div className="vat-summary-strip" aria-label="Samenvatting btw-keuzes">
        <div className="vat-summary-item vat-summary-danger">
          <span>Te beoordelen</span>
          <strong><StatValue loading={isLoading} value={numberText(summary.unresolved)} /></strong>
        </div>
        <div className="vat-summary-item vat-summary-success">
          <span>Inclusief btw</span>
          <strong><StatValue loading={isLoading} value={numberText(summary.inclusive)} /></strong>
        </div>
        <div className="vat-summary-item vat-summary-success">
          <span>Exclusief btw</span>
          <strong><StatValue loading={isLoading} value={numberText(summary.exclusive)} /></strong>
        </div>
        <div className="vat-summary-item vat-summary-warning">
          <span>Uitzonderingen</span>
          <strong><StatValue loading={isLoading} value={numberText(summary.allowUnknown)} /></strong>
        </div>
      </div>
    </section>
  );
}
