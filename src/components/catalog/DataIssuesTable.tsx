import { Save } from "lucide-react";
import { formatRecommendation } from "../../lib/i18n/statusLabels";
import { Badge, type BadgeVariant } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { Field } from "../ui/forms/Field";
import { Select } from "../ui/forms/Select";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { Textarea } from "../ui/forms/Textarea";
import { numberText, dateTimeText } from "./catalog/catalogUtils";

export type DuplicateEanDecision =
  | "keep_separate"
  | "merge_later"
  | "source_error"
  | "accepted_duplicate"
  | "resolved";

export type DuplicateEanProduct = {
  productId: string;
  articleNumber?: string;
  supplierCode?: string;
  productName: string;
  sourceFileNames: string[];
  sourceSheetNames: string[];
  priceCount: number;
};

export type DuplicateEanIssue = {
  issueId?: string;
  issueType: "duplicate_ean";
  severity: "info" | "warning" | "error";
  issueStatus: "open" | "reviewed" | "accepted" | "resolved";
  supplier: string;
  ean: string;
  productIds: string[];
  articleNumbers: string[];
  supplierCodes: string[];
  productNames: string[];
  sourceFileNames: string[];
  sourceSheetNames: string[];
  priceCounts: Record<string, number>;
  products: DuplicateEanProduct[];
  recommendation: string;
  reason: string;
  notes?: string;
  reviewDecision?: DuplicateEanDecision;
  reviewedByExternalUserId?: string;
  reviewedAt?: number;
};

export type IssueDraft = {
  decision: DuplicateEanDecision;
  notes: string;
};

type DataIssuesTableProps = {
  filteredGroups: DuplicateEanIssue[];
  /** Totaal aantal groepen na filtering; filteredGroups kan een deelvenster zijn. */
  totalGroupCount: number;
  drafts: Record<string, IssueDraft>;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  onUpdateDraft: (issueId: string, patch: Partial<IssueDraft>) => void;
  onSaveIssue: (issue: DuplicateEanIssue) => void | Promise<void>;
  /** Aanwezig zolang er meer groepen zijn dan er getoond worden. */
  onShowMore?: () => void;
};

const decisions: Array<{ value: DuplicateEanDecision; label: string; helpText: string }> = [
  {
    value: "keep_separate",
    label: "Gescheiden houden",
    helpText: "Producten blijven bewust gescheiden ondanks dezelfde EAN."
  },
  {
    value: "merge_later",
    label: "Later beoordelen voor samenvoegen",
    helpText: "Nog niet samenvoegen; eerst zakelijke controle of broncorrectie nodig."
  },
  {
    value: "source_error",
    label: "Fout in leverancierbestand",
    helpText: "Waarschijnlijk fout in het aangeleverde bestand."
  },
  {
    value: "accepted_duplicate",
    label: "Bewust dubbel toegestaan",
    helpText: "Dubbele EAN is bekend en geaccepteerd voor deze catalogus."
  },
  {
    value: "resolved",
    label: "Opgelost",
    helpText: "Waarschuwing is inhoudelijk afgehandeld."
  }
];


function statusVariant(status: DuplicateEanIssue["issueStatus"]): BadgeVariant {
  if (status === "resolved" || status === "accepted") {
    return "success";
  }

  if (status === "reviewed") {
    return "warning";
  }

  return "danger";
}

function recommendationVariant(recommendation: string): BadgeVariant {
  if (recommendation === "keep_separate" || recommendation === "accepted_duplicate") {
    return "info";
  }

  if (recommendation === "resolved") {
    return "success";
  }

  return "warning";
}

function formatDuplicateEanStatus(status: DuplicateEanIssue["issueStatus"]) {
  if (status === "open") {
    return "Te beoordelen";
  }

  if (status === "accepted") {
    return "Bewust toegestaan";
  }

  if (status === "reviewed") {
    return "Beoordeeld";
  }

  return "Opgelost";
}

function formatSeverity(severity: DuplicateEanIssue["severity"]) {
  if (severity === "error") {
    return "Fout";
  }

  if (severity === "warning") {
    return "Waarschuwing";
  }

  return "Informatie";
}

export function DataIssuesTable({
  filteredGroups,
  totalGroupCount,
  drafts,
  isSaving,
  isLoading,
  error,
  onUpdateDraft,
  onSaveIssue,
  onShowMore
}: DataIssuesTableProps) {
  function decisionHelpText(issueId?: string, fallback?: DuplicateEanDecision) {
    const decision = issueId ? drafts[issueId]?.decision : fallback;

    return decisions.find((item) => item.value === (decision ?? fallback ?? "keep_separate"))
      ?.helpText;
  }

  const columns: Array<DataTableColumn<DuplicateEanIssue>> = [
    {
      key: "issue",
      header: "Signaal",
      width: "180px",
      render: (issue) => (
        <div className="issue-signal-cell">
          <StatusBadge
            status={issue.issueStatus}
            label={formatDuplicateEanStatus(issue.issueStatus)}
            variant={statusVariant(issue.issueStatus)}
          />
          <Badge variant="warning">Dubbele EAN</Badge>
          <div className="issue-ean-code">{issue.ean}</div>
          <small className="muted">Ernst: {formatSeverity(issue.severity)}</small>
        </div>
      )
    },
    {
      key: "supplier",
      header: "Leverancier",
      width: "150px",
      render: (issue) => (
        <div className="stack-sm">
          <strong>{issue.supplier}</strong>
          <small className="muted">
            {numberText(issue.products.length)} producten in deze groep
          </small>
        </div>
      )
    },
    {
      key: "products",
      header: "Producten",
      render: (issue) => (
        <div className="product-compare">
          <div className="product-compare-grid">
            {issue.products.slice(0, 2).map((product) => (
              <div className="product-compare-item" key={product.productId}>
                <strong>{product.productName}</strong>
                <div className="muted">
                  artikel {product.articleNumber ?? "-"}
                  {product.supplierCode ? ` · leverancierscode ${product.supplierCode}` : ""}
                </div>
                {product.priceCount > 0 ? (
                  <div className="muted">prijzen {numberText(product.priceCount)}</div>
                ) : null}
              </div>
            ))}
          </div>
          {issue.products.length > 2 ? (
            <div className="product-compare-overflow">
              +{numberText(issue.products.length - 2)} extra producten in deze groep
            </div>
          ) : null}
        </div>
      )
    },
    {
      key: "sources",
      header: "Bronnen",
      hideOnMobile: true,
      render: (issue) => (
        <div className="issue-source-list">
          {issue.sourceFileNames.length > 0 ? <div>{issue.sourceFileNames.join(", ")}</div> : null}
          {issue.sourceSheetNames.length > 0 ? (
            <small className="muted">Tabblad: {issue.sourceSheetNames.join(", ")}</small>
          ) : null}
          <small className="muted">Artikelnummers: {issue.articleNumbers.join(", ") || "-"}</small>
          {issue.supplierCodes.length > 0 ? (
            <small className="muted">Leverancierscodes: {issue.supplierCodes.join(", ")}</small>
          ) : null}
        </div>
      )
    },
    {
      key: "recommendation",
      header: "Controleadvies",
      width: "210px",
      render: (issue) => (
        <div className="stack-sm">
          <Badge variant={recommendationVariant(issue.recommendation)}>
            {formatRecommendation(issue.recommendation)}
          </Badge>
          <small className="muted">{issue.reason}</small>
        </div>
      )
    },
    {
      key: "review",
      header: "Beoordeling",
      width: "280px",
      render: (issue) => {
        const draft = issue.issueId ? drafts[issue.issueId] : undefined;

        return (
          <>
            <Field
              label="Zakelijke beslissing"
              htmlFor={`decision-${issue.issueId ?? issue.ean}`}
              description={decisionHelpText(issue.issueId, issue.reviewDecision)}
            >
              <Select
                id={`decision-${issue.issueId ?? issue.ean}`}
                value={draft?.decision ?? issue.reviewDecision ?? "keep_separate"}
                disabled={isSaving || !issue.issueId}
                onChange={(event) =>
                  issue.issueId
                    ? onUpdateDraft(issue.issueId, {
                        decision: event.target.value as DuplicateEanDecision
                      })
                    : undefined
                }
              >
                {decisions.map((decision) => (
                  <option key={decision.value} value={decision.value}>
                    {decision.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div style={{ marginTop: 10 }}>
              <Field
                label="Interne beoordelingsnotitie"
                htmlFor={`notes-${issue.issueId ?? issue.ean}`}
                description="Alleen bedoeld voor interne productcontrole."
              >
                <Textarea
                  id={`notes-${issue.issueId ?? issue.ean}`}
                  value={draft?.notes ?? issue.notes ?? ""}
                  disabled={isSaving || !issue.issueId}
                  onChange={(event) =>
                    issue.issueId
                      ? onUpdateDraft(issue.issueId, { notes: event.target.value })
                      : undefined
                  }
                />
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={isSaving || !issue.issueId}
              onClick={() => void onSaveIssue(issue)}
              style={{ marginTop: 10 }}
              leftIcon={<Save size={17} aria-hidden="true" />}
            >
              Beoordeling bewaren
            </Button>
            <div className="muted" style={{ marginTop: 8 }}>
              {issue.reviewedAt ? `Beoordeeld ${dateTimeText(issue.reviewedAt)}` : "Nog niet beoordeeld"}
            </div>
          </>
        );
      }
    }
  ];

  return (
    <section className="panel issue-table-panel">
      <div className="toolbar issue-table-heading">
        <div>
          <p className="eyebrow">EAN-groepen</p>
          <h2>Te beoordelen productgroepen</h2>
        </div>
        <Badge>
          {filteredGroups.length < totalGroupCount
            ? `${numberText(filteredGroups.length)} van ${numberText(totalGroupCount)} groepen`
            : `${numberText(totalGroupCount)} groepen`}
        </Badge>
      </div>
      <DataTable
        rows={filteredGroups}
        columns={columns}
        getRowKey={(issue) => `${issue.supplier}-${issue.ean}`}
        loading={isLoading}
        error={error}
        emptyTitle="Geen dubbele EAN-waarschuwingen gevonden"
        emptyDescription="Pas filters aan of werk de waarschuwingen opnieuw bij."
        density="compact"
        mobileMode="cards"
        renderMobileCard={(issue) => {
          const draft = issue.issueId ? drafts[issue.issueId] : undefined;
          const fieldId = issue.issueId ?? `${issue.supplier}-${issue.ean}`;

          return (
            <>
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <strong>{issue.supplier}</strong>
                  <span className="muted">EAN {issue.ean}</span>
                </div>
                <StatusBadge
                  status={issue.issueStatus}
                  label={formatDuplicateEanStatus(issue.issueStatus)}
                  variant={statusVariant(issue.issueStatus)}
                />
              </div>
              <div className="mobile-card-meta">
                <Badge variant="warning">Dubbele EAN</Badge>
                <Badge variant={recommendationVariant(issue.recommendation)}>
                  {formatRecommendation(issue.recommendation)}
                </Badge>
                <Badge variant="neutral">{numberText(issue.products.length)} producten</Badge>
              </div>
              <div className="mobile-card-section">
                <p className="mobile-card-section-label">Productvergelijking</p>
                <div className="product-compare-grid">
                  {issue.products.slice(0, 2).map((product) => (
                    <div className="product-compare-item" key={product.productId}>
                      <strong>{product.productName}</strong>
                      <div className="muted">
                        artikel {product.articleNumber ?? "-"}
                        {product.supplierCode ? ` · leverancierscode ${product.supplierCode}` : ""}
                      </div>
                      {product.priceCount > 0 ? (
                        <div className="muted">prijzen {numberText(product.priceCount)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {issue.products.length > 2 ? (
                  <div className="product-compare-overflow">
                    +{numberText(issue.products.length - 2)} extra producten in deze groep
                  </div>
                ) : null}
              </div>
              <div className="mobile-card-section">
                <p className="mobile-card-section-label">Advies</p>
                <span className="muted">{issue.reason}</span>
              </div>
              <div className="mobile-card-section">
                <Field
                  label="Zakelijke beslissing"
                  htmlFor={`mobile-decision-${fieldId}`}
                  description={decisionHelpText(issue.issueId, issue.reviewDecision)}
                >
                  <Select
                    id={`mobile-decision-${fieldId}`}
                    value={draft?.decision ?? issue.reviewDecision ?? "keep_separate"}
                    disabled={isSaving || !issue.issueId}
                    onChange={(event) =>
                      issue.issueId
                        ? onUpdateDraft(issue.issueId, {
                            decision: event.target.value as DuplicateEanDecision
                          })
                        : undefined
                    }
                  >
                    {decisions.map((decision) => (
                      <option key={decision.value} value={decision.value}>
                        {decision.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Interne beoordelingsnotitie"
                  htmlFor={`mobile-notes-${fieldId}`}
                  description="Alleen bedoeld voor interne productcontrole."
                >
                  <Textarea
                    id={`mobile-notes-${fieldId}`}
                    value={draft?.notes ?? issue.notes ?? ""}
                    disabled={isSaving || !issue.issueId}
                    onChange={(event) =>
                      issue.issueId
                        ? onUpdateDraft(issue.issueId, { notes: event.target.value })
                        : undefined
                    }
                  />
                </Field>
              </div>
              <div className="mobile-card-actions">
                <Button
                  variant="primary"
                  disabled={isSaving || !issue.issueId}
                  onClick={() => void onSaveIssue(issue)}
                  leftIcon={<Save size={17} aria-hidden="true" />}
                >
                  Beoordeling bewaren
                </Button>
              </div>
            </>
          );
        }}
        ariaLabel="Dubbele EAN-waarschuwingen"
      />
      {onShowMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <Button variant="secondary" onClick={onShowMore}>
            Toon meer ({numberText(totalGroupCount - filteredGroups.length)} resterend)
          </Button>
        </div>
      ) : null}
    </section>
  );
}
