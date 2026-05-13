import { Ban, CheckCircle2, Pencil, Save, Send, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppSession } from "../../lib/auth/session";
import type { SubmitEventLike } from "../../lib/events";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  PortalQuoteLine,
  QuoteLineType,
  QuoteStatus,
  QuoteTemplate
} from "../../lib/portalTypes";
import { formatLineType, formatQuoteStatus, formatUnit } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { buildQuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import { polishQuoteTemplateLines, polishQuoteTemplateText } from "../../lib/quoteTemplateCopy";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";
import { SummaryList } from "../ui/SummaryList";
import { Textarea } from "../ui/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import MeasurementLinePicker from "./MeasurementLinePicker";
import QuoteDocumentPreview from "./QuoteDocumentPreview";
import QuoteLineEditor, { type QuoteLineFormValues } from "./QuoteLineEditor";
import QuoteTotals from "./QuoteTotals";

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
  mode?: "full" | "field";
};

type QuoteLineDraft = {
  projectRoomId: string;
  productId: string;
  lineType: QuoteLineType;
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unitPriceExVat: string;
  vatRate: string;
  discountExVat: string;
  sortOrder: string;
  metadata?: Record<string, unknown>;
};

const lineTypeOptions: QuoteLineType[] = [
  "product",
  "service",
  "labor",
  "material",
  "discount",
  "text",
  "manual"
];

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

function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function parseDecimal(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalDecimal(value: string): number | undefined {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = parseDecimal(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function draftFromLine(line: PortalQuoteLine): QuoteLineDraft {
  return {
    projectRoomId: line.projectRoomId ?? "",
    productId: line.productId ?? "",
    lineType: line.lineType,
    title: line.title,
    description: line.description ?? "",
    quantity: decimalText(line.quantity),
    unit: line.unit,
    unitPriceExVat: decimalText(line.unitPriceExVat),
    vatRate: decimalText(line.vatRate),
    discountExVat: decimalText(line.discountExVat),
    sortOrder: decimalText(line.sortOrder),
    metadata: line.metadata
  };
}

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
  const [lineDraft, setLineDraft] = useState<QuoteLineDraft | null>(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<PortalQuoteLine | null>(null);
  const [pendingStatus, setPendingStatus] = useState<QuoteStatus | null>(null);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const canEditDraftLines = canEdit && quote.status === "draft";
  const roomById = useMemo(
    () => new Map((project?.rooms ?? []).map((room) => [room.id, room.name])),
    [project?.rooms]
  );

  useEffect(() => {
    setTermsText(polishQuoteTemplateLines(quote.terms ?? []).join("\n"));
    setPaymentTermsText(polishQuoteTemplateLines(quote.paymentTerms ?? []).join("\n"));
  }, [quote.id, quote.paymentTerms, quote.terms]);

  useEffect(() => {
    setEditingLine(null);
    setLineDraft(null);
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

  function startEditLine(line: PortalQuoteLine) {
    setEditingLine(line);
    setLineDraft(draftFromLine(line));
  }

  async function saveLine(event: SubmitEventLike) {
    event.preventDefault();

    if (!editingLine || !lineDraft || !onUpdateLine) {
      return;
    }

    if (!lineDraft.title.trim()) {
      return;
    }

    const isTextLine = lineDraft.lineType === "text";
    setIsSavingLine(true);
    try {
      await onUpdateLine(editingLine.id, {
        projectRoomId: lineDraft.projectRoomId || undefined,
        productId: lineDraft.productId || undefined,
        lineType: lineDraft.lineType,
        title: lineDraft.title.trim(),
        description: lineDraft.description.trim() || undefined,
        quantity: isTextLine ? 0 : parseDecimal(lineDraft.quantity),
        unit: isTextLine ? "tekst" : lineDraft.unit.trim() || editingLine.unit,
        unitPriceExVat: isTextLine ? 0 : parseDecimal(lineDraft.unitPriceExVat),
        vatRate: isTextLine ? 0 : parseDecimal(lineDraft.vatRate),
        discountExVat: optionalDecimal(lineDraft.discountExVat),
        sortOrder: Math.max(1, Math.round(parseDecimal(lineDraft.sortOrder) || editingLine.sortOrder)),
        metadata: lineDraft.metadata
      });
      setEditingLine(null);
      setLineDraft(null);
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
        setLineDraft(null);
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
      render: (line) =>
        canEditDraftLines ? (
          <div className="toolbar">
            {onUpdateLine ? (
              <IconButton
                aria-label={`Offertepost ${line.title} bewerken`}
                onClick={() => startEditLine(line)}
                variant="secondary"
                size="sm"
              >
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
            ) : null}
            <IconButton
              aria-label={`Offertepost ${line.title} verwijderen`}
              onClick={() => setPendingDeleteLine(line)}
              variant="danger"
              size="sm"
            >
              <Trash2 size={16} aria-hidden="true" />
            </IconButton>
          </div>
        ) : null
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
      onAddLine={onAddLine}
      onImported={onMeasurementLinesImported}
    />
  );
  const lineEditPanel =
    editingLine && lineDraft && onUpdateLine && canEditDraftLines ? (
      <section className="panel">
        <SectionHeader
          compact
          title="Offertepost bewerken"
          description="Pas de conceptregel aan. Definitieve of verzonden offertes blijven beschermd tegen losse regelwijzigingen."
          actions={<LineTypeBadge lineType={lineDraft.lineType} />}
        />
        <form className="form-grid" onSubmit={saveLine}>
          <div className="grid two-column-even">
            <Field htmlFor="quote-line-edit-type" label="Soort post">
              <Select
                id="quote-line-edit-type"
                value={lineDraft.lineType}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current
                      ? { ...current, lineType: event.target.value as QuoteLineType }
                      : current
                  )
                }
              >
                {lineTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {formatLineType(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="quote-line-edit-title" label="Omschrijving" required>
              <Input
                id="quote-line-edit-title"
                required
                value={lineDraft.title}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, title: event.target.value } : current
                  )
                }
              />
            </Field>
          </div>
          {(project?.rooms ?? []).length > 0 ? (
            <Field htmlFor="quote-line-edit-room" label="Ruimte">
              <Select
                id="quote-line-edit-room"
                value={lineDraft.projectRoomId}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, projectRoomId: event.target.value } : current
                  )
                }
              >
                <option value="">Geen specifieke ruimte</option>
                {project?.rooms.map((room) => (
                  <option value={room.id} key={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field htmlFor="quote-line-edit-description" label="Beschrijving">
            <Textarea
              id="quote-line-edit-description"
              rows={3}
              value={lineDraft.description}
              onChange={(event) =>
                setLineDraft((current) =>
                  current ? { ...current, description: event.target.value } : current
                )
              }
            />
          </Field>
          <div className="grid three-column">
            <Field htmlFor="quote-line-edit-quantity" label="Aantal">
              <Input
                disabled={lineDraft.lineType === "text"}
                id="quote-line-edit-quantity"
                inputMode="decimal"
                value={lineDraft.quantity}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, quantity: event.target.value } : current
                  )
                }
              />
            </Field>
            <Field htmlFor="quote-line-edit-unit" label="Eenheid">
              <Input
                disabled={lineDraft.lineType === "text"}
                id="quote-line-edit-unit"
                value={lineDraft.unit}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, unit: event.target.value } : current
                  )
                }
              />
            </Field>
            <Field htmlFor="quote-line-edit-price" label="Prijs excl. btw">
              <Input
                disabled={lineDraft.lineType === "text"}
                id="quote-line-edit-price"
                inputMode="decimal"
                value={lineDraft.unitPriceExVat}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, unitPriceExVat: event.target.value } : current
                  )
                }
              />
            </Field>
          </div>
          <div className="grid three-column">
            <Field htmlFor="quote-line-edit-vat" label="Btw %">
              <Input
                disabled={lineDraft.lineType === "text"}
                id="quote-line-edit-vat"
                inputMode="decimal"
                value={lineDraft.vatRate}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, vatRate: event.target.value } : current
                  )
                }
              />
            </Field>
            <Field htmlFor="quote-line-edit-discount" label="Korting excl. btw">
              <Input
                disabled={lineDraft.lineType === "text"}
                id="quote-line-edit-discount"
                inputMode="decimal"
                value={lineDraft.discountExVat}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, discountExVat: event.target.value } : current
                  )
                }
              />
            </Field>
            <Field htmlFor="quote-line-edit-sort" label="Volgorde">
              <Input
                id="quote-line-edit-sort"
                inputMode="numeric"
                value={lineDraft.sortOrder}
                onChange={(event) =>
                  setLineDraft((current) =>
                    current ? { ...current, sortOrder: event.target.value } : current
                  )
                }
              />
            </Field>
          </div>
          <div className="toolbar">
            <Button
              isLoading={isSavingLine}
              leftIcon={<Save size={17} aria-hidden="true" />}
              type="submit"
              variant="primary"
            >
              Offertepost opslaan
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingLine(null);
                setLineDraft(null);
              }}
            >
              Annuleren
            </Button>
          </div>
        </form>
      </section>
    ) : null;
  const quoteLinesPanel = (
    <section className="panel">
      <SectionHeader
        compact
        title={isFieldMode ? "Conceptposten" : "Offerteposten"}
        description={
          isFieldMode
            ? "Controleer of de meetregels en extra posten kloppen voor de klantversie."
            : "Producten, werkzaamheden, materialen en tekst in verkoopvolgorde."
        }
      />
      <DataTable
        ariaLabel={isFieldMode ? "Conceptposten" : "Offerteposten"}
        columns={columns}
        density="compact"
        emptyTitle={isFieldMode ? "Nog geen conceptposten" : "Nog geen offerteposten"}
        emptyDescription={
          isFieldMode
            ? "Neem eerst meetregels over of voeg een extra post toe."
            : "Voeg een product, werkzaamheid, materiaal, korting of tekst toe."
        }
        getRowKey={(line) => line.id}
        rows={quote.lines}
      />
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
          <Button isLoading={isSavingTerms} onClick={() => void saveTerms()} variant="secondary">
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
  const customerVersionContent = documentModel ? (
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
      />
      {customerVersionContent}
    </section>
  );
  const pendingStatusAction = quoteStatusActions.find((action) => action.status === pendingStatus);
  const statusActions =
    !isFieldMode && canEdit && onUpdateStatus ? (
      <div className="toolbar">
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
    </>
  );

  if (isFieldMode) {
    return (
      <div className="grid field-quote-workbench">
        {dialogs}
        <section className="field-quote-compact-header">
          <div>
            <p className="eyebrow">Conceptofferte</p>
            <h2>{quote.title}</h2>
          </div>
          <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
          <SummaryList
            items={[
              { id: "number", label: "Offertenummer", value: quote.quoteNumber },
              { id: "lines", label: "Conceptposten", value: quote.lines.length },
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
          <div className="field-quote-disclosure-content">{customerVersionContent}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="grid quote-workbench">
      {dialogs}
      <div className="grid quote-main-column">
        <section className="panel">
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

        {canEditDraftLines ? (
          isFieldMode ? (
            <>
              {measurementPicker}
              {lineEditor}
            </>
          ) : (
            <>
              {lineEditor}
              {measurementPicker}
            </>
          )
        ) : null}

        {quoteLinesPanel}
        {lineEditPanel}

        {termsPanel}

        {customerVersionPanel}
      </div>
      <QuoteTotals lines={quote.lines} />
    </div>
  );
}
