import type { ReactNode } from "react";
import { classNames } from "./classNames";
import { TableState } from "./TableState";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  priority?: "primary" | "secondary" | "tertiary";
  hideOnMobile?: boolean;
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
  if (loading) {
    return (
      <div className="data-table-state">
        <TableState state="loading" title="Gegevens laden" description="De tabel wordt opgehaald." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-table-state">
        <TableState state="error" title="Tabel kon niet worden geladen" description={error} />
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
                className={classNames(
                  column.hideOnMobile && "data-table-cell-mobile-hidden",
                  column.align === "right" && "data-table-align-right",
                  column.align === "center" && "data-table-align-center",
                  column.priority && `data-table-priority-${column.priority}`
                )}
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
                <td
                  className={classNames(
                    column.hideOnMobile && "data-table-cell-mobile-hidden",
                    column.align === "right" && "data-table-align-right",
                    column.align === "center" && "data-table-align-center",
                    column.priority && `data-table-priority-${column.priority}`
                  )}
                  key={column.key}
                >
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
