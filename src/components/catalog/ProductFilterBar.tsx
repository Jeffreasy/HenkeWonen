import { formatStatusLabel } from "../../lib/i18n/statusLabels";
import { Checkbox } from "../ui/forms/Checkbox";
import { Field } from "../ui/forms/Field";
import { FilterBar } from "../ui/layout/FilterBar";
import { SearchInput } from "../ui/forms/SearchInput";
import { Select } from "../ui/forms/Select";
import { type ProductStatus, PRODUCT_STATUSES } from "./catalog/catalogTypes";

type CategoryStat = {
  name: string;
  count: number;
  truncated?: boolean;
};

type ProductFilterBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  statusFilter: ProductStatus;
  onStatusFilterChange: (status: ProductStatus) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: CategoryStat[];
  includePilotHidden: boolean;
  onIncludePilotHiddenChange: (includePilotHidden: boolean) => void;
  canManageProducts: boolean;
};

function countLabel(count: number, truncated?: boolean) {
  return `${count}${truncated ? "+" : ""}`;
}

function categoryTotalLabel(categories: CategoryStat[]) {
  const count = categories.reduce((sum, item) => sum + item.count, 0);
  const truncated = categories.some((item) => item.truncated);

  return countLabel(count, truncated);
}

export function ProductFilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  category,
  onCategoryChange,
  categories,
  includePilotHidden,
  onIncludePilotHiddenChange,
  canManageProducts
}: ProductFilterBarProps) {
  return (
    <FilterBar
      search={
        <SearchInput
          aria-label="Zoek in catalogus"
          value={query}
          placeholder="Zoek op product, artikelnummer, kleur of leverancier"
          onChange={onQueryChange}
        />
      }
      filters={
        <>
          <Field label="Status" htmlFor="catalog-status-filter">
            <Select
              id="catalog-status-filter"
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as ProductStatus)}
            >
              {PRODUCT_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categorie" htmlFor="catalog-category-filter">
            <Select
              id="catalog-category-filter"
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="Alle">
                Alle ({categoryTotalLabel(categories)})
              </option>
              {categories.map((item) => (
                <option value={item.name} key={item.name}>
                  {item.name} ({countLabel(item.count, item.truncated)})
                </option>
              ))}
            </Select>
          </Field>
          {canManageProducts ? (
            <Checkbox
              checked={includePilotHidden}
              label="Verborgen pilotproducten tonen"
              aria-label="Verborgen pilotproducten tonen"
              description="Alleen voor importcontrole en beheer."
              onChange={(event) => onIncludePilotHiddenChange(event.target.checked)}
            />
          ) : null}
        </>
      }
    />
  );
}
