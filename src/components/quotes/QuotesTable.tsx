import { Plus } from "lucide-react";
import { formatQuoteStatus } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import type { PortalCustomer, PortalQuote, QuoteStatus } from "../../lib/portalTypes";
import { Button } from "../ui/Button";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";

type StatusFilter = "all" | QuoteStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statussen" },
  { value: "draft", label: formatQuoteStatus("draft") },
  { value: "sent", label: formatQuoteStatus("sent") },
  { value: "accepted", label: formatQuoteStatus("accepted") },
  { value: "rejected", label: formatQuoteStatus("rejected") },
  { value: "expired", label: formatQuoteStatus("expired") },
  { value: "cancelled", label: formatQuoteStatus("cancelled") }
];

type QuotesTableProps = {
  quotes: PortalQuote[];
  selectedQuoteId: string | null;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  isLoading: boolean;
  onSelectQuote: (quoteId: string) => void;
  customerById: Map<string, PortalCustomer>;
  onNew?: () => void;
};

export function QuotesTable({
  quotes,
  selectedQuoteId,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  isLoading,
  onSelectQuote,
  customerById,
  onNew
}: QuotesTableProps) {
  const columns: Array<DataTableColumn<PortalQuote>> = [
    {
      key: "quote",
      header: "Offerte",
      priority: "primary",
      render: (quote) => (
        <button
          className="quote-select-button"
          type="button"
          onClick={() => onSelectQuote(quote.id)}
        >
          <strong>{quote.offertenummer}</strong>
          <span>{quote.titel}</span>
        </button>
      )
    },
    {
      key: "customer",
      header: "Klant",
      render: (quote) => customerById.get(quote.klantId)?.weergaveNaam ?? "-"
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (quote) => <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
    },
    {
      key: "lines",
      header: "Offerteposten",
      align: "right",
      width: "90px",
      hideOnMobile: true,
      render: (quote) => quote.lines.length
    },
    {
      key: "total",
      header: "Totaal",
      align: "right",
      width: "130px",
      render: (quote) => formatEuro(quote.totaalInclBtw)
    }
  ];

  return (
    <section className="grid">
      <SectionHeader
        compact
        title="Offertes"
        description="Selecteer een offerte om posten, voorwaarden en totaal te bekijken."
        actions={
          onNew ? (
            <Button
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={onNew}
              size="sm"
              variant="primary"
              data-shortcut="new-quote"
            >
              Nieuwe offerte
            </Button>
          ) : null
        }
      />
      <FilterBar
        search={
          <SearchInput
            aria-label="Offertes zoeken"
            placeholder="Zoek op nummer, titel of klant"
            value={search}
            onChange={setSearch}
            data-searchbar
          />
        }
        filters={
          <Field label="Status" htmlFor="quote-status-filter">
            <Select
              id="quote-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        }
      />
      <DataTable
        ariaLabel="Offertes"
        columns={columns}
        density="compact"
        emptyDescription="Maak hierboven een offerte aan of pas je filters aan."
        emptyTitle="Geen offertes gevonden"
        getRowKey={(quote) => quote.id}
        loading={isLoading}
        mobileMode="cards"
        renderMobileCard={(quote) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <strong>{quote.offertenummer}</strong>
                <small className="muted">{quote.titel}</small>
              </div>
              <StatusBadge status={quote.status} label={formatQuoteStatus(quote.status)} />
            </div>
            <div className="mobile-card-meta">
              <span>{customerById.get(quote.klantId)?.weergaveNaam ?? "Geen klant"}</span>
              <span>{quote.lines.length} posten</span>
              <strong>{formatEuro(quote.totaalInclBtw)}</strong>
            </div>
            <div className="mobile-card-actions">
              <Button
                onClick={() => onSelectQuote(quote.id)}
                size="sm"
                variant={quote.id === selectedQuoteId ? "primary" : "secondary"}
              >
                {quote.id === selectedQuoteId ? "Geselecteerd" : "Selecteren"}
              </Button>
              <a className="ui-button ui-button-secondary ui-button-sm" href={`/portal/offertes/${quote.id}`}>
                Openen
              </a>
            </div>
          </div>
        )}
        rows={quotes}
      />
    </section>
  );
}
