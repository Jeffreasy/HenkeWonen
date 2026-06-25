import { Printer } from "lucide-react";
import { henkeCompanyProfile } from "../../lib/quotes/henkeCompanyProfile";
import { formatQuantity } from "../../lib/quotes/quoteDocumentFormatting";
import { formatEuro } from "../../lib/money";
import { formatDate } from "../../lib/dates";
import { printDocumentFromButton } from "../../lib/documents/printDocument";
import type {
  PortalSupplierOrder,
  PortalSupplierOrderLine
} from "../../lib/portalTypes";
import { Button } from "../ui/forms/Button";

type SupplierOrderDocumentDetail = {
  order: PortalSupplierOrder;
  lines: PortalSupplierOrderLine[];
  leverancier: { naam: string; contactpersoon?: string; email?: string; telefoon?: string } | null;
  project: { id: string; titel: string } | null;
};

type SupplierOrderDocumentProps = {
  detail: SupplierOrderDocumentDetail;
};

export default function SupplierOrderDocument({ detail }: SupplierOrderDocumentProps) {
  const { order, lines, leverancier, project } = detail;
  const company = henkeCompanyProfile;
  const leverancierNaam = leverancier?.naam ?? "Leverancier onbekend";

  return (
    <article
      className="quote-document-preview"
      aria-label="Bestelbon"
      data-print-title={`Bestelbon ${order.bestelnummer ?? ""} - ${leverancierNaam}`.trim()}
    >
      <section className="quote-document-control-panel no-print" aria-label="Bestelbon controle">
        <div className="quote-document-control-copy">
          <div>
            <p className="eyebrow">Bestelbon</p>
            <h2>{leverancierNaam}</h2>
            <p>Bekijk en print de bestelling voor deze leverancier.</p>
          </div>
        </div>
        <div className="quote-document-actions no-print">
          <Button
            leftIcon={<Printer size={17} aria-hidden="true" />}
            onClick={printDocumentFromButton}
            variant="primary"
          >
            Bestelbon printen
          </Button>
        </div>
      </section>

      <div className="quote-document-front-page">
        <section className="quote-document-letterhead print-page-break-avoid">
          <div>
            {company.logoUrl ? (
              <img
                className="quote-document-logo"
                src={company.logoUrl}
                alt={company.name}
                width="220"
                height="58"
              />
            ) : (
              <strong>{company.name}</strong>
            )}
            {company.addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div>
            <span>{company.contactLine}</span>
            <span>{company.legalLine}</span>
          </div>
        </section>

        <section className="quote-document-print-title print-page-break-avoid">
          <p className="eyebrow">Bestelling</p>
          <h1>{leverancierNaam}</h1>
        </section>

        <section className="quote-document-meta-grid print-page-break-avoid">
          <div>
            <p className="eyebrow">Leverancier</p>
            <strong>{leverancierNaam}</strong>
            {leverancier?.contactpersoon ? <span>{leverancier.contactpersoon}</span> : null}
            {leverancier?.email ? <span>{leverancier.email}</span> : null}
            {leverancier?.telefoon ? <span>{leverancier.telefoon}</span> : null}
          </div>
          <div>
            <p className="eyebrow">Bestelling</p>
            <dl>
              {order.bestelnummer ? (
                <div>
                  <dt>Bestelnummer</dt>
                  <dd>{order.bestelnummer}</dd>
                </div>
              ) : null}
              <div>
                <dt>Datum</dt>
                <dd>{formatDate(order.besteldOp ?? order.aangemaaktOp)}</dd>
              </div>
              {project ? (
                <div>
                  <dt>Project</dt>
                  <dd>{project.titel}</dd>
                </div>
              ) : null}
              {order.verwachteLeverdatumOp ? (
                <div>
                  <dt>Gewenste levering</dt>
                  <dd>{formatDate(order.verwachteLeverdatumOp)}</dd>
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
                  <th>Art.nr</th>
                  <th>Inkoop excl. btw</th>
                  <th>Totaal excl. btw</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{formatQuantity(line.aantal)}</td>
                    <td>{line.eenheid}</td>
                    <td>{line.omschrijving}</td>
                    <td>{line.leverancierCode || line.artikelnummer || "—"}</td>
                    <td>
                      {line.inkoopPrijsExBtw !== undefined
                        ? formatEuro(line.inkoopPrijsExBtw)
                        : "—"}
                    </td>
                    <td>
                      {line.regelTotaalExBtw !== undefined
                        ? formatEuro(line.regelTotaalExBtw)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="quote-document-totals print-keep-together" aria-label="Besteltotaal">
          <div className="quote-document-total-row">
            <span>Totaal inkoop excl. btw</span>
            <strong>{formatEuro(order.totaalInkoopExBtw)}</strong>
          </div>
          {order.notities ? <p>{order.notities}</p> : null}
        </section>
      </div>
    </article>
  );
}
