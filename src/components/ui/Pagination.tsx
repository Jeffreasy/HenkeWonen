import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

type PaginationProps = {
  currentPage?: number;
  totalPages?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  label?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  label = "Paginatie"
}: PaginationProps) {
  const pageLabel =
    typeof currentPage === "number" && typeof totalPages === "number"
      ? `Pagina ${currentPage} van ${totalPages}`
      : label;

  return (
    <nav className="pagination" aria-label={label}>
      <Button
        leftIcon={<ChevronLeft size={16} aria-hidden="true" />}
        variant="secondary"
        size="sm"
        disabled={!hasPreviousPage}
        onClick={onPrevious}
      >
        Vorige
      </Button>
      <span className="pagination-label" aria-live="polite">
        {pageLabel}
      </span>
      <Button
        rightIcon={<ChevronRight size={16} aria-hidden="true" />}
        variant="secondary"
        size="sm"
        disabled={!hasNextPage}
        onClick={onNext}
      >
        Volgende
      </Button>
    </nav>
  );
}
