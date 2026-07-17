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
 * Console 26: soft-rounded card, hairline border, department-colored left rail
 * (--oe-nc-role-accent is set per desk by the shell), blue hover tint.
 */
export function queueCardShellClass(
  options: QueueCardShellOptions = {},
  className?: string,
): string {
  return cn(
    'nc-queue-card mb-2 w-full rounded-[var(--oe-nc-radius,0.75rem)] border border-[var(--oe-nc-border,rgba(0,0,0,0.08))] border-l-[3px] border-l-[var(--oe-nc-role-accent,var(--oe-nc-primary,#0071e3))] bg-white px-3 py-2.5 text-left',
    'transition-[background,border-color,box-shadow] duration-150 hover:bg-[var(--oe-nc-primary-tint,#e8f1fc)]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oe-nc-primary)]',
    options.urgent && '!border-l-[var(--oe-nc-danger,#e0362c)] !bg-[#f9ecea]',
    options.active && '!border-[var(--oe-nc-primary,#0071e3)] !bg-[var(--oe-nc-primary-tint,#e8f1fc)]',
    options.triageMine && '!border-l-[var(--oe-nc-cta,#2bb350)] !bg-[#e9f5f0]',
    options.mine && '!border-l-4 !border-l-[var(--oe-nc-primary,#0071e3)]',
    options.muted && 'opacity-65',
    options.claimLost && 'cursor-not-allowed opacity-55',
    options.disabled && 'cursor-not-allowed opacity-60',
    options.highlighted && 'shadow-[0_0_0_2px_rgba(0,113,227,0.35)]',
    className,
  );
}

export const queueCardRowClass = 'flex items-start gap-2.5';

export function queueCardAvatarClass(urgent?: boolean, claimLost?: boolean): string {
  return cn(
    'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--oe-nc-role-accent,var(--oe-nc-primary,#0071e3))] text-xs font-bold tracking-wide text-white',
    urgent && 'bg-[var(--oe-nc-danger,#e0362c)]',
    claimLost && 'opacity-55',
  );
}

export const queueCardBodyClass = 'min-w-0 flex-1';
export const queueCardHeaderClass =
  'mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-snug';
export const queueCardQueueNumClass =
  'text-[0.8125rem] font-bold tabular-nums text-[var(--oe-nc-text-muted,#6e6e73)]';
export const queueCardNameClass = 'text-[0.9375rem] font-semibold text-[var(--oe-nc-text,#1d1d1f)]';
export const queueCardMetaClass = 'mb-0.5 text-sm text-[var(--oe-nc-text-muted)] tabular-nums';
export const queueCardCcClass = 'mb-1 truncate text-sm text-[var(--oe-nc-text-muted)]';
export const queueCardFooterClass = 'mt-1.5';
export const queueCardStaleBadgeClass =
  'ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#ecd1ae] bg-[#faf1e4] px-1.5 py-0.5 text-[0.68rem] font-semibold leading-none text-[#8f3c06]';
