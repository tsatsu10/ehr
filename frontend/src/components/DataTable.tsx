import type { ReactNode } from 'react';

interface DataTableProps {
  id?: string;
  hover?: boolean;
  bordered?: boolean;
  compact?: boolean;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function DataTable({
  id,
  hover = false,
  bordered = false,
  compact = true,
  header,
  footer,
  children,
}: DataTableProps) {
  const tableClass = [
    'table',
    compact && 'table-sm',
    hover && 'table-hover',
    bordered && 'table-bordered',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="table-responsive oe-nc-data-table">
        <table className={tableClass} id={id}>
          <thead>{header}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </>
  );
}

interface DataTableStatusRowProps {
  colSpan: number;
  tone?: 'muted' | 'danger';
  children: ReactNode;
}

export function DataTableStatusRow({ colSpan, tone = 'muted', children }: DataTableStatusRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={tone === 'danger' ? 'text-danger' : 'text-muted'}>
        {children}
      </td>
    </tr>
  );
}
