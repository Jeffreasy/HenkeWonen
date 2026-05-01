import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  PortalQuoteLine,
  QuoteTemplate
} from "../../lib/portalTypes";
import { formatQuoteStatus, formatUnit } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { buildQuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import { polishQuoteTemplateLines, polishQuoteTemplateText } from "../../lib/quoteTemplateCopy";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { SectionHeader } from "../ui/SectionHeader";
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
  project?: PortalProject;
  quoteTemplates?: QuoteTemplate[];
  onAddLine: (line: QuoteLineFormValues) => Promise<string | void> | string | void;
  onDeleteLine: (lineId: string) => Promise<void> | void;
  onUpdateTerms?: (terms: string[], paymentTerms: string[]) => Promise<void> | void;
  onMeasurementLinesImported?: () => Promise<void> | void;
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function QuoteBuilder({
  quote,
  customer,
  project,
  quoteTemplates = [],
  onAddLine,
  onDeleteLine,
  onUpdateTerms,
  onMeasurementLinesImported
}: QuoteBuilderProps) {
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

  useEffect(() => {
    setTermsText(polishQuoteTemplateLines(quote.terms ?? []).join("\n"));
    setPaymentTermsText(polishQuoteTemplateLines(quote.paymentTerms ?? []).join("\n"));
  }, [quote.id, quote.paymentTerms, quote.terms]);

  async function saveTerms() {
    if (!onUpdateTerms) {
      return;
    }

    setIsSavingTerms(true);
    try {
      await onUpdateTerms(splitLines(termsText), splitLines(paymentTermsText));
    } finally {
      setIsSavingTerms(false);
    }
  }

  const columns: Array<DataTableColumn<PortalQuoteLine>> = [
    {
      key: "type",
      header: "Regeltype",
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
      header: "",
      align: "right",
      width: "54px",
      render: (line) => (
        <IconButton
          aria-label={`Regel ${line.title} verwijderen`}
          onClick={() => void onDeleteLine(line.id)}
          variant="secondary"
        >
          <Trash2 size={17} aria-hidden="true" />
        </IconButton>
      )
    }
  ];

  return (
    <div className="grid quote-workbench">
      <div className="grid quote-main-column">
        <section className="panel">
          <SectionHeader
            compact
            title={quote.title}
            description="Offertegegevens, voorwaarden en regels voor winkelgebruik."
            actions={<StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />}
          />
          <SummaryList
            items={[
              { id: "number", label: "Offertenummer", value: quote.quoteNumber },
              { id: "lines", label: "Offerteposten", value: quote.lines.length },
              { id: "updated", label: "Bijgewerkt", value: new Intl.DateTimeFormat("nl-NL").format(new Date(quote.updatedAt)) }
            ]}
          />
        </section>

        <QuoteLineEditor
          sortOrder={quote.lines.length + 1}
          templateLines={defaultTemplate?.defaultLines ?? []}
          onAdd={onAddLine}
        />

        <MeasurementLinePicker
          tenantSlug={quote.tenantId}
          quoteId={quote.id}
          projectId={quote.projectId}
          startSortOrder={quote.lines.length + 1}
          onAddLine={onAddLine}
          onImported={onMeasurementLinesImported}
        />

        <section className="panel">
          <SectionHeader
            compact
            title="Offerteregels"
            description="Producten, werkzaamheden, materialen en tekstregels in verkoopvolgorde."
          />
          <DataTable
            ariaLabel="Offerteregels"
            columns={columns}
            density="compact"
            emptyTitle="Nog geen regels"
            emptyDescription="Voeg een product-, arbeids-, materiaal- of tekstregel toe."
            getRowKey={(line) => line.id}
            rows={quote.lines}
          />
        </section>

        <section className="panel">
          <SectionHeader
            compact
            title="Voorwaarden"
            description="Voorwaarden en factureringsregels die bij deze offerte horen en per offerte overschrijfbaar zijn."
          />
          {onUpdateTerms ? (
            <div className="grid two-column-even">
              <Field
                htmlFor="quote-terms"
                label="Uitvoeringsvoorwaarden"
                description="Een voorwaarde per regel. Nieuwe offertes nemen dit over vanuit het offertesjabloon."
              >
                <Textarea
                  id="quote-terms"
                  rows={9}
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
                  rows={9}
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
          )}
        </section>

        <section className="panel">
          <SectionHeader
            compact
            title="Preview"
            description="Read-only offertepreview op basis van bestaande quote-data."
          />
          {documentModel ? (
            <QuoteDocumentPreview model={documentModel} />
          ) : (
            <EmptyState
              title="Preview niet beschikbaar"
              description="Klantgegevens zijn nodig om de offertepreview op te bouwen."
            />
          )}
        </section>
      </div>
      <QuoteTotals lines={quote.lines} />
    </div>
  );
}
