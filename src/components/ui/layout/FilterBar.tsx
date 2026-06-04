import type { ReactNode } from "react";

type FilterBarProps = {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function FilterBar({ search, filters, actions }: FilterBarProps) {
  return (
    <div className="filter-bar">
      {search ? <div className="filter-bar-search">{search}</div> : null}
      {filters ? <div className="filter-bar-filters">{filters}</div> : null}
      {actions ? <div className="filter-bar-actions">{actions}</div> : null}
    </div>
  );
}
