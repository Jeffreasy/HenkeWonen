import { AlertTriangle, CheckCircle2, FileText, Printer } from "lucide-react";
import { shouldShowCostBreakdown } from "../../lib/documents/costBreakdown";
import type { QuoteDocumentModel } from "../../lib/quotes/quoteDocumentModel";
import {
  formatCurrencyEUR,
  formatDateNL,
  formatQuantity,
  formatVatRate
} from "../../lib/quotes/quoteDocumentFormatting";
import { printDocumentFromButton } from "../../lib/documents/printDocument";
import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Alert } from "../ui/feedback/Alert";
import { Badge } from "../ui/data-display/Badge";
import { Button } from "../ui/forms/Button";

type QuoteDocumentPreviewProps = {
  model: QuoteDocumentModel;
};

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
    <article
      className="quote-document-preview"
      aria-label="Klantversie offerte"
      data-print-title={`${model.quote.quoteNumber} - ${model.customer.name}`}
    >
      <section className="quote-document-control-panel no-print" aria-label="Klantversie controle">
        <div className="quote-document-control-copy">
          <span
            className={
              hasManualReviewLines
                ? "quote-document-control-icon warning"
                : "quote-document-control-icon success"
            }
          >
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
            onClick={printDocumentFromButton}
            variant="primary"
          >
            Klantversie printen
          </Button>
        </div>
      </section>

      <Alert
        className="no-print"
        variant="info"
        title="Alleen bekijken"
        description="Deze klantversie toont de huidige offertegegevens en wijzigt niets."
      />

      {hasManualReviewLines ? (
        <Alert
          className="no-print"
          variant="warning"
          title="Controle nodig"
          description="Een of meer regels vragen handmatige controle. Controleer product, prijs en btw."
        />
      ) : null}

      <section className="quote-document-cover print-page-break-avoid no-print">
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
          <small>
            {model.quote.validUntil
              ? `Geldig tot ${formatDateNL(model.quote.validUntil)}`
              : "Geldigheid niet ingevuld"}
          </small>
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

      {/* Het vel: dit deel is wat de klant op papier krijgt (zie .quote-document-sheet). */}
      <div className="quote-document-sheet">
        <div className="quote-document-front-page">
          <section className="quote-document-letterhead print-page-break-avoid">
            <div>
              {model.company.logoUrl ? (
                <img
                  className="quote-document-logo"
                  src={model.company.logoUrl}
                  alt={model.company.name}
                  width="220"
                  height="58"
                />
              ) : (
                <strong>{model.company.name}</strong>
              )}
              {model.company.addressLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <div>
              <span>{model.company.contactLine}</span>
              <span>{model.company.legalLine}</span>
            </div>
          </section>

          <section className="quote-document-print-title print-only print-page-break-avoid">
            <div>
              <p className="eyebrow">Offerte</p>
              <h1>{model.quote.subject}</h1>
            </div>
            <div className="quote-document-title-reference">
              <span>Offertenummer</span>
              <strong>{model.quote.quoteNumber}</strong>
            </div>
          </section>

          <section className="quote-document-meta-grid print-page-break-avoid">
            <div>
              <p className="eyebrow">Klant</p>
              <strong>{model.customer.name}</strong>
              {model.customer.addressLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              {model.customer.telefoon ? <span>{model.customer.telefoon}</span> : null}
              {model.customer.email ? <span>{model.customer.email}</span> : null}
            </div>
            <div>
              <p className="eyebrow">Offertegegevens</p>
              <dl>
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
                className="quote-document-section"
                key={section.key ?? `section-${sectionIndex}`}
              >
                {section.title ? <h3>{section.title}</h3> : null}
                <div className="quote-document-table-wrap">
                  <table className="quote-document-table quote-document-quote-table">
                    <thead>
                      <tr>
                        <th>Aantal</th>
                        <th>Omschrijving</th>
                        <th>Prijs excl. btw</th>
                        <th>Btw</th>
                        <th>Totaal incl. btw</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.lines.map((line, lineIndex) =>
                        line.isText ? (
                          // Tekstregel: alleen de tekst, geen 0-bedragen — zelfde opmaak
                          // als de factuur-klantversie (InvoiceDocumentPreview).
                          <tr key={`${section.key ?? sectionIndex}-${lineIndex}`}>
                            <td />
                            <td colSpan={4}>
                              <span className="muted">
                                <DescriptionText description={line.description} />
                              </span>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            className={
                              line.requiresManualReview
                                ? "quote-document-line-needs-review"
                                : undefined
                            }
                            key={`${section.key ?? sectionIndex}-${lineIndex}`}
                          >
                            <td>
                              <span className="quote-document-quantity">
                                {formatQuantity(line.quantity)}
                                {line.unit ? <small>{line.unit}</small> : null}
                              </span>
                            </td>
                            <td>
                              <DescriptionText description={line.description} />
                              {line.requiresManualReview ? (
                                <small className="quote-document-review-warning no-print">
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  Controleer product, prijs en btw.
                                </small>
                              ) : null}
                            </td>
                            <td>{formatCurrencyEUR(line.unitPriceExVat)}</td>
                            <td>{formatVatRate(line.vatRate)}</td>
                            <td>{formatCurrencyEUR(line.lineTotalIncVat)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <section
            className="quote-document-totals print-keep-together"
            aria-label="Offertetotalen"
          >
            <div>
              <span>Subtotaal excl. btw</span>
              <strong>{formatCurrencyEUR(model.totals.subtotalExVat)}</strong>
            </div>
            {shouldShowCostBreakdown(model.totals.costBreakdown)
              ? model.totals.costBreakdown.map((row) => (
                  <div key={row.category} className="quote-document-cost-row">
                    <span>waarvan {row.label.toLowerCase()}</span>
                    <strong>{formatCurrencyEUR(row.amount)}</strong>
                  </div>
                ))
              : null}
            {model.totals.vatBreakdown.length > 0 ? (
              // Zelfde btw-uitsplitsing per tarief als op de factuur.
              model.totals.vatBreakdown.map((row) => (
                <div key={row.rate}>
                  <span>
                    Btw {formatVatRate(row.rate)} over {formatCurrencyEUR(row.base)}
                  </span>
                  <strong>{formatCurrencyEUR(row.amount)}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Btw</span>
                <strong>{formatCurrencyEUR(model.totals.vatTotal)}</strong>
              </div>
            )}
            <div className="quote-document-total-row">
              <span>Totaal incl. btw</span>
              <strong>{formatCurrencyEUR(model.totals.totalIncVat)}</strong>
            </div>
            <p>{model.totals.vatLabel}</p>
          </section>
        </div>

        <div className="quote-document-back-matter">
          {model.agreements.length > 0 ? (
            <section className="quote-document-terms print-page-break-avoid">
              <div>
                <h3>Afspraken</h3>
                <TextLines lines={model.agreements} />
              </div>
            </section>
          ) : null}
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

          <section
            className="quote-document-agreement print-page-break-avoid"
            aria-label="Akkoord klant"
          >
            <h3>Voor akkoord</h3>
            <p>
              Voor akkoord met deze offerte
              {model.quote.validUntil
                ? ` (geldig tot ${formatDateNL(model.quote.validUntil)})`
                : ""}
              :
            </p>
            <div className="quote-document-agreement-grid">
              <div>
                <span>Naam</span>
              </div>
              <div>
                <span>Datum</span>
              </div>
              <div>
                <span>Handtekening</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
