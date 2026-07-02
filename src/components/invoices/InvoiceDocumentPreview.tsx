import { FileText, Printer } from "lucide-react";
import type { InvoiceDocumentModel } from "../../lib/invoices/invoiceDocumentModel";
import {
  formatCurrencyEUR,
  formatDateNL,
  formatQuantity,
  formatVatRate
} from "../../lib/quotes/quoteDocumentFormatting";
import { printDocumentFromButton } from "../../lib/documents/printDocument";
import { Alert } from "../ui/feedback/Alert";
import { Button } from "../ui/forms/Button";

type InvoiceDocumentPreviewProps = {
  model: InvoiceDocumentModel;
};

export default function InvoiceDocumentPreview({ model }: InvoiceDocumentPreviewProps) {
  const lineCount = model.lines.filter((line) => !line.isText).length;
  const isPaid = model.payment.outstanding <= 0;

  return (
    <article
      className="quote-document-preview"
      aria-label="Factuur klantversie"
      data-print-title={`${model.invoice.invoiceNumber} - ${model.customer.name}`}
    >
      <section className="quote-document-control-panel no-print" aria-label="Factuur controle">
        <div className="quote-document-control-copy">
          <span className="quote-document-control-icon success">
            <FileText size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Klantversie</p>
            <h2>Factuur {model.invoice.invoiceNumber}</h2>
            <p>Bekijk de factuur zoals de klant hem ontvangt en print hem naar PDF.</p>
          </div>
        </div>
        <div className="quote-document-actions no-print">
          <Button
            leftIcon={<Printer size={17} aria-hidden="true" />}
            onClick={printDocumentFromButton}
            variant="primary"
          >
            Factuur printen
          </Button>
        </div>
      </section>

      <Alert
        className="no-print"
        variant="info"
        title="Alleen bekijken"
        description="Deze klantversie toont de huidige factuurgegevens en wijzigt niets."
      />

      <section className="quote-document-snapshot no-print" aria-label="Samenvatting factuur">
        <div>
          <FileText size={18} aria-hidden="true" />
          <span>Factuurnummer</span>
          <strong>{model.invoice.invoiceNumber}</strong>
        </div>
        <div>
          <FileText size={18} aria-hidden="true" />
          <span>Regels</span>
          <strong>{lineCount}</strong>
        </div>
        <div className={isPaid ? "is-ready" : "needs-review"}>
          <FileText size={18} aria-hidden="true" />
          <span>Nog te voldoen</span>
          <strong>{formatCurrencyEUR(model.payment.outstanding)}</strong>
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

        <section className="quote-document-print-title print-page-break-avoid">
          <p className="eyebrow">Factuur</p>
          <h1>{model.invoice.subject}</h1>
        </section>

        <section className="quote-document-meta-grid print-page-break-avoid">
          <div>
            <p className="eyebrow">Factuuradres</p>
            <strong>{model.customer.name}</strong>
            {model.customer.addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div>
            <p className="eyebrow">Factuur</p>
            <dl>
              <div>
                <dt>Factuurnummer</dt>
                <dd>{model.invoice.invoiceNumber}</dd>
              </div>
              <div>
                <dt>Factuurdatum</dt>
                <dd>{formatDateNL(model.invoice.invoiceDate)}</dd>
              </div>
              <div>
                <dt>Vervaldatum</dt>
                <dd>{formatDateNL(model.invoice.dueDate)}</dd>
              </div>
              {model.invoice.quoteNumber ? (
                <div>
                  <dt>Offertenummer</dt>
                  <dd>{model.invoice.quoteNumber}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <section className="quote-document-section print-page-break-avoid">
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
                {model.lines.map((line, lineIndex) =>
                  line.isText ? (
                    <tr key={`line-${lineIndex}`}>
                      <td />
                      <td />
                      <td colSpan={4}>
                        <span className="muted">{line.description}</span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`line-${lineIndex}`}>
                      <td>{formatQuantity(line.quantity)}</td>
                      <td>{line.unit}</td>
                      <td>
                        {line.description}
                        {line.discountExVat > 0
                          ? ` (korting ${formatCurrencyEUR(line.discountExVat)})`
                          : ""}
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
        </section>

        <section className="quote-document-totals print-keep-together" aria-label="Factuurtotalen">
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
          {model.payment.paidAmount > 0 ? (
            <div>
              <span>Reeds betaald</span>
              <strong>{formatCurrencyEUR(model.payment.paidAmount)}</strong>
            </div>
          ) : null}
          <div className="quote-document-total-row">
            <span>Nog te voldoen</span>
            <strong>{formatCurrencyEUR(model.payment.outstanding)}</strong>
          </div>
        </section>
      </div>

      <div className="quote-document-back-matter">
        <section className="quote-document-terms">
          <div>
            <h3>Facturering en betaling</h3>
            {isPaid ? (
              <p>Deze factuur is volledig voldaan. Hartelijk dank.</p>
            ) : (
              <p>
                Wij verzoeken u vriendelijk het openstaande bedrag van{" "}
                <strong>{formatCurrencyEUR(model.payment.outstanding)}</strong> te voldoen vóór{" "}
                <strong>{formatDateNL(model.payment.dueDate)}</strong>
                {model.payment.iban ? (
                  <>
                    {" "}
                    op IBAN <strong>{model.payment.iban}</strong> t.n.v. {model.company.name}
                  </>
                ) : null}
                , onder vermelding van factuurnummer{" "}
                <strong>{model.payment.reference}</strong>.
              </p>
            )}
          </div>
        </section>

        <section className="quote-document-closing print-page-break-avoid">
          <p>Met vriendelijke groet,</p>
          <strong>{model.company.name}</strong>
          <span>{model.company.signatoryName}</span>
        </section>
      </div>
      </div>
    </article>
  );
}
