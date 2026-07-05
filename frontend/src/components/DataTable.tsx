import { useMemo, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { ncTableHoverClass, ncTableScrollWrapClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

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
  return (
    <>
      <div
        className={cn(
          'nc-data-table mb-0 w-full',
          ncTableScrollWrapClass,
          bordered && 'rounded-lg border border-[var(--oe-nc-border)]'
        )}
      >
        <Table
          id={id}
          className={cn(
            compact && 'text-xs [&_td]:py-1.5 [&_th]:h-8',
            hover && ncTableHoverClass
          )}
        >
          <TableHeader>{header}</TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
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
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={tone === 'danger' ? 'text-[var(--oe-nc-danger,#dc2626)]' : 'text-[var(--oe-nc-text-muted)]'}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

interface MatrixDataTableProps {
  id?: string;
  columns: string[];
  rows: string[][];
  hover?: boolean;
  compact?: boolean;
  bordered?: boolean;
  emptyMessage?: ReactNode;
  footer?: ReactNode;
}

/** TanStack-powered table for dynamic column matrices (report previews, exports). */
export function MatrixDataTable({
  id,
  columns,
  rows,
  hover = true,
  compact = true,
  bordered = false,
  emptyMessage = 'No rows.',
  footer,
}: MatrixDataTableProps) {
  const columnDefs = useMemo<ColumnDef<string[]>[]>(
    () => columns.map((label, index) => ({
      id: `col-${index}`,
      accessorFn: (row) => row[index] ?? '',
      header: label,
      cell: ({ getValue }) => getValue(),
    })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerGroup = table.getHeaderGroups()[0];

  return (
    <>
      <div
        className={cn(
          'nc-data-table mb-0 w-full',
          ncTableScrollWrapClass,
          bordered && 'rounded-lg border border-[var(--oe-nc-border)]'
        )}
      >
        <Table
          id={id}
          className={cn(
            compact && 'text-xs [&_td]:py-1.5 [&_th]:h-8',
            hover && ncTableHoverClass
          )}
        >
          <TableHeader>
            {headerGroup ? (
              <TableRow>
                {headerGroup.headers.map((headerCell) => (
                  <TableHead key={headerCell.id} scope="col">
                    {flexRender(headerCell.column.columnDef.header, headerCell.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ) : null}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <DataTableStatusRow colSpan={Math.max(columns.length, 1)}>
                {emptyMessage}
              </DataTableStatusRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {footer}
    </>
  );
}
