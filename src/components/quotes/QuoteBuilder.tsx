import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  Presentation,
  Printer,
  Save,
  Send,
  Trash2,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { navigate } from "astro:transitions/client";
import type { AppSession } from "../../lib/auth/session";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  PortalQuoteLine,
  QuoteStatus,
  QuoteTemplate
} from "../../lib/portalTypes";
import { formatDate } from "../../lib/dates";
import {
  formatMeasurementProductGroup,
  formatQuoteStatus,
  formatUnit
} from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { MeasurementProductGroup } from "../../lib/portalTypes";
import { buildQuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import { PRODUCT_GROUP_OPTIONS } from "../projects/measurement/measurementTypes";
import {
  polishQuoteTemplateLines,
  polishQuoteTemplateText
} from "../../lib/quotes/quoteTemplateCopy";
import { Button } from "../ui/forms/Button";
import { ConfirmDialog } from "../ui/overlays/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { EmptyState } from "../ui/feedback/EmptyState";
import { Field } from "../ui/forms/Field";
import { IconButton } from "../ui/forms/IconButton";
import { FormModal } from "../ui/overlays/FormModal";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { CollapsiblePanel } from "../ui/layout/CollapsiblePanel";
import { StatusBadge } from "../ui/data-display/StatusBadge";
import { SummaryList } from "../ui/data-display/SummaryList";
import { Textarea } from "../ui/forms/Textarea";
import LineTypeBadge from "./LineTypeBadge";
import MeasurementLinePicker from "./MeasurementLinePicker";
import QuoteDocumentPreview from "./QuoteDocumentPreview";
import QuoteComposer from "./QuoteComposer";
import { QuoteLineEditForm } from "./QuoteLineEditForm";
import QuoteTotals from "./QuoteTotals";
import type { QuoteLineFormValues } from "./quote/quoteTypes";

type QuoteBuilderProps = {
  quote: PortalQuote;
  customer?: PortalCustomer;
  canEdit?: boolean;
  session: AppSession;
  project?: PortalProject;
  /** Klant-zichtbare afspraken uit het klantdossier voor de klantversie. */
  klantAfspraken?: Array<{ titel: string; omschrijving?: string }>;
  quoteTemplates?: QuoteTemplate[];
  onAddLine: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  onDeleteLine: (lineId: string) => Promise<void> | void;
  onUpdateLine?: (lineId: string, line: QuoteLineFormValues) => Promise<void> | void;
  onUpdateStatus?: (status: QuoteStatus) => Promise<void> | void;
  onUpdateTerms?: (terms: string[], paymentTerms: string[]) => Promise<void> | void;
  onUpdateTexts?: (introText: string, closingText: string) => Promise<void> | void;
  onMeasurementLinesImported?: () => Promise<void> | void;
  onCreateInvoice?: () => Promise<string | null>;
  mode?: "full" | "field";
};

const quoteStatusActions: Array<{
  status: QuoteStatus;
  label: string;
  /** Afwijkend label voor de bevestigingsknop in de dialoog (default: label). */
  confirmLabel?: string;
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
    description:
      "De offerte wordt afgewezen en het project krijgt opvolgstatus afgewezen. Nog niet ontvangen leveranciersbestellingen van deze offerte worden mee-geannuleerd.",
    variant: "danger",
    icon: XCircle
  },
  {
    status: "cancelled",
    label: "Annuleren",
    // Onderscheid met de dialoog-sluitknop, die óók "Annuleren" heet.
    confirmLabel: "Offerte annuleren",
    description:
      "De offerte wordt geannuleerd. Dit is bedoeld voor vervallen concepten of ingetrokken offertes. Nog niet ontvangen leveranciersbestellingen van deze offerte worden mee-geannuleerd.",
    variant: "secondary",
    icon: Ban
  }
];

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Meerregelige omschrijvingen (bv. de werkinstructies van geïmporteerde
 * inmeetregels) als losse korte regels i.p.v. één doorlopende lap tekst.
 */
function OmschrijvingRegels({ tekst }: { tekst: string }) {
  return (
    <>
      {splitLines(tekst).map((regel, index) => (
        <span className="quote-line-omschrijving-regel" key={`${regel}-${index}`}>
          {regel}
        </span>
      ))}
    </>
  );
}

export default function QuoteBuilder({
  quote,
  customer,
  canEdit = true,
  session,
  project,
  klantAfspraken = [],
  quoteTemplates = [],
  onAddLine,
  onDeleteLine,
  onUpdateLine,
  onUpdateStatus,
  onUpdateTerms,
  onUpdateTexts,
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
            template: defaultTemplate,
            customerAgreements: klantAfspraken
          })
        : null,
    [customer, defaultTemplate, klantAfspraken, project, quote]
  );
  const [termsText, setTermsText] = useState(
    polishQuoteTemplateLines(quote.voorwaarden ?? []).join("\n")
  );
  const [paymentTermsText, setPaymentTermsText] = useState(
    polishQuoteTemplateLines(quote.betalingsvoorwaarden ?? []).join("\n")
  );
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [introText, setIntroText] = useState(quote.inleidingTekst ?? "");
  const [closingText, setClosingText] = useState(quote.afsluitTekst ?? "");
  const [isSavingTexts, setIsSavingTexts] = useState(false);
  const [editingLine, setEditingLine] = useState<PortalQuoteLine | null>(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<PortalQuoteLine | null>(null);
  const [pendingStatus, setPendingStatus] = useState<QuoteStatus | null>(null);
  const [pendingCreateInvoice, setPendingCreateInvoice] = useState(false);
  const [isCustomerVersionModalOpen, setIsCustomerVersionModalOpen] = useState(false);
  // Presentatiemodus: fullscreen klantwaardige weergave voor het winkelgesprek
  // (scherm omdraaien naar de klant). Toont uitsluitend het offertevel — alles
  // met de interne no-print-markering blijft verborgen, net als op papier.
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  useEffect(() => {
    if (!isPresentationOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPresentationOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPresentationOpen]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const canEditDraftLines = canEdit && quote.status === "draft";
  const fieldQuoteLabel = quote.status === "draft" ? "Conceptofferte" : "Klantversie";
  const fieldLineLabel = quote.status === "draft" ? "Conceptposten" : "Offerteposten";
  const customerName = customer?.weergaveNaam ?? "Onbekende klant";
  const customerAddress = customer
    ? [
        [customer.straat, customer.huisnummer].filter(Boolean).join(" "),
        [customer.postcode, customer.plaats].filter(Boolean).join(" ")
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const validUntilLabel = quote.geldigTot ? formatDate(quote.geldigTot) : "Niet ingevuld";

  // ── Catalogusfilter inferentie (field-mode) ──────────────────────────────────
  const inferredProductGroup = useMemo((): MeasurementProductGroup | null => {
    if (!isFieldMode) return null;
    const measurementLines = quote.lines.filter(
      (line) => (line.metadata as Record<string, unknown> | undefined)?.source === "measurement"
    );
    if (measurementLines.length === 0) return null;
    const counts = new Map<string, number>();
    for (const line of measurementLines) {
      const group = (line.metadata as Record<string, unknown>)?.productGroup as string | undefined;
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    let dominant: string | null = null;
    let highest = 0;
    for (const [group, count] of counts) {
      if (count > highest) {
        highest = count;
        dominant = group;
      }
    }
    return dominant as MeasurementProductGroup | null;
  }, [isFieldMode, quote.lines]);

  const [productGroupOverride, setProductGroupOverride] = useState<
    MeasurementProductGroup | "all" | null
  >(null);
  const activeProductGroup: MeasurementProductGroup | null =
    productGroupOverride === "all" ? null : (productGroupOverride ?? inferredProductGroup);
  const roomById = useMemo(
    () => new Map((project?.rooms ?? []).map((room) => [room.id, room.naam])),
    [project?.rooms]
  );
  const customerVersionReviewCount = useMemo(
    () =>
      documentModel?.sections.reduce(
        (count, section) =>
          count + section.lines.filter((line) => line.requiresManualReview).length,
        0
      ) ?? 0,
    [documentModel]
  );

  useEffect(() => {
    setTermsText(polishQuoteTemplateLines(quote.voorwaarden ?? []).join("\n"));
    setPaymentTermsText(polishQuoteTemplateLines(quote.betalingsvoorwaarden ?? []).join("\n"));
  }, [quote.id, quote.betalingsvoorwaarden, quote.voorwaarden]);

  useEffect(() => {
    setIntroText(quote.inleidingTekst ?? "");
    setClosingText(quote.afsluitTekst ?? "");
  }, [quote.id, quote.inleidingTekst, quote.afsluitTekst]);

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
    } catch {
      // Fout is al gemeld via toast in de workspace.
    } finally {
      setIsSavingTerms(false);
    }
  }

  async function saveTexts() {
    if (!onUpdateTexts || !canEditDraftLines) {
      return;
    }

    setIsSavingTexts(true);
    try {
      await onUpdateTexts(introText.trim(), closingText.trim());
    } catch {
      // Fout is al gemeld via toast in de workspace.
    } finally {
      setIsSavingTexts(false);
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
    } catch {
      // Fout is al gemeld via toast; laat het bewerkformulier open staan.
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
    } catch {
      // Fout is al gemeld via toast; laat de bevestiging open staan.
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
    } catch {
      // Fout is al gemeld via toast; laat de bevestiging open staan.
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
        void navigate(`/portal/facturen/${invoiceId}`);
      }
    } catch {
      // Fout is al gemeld via toast; laat de bevestiging open staan.
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  function renderLineActionButtons(line: PortalQuoteLine) {
    return canEditDraftLines ? (
      <div className="toolbar quote-line-actions">
        {onUpdateLine ? (
          <IconButton
            aria-label={`Offertepost ${line.titel} bewerken`}
            onClick={() => setEditingLine(line)}
            title={`Offertepost ${line.titel} bewerken`}
            variant="secondary"
            size="sm"
          >
            <Pencil size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={`Offertepost ${line.titel} verwijderen`}
          onClick={() => setPendingDeleteLine(line)}
          title={`Offertepost ${line.titel} verwijderen`}
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
      render: (line) => <LineTypeBadge lineType={line.regelType} />
    },
    {
      key: "title",
      header: "Omschrijving",
      priority: "primary",
      render: (line) => (
        <div className="stack-sm">
          <strong>{line.titel}</strong>
          {line.omschrijving ? (
            <small className="muted">
              <OmschrijvingRegels tekst={line.omschrijving} />
            </small>
          ) : null}
        </div>
      )
    },
    {
      key: "room",
      header: "Ruimte",
      width: "130px",
      hideOnMobile: true,
      render: (line) => (line.projectRuimteId ? (roomById.get(line.projectRuimteId) ?? "-") : "-")
    },
    {
      key: "quantity",
      header: "Aantal",
      align: "right",
      width: "90px",
      render: (line) => line.aantal
    },
    {
      key: "unit",
      header: "Eenheid",
      width: "90px",
      hideOnMobile: true,
      render: (line) => formatUnit(line.eenheid)
    },
    {
      key: "price",
      header: "Prijs excl. btw",
      align: "right",
      width: "120px",
      hideOnMobile: true,
      render: (line) => formatEuro(line.eenheidsprijsExBtw)
    },
    {
      key: "vat",
      header: "Btw",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (line) => `${line.btwTarief}%`
    },
    {
      key: "total",
      header: "Totaal incl. btw",
      align: "right",
      width: "130px",
      render: (line) => formatEuro(line.regelTotaalInclBtw)
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
      subtotalExVat: current.subtotalExVat + line.regelTotaalExBtw,
      vatTotal: current.vatTotal + line.regelBtwTotaal,
      totalIncVat: current.totalIncVat + line.regelTotaalInclBtw
    }),
    {
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0
    }
  );

  const composer = (
    // key={quote.id}: remount bij een offertewissel, zodat useFormDraft (dat maar één keer per
    // instance herstelt) het concept van de nieuwe offerte inlaadt en niet weglekt.
    <QuoteComposer
      key={quote.id}
      mode={mode}
      session={session}
      sortOrder={quote.lines.length + 1}
      templateLines={defaultTemplate?.standaardRegels ?? []}
      projectRooms={project?.rooms ?? []}
      productGroupHint={activeProductGroup}
      quoteId={quote.id}
      projectId={quote.projectId}
      tenantSlug={quote.tenantId}
      onAddLine={onAddLine}
      onMeasurementLinesImported={onMeasurementLinesImported}
      showMeasurement={!isFieldMode}
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
        session={session}
        onSave={saveLine}
        onCancel={() => setEditingLine(null)}
      />
    ) : null;

  const quoteLineCards =
    quote.lines.length > 0 ? (
      <div
        className="quote-line-list"
        role="list"
        aria-label={isFieldMode ? fieldLineLabel : "Offerteposten"}
      >
        {quote.lines.map((line) => (
          <article className="quote-line-card" key={line.id} role="listitem">
            <div className="quote-line-card-copy">
              <div className="quote-line-card-heading">
                <LineTypeBadge lineType={line.regelType} />
                <strong>{line.titel}</strong>
              </div>
              {line.omschrijving ? (
                <p>
                  <OmschrijvingRegels tekst={line.omschrijving} />
                </p>
              ) : null}
            </div>
            <div className="quote-line-card-values" aria-label={`Bedragen voor ${line.titel}`}>
              <div>
                <span>Ruimte</span>
                <strong>
                  {line.projectRuimteId ? (roomById.get(line.projectRuimteId) ?? "-") : "-"}
                </strong>
              </div>
              <div>
                <span>Aantal</span>
                <strong>
                  {line.aantal} {formatUnit(line.eenheid)}
                </strong>
              </div>
              <div>
                <span>Prijs excl.</span>
                <strong>{formatEuro(line.eenheidsprijsExBtw)}</strong>
              </div>
              <div>
                <span>Btw</span>
                <strong>{line.btwTarief}%</strong>
              </div>
              <div className="quote-line-total">
                <span>Totaal incl.</span>
                <strong>{formatEuro(line.regelTotaalInclBtw)}</strong>
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
                  <strong>{line.titel}</strong>
                  {line.omschrijving ? (
            <small className="muted">
              <OmschrijvingRegels tekst={line.omschrijving} />
            </small>
          ) : null}
                </div>
                <LineTypeBadge lineType={line.regelType} />
              </div>
              <div className="mobile-card-meta">
                <span>
                  {line.projectRuimteId
                    ? (roomById.get(line.projectRuimteId) ?? "Geen ruimte")
                    : "Geen ruimte"}
                </span>
                <span>
                  {line.aantal} {formatUnit(line.eenheid)}
                </span>
                <strong>{formatEuro(line.regelTotaalInclBtw)}</strong>
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
          <Button
            isLoading={isSavingTerms}
            onClick={() => void saveTerms()}
            variant="primary"
            leftIcon={<Save size={16} aria-hidden="true" />}
          >
            Voorwaarden opslaan
          </Button>
        </div>
      </div>
    ) : (
      <div className="grid">
        {[
          ...(quote.voorwaarden ?? []).map((term, index) => ({ term, key: `vw-${index}` })),
          ...(quote.betalingsvoorwaarden ?? []).map((term, index) => ({ term, key: `bv-${index}` }))
        ].map(({ term, key }) => (
          // Bron-prefix + index als key: dezelfde tekst kan in voorwaarden én
          // betalingsvoorwaarden voorkomen, dus de term zelf is niet uniek.
          <div className="quote-term" key={key}>
            {polishQuoteTemplateText(term)}
          </div>
        ))}
        {(quote.voorwaarden ?? []).length === 0 &&
        (quote.betalingsvoorwaarden ?? []).length === 0 ? (
          <EmptyState
            title="Geen voorwaarden gekoppeld"
            description="Voorwaarden verschijnen hier zodra ze aan de offerte zijn gekoppeld."
          />
        ) : null}
      </div>
    );

  const termsPanel = (
    <CollapsiblePanel
      title="Voorwaarden"
      description="Voorwaarden en factureringsregels, per offerte overschrijfbaar."
    >
      {termsContent}
    </CollapsiblePanel>
  );

  const textsContent =
    onUpdateTexts && canEditDraftLines ? (
      <div className="grid two-column-even">
        <Field
          htmlFor="quote-intro-text"
          label="Inleidingstekst"
          description="Korte introductie bovenaan de klantversie. Nieuwe offertes nemen dit over uit het sjabloon."
        >
          <Textarea
            id="quote-intro-text"
            rows={isFieldMode ? 4 : 6}
            value={introText}
            onChange={(event) => setIntroText(event.target.value)}
          />
        </Field>
        <Field
          htmlFor="quote-closing-text"
          label="Afsluitende tekst"
          description="Afsluiting onderaan de klantversie, bijvoorbeeld een bedankje of vervolgstap."
        >
          <Textarea
            id="quote-closing-text"
            rows={isFieldMode ? 4 : 6}
            value={closingText}
            onChange={(event) => setClosingText(event.target.value)}
          />
        </Field>
        <div className="quote-terms-action">
          <Button
            isLoading={isSavingTexts}
            onClick={() => void saveTexts()}
            variant="primary"
            leftIcon={<Save size={16} aria-hidden="true" />}
          >
            Teksten opslaan
          </Button>
        </div>
      </div>
    ) : quote.inleidingTekst || quote.afsluitTekst ? (
      <div className="grid">
        {quote.inleidingTekst ? <div className="quote-term">{quote.inleidingTekst}</div> : null}
        {quote.afsluitTekst ? <div className="quote-term">{quote.afsluitTekst}</div> : null}
      </div>
    ) : (
      <EmptyState
        title="Geen offerteteksten"
        description="Inleiding en afsluiting verschijnen hier zodra ze zijn ingevuld."
      />
    );

  const textsPanel = (
    <CollapsiblePanel
      title="Offerteteksten"
      description="Inleiding en afsluiting voor de klantversie."
    >
      {textsContent}
    </CollapsiblePanel>
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
    <CollapsiblePanel
      title="Klantversie"
      description="Controleer hoe de offerte eruitziet voordat je deze deelt of print."
      action={
        documentModel ? (
          <div className="toolbar">
            <Button
              leftIcon={<Presentation size={16} aria-hidden="true" />}
              onClick={() => setIsPresentationOpen(true)}
              size="sm"
              variant="primary"
            >
              Presenteren aan klant
            </Button>
            <Button
              leftIcon={<Eye size={16} aria-hidden="true" />}
              onClick={() => setIsCustomerVersionModalOpen(true)}
              size="sm"
              variant="secondary"
            >
              Klantversie openen
            </Button>
          </div>
        ) : null
      }
    >
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
    </CollapsiblePanel>
  );

  const pendingStatusAction = quoteStatusActions.find((action) => action.status === pendingStatus);

  // Buitendienst: alleen de 3 relevante statusacties
  const fieldAllowedStatuses = new Set(["sent", "accepted", "rejected"] as const);

  // Een terminale offerte (afgewezen/geannuleerd/verlopen) mag niet herleven naar
  // verstuurd/akkoord — spiegelt de backend-guard zodat die knoppen niet verschijnen.
  const terminalQuoteStatuses = new Set(["rejected", "cancelled", "expired"]);
  const isTerminalQuote = terminalQuoteStatuses.has(quote.status);
  const revivingStatuses = new Set(["sent", "accepted"]);

  const statusActions =
    canEdit && onUpdateStatus ? (
      <div className="toolbar quote-status-actions">
        <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
        {quoteStatusActions
          .filter(
            (action) =>
              action.status !== quote.status &&
              !(isTerminalQuote && revivingStatuses.has(action.status)) &&
              // Een geaccepteerde offerte gaat alleen nog naar 'geannuleerd' — spiegelt
              // de backend-guard: er kunnen al bestellingen op dit akkoord zijn geplaatst.
              !(quote.status === "accepted" && action.status !== "cancelled") &&
              (isFieldMode
                ? fieldAllowedStatuses.has(action.status as "sent" | "accepted" | "rejected")
                : true)
          )
          .map((action) => {
            const Icon = action.icon;

            return (
              <Button
                disabled={isUpdatingStatus}
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
        {/* Factuur aanmaken alleen in winkel-mode */}
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
            ? `Je verwijdert "${pendingDeleteLine.titel}" uit deze conceptofferte. Dit kan alleen zolang de post nog nergens definitief aan gekoppeld is.`
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
        confirmLabel={pendingStatusAction?.confirmLabel ?? pendingStatusAction?.label ?? "Status aanpassen"}
        tone={pendingStatus === "cancelled" || pendingStatus === "rejected" ? "danger" : "warning"}
        isBusy={isUpdatingStatus}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void confirmStatusUpdate()}
      />
      <ConfirmDialog
        open={pendingCreateInvoice}
        title="Factuur aanmaken?"
        description={`Er wordt een factuur aangemaakt op basis van offerte ${quote.offertenummer}. Het totaal bedraagt ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(quote.totaalInclBtw)} incl. btw. De vervaldatum volgt de betaaltermijn van deze klant.`}
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
      {isPresentationOpen && documentModel ? (
        <div
          className="quote-presentation-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Offerte presenteren aan de klant"
        >
          <div className="quote-presentation-toolbar">
            <span className="muted">
              Presentatie voor de klant — interne controles zijn verborgen
            </span>
            <Button variant="secondary" size="sm" onClick={() => setIsPresentationOpen(false)}>
              Sluiten (Esc)
            </Button>
          </div>
          <div className="quote-presentation-body">
            <QuoteDocumentPreview model={documentModel} />
          </div>
        </div>
      ) : null}
    </>
  );

  if (isFieldMode) {
    return (
      <div className="grid field-quote-workbench">
        {dialogs}

        {/* Compact header met status-acties */}
        <section className="field-quote-compact-header">
          <div>
            <p className="eyebrow">{fieldQuoteLabel}</p>
            <h2>{quote.titel}</h2>
          </div>
          <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
          <SummaryList
            items={[
              { id: "customer", label: "Klant", value: customerName },
              { id: "number", label: "Offertenummer", value: quote.offertenummer },
              { id: "valid", label: "Geldig tot", value: validUntilLabel },
              { id: "lines", label: fieldLineLabel, value: quote.lines.length },
              { id: "total", label: "Totaal incl. btw", value: formatEuro(quoteTotals.totalIncVat) }
            ]}
          />
          {canEdit && onUpdateStatus ? (
            <div className="field-quote-status-actions">{statusActions}</div>
          ) : null}
        </section>

        {canEditDraftLines ? measurementPicker : null}

        {quoteLinesPanel}
        {lineEditPanel}

        {canEditDraftLines ? (
          <details className="field-quote-disclosure">
            <summary>Extra post toevoegen</summary>
            <div className="field-quote-disclosure-content">
              {inferredProductGroup ? (
                <div className="field-quote-catalog-filter">
                  <label htmlFor="catalog-group-filter" className="eyebrow">
                    Catalogus gefilterd op
                  </label>
                  <select
                    id="catalog-group-filter"
                    value={productGroupOverride ?? inferredProductGroup}
                    onChange={(e) =>
                      setProductGroupOverride(
                        e.target.value === "all"
                          ? "all"
                          : (e.target.value as MeasurementProductGroup)
                      )
                    }
                  >
                    {PRODUCT_GROUP_OPTIONS.map((group) => (
                      <option key={group} value={group}>
                        {formatMeasurementProductGroup(group)}
                      </option>
                    ))}
                    <option value="all">Alle categorieën</option>
                  </select>
                </div>
              ) : null}
              {composer}
            </div>
          </details>
        ) : null}

        {/* Offerteteksten: ingeklapt in field-mode (minder vaak nodig op locatie) */}
        <details className="field-quote-disclosure">
          <summary>Offerteteksten</summary>
          <div className="field-quote-disclosure-content">{textsContent}</div>
        </details>

        {/* Voorwaarden: altijd open in field-mode zodat buitendienst ze kan inzien */}
        <details className="field-quote-disclosure" open>
          <summary>Voorwaarden</summary>
          <div className="field-quote-disclosure-content">{termsContent}</div>
        </details>

        {/* Klantversie: altijd zichtbaar als prominente sectie */}
        <section className="panel field-quote-customer-section">
          <SectionHeader
            compact
            title="Klantversie"
            description="Controleer en print de offerte zoals de klant hem ontvangt."
            actions={
              documentModel ? (
                <div className="toolbar">
                  <Button
                    leftIcon={<Presentation size={16} aria-hidden="true" />}
                    onClick={() => setIsPresentationOpen(true)}
                    size="sm"
                    variant="secondary"
                  >
                    Presenteren aan klant
                  </Button>
                  <Button
                    leftIcon={<Printer size={16} aria-hidden="true" />}
                    onClick={() => setIsCustomerVersionModalOpen(true)}
                    size="sm"
                    variant="primary"
                  >
                    Klantversie openen
                  </Button>
                </div>
              ) : null
            }
          />
          {customerVersionPreview}
        </section>
      </div>
    );
  }

  return (
    <div className="grid quote-workbench">
      {dialogs}
      <section className="panel quote-summary-panel">
        <SectionHeader
          compact
          title={quote.titel}
          description="Controleer gegevens, voorwaarden en offerteposten."
          actions={statusActions}
        />
        <SummaryList
          items={[
            { id: "customer", label: "Klant", value: customerName },
            ...(customerAddress ? [{ id: "address", label: "Adres", value: customerAddress }] : []),
            { id: "number", label: "Offertenummer", value: quote.offertenummer },
            { id: "valid", label: "Geldig tot", value: validUntilLabel },
            { id: "lines", label: "Offerteposten", value: quote.lines.length },
            { id: "updated", label: "Bijgewerkt", value: formatDate(quote.gewijzigdOp) }
          ]}
        />
      </section>
      <QuoteTotals lines={quote.lines} />

      <div className="quote-full-width-panel">{quoteLinesPanel}</div>
      {lineEditPanel ? <div className="quote-full-width-panel">{lineEditPanel}</div> : null}

      {canEditDraftLines ? (
        <CollapsiblePanel
          eyebrow="Toevoegen"
          title="Offertepost toevoegen"
          description="Kies hoe je een post toevoegt: catalogusproduct, werkzaamheid of inmeting overnemen."
        >
          {composer}
        </CollapsiblePanel>
      ) : null}

      <div className="quote-full-width-panel">{textsPanel}</div>
      <div className="quote-full-width-panel">{termsPanel}</div>
      <div className="quote-customer-version-panel">{customerVersionPanel}</div>
    </div>
  );
}
