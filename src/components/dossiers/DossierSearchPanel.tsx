import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../../lib/dates";
import { DataTable, type DataTableColumn } from "../ui/data-display/DataTable";
import { Field } from "../ui/forms/Field";
import { FilterBar } from "../ui/layout/FilterBar";
import { PaginationControls } from "../ui/PaginationControls";
import { SearchInput } from "../ui/forms/SearchInput";
import { SectionHeader } from "../ui/layout/SectionHeader";
import { Select } from "../ui/forms/Select";
import { StatusBadge } from "../ui/data-display/StatusBadge";

export type DossierType = "all" | "customer" | "project" | "quote";

export type DossierSearchRow = {
  id: string;
  type: Exclude<DossierType, "all">;
  typeLabel: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  href: string;
  updatedAt: number;
  amountLabel?: string;
  searchText: string;
};

const typeOptions: Array<{ value: DossierType; label: string }> = [
  { value: "customer", label: "Klanten" },
  { value: "all", label: "Alles" },
  { value: "project", label: "Projecten" },
  { value: "quote", label: "Offertes" }
];

const pageSize = 25;

type DossierSearchPanelProps = {
  search: string;
  onSearchChange: (search: string) => void;
  typeFilter: DossierType;
  onTypeFilterChange: (typeFilter: DossierType) => void;
  isLoading: boolean;
  rows: DossierSearchRow[];
};

export function DossierSearchPanel({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  isLoading,
  rows
}: DossierSearchPanelProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage]
  );

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns: Array<DataTableColumn<DossierSearchRow>> = [
    {
      key: "dossier",
      header: "Dossier",
      priority: "primary",
      render: (row) => (
        <div className="stack-sm">
          <a href={row.href}>
            <strong>{row.title}</strong>
          </a>
          <small className="muted">{row.subtitle}</small>
        </div>
      )
    },
    {
      key: "type",
      header: "Soort",
      width: "120px",
      render: (row) => <StatusBadge status={row.type} label={row.typeLabel} />
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      render: (row) => <StatusBadge status={row.status} label={row.statusLabel} />
    },
    {
      key: "updated",
      header: "Bijgewerkt",
      width: "120px",
      hideOnMobile: true,
      render: (row) => formatDate(row.updatedAt)
    },
    {
      key: "amount",
      header: "Waarde",
      align: "right",
      width: "130px",
      hideOnMobile: true,
      render: (row) => row.amountLabel ?? "-"
    },
    {
      key: "action",
      header: "",
      align: "right",
      width: "120px",
      render: (row) => (
        <a className="ui-button ui-button-secondary ui-button-sm" href={row.href}>
          Openen
        </a>
      )
    }
  ];

  return (
    <section className="panel dossier-search-panel">
      <SectionHeader
        compact
        title="Zoeken in alle dossiers"
        description="Zoek op klant, project, plaats, telefoonnummer, offerte of status."
      />
      <FilterBar
        search={
          <SearchInput
            aria-label="Dossiers zoeken"
            placeholder="Zoek klant, project, offerte, plaats of status"
            value={search}
            onChange={onSearchChange}
          />
        }
        filters={
          <Field label="Toon" htmlFor="dossier-type-filter">
            <Select
              id="dossier-type-filter"
              value={typeFilter}
              onChange={(event) => onTypeFilterChange(event.target.value as DossierType)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        }
      />
      <DataTable
        ariaLabel="Dossiers"
        columns={columns}
        density="compact"
        emptyDescription="Pas je zoekopdracht aan of maak een nieuw klant- of projectdossier aan."
        emptyTitle="Geen dossiers gevonden"
        getRowKey={(row) => row.id}
        loading={isLoading}
        mobileMode="cards"
        renderMobileCard={(row) => (
          <div className="mobile-card-section">
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <a href={row.href}>
                  <strong>{row.title}</strong>
                </a>
                <small className="muted">{row.subtitle}</small>
              </div>
              <StatusBadge status={row.status} label={row.statusLabel} />
            </div>
            <div className="mobile-card-meta">
              <StatusBadge status={row.type} label={row.typeLabel} />
              <span>Bijgewerkt {formatDate(row.updatedAt)}</span>
              {row.amountLabel ? <strong>{row.amountLabel}</strong> : null}
            </div>
            <div className="mobile-card-actions">
              <a className="ui-button ui-button-secondary ui-button-sm" href={row.href}>
                Openen
              </a>
            </div>
          </div>
        )}
        rows={paginatedRows}
      />
      <PaginationControls
        label="Paginering voor dossierresultaten"
        page={safePage}
        pageSize={pageSize}
        totalItems={rows.length}
        onPageChange={setPage}
      />
    </section>
  );
}
