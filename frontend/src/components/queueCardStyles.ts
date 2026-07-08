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

/**
 * Shared queue card shell — React desks + Visit Board. Legacy JS keeps BEM in components.css.
 * Clinical Console: squared card, hairline border, department-colored left rail
 * (--oe-nc-role-accent is set per desk by the shell), navy hover tint.
 */
export function queueCardShellClass(
  options: QueueCardShellOptions = {},
  className?: string,
): string {
  return cn(
    'nc-queue-card mb-2 w-full rounded-[0.25rem] border border-[var(--oe-nc-border,#d3dce3)] border-l-[3px] border-l-[var(--oe-nc-role-accent,var(--oe-nc-primary,#1b3a5f))] bg-white px-3 py-2.5 text-left',
    'transition-[background,border-color,box-shadow] duration-150 hover:bg-[var(--oe-nc-primary-tint,#e8eef5)]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oe-nc-primary)]',
    options.urgent && '!border-l-[var(--oe-nc-danger,#b42318)] !bg-[#f9ecea]',
    options.active && '!border-[var(--oe-nc-primary,#1b3a5f)] !bg-[var(--oe-nc-primary-tint,#e8eef5)]',
    options.triageMine && '!border-l-[var(--oe-nc-cta,#047857)] !bg-[#e9f5f0]',
    options.mine && '!border-l-4 !border-l-[var(--oe-nc-primary,#1b3a5f)]',
    options.muted && 'opacity-65',
    options.claimLost && 'cursor-not-allowed opacity-55',
    options.disabled && 'cursor-not-allowed opacity-60',
    options.highlighted && 'shadow-[0_0_0_2px_rgba(27,58,95,0.35)]',
    className,
  );
}

export const queueCardRowClass = 'flex items-start gap-2.5';

export function queueCardAvatarClass(urgent?: boolean, claimLost?: boolean): string {
  return cn(
    'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--oe-nc-role-accent,var(--oe-nc-primary,#1b3a5f))] text-xs font-bold tracking-wide text-white',
    urgent && 'bg-[var(--oe-nc-danger,#b42318)]',
    claimLost && 'opacity-55',
  );
}

export const queueCardBodyClass = 'min-w-0 flex-1';
export const queueCardHeaderClass =
  'mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-snug';
export const queueCardQueueNumClass =
  'text-[0.8125rem] font-bold tabular-nums text-[var(--oe-nc-text-muted,#5b6b7b)]';
export const queueCardNameClass = 'text-[0.9375rem] font-semibold text-[var(--oe-nc-text,#1c2733)]';
export const queueCardMetaClass = 'mb-0.5 text-sm text-[var(--oe-nc-text-muted)] tabular-nums';
export const queueCardCcClass = 'mb-1 truncate text-sm text-[var(--oe-nc-text-muted)]';
export const queueCardFooterClass = 'mt-1.5';
export const queueCardStaleBadgeClass =
  'ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-[0.125rem] border border-[#ecd1ae] bg-[#faf1e4] px-1.5 py-0.5 text-[0.68rem] font-semibold leading-none text-[#8f3c06]';
