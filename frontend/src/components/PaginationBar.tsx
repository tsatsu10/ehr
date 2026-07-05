import { Button } from './ui/button';
import { cn } from '@/lib/utils';

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
      className="mt-3 flex items-center justify-between gap-2"
      id={id}
    >
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto shrink-0 p-0"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Prev
      </Button>
      <span className="flex-1 text-center text-sm text-[var(--oe-nc-text-muted)]">
        Showing {from}–{to} of {total}
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className={cn('h-auto shrink-0 p-0')}
        disabled={to >= total}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
