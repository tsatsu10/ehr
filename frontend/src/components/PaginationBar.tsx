interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  id?: string;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  id,
}: PaginationBarProps) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className="oe-nc-pagination-bar d-flex justify-content-between align-items-center"
      id={id}
    >
      <button
        type="button"
        className="btn btn-link btn-sm p-0 oe-nc-pagination-bar__btn"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Prev
      </button>
      <span className="oe-nc-pagination-bar__summary small text-muted">
        Showing {from}–{to} of {total}
      </span>
      <button
        type="button"
        className="btn btn-link btn-sm p-0 oe-nc-pagination-bar__btn"
        disabled={to >= total}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
