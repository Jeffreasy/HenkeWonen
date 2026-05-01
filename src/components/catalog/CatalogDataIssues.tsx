import { RefreshCw, Save, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatIssueStatus,
  formatRecommendation,
  formatStatusLabel
} from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { LoadingState } from "../ui/LoadingState";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

type CatalogDataIssuesProps = {
  session: AppSession;
};

type DuplicateEanDecision =
  | "keep_separate"
  | "merge_later"
  | "source_error"
  | "accepted_duplicate"
  | "resolved";

type DuplicateEanProduct = {
  productId: string;
  articleNumber?: string;
  supplierCode?: string;
  productName: string;
  sourceFileNames: string[];
  sourceSheetNames: string[];
  priceCount: number;
};

type DuplicateEanIssue = {
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

type DuplicateEanReview = {
  duplicateGroupCount: number;
  duplicateProductCount: number;
  groups: DuplicateEanIssue[];
};

type IssueDraft = {
  decision: DuplicateEanDecision;
  notes: string;
};

type IssueStatusFilter = "all" | DuplicateEanIssue["issueStatus"];
type RecommendationFilter = "all" | string;

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
    label: "Bronfout",
    helpText: "Waarschijnlijk fout in leverancierbestand of bronmapping."
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

function numberText(value: number) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function dateText(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusVariant(status: DuplicateEanIssue["issueStatus"]): BadgeVariant {
  if (status === "resolved" || status === "accepted") {
    return "success";
  }

  if (status === "reviewed") {
    return "warning";
  }

  return "danger";
}

export default function CatalogDataIssues({ session }: CatalogDataIssuesProps) {
  const [review, setReview] = useState<DuplicateEanReview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, IssueDraft>>({});
  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>("open");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierOptions = useMemo(
    () => [...new Set((review?.groups ?? []).map((issue) => issue.supplier))].sort(),
    [review?.groups]
  );
  const recommendationOptions = useMemo(
    () => [...new Set((review?.groups ?? []).map((issue) => issue.recommendation))].sort(),
    [review?.groups]
  );
  const summary = useMemo(() => {
    const groups = review?.groups ?? [];

    return {
      open: groups.filter((issue) => issue.issueStatus === "open").length,
      reviewed: groups.filter((issue) => issue.issueStatus === "reviewed").length,
      accepted: groups.filter((issue) => issue.issueStatus === "accepted").length,
      resolved: groups.filter((issue) => issue.issueStatus === "resolved").length
    };
  }, [review?.groups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (review?.groups ?? []).filter((issue) => {
      const matchesStatus = statusFilter === "all" || issue.issueStatus === statusFilter;
      const matchesSupplier = supplierFilter === "all" || issue.supplier === supplierFilter;
      const matchesRecommendation =
        recommendationFilter === "all" || issue.recommendation === recommendationFilter;
      const haystack = [
        issue.supplier,
        issue.ean,
        ...issue.productNames,
        ...issue.articleNumbers,
        ...issue.supplierCodes,
        ...issue.sourceFileNames
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

      return matchesStatus && matchesSupplier && matchesRecommendation && matchesSearch;
    });
  }, [recommendationFilter, review?.groups, searchQuery, statusFilter, supplierFilter]);

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = (await client.query(api.catalogReview.duplicateEanReview, {
        tenantSlug: session.tenantId
      })) as DuplicateEanReview;

      setReview(result);
      setDrafts(
        Object.fromEntries(
          result.groups
            .filter((issue) => issue.issueId)
            .map((issue) => [
              issue.issueId as string,
              {
                decision: issue.reviewDecision ?? "keep_separate",
                notes: issue.notes ?? ""
              }
            ])
        )
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Datakwaliteitswaarschuwingen konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, [session.tenantId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  async function syncIssues() {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.syncDuplicateEanIssues, {
        tenantSlug: session.tenantId
      });
      await loadReview();
    } catch (syncError) {
      console.error(syncError);
      setError("Dubbele EAN-waarschuwingen konden niet worden gesynchroniseerd.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveIssue(issue: DuplicateEanIssue) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("De gegevensverbinding is niet geconfigureerd.");
      return;
    }

    if (!issue.issueId) {
      setError("Waarschuwing heeft geen beoordelings-id. Synchroniseer dubbele EAN-waarschuwingen opnieuw.");
      return;
    }

    const draft = drafts[issue.issueId];

    setIsSaving(true);
    setError(null);

    try {
      await client.mutation(api.catalogReview.updateDuplicateEanIssueReview, {
        tenantSlug: session.tenantId,
        issueId: issue.issueId,
        decision: draft?.decision ?? "keep_separate",
        notes: draft?.notes,
        reviewedByExternalUserId: session.userId
      });
      await loadReview();
    } catch (saveError) {
      console.error(saveError);
      setError("Beoordeling kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft(issueId: string, patch: Partial<IssueDraft>) {
    setDrafts((current) => ({
      ...current,
      [issueId]: {
        decision: current[issueId]?.decision ?? "keep_separate",
        notes: current[issueId]?.notes ?? "",
        ...patch
      }
    }));
  }

  function decisionHelpText(issueId?: string, fallback?: DuplicateEanDecision) {
    const decision = issueId ? drafts[issueId]?.decision : fallback;

    return decisions.find((item) => item.value === (decision ?? fallback ?? "keep_separate"))
      ?.helpText;
  }

  const columns: Array<DataTableColumn<DuplicateEanIssue>> = [
    {
      key: "issue",
      header: "Waarschuwing",
      width: "150px",
      render: (issue) => (
        <>
          <StatusBadge
            status={issue.issueStatus}
            label={formatIssueStatus(issue.issueStatus)}
            variant={statusVariant(issue.issueStatus)}
          />
          <div className="muted">Dubbele EAN</div>
          <div className="muted">ernst {formatStatusLabel(issue.severity)}</div>
        </>
      )
    },
    {
      key: "supplier",
      header: "Leverancier / EAN",
      width: "180px",
      render: (issue) => (
        <>
          <strong>{issue.supplier}</strong>
          <div className="muted">{issue.ean}</div>
        </>
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
                artikel {product.articleNumber ?? "-"} · leverancierscode {product.supplierCode ?? "-"}
              </div>
              <div className="muted">prijzen {numberText(product.priceCount)}</div>
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
        <>
          <div>{issue.sourceFileNames.join(", ") || "-"}</div>
          <div className="muted">{issue.sourceSheetNames.join(", ") || "-"}</div>
          <div className="muted">Artikelnummers: {issue.articleNumbers.join(", ") || "-"}</div>
          <div className="muted">Leverancierscodes: {issue.supplierCodes.join(", ") || "-"}</div>
        </>
      )
    },
    {
      key: "recommendation",
      header: "Advies",
      width: "190px",
      render: (issue) => (
        <>
          <Badge variant="warning">{formatRecommendation(issue.recommendation)}</Badge>
          <div className="muted">{issue.reason}</div>
        </>
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
              label="Beslissing"
              htmlFor={`decision-${issue.issueId ?? issue.ean}`}
              description={decisionHelpText(issue.issueId, issue.reviewDecision)}
            >
              <Select
                id={`decision-${issue.issueId ?? issue.ean}`}
                value={draft?.decision ?? issue.reviewDecision ?? "keep_separate"}
                disabled={isSaving || !issue.issueId}
                onChange={(event) =>
                  issue.issueId
                    ? updateDraft(issue.issueId, {
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
                description="Alleen bedoeld voor interne datakwaliteitscontrole."
              >
                <Textarea
                  id={`notes-${issue.issueId ?? issue.ean}`}
                  value={draft?.notes ?? issue.notes ?? ""}
                  disabled={isSaving || !issue.issueId}
                  onChange={(event) =>
                    issue.issueId ? updateDraft(issue.issueId, { notes: event.target.value }) : undefined
                  }
                />
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={isSaving || !issue.issueId}
              onClick={() => void saveIssue(issue)}
              style={{ marginTop: 10 }}
              leftIcon={<Save size={17} aria-hidden="true" />}
            >
              Beoordeling opslaan
            </Button>
            <div className="muted" style={{ marginTop: 8 }}>
              beoordeeld {dateText(issue.reviewedAt)} · {issue.reviewedByExternalUserId ?? "-"}
            </div>
          </>
        );
      }
    }
  ];

  return (
    <div className="grid">
      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
              Dubbele EAN-waarschuwingen
            </Badge>
            <h2 style={{ margin: "8px 0 0" }}>
              {numberText(review?.duplicateGroupCount ?? 0)} leverancier+EAN-groepen
            </h2>
            <p className="muted">
              {numberText(review?.duplicateProductCount ?? 0)} producten met een EAN-waarschuwing.
              EAN is alleen ondersteunend; er wordt niets automatisch samengevoegd.
            </p>
          </div>
          <div className="toolbar">
            <Button
              leftIcon={<RefreshCw size={17} aria-hidden="true" />}
              variant="secondary"
              onClick={() => void loadReview()}
            >
              Verversen
            </Button>
            <Button
              variant="secondary"
              onClick={() => void syncIssues()}
              disabled={isSaving}
            >
              Waarschuwingen synchroniseren
            </Button>
          </div>
        </div>
        <Alert
          variant="warning"
          title="Niet automatisch samenvoegen"
          description="EAN is een ondersteunend signaal. Producten blijven gescheiden tot er een expliciete zakelijke beslissing is."
          style={{ marginTop: 16 }}
        />
        {error ? (
          <Alert
            variant="danger"
            title="Datakwaliteit niet geladen"
            description={error}
            style={{ marginTop: 16 }}
          />
        ) : null}
        {isLoading ? (
          <div style={{ marginTop: 16 }}>
            <LoadingState title="Dubbele EAN-waarschuwingen laden" description="Beoordeling ophalen." />
          </div>
        ) : null}
      </section>

      <div className="grid three-column">
        <StatCard label="Open waarschuwingen" value={numberText(summary.open)} tone="warning" />
        <StatCard label="Beoordeeld" value={numberText(summary.reviewed)} tone="info" />
        <StatCard label="Bewust dubbel toegestaan" value={numberText(summary.accepted)} tone="success" />
      </div>
      <div className="grid three-column">
        <StatCard label="Opgelost" value={numberText(summary.resolved)} tone="success" />
        <StatCard
          label="Producten met waarschuwing"
          value={numberText(review?.duplicateProductCount ?? 0)}
          tone="warning"
        />
        <StatCard
          label="Zichtbaar"
          value={numberText(filteredGroups.length)}
          tone="neutral"
        />
      </div>

      <section className="panel">
        <FilterBar
          search={
            <SearchInput
              aria-label="Zoek in dubbele EAN-waarschuwingen"
              value={searchQuery}
              placeholder="Zoek op leverancier, EAN, product of bronbestand"
              onChange={setSearchQuery}
            />
          }
          filters={
            <>
              <Field label="Status" htmlFor="issue-status-filter">
                <Select
                  id="issue-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as IssueStatusFilter)}
                >
                  <option value="open">Open</option>
                  <option value="reviewed">Beoordeeld</option>
                  <option value="accepted">Geaccepteerd</option>
                  <option value="resolved">Opgelost</option>
                  <option value="all">Alle</option>
                </Select>
              </Field>
              <Field label="Leverancier" htmlFor="issue-supplier-filter">
                <Select
                  id="issue-supplier-filter"
                  value={supplierFilter}
                  onChange={(event) => setSupplierFilter(event.target.value)}
                >
                  <option value="all">Alle leveranciers</option>
                  {supplierOptions.map((supplier) => (
                    <option value={supplier} key={supplier}>
                      {supplier}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Advies" htmlFor="issue-recommendation-filter">
                <Select
                  id="issue-recommendation-filter"
                  value={recommendationFilter}
                  onChange={(event) => setRecommendationFilter(event.target.value)}
                >
                  <option value="all">Alle adviezen</option>
                  {recommendationOptions.map((recommendation) => (
                    <option value={recommendation} key={recommendation}>
                      {recommendation}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          }
          actions={<span className="muted">{numberText(filteredGroups.length)} zichtbaar</span>}
        />
      </section>

      <DataTable
        rows={filteredGroups}
        columns={columns}
        getRowKey={(issue) => `${issue.supplier}-${issue.ean}`}
        loading={isLoading}
        error={error}
        emptyTitle="Geen dubbele EAN-waarschuwingen gevonden"
        emptyDescription="Pas filters aan of synchroniseer de waarschuwingen opnieuw."
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
                  label={formatIssueStatus(issue.issueStatus)}
                  variant={statusVariant(issue.issueStatus)}
                />
              </div>
              <div className="mobile-card-meta">
                <Badge variant="warning">Dubbele EAN</Badge>
                <Badge variant="neutral">{formatRecommendation(issue.recommendation)}</Badge>
                <Badge variant="neutral">{numberText(issue.products.length)} producten</Badge>
              </div>
              <div className="mobile-card-section">
                <p className="mobile-card-section-label">Productvergelijking</p>
                <div className="product-compare-grid">
                  {issue.products.slice(0, 2).map((product) => (
                    <div className="product-compare-item" key={product.productId}>
                      <strong>{product.productName}</strong>
                      <div className="muted">
                        artikel {product.articleNumber ?? "-"} · leverancierscode{" "}
                        {product.supplierCode ?? "-"}
                      </div>
                      <div className="muted">prijzen {numberText(product.priceCount)}</div>
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
                  label="Beslissing"
                  htmlFor={`mobile-decision-${fieldId}`}
                  description={decisionHelpText(issue.issueId, issue.reviewDecision)}
                >
                  <Select
                    id={`mobile-decision-${fieldId}`}
                    value={draft?.decision ?? issue.reviewDecision ?? "keep_separate"}
                    disabled={isSaving || !issue.issueId}
                    onChange={(event) =>
                      issue.issueId
                        ? updateDraft(issue.issueId, {
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
                  description="Alleen bedoeld voor interne datakwaliteitscontrole."
                >
                  <Textarea
                    id={`mobile-notes-${fieldId}`}
                    value={draft?.notes ?? issue.notes ?? ""}
                    disabled={isSaving || !issue.issueId}
                    onChange={(event) =>
                      issue.issueId ? updateDraft(issue.issueId, { notes: event.target.value }) : undefined
                    }
                  />
                </Field>
              </div>
              <div className="mobile-card-actions">
                <Button
                  variant="primary"
                  disabled={isSaving || !issue.issueId}
                  onClick={() => void saveIssue(issue)}
                  leftIcon={<Save size={17} aria-hidden="true" />}
                >
                  Beoordeling opslaan
                </Button>
              </div>
            </>
          );
        }}
        ariaLabel="Dubbele EAN-waarschuwingen"
      />
    </div>
  );
}
