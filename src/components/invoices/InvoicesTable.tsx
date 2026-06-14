import { formatInvoiceStatus } from "../../lib/i18n/statusLabels";
import { formatEuro } from "../../lib/money";
import { formatDate } from "../../lib/dates";
import type { InvoiceStatus, PortalInvoiceRow } from "../../lib/portalTypes";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { SectionHeader } from "../ui/SectionHeader";
import { Select } from "../ui/Select";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export type StatusFilter = "all" | InvoiceStatus;

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle statussen" },
  { value: "sent", label: formatInvoiceStatus("sent") },
  { value: "overdue", label: formatInvoiceStatus("overdue") },
  { value: "partially_paid", label: formatInvoiceStatus("partially_paid") },
  { value: "paid", label: formatInvoiceStatus("paid") },
  { value: "cancelled", label: formatInvoiceStatus("cancelled") },
  { value: "draft", label: formatInvoiceStatus("draft") }
];

type InvoicesTableProps = {
  invoices: PortalInvoiceRow[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
};

export function InvoicesTable({
  invoices,
  isLoading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter
}: InvoicesTableProps) {
  const columns: Array<DataTableColumn<PortalInvoiceRow>> = [
    {
      key: "invoice",
      header: "Factuurnummer",
      priority: "primary",
      render: (invoice) => (
        <div className="stack-sm">
          <a href={`/portal/facturen/${invoice.id}`}>
            <strong>{invoice.factuurnummer}</strong>
          </a>
          <small className="muted">{invoice.projectTitle}</small>
        </div>
      )
    },
    {
      key: "customer",
      header: "Klant",
      render: (invoice) => invoice.customerName
    },
    {
      key: "dueDate",
      header: "Vervaldatum",
      hideOnMobile: true,
      render: (invoice) => {
        const isOverdue =
          invoice.status !== "paid" &&
          invoice.status !== "cancelled" &&
          invoice.vervaldatum < Date.now();
        return (
          <span style={isOverdue ? { color: "var(--color-danger, #b91c1c)", fontWeight: 700 } : undefined}>
            {formatDate(invoice.vervaldatum)}
          </span>
        );
      }
    },
    {
      key: "totalIncVat",
      header: "Bedrag incl. btw",
      align: "right",
      hideOnMobile: true,
      render: (invoice) => <strong>{formatEuro(invoice.totaalInclBtw)}</strong>
    },
    {
      key: "status",
      header: "Status",
      width: "180px",
      render: (invoice) => <InvoiceStatusBadge status={invoice.status} />
    }
  ];

  return (
    <section className="grid">
      <SectionHeader
        compact
        title="Factuuroverzicht"
        description="Alle facturen gesorteerd op aanmaakdatum. Klik op een factuurnummer voor het volledige detail."
      />
      <FilterBar
        search={
          <SearchInput
            aria-label="Facturen zoeken"
            placeholder="Zoek op factuurnummer, klant of project"
            value={search}
            onChange={setSearch}
          />
        }
        filters={
          <Field label="Status" htmlFor="invoice-status-filter">
            <Select
              id="invoice-status-filter"
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
        ariaLabel="Facturen"
        columns={columns}
        density="compact"
        emptyTitle="Geen facturen gevonden"
        emptyDescription="Facturen worden automatisch aangemaakt wanneer je een dossier op 'Gefactureerd' zet via de dossierworkflow."
        getRowKey={(invoice) => invoice.id}
        loading={isLoading}
        mobileMode="cards"
        renderMobileCard={(invoice) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <a href={`/portal/facturen/${invoice.id}`}>
                  <strong>{invoice.factuurnummer}</strong>
                </a>
                <small className="muted">{invoice.customerName}</small>
              </div>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <div className="mobile-card-meta">
              <span>{invoice.projectTitle}</span>
              <span>{formatEuro(invoice.totaalInclBtw)}</span>
            </div>
            <div className="mobile-card-actions">
              <a
                className="ui-button ui-button-secondary ui-button-sm"
                href={`/portal/facturen/${invoice.id}`}
              >
                Factuur openen
              </a>
            </div>
          </div>
        )}
        rows={invoices}
      />
    </section>
  );
}
