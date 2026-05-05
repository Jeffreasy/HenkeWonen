import { AlertTriangle, CheckCircle2, FileText, Printer } from "lucide-react";
import type { MouseEvent } from "react";
import type { QuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import {
  formatCurrencyEUR,
  formatDateNL,
  formatQuantity,
  formatVatRate
} from "../../lib/quotes/quoteDocumentFormatting";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

type QuoteDocumentPreviewProps = {
  model: QuoteDocumentModel;
};

const PRINT_ROOT_ID = "quote-print-root";

function TextLines({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return <p className="muted">Geen tekst opgenomen.</p>;
  }

  return (
    <ul className="quote-document-text-list">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

function DescriptionText({ description }: { description: string }) {
  return (
    <span className="quote-document-line-description">
      {description.split("\n").map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
    </span>
  );
}

function removePrintRoot() {
  window.document.getElementById(PRINT_ROOT_ID)?.remove();
  window.document.body.classList.remove("quote-print-active");
}

function printConceptQuote(event: MouseEvent<HTMLButtonElement>) {
  if (typeof window !== "undefined") {
    const source = event.currentTarget.closest(".quote-document-preview");

    if (!source) {
      return;
    }

    removePrintRoot();

    const printRoot = window.document.createElement("div");
    const printablePreview = source.cloneNode(true) as HTMLElement;

    printRoot.id = PRINT_ROOT_ID;
    printRoot.className = "quote-print-root";
    printablePreview
      .querySelectorAll(".no-print, .quote-document-actions")
      .forEach((element) => element.remove());
    printRoot.appendChild(printablePreview);

    window.document.body.appendChild(printRoot);
    window.document.body.classList.add("quote-print-active");
    window.addEventListener("afterprint", removePrintRoot, { once: true });
    window.requestAnimationFrame(() => window.print());
  }
}

export default function QuoteDocumentPreview({ model }: QuoteDocumentPreviewProps) {
  const lineCount = model.sections.reduce((count, section) => count + section.lines.length, 0);
  const reviewCount = model.sections.reduce(
    (count, section) => count + section.lines.filter((line) => line.requiresManualReview).length,
    0
  );
  const hasManualReviewLines = model.sections.some((section) =>
    section.lines.some((line) => line.requiresManualReview)
  );
  const reviewStatus = hasManualReviewLines
    ? {
        icon: <AlertTriangle size={18} aria-hidden="true" />,
        title: "Controle nodig",
        description: `${reviewCount} regel${reviewCount === 1 ? "" : "s"} vragen nog aandacht voor product, prijs of btw.`
      }
    : {
        icon: <CheckCircle2 size={18} aria-hidden="true" />,
        title: "Klaar om te bekijken",
        description: "Er zijn geen open controlepunten in deze klantversie."
      };

  return (
    <article className="quote-document-preview" aria-label="Klantversie offerte">
      <section className="quote-document-control-panel no-print" aria-label="Klantversie controle">
        <div className="quote-document-control-copy">
          <span className={hasManualReviewLines ? "quote-document-control-icon warning" : "quote-document-control-icon success"}>
            {reviewStatus.icon}
          </span>
          <div>
            <p className="eyebrow">Klantversie</p>
            <h2>{reviewStatus.title}</h2>
            <p>{reviewStatus.description}</p>
          </div>
        </div>
        <div className="quote-document-actions no-print">
          <Button
            leftIcon={<Printer size={17} aria-hidden="true" />}
            onClick={printConceptQuote}
            variant="primary"
          >
            Klantversie printen
          </Button>
        </div>
      </section>

      <Alert
        variant="info"
        title="Alleen bekijken"
        description="Deze klantversie toont de huidige offertegegevens en wijzigt niets."
      />

      {hasManualReviewLines ? (
        <Alert
          variant="warning"
          title="Controle nodig"
          description="Een of meer regels vragen handmatige controle. Controleer product, prijs en btw."
        />
      ) : null}

      <section className="quote-document-cover print-page-break-avoid">
        <div className="quote-document-cover-main">
          <p className="eyebrow">Offerte</p>
          <h2>Offerte voor {model.customer.name}</h2>
          <p>{model.quote.subject}</p>
          <div className="quote-document-preview-badges">
            <Badge variant="warning">Concept</Badge>
            <Badge variant="neutral">{formatStatusLabel(model.quote.status)}</Badge>
          </div>
        </div>
        <div className="quote-document-total-card" aria-label="Totaal offerte">
          <span>Totaal incl. btw</span>
          <strong>{formatCurrencyEUR(model.totals.totalIncVat)}</strong>
          <small>{model.quote.validUntil ? `Geldig tot ${formatDateNL(model.quote.validUntil)}` : "Geldigheid niet ingevuld"}</small>
        </div>
      </section>

      <section className="quote-document-snapshot no-print" aria-label="Samenvatting klantversie">
        <div>
          <FileText size={18} aria-hidden="true" />
          <span>Offertenummer</span>
          <strong>{model.quote.quoteNumber}</strong>
        </div>
        <div>
          <FileText size={18} aria-hidden="true" />
          <span>Regels</span>
          <strong>{lineCount}</strong>
        </div>
        <div className={hasManualReviewLines ? "needs-review" : "is-ready"}>
          {hasManualReviewLines ? (
            <AlertTriangle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>Controlepunten</span>
          <strong>{reviewCount}</strong>
        </div>
      </section>

      <section className="quote-document-letterhead print-page-break-avoid">
        <div>
          <strong>{model.company.name}</strong>
          {model.company.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div>
          <span>{model.company.contactLine}</span>
          <span>{model.company.legalLine}</span>
        </div>
      </section>

      <section className="quote-document-meta-grid print-page-break-avoid">
        <div>
          <p className="eyebrow">Klant</p>
          <strong>{model.customer.name}</strong>
          {model.customer.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div>
          <p className="eyebrow">Offerte</p>
          <dl>
            <div>
              <dt>Offertenummer</dt>
              <dd>{model.quote.quoteNumber}</dd>
            </div>
            <div>
              <dt>Datum</dt>
              <dd>{formatDateNL(model.quote.quoteDate)}</dd>
            </div>
            {model.quote.validUntil ? (
              <div>
                <dt>Geldig tot</dt>
                <dd>{formatDateNL(model.quote.validUntil)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Onderwerp</dt>
              <dd>{model.quote.subject}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="quote-document-copy print-page-break-avoid">
        <p>{model.customer.salutation}</p>
        {model.quote.introText ? <p>{model.quote.introText}</p> : null}
      </section>

      <section className="quote-document-sections">
        {model.sections.map((section, sectionIndex) => (
          <div
            className="quote-document-section print-page-break-avoid"
            key={section.key ?? `section-${sectionIndex}`}
          >
            {section.title ? <h3>{section.title}</h3> : null}
            <div className="quote-document-table-wrap">
              <table className="quote-document-table">
                <thead>
                  <tr>
                    <th>Aantal</th>
                    <th>Eenheid</th>
                    <th>Omschrijving</th>
                    <th>Prijs excl. btw</th>
                    <th>Btw</th>
                    <th>Totaal incl. btw</th>
                  </tr>
                </thead>
                <tbody>
                  {section.lines.map((line, lineIndex) => (
                    <tr
                      className={line.requiresManualReview ? "quote-document-line-needs-review" : undefined}
                      key={`${section.key ?? sectionIndex}-${lineIndex}`}
                    >
                      <td>{formatQuantity(line.quantity)}</td>
                      <td>{line.unit}</td>
                      <td>
                        <DescriptionText description={line.description} />
                        {line.requiresManualReview ? (
                          <small className="quote-document-review-warning">
                            <AlertTriangle size={14} aria-hidden="true" />
                            Controleer product, prijs en btw.
                          </small>
                        ) : null}
                      </td>
                      <td>{formatCurrencyEUR(line.unitPriceExVat)}</td>
                      <td>{formatVatRate(line.vatRate)}</td>
                      <td>{formatCurrencyEUR(line.lineTotalIncVat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="quote-document-totals print-keep-together" aria-label="Offertetotalen">
        <div>
          <span>Subtotaal excl. btw</span>
          <strong>{formatCurrencyEUR(model.totals.subtotalExVat)}</strong>
        </div>
        <div>
          <span>Btw</span>
          <strong>{formatCurrencyEUR(model.totals.vatTotal)}</strong>
        </div>
        <div className="quote-document-total-row">
          <span>Totaal incl. btw</span>
          <strong>{formatCurrencyEUR(model.totals.totalIncVat)}</strong>
        </div>
        <p>{model.totals.vatLabel}</p>
      </section>

      <section className="quote-document-terms">
        <div>
          <h3>Voorwaarden</h3>
          <TextLines lines={model.terms} />
        </div>
        <div>
          <h3>Facturering en betaling</h3>
          <TextLines lines={model.paymentTerms} />
        </div>
      </section>

      <section className="quote-document-closing print-page-break-avoid">
        {model.quote.closingText ? <p>{model.quote.closingText}</p> : null}
        <p>Met vriendelijke groet,</p>
        <strong>{model.company.name}</strong>
        <span>{model.company.signatoryName}</span>
      </section>
    </article>
  );
}
