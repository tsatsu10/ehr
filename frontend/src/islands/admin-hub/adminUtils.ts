import { formatMoney, type CurrencyFormat } from '@core/formatMoney';
import type { AdminTabId } from './adminTypes';

export function profileLabel(profile: string): string {
  if (profile === 'lab_direct') return 'Lab direct';
  if (profile === 'pharmacy_walkin') return 'Pharmacy walk-in';
  return 'Full OPD';
}

export function formatPrice(
  amount: number | string | null | undefined,
  settings: Record<string, unknown>
): string {
  const format: CurrencyFormat = {
    currency_symbol: String(settings.currency_symbol ?? ''),
    currency_decimals: settings.currency_decimals !== undefined
      ? Number(settings.currency_decimals)
      : 2,
    currency_symbol_position: settings.currency_symbol_position === 'after' ? 'after' : 'before',
  };

  return formatMoney(amount, format);
}

/** ADM-3: 'queue' (the old Queue & roles mega-tab) split into 'queue-desks' + 'features'. */
const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  roles: 'people',
  queue: 'queue-desks',
};

export function initialAdminTab(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('tab');
  // The setup checklist used to be a scroll-anchor inside System, not its own
  // tab — an old `?tab=system#nc-admin-setup-checklist` link (runbook cards,
  // bookmarks) should still land on the checklist, not bare System.
  if (fromUrl === 'system' && window.location.hash === '#nc-admin-setup-checklist') {
    return 'setup';
  }
  if (fromUrl && fromUrl in LEGACY_TAB_REDIRECTS) {
    return LEGACY_TAB_REDIRECTS[fromUrl];
  }
  return fromUrl ?? 'queue-desks';
}

/** Shared by handleTabChange and the sidebar's real `<a href>`s so both stay in sync. */
export function buildAdminTabUrl(tab: AdminTabId): string {
  const url = new URL(window.location.href);
  if (tab !== 'queue-desks') {
    url.searchParams.set('tab', tab);
    if (tab !== 'people') {
      url.searchParams.delete('sub');
    }
  } else {
    url.searchParams.delete('tab');
    url.searchParams.delete('sub');
  }
  return url.toString();
}

export function localDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}
