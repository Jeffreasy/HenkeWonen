import { Filter } from "lucide-react";
import { Badge } from "../ui/data-display/Badge";
import { Field } from "../ui/forms/Field";
import { FilterBar } from "../ui/layout/FilterBar";
import { SearchInput } from "../ui/forms/SearchInput";
import { Select } from "../ui/forms/Select";
import { formatRecommendation } from "../../lib/i18n/statusLabels";
import { numberText } from "./catalog/catalogUtils";
import { STATUS_FILTERS } from "./catalog/catalogTypes";

export type IssueStatusFilter = "all" | "open" | "reviewed" | "accepted" | "resolved";

type DataIssuesFilterBarProps = {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  statusFilter: IssueStatusFilter;
  onStatusFilterChange: (s: IssueStatusFilter) => void;
  statusCounts: Record<IssueStatusFilter, number>;
  supplierFilter: string;
  onSupplierFilterChange: (s: string) => void;
  supplierOptions: string[];
  recommendationFilter: string;
  onRecommendationFilterChange: (r: string) => void;
  recommendationOptions: string[];
  filteredGroupsCount: number;
};


export function DataIssuesFilterBar({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  supplierFilter,
  onSupplierFilterChange,
  supplierOptions,
  recommendationFilter,
  onRecommendationFilterChange,
  recommendationOptions,
  filteredGroupsCount
}: DataIssuesFilterBarProps) {
  return (
    <FilterBar
      search={
        <SearchInput
          aria-label="Zoek in dubbele EAN-waarschuwingen"
          value={searchQuery}
          placeholder="Zoek leverancier, EAN, product, artikelnummer of bestand"
          onChange={onSearchQueryChange}
        />
      }
      filters={
        <>
          <Badge icon={<Filter size={14} aria-hidden="true" />}>Weergave</Badge>
          <div className="tabs issue-tabs">
            {STATUS_FILTERS.map((item) => (
              <button
                className={statusFilter === item.value ? "tab active" : "tab"}
                key={item.value}
                type="button"
                aria-pressed={statusFilter === item.value}
                onClick={() => onStatusFilterChange(item.value)}
              >
                <span>{item.label}</span>
                <span className="vat-tab-count">{numberText(statusCounts[item.value] ?? 0)}</span>
              </button>
            ))}
          </div>
          <Field label="Leverancier" htmlFor="issue-supplier-filter">
            <Select
              id="issue-supplier-filter"
              value={supplierFilter}
              onChange={(event) => onSupplierFilterChange(event.target.value)}
            >
              <option value="all">Alle leveranciers</option>
              {supplierOptions.map((supplier) => (
                <option value={supplier} key={supplier}>
                  {supplier}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Advies" htmlFor="issue-recommendation-filter">
            <Select
              id="issue-recommendation-filter"
              value={recommendationFilter}
              onChange={(event) => onRecommendationFilterChange(event.target.value)}
            >
              <option value="all">Alle adviezen</option>
              {recommendationOptions.map((recommendation) => (
                <option value={recommendation} key={recommendation}>
                  {formatRecommendation(recommendation)}
                </option>
              ))}
            </Select>
          </Field>
        </>
      }
      actions={<span className="muted">{numberText(filteredGroupsCount)} zichtbare groepen</span>}
    />
  );
}
