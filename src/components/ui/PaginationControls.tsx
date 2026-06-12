import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label: string;
};

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  label
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <nav className="pagination-bar" aria-label={label}>
      <p className="pagination-summary">
        {start}-{end} van {totalItems}
      </p>
      <div className="pagination-actions">
        <Button
          disabled={safePage <= 1}
          leftIcon={<ChevronLeft size={16} aria-hidden="true" />}
          onClick={() => onPageChange(safePage - 1)}
          size="sm"
          variant="secondary"
        >
          Vorige
        </Button>
        <span className="pagination-page" aria-live="polite">
          Pagina {safePage} van {totalPages}
        </span>
        <Button
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          rightIcon={<ChevronRight size={16} aria-hidden="true" />}
          size="sm"
          variant="secondary"
        >
          Volgende
        </Button>
      </div>
    </nav>
  );
}
