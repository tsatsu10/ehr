import type { BillOpsTab } from '@islands/bill-ops/billOpsTypes';
import { REPORT_TABS, type ReportTabId } from '@islands/daily-reports/reportsTypes';
import type { ReportHubCard } from './reportHubTypes';

export type ReportHubEmbedTarget =
  | { kind: 'daily_reports'; initialTab: ReportTabId }
  | { kind: 'bill_ops'; initialTab: BillOpsTab }
  | { kind: 'pharm_ops_reports' }
  | { kind: 'patient_registry' }
  | { kind: 'stock_iframe'; url: string };

const BILL_OPS_TABS: BillOpsTab[] = [
  'corrections',
  'payments',
  'close',
  'outstanding',
  'insurance',
];

export function resolveHref(webroot: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = webroot.replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

function isReportTabId(value: string): value is ReportTabId {
  return REPORT_TABS.some((tab) => tab.id === value);
}

function isBillOpsTab(value: string): value is BillOpsTab {
  return BILL_OPS_TABS.includes(value as BillOpsTab);
}

function parseModulePath(pathname: string): URL | null {
  try {
    return new URL(pathname, window.location.origin);
  } catch {
    return null;
  }
}

export function resolveHubEmbedTarget(
  card: ReportHubCard,
  webroot: string,
): ReportHubEmbedTarget | null {
  if (card.kind === 'placeholder' || card.url === '') {
    return null;
  }

  if (card.kind === 'stock') {
    return { kind: 'stock_iframe', url: resolveHref(webroot, card.url) };
  }

  const href = resolveHref(webroot, card.url);
  const url = parseModulePath(href);
  if (!url) return null;

  if (url.pathname.endsWith('/reports.php')) {
    const tabParam = url.searchParams.get('tab') ?? 'visits';
    const initialTab = isReportTabId(tabParam) ? tabParam : 'visits';
    return { kind: 'daily_reports', initialTab };
  }

  if (url.pathname.includes('/bill-ops/')) {
    const tabParam = url.searchParams.get('tab') ?? 'corrections';
    if (!isBillOpsTab(tabParam)) return null;
    return { kind: 'bill_ops', initialTab: tabParam };
  }

  if (url.pathname.includes('/pharm-ops/') && url.searchParams.get('tab') === 'reports') {
    return { kind: 'pharm_ops_reports' };
  }

  if (url.pathname.endsWith('/patient-registry.php')) {
    return { kind: 'patient_registry' };
  }

  return null;
}
