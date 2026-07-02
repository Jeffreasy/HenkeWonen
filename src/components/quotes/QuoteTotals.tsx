import { buildVatBreakdown } from "../../lib/documents/vatBreakdown";
import { formatEuro } from "../../lib/money";
import type { PortalQuoteLine } from "../../lib/portalTypes";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { SummaryList } from "../ui/data-display/SummaryList";

type QuoteTotalsProps = {
  lines: PortalQuoteLine[];
};

export default function QuoteTotals({ lines }: QuoteTotalsProps) {
  const totals = lines.reduce(
    (current, line) => ({
      subtotalExVat: current.subtotalExVat + line.regelTotaalExBtw,
      vatTotal: current.vatTotal + line.regelBtwTotaal,
      totalIncVat: current.totalIncVat + line.regelTotaalInclBtw,
      discountExVat: current.discountExVat + (line.kortingExBtw ?? 0)
    }),
    {
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0,
      discountExVat: 0
    }
  );

  // regelTotaalExBtw is al na korting; bij korting tonen we de volledige opbouw
  // (bruto -> korting -> netto) zodat het btw-bedrag aansluit op het subtotaal.
  const hasDiscount = totals.discountExVat > 0;

  // Zelfde btw-uitsplitsing per tarief als op de klantversie, zodat de winkel
  // hier exact controleert wat de klant straks op het document ziet.
  const vatBreakdown = buildVatBreakdown(lines);

  return (
    <aside className="panel quote-totals-panel">
      <SectionHeader compact title="Totalen" description={`${lines.length} offerteregels`} />
      <SummaryList
        items={[
          ...(hasDiscount
            ? [
                {
                  id: "gross",
                  label: "Subtotaal voor korting",
                  value: formatEuro(totals.subtotalExVat + totals.discountExVat)
                },
                {
                  id: "discount",
                  label: "Korting",
                  value: `− ${formatEuro(totals.discountExVat)}`
                }
              ]
            : []),
          {
            id: "subtotal",
            label: "Subtotaal excl. btw",
            value: formatEuro(totals.subtotalExVat)
          },
          ...(vatBreakdown.length > 0
            ? vatBreakdown.map((row) => ({
                id: `vat-${row.rate}`,
                label: `Btw ${row.rate}% over ${formatEuro(row.base)}`,
                value: formatEuro(row.amount)
              }))
            : [
                {
                  id: "vat",
                  label: "Btw",
                  value: formatEuro(totals.vatTotal)
                }
              ]),
          {
            id: "total",
            label: "Totaal incl. btw",
            value: formatEuro(totals.totalIncVat)
          }
        ]}
      />
    </aside>
  );
}
