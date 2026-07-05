import { cn } from '@/lib/utils';

export interface QueueCardShellOptions {
  urgent?: boolean;
  active?: boolean;
  claimLost?: boolean;
  /** Doctor/cashier mine highlight — thicker primary left border */
  mine?: boolean;
  /** Triage — in triage with current nurse */
  triageMine?: boolean;
  muted?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
}

/** Shared queue card shell — React desks + Visit Board. Legacy JS keeps BEM in components.css. */
export function queueCardShellClass(
  options: QueueCardShellOptions = {},
  className?: string,
): string {
  return cn(
    'nc-queue-card mb-2 w-full rounded-lg border border-[#cbd5e1] border-l-[3px] border-l-[#2563eb] bg-white px-3 py-2.5 text-left',
    'transition-[background,border-color,box-shadow] duration-150 hover:bg-[#eff6ff]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oe-nc-primary)]',
    options.urgent && '!border-l-[#f59e0b] !bg-[#fffbeb]',
    options.active && '!border-[#2563eb] !bg-[#eff6ff]',
    options.triageMine && '!border-l-[var(--oe-nc-success,#059669)] !bg-[#f0fdf4]',
    options.mine && '!border-l-4 !border-l-[#2563eb]',
    options.muted && 'opacity-65',
    options.claimLost && 'cursor-not-allowed opacity-55',
    options.disabled && 'cursor-not-allowed opacity-60',
    options.highlighted && 'shadow-[0_0_0_2px_rgba(8,145,178,0.35)]',
    className,
  );
}

export const queueCardRowClass = 'flex items-start gap-2.5';

export function queueCardAvatarClass(urgent?: boolean, claimLost?: boolean): string {
  return cn(
    'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-xs font-bold tracking-wide text-white',
    urgent && 'bg-[#d97706]',
    claimLost && 'opacity-55',
  );
}

export const queueCardBodyClass = 'min-w-0 flex-1';
export const queueCardHeaderClass =
  'mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-snug';
export const queueCardQueueNumClass =
  'text-[0.8125rem] font-bold tabular-nums text-[#64748b]';
export const queueCardNameClass = 'text-[0.9375rem] font-semibold text-[#0f172a]';
export const queueCardMetaClass = 'mb-0.5 text-sm text-[var(--oe-nc-text-muted)]';
export const queueCardCcClass = 'mb-1 truncate text-sm text-[var(--oe-nc-text-muted)]';
export const queueCardFooterClass = 'mt-1.5';
export const queueCardStaleBadgeClass =
  'ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded border border-[#fde68a] bg-[#fef3c7] px-1.5 py-0.5 text-[0.68rem] font-semibold leading-none text-[#92400e]';
