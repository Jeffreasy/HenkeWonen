import type { ReactNode } from "react";
import { classNames } from "../utils/classNames";
import { TableState } from "../utils/TableState";
import { Skeleton } from "../feedback/Skeleton";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  priority?: "primary" | "secondary" | "tertiary";
  hideOnMobile?: boolean;
  /** Extra class op de th/td van deze kolom (bijv. om actie-knoppen niet te laten wrappen). */
  cellClassName?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T) => string;
  renderMobileCard?: (row: T) => ReactNode;
  loading?: boolean;
  error?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  actions?: ReactNode;
  density?: "compact" | "comfortable";
  mobileMode?: "scroll" | "cards";
  ariaLabel: string;
};

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  renderMobileCard,
  loading = false,
  error,
  emptyTitle = "Geen regels gevonden",
  emptyDescription,
  actions,
  density = "comfortable",
  mobileMode = "scroll",
  ariaLabel
}: DataTableProps<T>) {
  const cellClassFor = (column: DataTableColumn<T>) =>
    classNames(
      column.hideOnMobile && "data-table-cell-mobile-hidden",
      column.align === "right" && "data-table-align-right",
      column.align === "center" && "data-table-align-center",
      column.priority && `data-table-priority-${column.priority}`,
      column.cellClassName
    );

  if (loading) {
    // Professionele loading-staat: dezelfde tabel met de échte kolomkoppen, maar de
    // rijen als shimmer-skeletons. Geen layout-sprong als de data binnenkomt. Breedtes
    // zijn deterministisch (Math.sin) zodat SSR en client identiek blijven (geen
    // hydration-mismatch).
    const skeletonRows = 6;
    const skeletonWidth = (column: DataTableColumn<T>, row: number, col: number) => {
      const base = column.align === "right" ? 42 : col === 0 || column.priority === "primary" ? 66 : 50;
      return `${Math.round(base + Math.sin(row * 1.7 + col) * 9)}%`;
    };
    const showMobileCardsLoading = mobileMode === "cards" && Boolean(renderMobileCard);

    return (
      <>
        <div className={classNames("data-table-wrap", showMobileCardsLoading && "data-table-wrap-card-mode")}>
          <table
            className={classNames("data-table", `data-table-${density}`)}
            aria-label={ariaLabel}
            aria-busy="true"
          >
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    className={cellClassFor(column)}
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    scope="col"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, row) => (
                <tr key={row}>
                  {columns.map((column, col) => (
                    <td className={cellClassFor(column)} key={column.key}>
                      <Skeleton
                        height={14}
                        width={skeletonWidth(column, row, col)}
                        style={{ display: "inline-block", maxWidth: "100%" }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showMobileCardsLoading ? (
          <div className="data-table-mobile-cards" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <article className="data-table-mobile-card" key={i}>
                <Skeleton height={15} width="55%" />
                <Skeleton height={12} width="38%" style={{ marginTop: "var(--space-2)" }} />
              </article>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (error) {
    return (
      <div className="data-table-state">
        <TableState state="error" title="Overzicht kon niet worden geladen" description={error} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="data-table-state">
        <TableState
          state="empty"
          title={emptyTitle}
          description={emptyDescription}
          action={actions}
        />
      </div>
    );
  }

  const useMobileCards = mobileMode === "cards" && Boolean(renderMobileCard);

  return (
    <>
    <div className={classNames("data-table-wrap", useMobileCards && "data-table-wrap-card-mode")}>
      <table
        className={classNames("data-table", `data-table-${density}`)}
        aria-label={ariaLabel}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={cellClassFor(column)}
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td className={cellClassFor(column)} key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {useMobileCards ? (
      <div className="data-table-mobile-cards" role="list" aria-label={`${ariaLabel} als kaarten`}>
        {rows.map((row) => (
          <article className="data-table-mobile-card" role="listitem" key={getRowKey(row)}>
            {renderMobileCard?.(row)}
          </article>
        ))}
      </div>
    ) : null}
    </>
  );
}
