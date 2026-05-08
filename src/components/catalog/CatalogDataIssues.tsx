import { CheckCircle2, Filter, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { mutationActorFromSession } from "../../lib/auth/authzToken";
import type { AppSession } from "../../lib/auth/session";
import { createConvexHttpClient } from "../../lib/convex/client";
import {
  formatRecommendation,
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

const statusFilters: Array<{ value: IssueStatusFilter; label: string }> = [
  { value: "open", label: "Te beoordelen" },
  { value: "reviewed", label: "Beoordeeld" },
  { value: "accepted", label: "Bewust toegestaan" },
  { value: "resolved", label: "Opgelost" },
  { value: "all", label: "Alle" }
];

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

function normalizedText(value?: string) {
  return (value ?? "").toLocaleLowerCase("nl-NL");
}

function issueMatchesSearch(issue: DuplicateEanIssue, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  return [
    issue.supplier,
    issue.ean,
    issue.reason,
    issue.recommendation,
    formatRecommendation(issue.recommendation),
    formatDuplicateEanStatus(issue.issueStatus),
    ...issue.productNames,
    ...issue.articleNumbers,
    ...issue.supplierCodes,
    ...issue.sourceFileNames,
    ...issue.sourceSheetNames
  ].some((value) => normalizedText(value).includes(searchQuery));
}

function statusSortValue(status: DuplicateEanIssue["issueStatus"]) {
  if (status === "open") {
    return 0;
  }

  if (status === "reviewed") {
    return 1;
  }

  if (status === "accepted") {
    return 2;
  }

  return 3;
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
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
  const [notice, setNotice] = useState<string | null>(null);

  const orderedGroups = useMemo(
    () =>
      [...(review?.groups ?? [])].sort((left, right) => {
        const statusDifference = statusSortValue(left.issueStatus) - statusSortValue(right.issueStatus);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        if (left.supplier !== right.supplier) {
          return left.supplier.localeCompare(right.supplier, "nl-NL");
        }

        return left.ean.localeCompare(right.ean, "nl-NL");
      }),
    [review?.groups]
  );

  const supplierOptions = useMemo(
    () => [...new Set(orderedGroups.map((issue) => issue.supplier))].sort(),
    [orderedGroups]
  );
  const recommendationOptions = useMemo(
    () => [...new Set(orderedGroups.map((issue) => issue.recommendation))].sort(),
    [orderedGroups]
  );
  const summary = useMemo(() => {
    return {
      total: orderedGroups.length,
      open: orderedGroups.filter((issue) => issue.issueStatus === "open").length,
      reviewed: orderedGroups.filter((issue) => issue.issueStatus === "reviewed").length,
      accepted: orderedGroups.filter((issue) => issue.issueStatus === "accepted").length,
      resolved: orderedGroups.filter((issue) => issue.issueStatus === "resolved").length,
      missingIssueRecords: orderedGroups.filter((issue) => !issue.issueId).length
    };
  }, [orderedGroups]);

  const groupsMatchingFiltersExceptStatus = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("nl-NL");

    return orderedGroups.filter((issue) => {
      const matchesSupplier = supplierFilter === "all" || issue.supplier === supplierFilter;
      const matchesRecommendation =
        recommendationFilter === "all" || issue.recommendation === recommendationFilter;
      const matchesSearch = issueMatchesSearch(issue, normalizedQuery);

      return matchesSupplier && matchesRecommendation && matchesSearch;
    });
  }, [orderedGroups, recommendationFilter, searchQuery, supplierFilter]);

  const statusCounts = useMemo(
    () =>
      statusFilters.reduce(
        (counts, item) => ({
          ...counts,
          [item.value]:
            item.value === "all"
              ? groupsMatchingFiltersExceptStatus.length
              : groupsMatchingFiltersExceptStatus.filter((issue) => issue.issueStatus === item.value)
                  .length
        }),
        {} as Record<IssueStatusFilter, number>
      ),
    [groupsMatchingFiltersExceptStatus]
  );

  const filteredGroups = useMemo(
    () =>
      groupsMatchingFiltersExceptStatus.filter(
        (issue) => statusFilter === "all" || issue.issueStatus === statusFilter
      ),
    [groupsMatchingFiltersExceptStatus, statusFilter]
  );

  const visibleProductCount = useMemo(
    () => filteredGroups.reduce((total, issue) => total + issue.products.length, 0),
    [filteredGroups]
  );
  const visibleSourceFileCount = useMemo(
    () => uniqueCount(filteredGroups.flatMap((issue) => issue.sourceFileNames)),
    [filteredGroups]
  );
  const nextOpenIssue = orderedGroups.find((issue) => issue.issueStatus === "open");
  const hasOpenIssues = Boolean(review && summary.open > 0);

  const loadReview = useCallback(async () => {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);

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
      setError("Productwaarschuwingen konden niet worden geladen.");
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
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.catalogReview.syncDuplicateEanIssues, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session)
      });
      await loadReview();
      setNotice("Dubbele EAN-waarschuwingen zijn bijgewerkt.");
    } catch (syncError) {
      console.error(syncError);
      setError("Dubbele EAN-waarschuwingen konden niet worden bijgewerkt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveIssue(issue: DuplicateEanIssue) {
    const client = createConvexHttpClient();

    if (!client) {
      setError("Kan de gegevens nu niet bereiken. Controleer de omgeving of probeer het opnieuw.");
      return;
    }

    if (!issue.issueId) {
      setError("Deze waarschuwing mist een beoordeling. Werk de waarschuwingen opnieuw bij.");
      return;
    }

    const draft = drafts[issue.issueId];

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await client.mutation(api.catalogReview.updateDuplicateEanIssueReview, {
        tenantSlug: session.tenantId,
        actor: mutationActorFromSession(session),
        issueId: issue.issueId,
        decision: draft?.decision ?? "keep_separate",
        notes: draft?.notes,
        reviewedByExternalUserId: session.userId
      });
      await loadReview();
      setNotice(`Beoordeling voor EAN ${issue.ean} is opgeslagen.`);
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
          {!issue.issueId ? <Badge variant="neutral">Nog bijwerken</Badge> : null}
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
        <div className="issue-source-list">
          <div>{issue.sourceFileNames.join(", ") || "-"}</div>
          <small className="muted">Tabblad: {issue.sourceSheetNames.join(", ") || "-"}</small>
          <small className="muted">Artikelnummers: {issue.articleNumbers.join(", ") || "-"}</small>
          <small className="muted">Leverancierscodes: {issue.supplierCodes.join(", ") || "-"}</small>
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
                description="Alleen bedoeld voor interne productcontrole."
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
              Beoordeling bewaren
            </Button>
            <div className="muted" style={{ marginTop: 8 }}>
              {!issue.issueId
                ? "Werk waarschuwingen bij voordat je deze groep kunt beoordelen."
                : issue.reviewedAt
                  ? `Beoordeeld ${dateText(issue.reviewedAt)}`
                  : "Nog niet beoordeeld"}
            </div>
          </>
        );
      }
    }
  ];

  return (
    <div className="grid">
      <section
        className={
          hasOpenIssues ? "panel issue-workbench issue-workbench-attention" : "panel issue-workbench"
        }
      >
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
              onClick={() => void loadReview()}
            >
              Verversen
            </Button>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={17} aria-hidden="true" />}
              onClick={() => void syncIssues()}
              disabled={isSaving}
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
        {notice ? (
          <Alert
            variant="success"
            title="Wijziging opgeslagen"
            description={notice}
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
                  {numberText(supplierOptions.length)} leveranciers.
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
                <strong>{numberText(filteredGroups.length)}</strong>
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

            <FilterBar
              search={
                <SearchInput
                  aria-label="Zoek in dubbele EAN-waarschuwingen"
                  value={searchQuery}
                  placeholder="Zoek leverancier, EAN, product, artikelnummer of bestand"
                  onChange={setSearchQuery}
                />
              }
              filters={
            <>
              <Badge icon={<Filter size={14} aria-hidden="true" />}>Weergave</Badge>
              <div className="tabs issue-tabs">
                {statusFilters.map((item) => (
                  <button
                    className={statusFilter === item.value ? "tab active" : "tab"}
                    key={item.value}
                    type="button"
                    aria-pressed={statusFilter === item.value}
                    onClick={() => setStatusFilter(item.value)}
                  >
                    <span>{item.label}</span>
                    <span className="vat-tab-count">{numberText(statusCounts[item.value] ?? 0)}</span>
                  </button>
                ))}
              </div>
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
                      {formatRecommendation(recommendation)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
              }
              actions={<span className="muted">{numberText(filteredGroups.length)} zichtbare groepen</span>}
            />
          </>
        ) : null}
      </section>

      <section className="panel issue-table-panel">
        <div className="toolbar issue-table-heading">
          <div>
            <p className="eyebrow">EAN-groepen</p>
            <h2>Te beoordelen productgroepen</h2>
          </div>
          <Badge>{numberText(filteredGroups.length)} groepen</Badge>
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
                {!issue.issueId ? <Badge variant="neutral">Nog bijwerken</Badge> : null}
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
                  description="Alleen bedoeld voor interne productcontrole."
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
                  Beoordeling bewaren
                </Button>
              </div>
            </>
          );
          }}
          ariaLabel="Dubbele EAN-waarschuwingen"
        />
      </section>
    </div>
  );
}
