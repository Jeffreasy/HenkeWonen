import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/LoadingState";
import { numberText } from "./catalog/catalogUtils";
import type { DuplicateEanIssue } from "./DataIssuesTable";
type DuplicateEanReview = {
  duplicateProductCount: number;
  duplicateGroupCount: number;
};

type DataIssuesHeaderProps = {
  isLoading: boolean;
  isSaving: boolean;
  hasOpenIssues: boolean;
  review: DuplicateEanReview | null;
  error: string | null;
  summary: {
    total: number;
    open: number;
    reviewed: number;
    accepted: number;
    resolved: number;
    missingIssueRecords: number;
  };
  nextOpenIssue?: DuplicateEanIssue;
  supplierOptionsCount: number;
  visibleProductCount: number;
  visibleSourceFileCount: number;
  filteredGroupsCount: number;
  onRefresh: () => void | Promise<void>;
  onSync: () => void | Promise<void>;
};


export function DataIssuesHeader({
  isLoading,
  isSaving,
  hasOpenIssues,
  review,
  error,
  summary,
  nextOpenIssue,
  supplierOptionsCount,
  visibleProductCount,
  visibleSourceFileCount,
  filteredGroupsCount,
  onRefresh,
  onSync
}: DataIssuesHeaderProps) {
  return (
    <>
      <div className="toolbar issue-workbench-titlebar">
        <div>
          <p className="eyebrow">Productcontrole</p>
          <h2 className="issue-workbench-title">
            {isLoading
              ? "Dubbele EAN-signalen laden"
              : hasOpenIssues
                ? `${numberText(summary.open)} EAN-groepen vragen beoordeling`
                : "Alle EAN-signalen zijn beoordeeld"}
          </h2>
          <p className="muted issue-workbench-copy">
            EAN is een controlesignaal. Producten worden nooit automatisch samengevoegd.
          </p>
        </div>
        <div className="toolbar">
          <Badge
            variant={isLoading || !review ? "neutral" : hasOpenIssues ? "warning" : "success"}
            icon={
              isLoading || !review ? (
                <RefreshCw size={14} aria-hidden="true" />
              ) : hasOpenIssues ? (
                <ShieldAlert size={14} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )
            }
          >
            {isLoading || !review
              ? "Laden"
              : hasOpenIssues
                ? "Controle nodig"
                : "Productcontrole gereed"}
          </Badge>
          <Button
            leftIcon={<RefreshCw size={17} aria-hidden="true" />}
            variant="secondary"
            onClick={onRefresh}
            disabled={isLoading || isSaving}
          >
            Verversen
          </Button>
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={17} aria-hidden="true" />}
            onClick={onSync}
            disabled={isSaving || isLoading}
          >
            Signalen bijwerken
          </Button>
        </div>
      </div>
      <Alert
        variant="warning"
        title="Geen automatische samenvoeging"
        description="Deze controle helpt dubbele EAN's beoordelen. De catalogus blijft veilig: producten blijven gescheiden tot er expliciet een zakelijke beslissing is vastgelegd."
        style={{ marginTop: 16 }}
      />
      {error ? (
        <Alert
          variant="danger"
          title="Productcontrole niet geladen"
          description={error}
          style={{ marginTop: 16 }}
        />
      ) : null}
      {isLoading ? (
        <div style={{ marginTop: 16 }}>
          <LoadingState title="Dubbele EAN-waarschuwingen laden" description="Productcontrole ophalen." />
        </div>
      ) : null}

      {review && !isLoading ? (
        <>
          <div className="issue-overview-layout">
            <div className="issue-focus-block">
              <p className="eyebrow">Nu eerst</p>
              <strong>
                {nextOpenIssue
                  ? `${nextOpenIssue.supplier} · EAN ${nextOpenIssue.ean}`
                  : "Geen open EAN-signalen"}
              </strong>
              <p className="muted">
                {nextOpenIssue
                  ? `${numberText(nextOpenIssue.products.length)} producten delen deze EAN. Leg vast of dit bewust gescheiden blijft, later beoordeeld wordt of opgelost is.`
                  : "De open productcontrole is afgerond. Bewaarde beslissingen blijven zichtbaar."}
              </p>
            </div>
            <div className="issue-focus-block">
              <p className="eyebrow">Scope</p>
              <strong>{numberText(review.duplicateProductCount)} producten met signaal</strong>
              <p className="muted">
                {numberText(review.duplicateGroupCount)} leverancier+EAN-groepen uit{" "}
                {numberText(supplierOptionsCount)} leveranciers.
              </p>
            </div>
          </div>

          <div className="issue-summary-strip" aria-label="Samenvatting productcontrole">
            <div className="issue-summary-item issue-summary-warning">
              <span>Te beoordelen</span>
              <strong>{numberText(summary.open)}</strong>
            </div>
            <div className="issue-summary-item issue-summary-info">
              <span>Beoordeeld</span>
              <strong>{numberText(summary.reviewed)}</strong>
            </div>
            <div className="issue-summary-item issue-summary-success">
              <span>Bewust toegestaan</span>
              <strong>{numberText(summary.accepted)}</strong>
            </div>
            <div className="issue-summary-item issue-summary-success">
              <span>Opgelost</span>
              <strong>{numberText(summary.resolved)}</strong>
            </div>
            <div className="issue-summary-item">
              <span>Zichtbaar</span>
              <strong>{numberText(filteredGroupsCount)}</strong>
            </div>
          </div>

          <div className="issue-signal-row">
            <Badge variant="neutral">{numberText(visibleProductCount)} zichtbare producten</Badge>
            <Badge variant="neutral">{numberText(visibleSourceFileCount)} bronbestanden</Badge>
            {summary.missingIssueRecords > 0 ? (
              <Badge variant="warning">
                {numberText(summary.missingIssueRecords)} signaal nog bij te werken
              </Badge>
            ) : (
              <Badge variant="success">Alle signalen opgeslagen</Badge>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
