import { cn } from '@/lib/utils';

export const ncTableBorderedCellClass =
  '[&_td]:border [&_th]:border [&_td]:border-[var(--oe-nc-border)] [&_th]:border-[var(--oe-nc-border)] [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1';

export const ncTableHoverClass = '[&_tbody_tr:hover]:bg-[var(--oe-nc-bg-tint)]';

export const ncTableStripedClass = '[&_tbody_tr:nth-child(odd)]:bg-[var(--oe-nc-bg-tint)]';

export const ncTableSelectedRowClass = 'bg-[var(--oe-nc-bg-tint)]';

export const ncTableScrollWrapClass = 'overflow-x-auto';

export interface NcTableClassOptions {
  bordered?: boolean;
  hover?: boolean;
  striped?: boolean;
  className?: string;
}

/** Variant tokens for shadcn `Table` (base layout comes from the `Table` component). */
export function ncShadcnTableClass(options: NcTableClassOptions = {}): string {
  const { bordered = false, hover = false, striped = false, className } = options;
  return cn(
    bordered && ['border border-[var(--oe-nc-border)]', ncTableBorderedCellClass],
    hover && ncTableHoverClass,
    striped && ncTableStripedClass,
    className,
  );
}
