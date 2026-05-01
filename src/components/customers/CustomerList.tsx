import { useMemo, useState } from "react";
import { formatCustomerStatus, formatCustomerType } from "../../lib/i18n/statusLabels";
import type { CustomerStatus, CustomerType, PortalCustomer } from "../../lib/portalTypes";
import { Badge } from "../ui/Badge";
import { DataTable, type DataTableColumn } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { FilterBar } from "../ui/FilterBar";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";
import { StatusBadge } from "../ui/StatusBadge";

type CustomerListProps = {
  customers: PortalCustomer[];
  isLoading?: boolean;
};

type StatusFilter = "all" | CustomerStatus;
type TypeFilter = "all" | CustomerType;

export default function CustomerList({ customers, isLoading = false }: CustomerListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          customer.displayName,
          customer.email,
          customer.phone,
          customer.city,
          customer.notes
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
      const matchesType = typeFilter === "all" || customer.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [customers, search, statusFilter, typeFilter]);

  const columns: Array<DataTableColumn<PortalCustomer>> = [
    {
      key: "name",
      header: "Klant",
      priority: "primary",
      render: (customer) => (
        <div className="stack-sm">
          <a href={`/portal/klanten/${customer.id}`}>
            <strong>{customer.displayName}</strong>
          </a>
          <Badge variant={customer.type === "business" ? "info" : "neutral"}>
            {formatCustomerType(customer.type)}
          </Badge>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (customer) => (
        <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
      )
    },
    {
      key: "contact",
      header: "Contact",
      render: (customer) => (
        <div className="stack-sm">
          <span>{customer.email ?? "-"}</span>
          <small className="muted">{customer.phone ?? "-"}</small>
        </div>
      )
    },
    {
      key: "city",
      header: "Plaats",
      width: "140px",
      hideOnMobile: true,
      render: (customer) => customer.city ?? "-"
    }
  ];

  return (
    <div className="grid">
      <FilterBar
        search={
          <SearchInput
            aria-label="Klanten zoeken"
            placeholder="Zoek op naam, mail, telefoon of plaats"
            value={search}
            onChange={setSearch}
          />
        }
        filters={
          <>
            <Field label="Status" htmlFor="customer-status-filter">
              <Select
                id="customer-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">Alle statussen</option>
                <option value="lead">Lead</option>
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
                <option value="archived">Gearchiveerd</option>
              </Select>
            </Field>
            <Field label="Type" htmlFor="customer-type-filter">
              <Select
                id="customer-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              >
                <option value="all">Alle klanttypen</option>
                <option value="private">Particulier</option>
                <option value="business">Zakelijk</option>
              </Select>
            </Field>
          </>
        }
      />
      <DataTable
        ariaLabel="Klanten"
        columns={columns}
        density="compact"
        emptyDescription="Maak een nieuwe klant aan of pas je filters aan."
        emptyTitle="Geen klanten gevonden"
        getRowKey={(customer) => customer.id}
        loading={isLoading}
        mobileMode="cards"
        renderMobileCard={(customer) => (
          <>
            <div className="mobile-card-header">
              <div className="mobile-card-title">
                <a href={`/portal/klanten/${customer.id}`}>
                  <strong>{customer.displayName}</strong>
                </a>
                <span className="muted">{customer.city ?? "Plaats onbekend"}</span>
              </div>
              <StatusBadge status={customer.status} label={formatCustomerStatus(customer.status)} />
            </div>
            <div className="mobile-card-meta">
              <Badge variant={customer.type === "business" ? "info" : "neutral"}>
                {formatCustomerType(customer.type)}
              </Badge>
              <span className="muted">{customer.email ?? "Geen e-mail"}</span>
              <span className="muted">{customer.phone ?? "Geen telefoon"}</span>
            </div>
            <div className="mobile-card-actions">
              <a className="button secondary" href={`/portal/klanten/${customer.id}`}>
                Open klantdossier
              </a>
            </div>
          </>
        )}
        rows={filteredCustomers}
      />
    </div>
  );
}
