import { formatEuro } from "../../lib/money";
import type { PortalQuoteLine } from "../../lib/portalTypes";
import { SectionHeader } from "../ui/SectionHeader";
import { SummaryList } from "../ui/SummaryList";

type QuoteTotalsProps = {
  lines: PortalQuoteLine[];
};

export default function QuoteTotals({ lines }: QuoteTotalsProps) {
  const totals = lines.reduce(
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

  return (
    <aside className="panel quote-totals-panel">
      <SectionHeader compact title="Totalen" description={`${lines.length} offerteregels`} />
      <SummaryList
        items={[
          {
            id: "subtotal",
            label: "Subtotaal excl. btw",
            value: formatEuro(totals.subtotalExVat)
          },
          {
            id: "vat",
            label: "Btw",
            value: formatEuro(totals.vatTotal)
          },
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
