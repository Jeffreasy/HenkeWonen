import { Ban, CheckCircle2, Eye, FileText, Pencil, Save, Send, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  PortalQuoteLine,
  QuoteStatus,
  QuoteTemplate
} from "../../lib/portalTypes";
import { formatQuoteStatus, formatUnit } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { buildQuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import { polishQuoteTemplateLines, polishQuoteTemplateText } from "../../lib/quotes/quoteTemplateCopy";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { FormModal } from "../ui/overlays/FormModal";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import MeasurementLinePicker from "./MeasurementLinePicker";
import QuoteDocumentPreview from "./QuoteDocumentPreview";
import QuoteLineEditor from "./QuoteLineEditor";
import { QuoteLineEditForm } from "./QuoteLineEditForm";
import QuoteTotals from "./QuoteTotals";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

type QuoteBuilderProps = {
  quote: PortalQuote;
  customer?: PortalCustomer;
  canEdit?: boolean;
  session: AppSession;
  project?: PortalProject;
  quoteTemplates?: QuoteTemplate[];
  onAddLine: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  onDeleteLine: (lineId: string) => Promise<void> | void;
  onUpdateLine?: (lineId: string, line: QuoteLineFormValues) => Promise<void> | void;
  onUpdateStatus?: (status: QuoteStatus) => Promise<void> | void;
  onUpdateTerms?: (terms: string[], paymentTerms: string[]) => Promise<void> | void;
  onMeasurementLinesImported?: () => Promise<void> | void;
  onCreateInvoice?: () => Promise<string | null>;
  mode?: "full" | "field";
};

const quoteStatusActions: Array<{
  status: QuoteStatus;
  label: string;
  description: string;
  variant: "primary" | "secondary" | "danger";
  icon: typeof Send;
}> = [
  {
    status: "draft",
    label: "Terug naar concept",
    description: "De offerte blijft bewerkbaar en wordt nog niet als verstuurd gezien.",
    variant: "secondary",
    icon: Pencil
  },
  {
    status: "sent",
    label: "Markeer verzonden",
    description: "De offerte en projectstatus worden bijgewerkt naar verzonden.",
    variant: "secondary",
    icon: Send
  },
  {
    status: "accepted",
    label: "Akkoord",
    description: "De offerte wordt akkoord gezet en het project gaat naar akkoord.",
    variant: "primary",
    icon: CheckCircle2
  },
  {
    status: "rejected",
    label: "Afwijzen",
    description: "De offerte wordt afgewezen en het project krijgt opvolgstatus afgewezen.",
    variant: "danger",
    icon: XCircle
  },
  {
    status: "cancelled",
    label: "Annuleren",
    description: "De offerte wordt geannuleerd. Dit is bedoeld voor vervallen concepten of ingetrokken offertes.",
    variant: "danger",
    icon: Ban
  }
];

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function QuoteBuilder({
  quote,
  customer,
  canEdit = true,
  session,
  project,
  quoteTemplates = [],
  onAddLine,
  onDeleteLine,
  onUpdateLine,
  onUpdateStatus,
  onUpdateTerms,
  onMeasurementLinesImported,
  onCreateInvoice,
  mode = "full"
}: QuoteBuilderProps) {
  const isFieldMode = mode === "field";
  const defaultTemplate = useMemo(
    () => quoteTemplates.find((template) => template.type === "default") ?? quoteTemplates[0],
    [quoteTemplates]
  );
  const documentModel = useMemo(
    () =>
      customer
        ? buildQuoteDocumentModel({
            quote,
            customer,
            project,
            template: defaultTemplate
          })
        : null,
    [customer, defaultTemplate, project, quote]
  );
  const [termsText, setTermsText] = useState(polishQuoteTemplateLines(quote.terms ?? []).join("\n"));
  const [paymentTermsText, setPaymentTermsText] = useState(
    polishQuoteTemplateLines(quote.paymentTerms ?? []).join("\n")
  );
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [editingLine, setEditingLine] = useState<PortalQuoteLine | null>(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<PortalQuoteLine | null>(null);
  const [pendingStatus, setPendingStatus] = useState<QuoteStatus | null>(null);
  const [pendingCreateInvoice, setPendingCreateInvoice] = useState(false);
  const [isCustomerVersionModalOpen, setIsCustomerVersionModalOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const canEditDraftLines = canEdit && quote.status === "draft";
  const fieldQuoteLabel = quote.status === "draft" ? "Conceptofferte" : "Klantversie";
  const fieldLineLabel = quote.status === "draft" ? "Conceptposten" : "Offerteposten";
  const roomById = useMemo(
    () => new Map((project?.rooms ?? []).map((room) => [room.id, room.name])),
    [project?.rooms]
  );
  const customerVersionReviewCount = useMemo(
    () =>
      documentModel?.sections.reduce(
        (count, section) => count + section.lines.filter((line) => line.requiresManualReview).length,
        0
      ) ?? 0,
    [documentModel]
  );

  useEffect(() => {
    setTermsText(polishQuoteTemplateLines(quote.terms ?? []).join("\n"));
    setPaymentTermsText(polishQuoteTemplateLines(quote.paymentTerms ?? []).join("\n"));
  }, [quote.id, quote.paymentTerms, quote.terms]);

  useEffect(() => {
    setEditingLine(null);
    setPendingDeleteLine(null);
    setPendingStatus(null);
  }, [quote.id]);

  async function saveTerms() {
    if (!onUpdateTerms || !canEditDraftLines) {
      return;
    }

    setIsSavingTerms(true);
    try {
      await onUpdateTerms(splitLines(termsText), splitLines(paymentTermsText));
    } finally {
      setIsSavingTerms(false);
    }
  }

  async function saveLine(values: QuoteLineFormValues) {
    if (!editingLine || !onUpdateLine) {
      return;
    }

    setIsSavingLine(true);
    try {
      await onUpdateLine(editingLine.id, values);
      setEditingLine(null);
    } finally {
      setIsSavingLine(false);
    }
  }

  async function confirmDeleteLine() {
    if (!pendingDeleteLine) {
      return;
    }

    const line = pendingDeleteLine;
    setIsSavingLine(true);
    try {
      await onDeleteLine(line.id);
      if (editingLine?.id === line.id) {
        setEditingLine(null);
      }
      setPendingDeleteLine(null);
    } finally {
      setIsSavingLine(false);
    }
  }

  async function confirmStatusUpdate() {
    if (!pendingStatus || !onUpdateStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(pendingStatus);
      setPendingStatus(null);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function confirmCreateInvoice() {
    if (!onCreateInvoice) return;
    setIsCreatingInvoice(true);
    try {
      const invoiceId = await onCreateInvoice();
      setPendingCreateInvoice(false);
      if (invoiceId) {
        window.location.href = `/portal/facturen/${invoiceId}`;
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  function renderLineActionButtons(line: PortalQuoteLine) {
    return canEditDraftLines ? (
      <div className="toolbar quote-line-actions">
        {onUpdateLine ? (
          <IconButton
            aria-label={`Offertepost ${line.title} bewerken`}
            onClick={() => setEditingLine(line)}
            title={`Offertepost ${line.title} bewerken`}
            variant="secondary"
            size="sm"
          >
            <Pencil size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={`Offertepost ${line.title} verwijderen`}
          onClick={() => setPendingDeleteLine(line)}
          title={`Offertepost ${line.title} verwijderen`}
          variant="danger"
          size="sm"
        >
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      </div>
    ) : null;
  }

  const columns: Array<DataTableColumn<PortalQuoteLine>> = [
    {
      key: "type",
      header: "Soort",
      width: "120px",
      render: (line) => <LineTypeBadge lineType={line.lineType} />
    },
    {
      key: "title",
      header: "Omschrijving",
      priority: "primary",
      render: (line) => (
        <div className="stack-sm">
          <strong>{line.title}</strong>
          {line.description ? <small className="muted">{line.description}</small> : null}
        </div>
      )
    },
    {
      key: "room",
      header: "Ruimte",
      width: "130px",
      hideOnMobile: true,
      render: (line) => (line.projectRoomId ? roomById.get(line.projectRoomId) ?? "-" : "-")
    },
    {
      key: "quantity",
      header: "Aantal",
      align: "right",
      width: "90px",
      render: (line) => line.quantity
    },
    {
      key: "unit",
      header: "Eenheid",
      width: "90px",
      hideOnMobile: true,
      render: (line) => formatUnit(line.unit)
    },
    {
      key: "price",
      header: "Prijs excl. btw",
      align: "right",
      width: "120px",
      hideOnMobile: true,
      render: (line) => formatEuro(line.unitPriceExVat)
    },
    {
      key: "vat",
      header: "Btw",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (line) => `${line.vatRate}%`
    },
    {
      key: "total",
      header: "Totaal incl. btw",
      align: "right",
      width: "130px",
      render: (line) => formatEuro(line.lineTotalIncVat)
    },
    {
      key: "actions",
      header: "Acties",
      align: "right",
      width: "96px",
      render: renderLineActionButtons
    }
  ];
  
  const quoteTotals = quote.lines.reduce(
    (current, line) => ({
      subtotalExVat: current.subtotalExVat + line.lineTotalExVat,
      vatTotal: current.vatTotal + line.lineVatTotal,
      totalIncVat: current.totalIncVat + line.lineTotalIncVat
    }),
    {
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0
    }
  );

  const lineEditor = (
    <QuoteLineEditor
      mode={mode}
      surface={isFieldMode ? "plain" : "panel"}
      sortOrder={quote.lines.length + 1}
      templateLines={defaultTemplate?.defaultLines ?? []}
      session={session}
      projectRooms={project?.rooms ?? []}
      onAdd={onAddLine}
    />
  );

  const measurementPicker = (
    <MeasurementLinePicker
      mode={mode}
      tenantSlug={quote.tenantId}
      quoteId={quote.id}
      projectId={quote.projectId}
      session={session}
      startSortOrder={quote.lines.length + 1}
      onImported={onMeasurementLinesImported}
    />
  );

  const lineEditPanel =
    editingLine && onUpdateLine && canEditDraftLines ? (
      <QuoteLineEditForm
        line={editingLine}
        projectRooms={project?.rooms ?? []}
        isSaving={isSavingLine}
        onSave={saveLine}
        onCancel={() => setEditingLine(null)}
      />
    ) : null;

  const quoteLineCards =
    quote.lines.length > 0 ? (
      <div className="quote-line-list" role="list" aria-label={isFieldMode ? fieldLineLabel : "Offerteposten"}>
        {quote.lines.map((line) => (
          <article className="quote-line-card" key={line.id} role="listitem">
            <div className="quote-line-card-copy">
              <div className="quote-line-card-heading">
                <LineTypeBadge lineType={line.lineType} />
                <strong>{line.title}</strong>
              </div>
              {line.description ? <p>{line.description}</p> : null}
            </div>
            <div className="quote-line-card-values" aria-label={`Bedragen voor ${line.title}`}>
              <div>
                <span>Ruimte</span>
                <strong>{line.projectRoomId ? roomById.get(line.projectRoomId) ?? "-" : "-"}</strong>
              </div>
              <div>
                <span>Aantal</span>
                <strong>
                  {line.quantity} {formatUnit(line.unit)}
                </strong>
              </div>
              <div>
                <span>Prijs excl.</span>
                <strong>{formatEuro(line.unitPriceExVat)}</strong>
              </div>
              <div>
                <span>Btw</span>
                <strong>{line.vatRate}%</strong>
              </div>
              <div className="quote-line-total">
                <span>Totaal incl.</span>
                <strong>{formatEuro(line.lineTotalIncVat)}</strong>
              </div>
            </div>
            {renderLineActionButtons(line)}
          </article>
        ))}
      </div>
    ) : (
      <EmptyState
        title={isFieldMode ? `Nog geen ${fieldLineLabel.toLowerCase()}` : "Nog geen offerteposten"}
        description={
          isFieldMode
            ? "Neem eerst meetregels over of voeg een extra post toe."
            : "Voeg een product, werkzaamheid, materiaal, korting of tekst toe."
        }
      />
    );

  const quoteLinesPanel = (
    <section className="panel">
      <SectionHeader
        compact
        title={isFieldMode ? fieldLineLabel : "Offerteposten"}
        description={
          isFieldMode
            ? "Controleer of de meetregels en extra posten kloppen voor de klantversie."
          : "Producten, werkzaamheden, materialen en tekst in verkoopvolgorde."
        }
      />
      {isFieldMode ? (
        <DataTable
          ariaLabel={fieldLineLabel}
          columns={columns}
          density="compact"
          emptyTitle={`Nog geen ${fieldLineLabel.toLowerCase()}`}
          emptyDescription="Neem eerst meetregels over of voeg een extra post toe."
          getRowKey={(line) => line.id}
          mobileMode="cards"
          renderMobileCard={(line) => (
            <div className="mobile-card-section">
              <div className="mobile-card-header">
                <div className="mobile-card-title">
                  <strong>{line.title}</strong>
                  {line.description ? <small className="muted">{line.description}</small> : null}
                </div>
                <LineTypeBadge lineType={line.lineType} />
              </div>
              <div className="mobile-card-meta">
                <span>
                  {line.projectRoomId ? roomById.get(line.projectRoomId) ?? "Geen ruimte" : "Geen ruimte"}
                </span>
                <span>
                  {line.quantity} {formatUnit(line.unit)}
                </span>
                <strong>{formatEuro(line.lineTotalIncVat)}</strong>
              </div>
              {canEditDraftLines ? (
                <div className="mobile-card-actions">
                  {onUpdateLine ? (
                    <Button
                      leftIcon={<Pencil size={16} aria-hidden="true" />}
                      onClick={() => setEditingLine(line)}
                      size="sm"
                      variant="secondary"
                    >
                      Bewerken
                    </Button>
                  ) : null}
                  <Button
                    leftIcon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() => setPendingDeleteLine(line)}
                    size="sm"
                    variant="danger"
                  >
                    Verwijderen
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          rows={quote.lines}
        />
      ) : (
        quoteLineCards
      )}
      {canEdit && quote.status !== "draft" ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Regels kunnen alleen worden aangepast zolang de offerte nog concept is.
        </p>
      ) : null}
    </section>
  );

  const termsContent =
    onUpdateTerms && canEditDraftLines ? (
      <div className="grid two-column-even">
        <Field
          htmlFor="quote-terms"
          label="Uitvoeringsvoorwaarden"
          description="Een voorwaarde per regel. Nieuwe offertes nemen dit over vanuit het offertesjabloon."
        >
          <Textarea
            id="quote-terms"
            rows={isFieldMode ? 5 : 9}
            value={termsText}
            onChange={(event) => setTermsText(event.target.value)}
          />
        </Field>
        <Field
          htmlFor="quote-payment-terms"
          label="Facturering en betaling"
          description="Aanbetaling, betaaltermijn en betaalwijze per regel."
        >
          <Textarea
            id="quote-payment-terms"
            rows={isFieldMode ? 5 : 9}
            value={paymentTermsText}
            onChange={(event) => setPaymentTermsText(event.target.value)}
          />
        </Field>
        <div className="quote-terms-action">
          <Button isLoading={isSavingTerms} onClick={() => void saveTerms()} variant="primary" leftIcon={<Save size={16} aria-hidden="true" />}>
            Voorwaarden opslaan
          </Button>
        </div>
      </div>
    ) : (
      <div className="grid">
        {[...(quote.terms ?? []), ...(quote.paymentTerms ?? [])].map((term) => (
          <div className="quote-term" key={term}>
            {polishQuoteTemplateText(term)}
          </div>
        ))}
        {(quote.terms ?? []).length === 0 && (quote.paymentTerms ?? []).length === 0 ? (
          <EmptyState
            title="Geen voorwaarden gekoppeld"
            description="Voorwaarden verschijnen hier zodra ze aan de offerte zijn gekoppeld."
          />
        ) : null}
      </div>
    );

  const termsPanel = (
    <section className="panel">
      <SectionHeader
        compact
        title="Voorwaarden"
        description="Voorwaarden en factureringsregels die bij deze offerte horen en per offerte overschrijfbaar zijn."
      />
      {termsContent}
    </section>
  );

  const customerVersionPreview = documentModel ? (
    <QuoteDocumentPreview model={documentModel} />
  ) : (
    <EmptyState
      title="Klantversie niet beschikbaar"
      description="Klantgegevens zijn nodig om de klantversie te tonen."
    />
  );

  const customerVersionPanel = (
    <section className="panel">
      <SectionHeader
        compact
        title="Klantversie"
        description="Controleer hoe de offerte eruitziet voordat je deze deelt of print."
        actions={
          documentModel ? (
            <Button
              leftIcon={<Eye size={16} aria-hidden="true" />}
              onClick={() => setIsCustomerVersionModalOpen(true)}
              size="sm"
              variant="primary"
            >
              Klantversie openen
            </Button>
          ) : null
        }
      />
      {documentModel ? (
        <SummaryList
          items={[
            { id: "quote-number", label: "Offertenummer", value: documentModel.quote.quoteNumber },
            { id: "quote-status", label: "Status", value: formatQuoteStatus(quote.status) },
            {
              id: "review",
              label: "Controle",
              value:
                customerVersionReviewCount > 0
                  ? `${customerVersionReviewCount} aandachtspunt${customerVersionReviewCount === 1 ? "" : "en"}`
                  : "Geen aandachtspunten"
            }
          ]}
        />
      ) : (
        customerVersionPreview
      )}
    </section>
  );

  const pendingStatusAction = quoteStatusActions.find((action) => action.status === pendingStatus);
  
  const statusActions =
    !isFieldMode && canEdit && onUpdateStatus ? (
      <div className="toolbar quote-status-actions">
        <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
        {quoteStatusActions.map((action) => {
          const Icon = action.icon;
          const isCurrent = quote.status === action.status;

          return (
            <Button
              disabled={isCurrent || isUpdatingStatus}
              key={action.status}
              leftIcon={<Icon size={16} aria-hidden="true" />}
              onClick={() => setPendingStatus(action.status)}
              size="sm"
              variant={action.variant}
            >
              {action.label}
            </Button>
          );
        })}
        {!isFieldMode && quote.status === "accepted" && onCreateInvoice ? (
          <Button
            leftIcon={<FileText size={16} aria-hidden="true" />}
            onClick={() => setPendingCreateInvoice(true)}
            size="sm"
            variant="primary"
          >
            Factuur aanmaken
          </Button>
        ) : null}
      </div>
    ) : (
      <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
    );

  const dialogs = (
    <>
      <ConfirmDialog
        open={Boolean(pendingDeleteLine)}
        title="Offertepost verwijderen?"
        description={
          pendingDeleteLine
            ? `Je verwijdert "${pendingDeleteLine.title}" uit deze conceptofferte. Dit kan alleen zolang de post nog nergens definitief aan gekoppeld is.`
            : ""
        }
        confirmLabel="Offertepost verwijderen"
        tone="danger"
        isBusy={isSavingLine}
        onCancel={() => setPendingDeleteLine(null)}
        onConfirm={() => void confirmDeleteLine()}
      />
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title="Offertestatus aanpassen?"
        description={
          pendingStatusAction
            ? `${pendingStatusAction.description} Dit wordt ook vastgelegd op het bijbehorende project.`
            : ""
        }
        confirmLabel={pendingStatusAction?.label ?? "Status aanpassen"}
        tone={pendingStatus === "cancelled" || pendingStatus === "rejected" ? "danger" : "warning"}
        isBusy={isUpdatingStatus}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void confirmStatusUpdate()}
      />
      <ConfirmDialog
        open={pendingCreateInvoice}
        title="Factuur aanmaken?"
        description={`Er wordt een factuur aangemaakt op basis van offerte ${quote.quoteNumber}. Het totaal bedraagt ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(quote.totalIncVat)} incl. btw. De vervaldatum volgt de betaaltermijn van deze klant.`}
        confirmLabel="Factuur aanmaken"
        tone="warning"
        isBusy={isCreatingInvoice}
        onCancel={() => setPendingCreateInvoice(false)}
        onConfirm={() => void confirmCreateInvoice()}
      />
      <FormModal
        open={isCustomerVersionModalOpen}
        title="Klantversie"
        description="Bekijk de offerte zoals de klant hem ontvangt. Printen gebeurt vanuit deze preview."
        size="xl"
        onClose={() => setIsCustomerVersionModalOpen(false)}
      >
        {customerVersionPreview}
      </FormModal>
    </>
  );

  if (isFieldMode) {
    return (
      <div className="grid field-quote-workbench">
        {dialogs}
        <section className="field-quote-compact-header">
          <div>
            <p className="eyebrow">{fieldQuoteLabel}</p>
            <h2>{quote.title}</h2>
          </div>
          <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
          <SummaryList
            items={[
              { id: "number", label: "Offertenummer", value: quote.quoteNumber },
              { id: "lines", label: fieldLineLabel, value: quote.lines.length },
              { id: "total", label: "Totaal incl. btw", value: formatEuro(quoteTotals.totalIncVat) }
            ]}
          />
        </section>

        {canEditDraftLines ? measurementPicker : null}

        {quoteLinesPanel}
        {lineEditPanel}

        {canEditDraftLines ? (
          <details className="field-quote-disclosure">
            <summary>Extra post toevoegen</summary>
            <div className="field-quote-disclosure-content">{lineEditor}</div>
          </details>
        ) : null}

        <details className="field-quote-disclosure">
          <summary>Voorwaarden bekijken of aanpassen</summary>
          <div className="field-quote-disclosure-content">{termsContent}</div>
        </details>

        <details className="field-quote-disclosure">
          <summary>Klantversie bekijken en printen</summary>
          <div className="field-quote-disclosure-content">{customerVersionPreview}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="grid quote-workbench">
      {dialogs}
      <section className="panel quote-summary-panel">
        <SectionHeader
          compact
          title={quote.title}
          description="Controleer gegevens, voorwaarden en offerteposten."
          actions={statusActions}
        />
        <SummaryList
          items={[
            { id: "number", label: "Offertenummer", value: quote.quoteNumber },
            { id: "lines", label: "Offerteposten", value: quote.lines.length },
            { id: "updated", label: "Bijgewerkt", value: new Intl.DateTimeFormat("nl-NL").format(new Date(quote.updatedAt)) }
          ]}
        />
      </section>
      <QuoteTotals lines={quote.lines} />

      {canEditDraftLines ? (
        <div className="grid quote-composer-panel">
          {isFieldMode ? (
            <>
              {measurementPicker}
              {lineEditor}
            </>
          ) : (
            <>
              {lineEditor}
              {measurementPicker}
            </>
          )}
        </div>
      ) : null}

      <div className="quote-full-width-panel">{quoteLinesPanel}</div>
      {lineEditPanel ? <div className="quote-full-width-panel">{lineEditPanel}</div> : null}
      <div className="quote-full-width-panel">{termsPanel}</div>
      <div className="quote-customer-version-panel">{customerVersionPanel}</div>
    </div>
  );
}
